import { and, eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  candidacies,
  committees,
  elections,
  entities,
  externalIds,
  ingestRuns,
  moneyTransactions,
  relationships,
  sourceRecords,
  sources,
} from "@/db/schema";
import { apiError, normalizeName } from "@/lib/civic-data";
import {
  currentFecCycle,
  fecCandidateDisplayName,
  fecNumber,
  fecString,
  fetchFecCandidateBundles,
  sanitizedFecCandidate,
  sanitizedFecCommittee,
  sanitizedFecReceipt,
  type FecCandidateBundle,
} from "@/lib/fec";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function formatMoney(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function officeName(office: string | null, state: string | null, district: string | null) {
  if (office === "P") return "President of the United States";
  if (office === "S") return state ? `U.S. Senator — ${state}` : "U.S. Senator";
  if (office === "H") {
    if (!state) return "U.S. Representative";
    return district === "AL"
      ? `U.S. Representative — ${state} At Large`
      : `U.S. Representative — ${state} District ${district ?? "unknown"}`;
  }
  return "Federal office";
}

function normalizedDistrict(office: string | null, district: string | null) {
  if (office !== "H") return null;
  if (!district || district === "00") return "AL";
  return String(Number(district));
}

function candidateStatus(record: JsonRecord) {
  if (record.candidate_inactive === true) return "inactive";
  const status = fecString(record, "candidate_status");
  if (status === "C") return "filed";
  if (status === "F") return "future";
  if (status === "P") return "prior";
  if (status === "N") return "not_yet_candidate";
  return "reported";
}

function generalElectionDate(year: number) {
  for (let day = 2; day <= 8; day += 1) {
    const date = new Date(Date.UTC(year, 10, day));
    if (date.getUTCDay() === 2) return date.toISOString().slice(0, 10);
  }
  return null;
}

function candidateOfficialUrl(candidateId: string, cycle: number) {
  return `https://www.fec.gov/data/candidate/${encodeURIComponent(candidateId)}/?cycle=${cycle}&election_full=false`;
}

function committeeOfficialUrl(committeeId: string, cycle: number) {
  return `https://www.fec.gov/data/committee/${encodeURIComponent(committeeId)}/?cycle=${cycle}`;
}

function receiptsOfficialUrl(committeeId: string, cycle: number) {
  return `https://www.fec.gov/data/receipts/individual-contributions/?committee_id=${encodeURIComponent(committeeId)}&two_year_transaction_period=${cycle}`;
}

function transactionOfficialUrl(subId: string) {
  return `https://www.fec.gov/data/receipts/individual-contributions/?sub_id=${encodeURIComponent(subId)}`;
}

async function shortDigest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveCandidateEntity(
  record: JsonRecord,
  candidateId: string,
) {
  const db = getDb();
  const name = fecCandidateDisplayName(record);
  const state = fecString(record, "state");
  const office = fecString(record, "office");
  const district = normalizedDistrict(office, fecString(record, "district"));
  const conditions = [eq(entities.normalizedName, normalizeName(name))];
  if (state) conditions.push(eq(entities.stateCode, state));
  const matches = await db
    .select({
      id: entities.id,
      entityType: entities.entityType,
      district: entities.district,
    })
    .from(entities)
    .where(and(...conditions));
  const exactMatches = matches.filter(
    (match) =>
      match.entityType === "politician" &&
      (office !== "H" || match.district === district),
  );
  // Never silently choose between multiple plausible people. A candidate is
  // kept separate until the owner can review the ambiguous identity.
  const [known] = await db.select({ id: entities.id, entityType: entities.entityType })
    .from(externalIds).innerJoin(entities, eq(entities.id, externalIds.entityId))
    .where(and(eq(externalIds.sourceSystem, "fec"), eq(externalIds.externalId, candidateId))).limit(1);
  const exact = exactMatches.length === 1 ? exactMatches[0] : null;
  return {
    entityId: known?.id ?? exact?.id ?? `candidate:fec:${candidateId}`,
    matchedPolitician: known ? known.entityType === "politician" : Boolean(exact),
    identityMatchStatus:
      exactMatches.length === 1
        ? "verified"
        : exactMatches.length > 1
          ? "needs_review"
          : "unmatched",
    name,
    state,
    office,
    district,
  };
}

function electionIdentity(
  cycle: number,
  office: string | null,
  state: string | null,
  district: string | null,
) {
  const scope =
    office === "P"
      ? "president:us"
      : office === "S"
        ? `senate:${state ?? "unknown"}`
        : `house:${state ?? "unknown"}:${district ?? "unknown"}`;
  const name =
    office === "P"
      ? `${cycle} U.S. presidential election`
      : office === "S"
        ? `${cycle} U.S. Senate election — ${state ?? "unknown state"}`
        : `${cycle} U.S. House election — ${state ?? "unknown state"} ${district === "AL" ? "At Large" : `District ${district ?? "unknown"}`}`;
  return { id: `election:us:${cycle}:${scope}`, name };
}

type ReceiptWrite = {
  receipt: JsonRecord;
  candidateEntityId: string;
  candidateName: string;
  committeeEntityId: string;
  committeeName: string;
  committeeId: string;
  cycle: number;
  sourceId: string;
};

async function writeCandidate(
  bundle: FecCandidateBundle,
  now: string,
  receiptWrites: ReceiptWrite[],
) {
  const db = getDb();
  const identity = await resolveCandidateEntity(bundle.candidate, bundle.candidateId);
  const officialUrl = candidateOfficialUrl(bundle.candidateId, bundle.cycle);
  const sourceId = `fec:candidate:${bundle.candidateId}:${bundle.cycle}`;
  const party =
    fecString(bundle.candidate, "party_full") ??
    fecString(bundle.candidate, "party");
  const receipts = fecNumber(bundle.candidate, "receipts");
  const disbursements = fecNumber(bundle.candidate, "disbursements");
  const office = officeName(identity.office, identity.state, identity.district);
  const description = [
    `${bundle.cycle} FEC candidate record for ${office}.`,
    party ? `Party: ${party}.` : null,
    receipts !== null ? `Reported receipts: ${formatMoney(receipts)}.` : null,
    disbursements !== null
      ? `Reported disbursements: ${formatMoney(disbursements)}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  await db
    .insert(sources)
    .values({
      id: sourceId,
      sourceSystem: "fec",
      recordType: "candidate_finance_summary",
      publisher: "Federal Election Commission",
      title: `${identity.name} — ${bundle.cycle} candidate finance summary`,
      url: officialUrl,
      documentDate:
        fecString(bundle.candidate, "coverage_end_date") ??
        fecString(bundle.candidate, "last_file_date"),
      retrievedAt: now,
      coverageNote:
        "FEC candidate registration and reported financial totals. FEC filing status is not proof of ballot qualification, and totals can change through amendments and later filings.",
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        title: `${identity.name} — ${bundle.cycle} candidate finance summary`,
        url: officialUrl,
        documentDate:
          fecString(bundle.candidate, "coverage_end_date") ??
          fecString(bundle.candidate, "last_file_date"),
        retrievedAt: now,
      },
    });

  await db
    .insert(entities)
    .values({
      id: identity.entityId,
      entityType: identity.matchedPolitician ? "politician" : "candidate",
      canonicalName: identity.name,
      normalizedName: normalizeName(identity.name),
      jurisdictionLevel: "federal",
      stateCode: identity.state,
      district: identity.district,
      description,
      status: candidateStatus(bundle.candidate),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: entities.id,
      set: identity.matchedPolitician
        ? { updatedAt: now }
        : {
            canonicalName: identity.name,
            normalizedName: normalizeName(identity.name),
            stateCode: identity.state,
            district: identity.district,
            description,
            status: candidateStatus(bundle.candidate),
            updatedAt: now,
          },
    });

  await db
    .insert(externalIds)
    .values({
      entityId: identity.entityId,
      sourceSystem: "fec",
      externalId: bundle.candidateId,
      officialUrl,
      isPrimary: !identity.matchedPolitician,
      verifiedAt: now,
    })
    .onConflictDoUpdate({
      target: [externalIds.sourceSystem, externalIds.externalId],
      set: {
        entityId: identity.entityId,
        officialUrl,
        verifiedAt: now,
      },
    });

  await db
    .insert(sourceRecords)
    .values({
      id: `${sourceId}:summary`,
      sourceId,
      entityId: identity.entityId,
      externalId: `${bundle.candidateId}:${bundle.cycle}`,
      rawJson: JSON.stringify({
        kind: "fec_candidate_total",
        candidate: sanitizedFecCandidate(bundle.candidate),
        committeeError: bundle.committeeError,
      }),
      fetchedAt: now,
      transformedAt: now,
    })
    .onConflictDoUpdate({
      target: sourceRecords.id,
      set: {
        entityId: identity.entityId,
        rawJson: sql`excluded.raw_json`,
        fetchedAt: now,
        transformedAt: now,
      },
    });

  const election = electionIdentity(
    bundle.cycle,
    identity.office,
    identity.state,
    identity.district,
  );
  await db
    .insert(entities)
    .values({
      id: election.id,
      entityType: "election",
      canonicalName: election.name,
      normalizedName: normalizeName(election.name),
      jurisdictionLevel: "federal",
      stateCode: identity.state,
      district: identity.district,
      description:
        "Federal election-cycle record. FEC candidate status is tracked separately from official ballot qualification and certified results.",
      status: "upcoming",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: entities.id,
      set: { canonicalName: election.name, updatedAt: now },
    });

  await db
    .insert(elections)
    .values({
      entityId: election.id,
      officeName: office,
      stateCode: identity.state,
      district: identity.district,
      electionDate: generalElectionDate(bundle.cycle),
      cycle: bundle.cycle,
      electionType: "federal_general_cycle",
      stage: "filing",
      resultStatus: null,
    })
    .onConflictDoUpdate({
      target: elections.entityId,
      set: {
        officeName: office,
        electionDate: generalElectionDate(bundle.cycle),
        stage: "filing",
      },
    });

  await db
    .insert(candidacies)
    .values({
      id: `candidacy:${identity.entityId}:${election.id}`,
      candidateEntityId: identity.entityId,
      electionEntityId: election.id,
      party,
      status: candidateStatus(bundle.candidate),
      incumbent: fecString(bundle.candidate, "incumbent_challenge") === "I",
      ballotStatus: null,
      fecCandidateId: bundle.candidateId,
      sourceId,
    })
    .onConflictDoUpdate({
      target: [candidacies.candidateEntityId, candidacies.electionEntityId],
      set: {
        party,
        status: candidateStatus(bundle.candidate),
        incumbent: fecString(bundle.candidate, "incumbent_challenge") === "I",
        fecCandidateId: bundle.candidateId,
        sourceId,
      },
    });

  await db
    .insert(relationships)
    .values({
      id: `${identity.entityId}:candidate-in:${election.id}`,
      fromEntityId: identity.entityId,
      toEntityId: election.id,
      relationshipType: "candidate_in",
      description: `${identity.name} has an FEC candidate record for ${election.name}. This does not by itself establish ballot qualification.`,
      confidence: 1,
      evidenceClass: "source_fact",
      sourceId,
    })
    .onConflictDoUpdate({
      target: relationships.id,
      set: {
        description: `${identity.name} has an FEC candidate record for ${election.name}. This does not by itself establish ballot qualification.`,
        sourceId,
      },
    });

  for (const committeeBundle of bundle.committees) {
    const committee = committeeBundle.committee;
    const committeeId = fecString(committee, "committee_id");
    const committeeName = fecString(committee, "name");
    if (!committeeId || !committeeName) continue;
    const committeeEntityId = `committee:fec:${committeeId}`;
    const committeeUrl = committeeOfficialUrl(committeeId, bundle.cycle);
    const committeeSourceId = `fec:committee:${committeeId}:${bundle.cycle}`;

    await db
      .insert(sources)
      .values({
        id: committeeSourceId,
        sourceSystem: "fec",
        recordType: "committee_registration",
        publisher: "Federal Election Commission",
        title: committeeName,
        url: committeeUrl,
        documentDate: fecString(committee, "last_file_date"),
        retrievedAt: now,
        coverageNote:
          "FEC committee registration linked to a candidate. Committee relationships and designations can change by cycle.",
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          title: committeeName,
          url: committeeUrl,
          documentDate: fecString(committee, "last_file_date"),
          retrievedAt: now,
        },
      });

    await db
      .insert(entities)
      .values({
        id: committeeEntityId,
        entityType: "committee",
        canonicalName: committeeName,
        normalizedName: normalizeName(committeeName),
        jurisdictionLevel: "federal",
        stateCode: fecString(committee, "state"),
        description: [
          fecString(committee, "committee_type_full") ??
            fecString(committee, "committee_type"),
          fecString(committee, "designation_full") ??
            fecString(committee, "designation"),
        ]
          .filter(Boolean)
          .join(" · "),
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          canonicalName: committeeName,
          normalizedName: normalizeName(committeeName),
          description: [
            fecString(committee, "committee_type_full") ??
              fecString(committee, "committee_type"),
            fecString(committee, "designation_full") ??
              fecString(committee, "designation"),
          ]
            .filter(Boolean)
            .join(" · "),
          updatedAt: now,
        },
      });

    await db
      .insert(committees)
      .values({
        entityId: committeeEntityId,
        committeeType: fecString(committee, "committee_type"),
        designation: fecString(committee, "designation"),
        party:
          fecString(committee, "party_full") ?? fecString(committee, "party"),
        treasurer: fecString(committee, "treasurer_name"),
        fecCommitteeId: committeeId,
      })
      .onConflictDoUpdate({
        target: committees.entityId,
        set: {
          committeeType: fecString(committee, "committee_type"),
          designation: fecString(committee, "designation"),
          party:
            fecString(committee, "party_full") ?? fecString(committee, "party"),
          treasurer: fecString(committee, "treasurer_name"),
        },
      });

    await db
      .insert(externalIds)
      .values({
        entityId: committeeEntityId,
        sourceSystem: "fec",
        externalId: committeeId,
        officialUrl: committeeUrl,
        isPrimary: true,
        verifiedAt: now,
      })
      .onConflictDoUpdate({
        target: [externalIds.sourceSystem, externalIds.externalId],
        set: {
          entityId: committeeEntityId,
          officialUrl: committeeUrl,
          verifiedAt: now,
        },
      });

    await db
      .insert(sourceRecords)
      .values({
        id: `${committeeSourceId}:registration`,
        sourceId: committeeSourceId,
        entityId: committeeEntityId,
        externalId: `${committeeId}:${bundle.cycle}`,
        rawJson: JSON.stringify({
          kind: "fec_committee",
          committee: sanitizedFecCommittee(committee),
        }),
        fetchedAt: now,
        transformedAt: now,
      })
      .onConflictDoUpdate({
        target: sourceRecords.id,
        set: {
          rawJson: sql`excluded.raw_json`,
          fetchedAt: now,
          transformedAt: now,
        },
      });

    await db
      .insert(relationships)
      .values({
        id: `${identity.entityId}:authorized-committee:${committeeEntityId}`,
        fromEntityId: identity.entityId,
        toEntityId: committeeEntityId,
        relationshipType: "authorized_committee",
        description: `${committeeName} is reported by the FEC as an authorized or principal committee associated with ${identity.name} for this cycle.`,
        confidence: 1,
        evidenceClass: "source_fact",
        sourceId: committeeSourceId,
      })
      .onConflictDoUpdate({
        target: relationships.id,
        set: {
          description: `${committeeName} is reported by the FEC as an authorized or principal committee associated with ${identity.name} for this cycle.`,
          sourceId: committeeSourceId,
        },
      });

    const receiptsSourceId = `fec:schedule-a:${committeeId}:${bundle.cycle}`;
    await db
      .insert(sources)
      .values({
        id: receiptsSourceId,
        sourceSystem: "fec",
        recordType: "schedule_a_itemized_receipts",
        publisher: "Federal Election Commission",
        title: `${committeeName} — itemized individual receipts (${bundle.cycle})`,
        url: receiptsOfficialUrl(committeeId, bundle.cycle),
        documentDate: now.slice(0, 10),
        retrievedAt: now,
        coverageNote:
          "A bounded sample of the largest currently returned individual Schedule A receipts for this committee and cycle. It is not a complete donor total, and amended filings can change the record.",
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: { retrievedAt: now },
      });

    for (const receipt of committeeBundle.receipts) {
      receiptWrites.push({
        receipt,
        candidateEntityId: identity.entityId,
        candidateName: identity.name,
        committeeEntityId,
        committeeName,
        committeeId,
        cycle: bundle.cycle,
        sourceId: receiptsSourceId,
      });
    }
  }

  return {
    candidateEntityId: identity.entityId,
    committees: bundle.committees.length,
    committeeError: bundle.committeeError,
  };
}

async function writeReceipts(receiptWrites: ReceiptWrite[], now: string) {
  const db = getDb();
  const contributorEntities = new Map<string, typeof entities.$inferInsert>();
  const contributionEntities = new Map<string, typeof entities.$inferInsert>();
  const identifierRows = new Map<string, typeof externalIds.$inferInsert>();
  const sourceRecordRows = new Map<string, typeof sourceRecords.$inferInsert>();
  const moneyRows = new Map<string, typeof moneyTransactions.$inferInsert>();
  const relationshipRows = new Map<string, typeof relationships.$inferInsert>();

  for (const write of receiptWrites) {
    const receipt = sanitizedFecReceipt(write.receipt);
    const subId = fecString(receipt, "sub_id");
    const contributorName = fecString(receipt, "contributor_name");
    const amount = fecNumber(receipt, "contribution_receipt_amount");
    const rawDate = fecString(receipt, "contribution_receipt_date");
    if (!subId || !contributorName || amount === null || !rawDate) continue;

    const city = fecString(receipt, "contributor_city");
    const state = fecString(receipt, "contributor_state");
    const employer = fecString(receipt, "contributor_employer");
    const occupation = fecString(receipt, "contributor_occupation");
    const contributorExternalId = fecString(receipt, "contributor_id");
    const identityBasis = [
      normalizeName(contributorName),
      normalizeName(city ?? ""),
      state ?? "",
      normalizeName(employer ?? ""),
    ].join("|");
    const contributorEntityId = contributorExternalId
      ? `contributor:fec:${contributorExternalId}`
      : `contributor:fec:reported:${await shortDigest(identityBasis)}`;
    const contributionEntityId = `contribution:fec:${subId}`;
    const amountCents = Math.round(amount * 100);
    const date = rawDate.slice(0, 10);
    const contributorDescription = [
      "FEC-reported contributor identity.",
      employer ? `Employer: ${employer}.` : null,
      occupation ? `Occupation: ${occupation}.` : null,
      [city, state].filter(Boolean).length
        ? `Reported location: ${[city, state].filter(Boolean).join(", ")}.`
        : null,
      "Names are grouped conservatively; matching does not prove two filings refer to the same person.",
    ]
      .filter(Boolean)
      .join(" ");

    contributorEntities.set(contributorEntityId, {
      id: contributorEntityId,
      entityType: "contributor",
      canonicalName: contributorName,
      normalizedName: normalizeName(contributorName),
      jurisdictionLevel: "federal",
      stateCode: state,
      description: contributorDescription,
      status: "reported",
      updatedAt: now,
    });
    contributionEntities.set(contributionEntityId, {
      id: contributionEntityId,
      entityType: "contribution",
      canonicalName: `${formatMoney(amount)} from ${contributorName} to ${write.committeeName}`,
      normalizedName: normalizeName(
        `${contributorName} ${write.committeeName} ${amount} ${date}`,
      ),
      jurisdictionLevel: "federal",
      stateCode: state,
      description: `FEC Schedule A itemized receipt reported on ${date}. Candidate linkage comes through the recipient committee.`,
      status: "reported",
      updatedAt: now,
    });

    const officialUrl = transactionOfficialUrl(subId);
    identifierRows.set(contributionEntityId, {
      entityId: contributionEntityId,
      sourceSystem: "fec",
      externalId: subId,
      officialUrl,
      isPrimary: true,
      verifiedAt: now,
    });
    sourceRecordRows.set(contributionEntityId, {
      id: `${write.sourceId}:receipt:${subId}`,
      sourceId: write.sourceId,
      entityId: contributionEntityId,
      externalId: subId,
      rawJson: JSON.stringify({ kind: "fec_schedule_a_receipt", receipt }),
      fetchedAt: now,
      transformedAt: now,
    });
    moneyRows.set(contributionEntityId, {
      id: contributionEntityId,
      transactionType: "itemized_receipt",
      amountCents,
      transactionDate: date,
      contributorEntityId,
      committeeEntityId: write.committeeEntityId,
      candidateEntityId: write.candidateEntityId,
      memo: fecString(receipt, "memo_text"),
      fecTransactionId: subId,
      filingId: fecString(receipt, "file_number"),
      amendmentIndicator: fecString(receipt, "amendment_indicator"),
      sourceId: write.sourceId,
    });

    const madeId = `${contributorEntityId}:made:${contributionEntityId}`;
    relationshipRows.set(madeId, {
      id: madeId,
      fromEntityId: contributorEntityId,
      toEntityId: contributionEntityId,
      relationshipType: "made_contribution",
      description: `${contributorName} is the contributor name reported for this ${formatMoney(amount)} receipt.`,
      startDate: date,
      amountCents,
      confidence: contributorExternalId ? 1 : 0.75,
      evidenceClass: "source_fact",
      sourceId: write.sourceId,
    });
    const receivedId = `${contributionEntityId}:received-by:${write.committeeEntityId}`;
    relationshipRows.set(receivedId, {
      id: receivedId,
      fromEntityId: contributionEntityId,
      toEntityId: write.committeeEntityId,
      relationshipType: "received_by",
      description: `${write.committeeName} reported receiving this itemized contribution.`,
      startDate: date,
      amountCents,
      confidence: 1,
      evidenceClass: "source_fact",
      sourceId: write.sourceId,
    });
    const directId = `${contributorEntityId}:contributed-to:${write.committeeEntityId}:${subId}`;
    relationshipRows.set(directId, {
      id: directId,
      fromEntityId: contributorEntityId,
      toEntityId: write.committeeEntityId,
      relationshipType: "contributed_to",
      description: `${contributorName} was reported as contributing ${formatMoney(amount)} to ${write.committeeName}.`,
      startDate: date,
      amountCents,
      confidence: contributorExternalId ? 1 : 0.75,
      evidenceClass: "source_fact",
      sourceId: write.sourceId,
    });
    const candidateId = `${contributionEntityId}:committee-linked-candidate:${write.candidateEntityId}`;
    relationshipRows.set(candidateId, {
      id: candidateId,
      fromEntityId: contributionEntityId,
      toEntityId: write.candidateEntityId,
      relationshipType: "committee_linked_candidate",
      description: `This receipt was reported by a committee linked by the FEC to ${write.candidateName}; that linkage is context, not proof of donor intent or influence.`,
      startDate: date,
      amountCents,
      confidence: 1,
      evidenceClass: "source_fact",
      sourceId: write.sourceId,
    });
  }

  const entityRows = [
    ...contributorEntities.values(),
    ...contributionEntities.values(),
  ];
  for (const rows of chunks(entityRows, 7)) {
    await db
      .insert(entities)
      .values(rows)
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          canonicalName: sql`excluded.canonical_name`,
          normalizedName: sql`excluded.normalized_name`,
          description: sql`excluded.description`,
          status: sql`excluded.status`,
          updatedAt: now,
        },
      });
  }
  for (const rows of chunks([...identifierRows.values()], 10)) {
    await db
      .insert(externalIds)
      .values(rows)
      .onConflictDoUpdate({
        target: [externalIds.sourceSystem, externalIds.externalId],
        set: {
          entityId: sql`excluded.entity_id`,
          officialUrl: sql`excluded.official_url`,
          verifiedAt: now,
        },
      });
  }
  for (const rows of chunks([...sourceRecordRows.values()], 7)) {
    await db
      .insert(sourceRecords)
      .values(rows)
      .onConflictDoUpdate({
        target: sourceRecords.id,
        set: {
          entityId: sql`excluded.entity_id`,
          rawJson: sql`excluded.raw_json`,
          fetchedAt: now,
          transformedAt: now,
        },
      });
  }
  for (const rows of chunks([...moneyRows.values()], 6)) {
    await db
      .insert(moneyTransactions)
      .values(rows)
      .onConflictDoUpdate({
        target: moneyTransactions.id,
        set: {
          amountCents: sql`excluded.amount_cents`,
          transactionDate: sql`excluded.transaction_date`,
          contributorEntityId: sql`excluded.contributor_entity_id`,
          committeeEntityId: sql`excluded.committee_entity_id`,
          candidateEntityId: sql`excluded.candidate_entity_id`,
          memo: sql`excluded.memo`,
          filingId: sql`excluded.filing_id`,
          amendmentIndicator: sql`excluded.amendment_indicator`,
          sourceId: sql`excluded.source_id`,
        },
      });
  }
  for (const rows of chunks([...relationshipRows.values()], 5)) {
    await db
      .insert(relationships)
      .values(rows)
      .onConflictDoUpdate({
        target: relationships.id,
        set: {
          description: sql`excluded.description`,
          startDate: sql`excluded.start_date`,
          amountCents: sql`excluded.amount_cents`,
          confidence: sql`excluded.confidence`,
          sourceId: sql`excluded.source_id`,
        },
      });
  }

  return moneyRows.size;
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "Cross-origin writes are not allowed." },
      { status: 403 },
    );
  }

  try {
    const authorization = await authorizeIngestRequest(request);
    if (!authorization.ok) {
      return Response.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }
    if (!env.FEC_API_KEY) {
      return Response.json(
        { error: "The FEC API key is not configured." },
        { status: 503 },
      );
    }

    const requestUrl = new URL(request.url);
    const cycle = Math.min(
      Math.max(
        Number(requestUrl.searchParams.get("cycle") ?? currentFecCycle()) ||
          currentFecCycle(),
        1976,
      ),
      2100,
    );
    const limit = Math.min(
      Math.max(Number(requestUrl.searchParams.get("limit") ?? 10) || 10, 1),
      20,
    );
    const page = Math.max(1, Math.trunc(Number(requestUrl.searchParams.get("page"))) || 1);
    const db = getDb();
    const runId = `fec-candidates:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "fec_candidates_and_receipts",
      status: "running",
    });

    try {
      const { bundles, nextPage } = await fetchFecCandidateBundles(
        env.FEC_API_KEY,
        cycle,
        limit,
        page,
      );
      const now = new Date().toISOString();
      const receiptWrites: ReceiptWrite[] = [];
      const candidateResults = [];
      for (const bundle of bundles) {
        candidateResults.push(await writeCandidate(bundle, now, receiptWrites));
      }
      const receiptCount = await writeReceipts(receiptWrites, now);

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: bundles.length + receiptWrites.length,
          recordsWritten: bundles.length + receiptCount,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        requestedCycle: cycle,
        page,
        nextPage,
        candidatesWritten: bundles.length,
        committeesLinked: candidateResults.reduce(
          (sum, row) => sum + row.committees,
          0,
        ),
        itemizedReceiptsWritten: receiptCount,
        partialErrors: bundles.flatMap((bundle) => [
          ...(bundle.committeeError ? [bundle.committeeError] : []),
          ...bundle.committees.flatMap((committee) => committee.receiptError ? [committee.receiptError] : []),
        ]),
      });
    } catch (error) {
      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "failed",
          errorText: apiError(error),
        })
        .where(eq(ingestRuns.id, runId));
      throw error;
    }
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
