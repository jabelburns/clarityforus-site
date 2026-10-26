import { desc, eq, inArray, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  analyses,
  analysisFindings,
  bills,
  candidacies,
  caseChallenges,
  committees,
  courtCases,
  elections,
  entities,
  entityAliases,
  externalIds,
  memberVotes,
  moneyTransactions,
  offices,
  relationships,
  sourceRecords,
  sources,
  votes as rollCallVotes,
} from "@/db/schema";
import { apiError, publicEntityType } from "@/lib/civic-data";
import { hasBillAnalysisProvider } from "@/lib/bill-analysis";
import { fecCommitteeCategory } from "@/lib/fec";
import { compareAnalysisVersion, normalizeBillTextVersions } from "@/lib/bill-text-versions.mts";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function arrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stripMarkup(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSnapshot(rawJson: string) {
  try {
    return objectValue(JSON.parse(rawJson));
  } catch {
    return {};
  }
}

function actionRecord(record: JsonRecord) {
  return {
    date: stringValue(record.actionDate ?? record.date),
    text: stripMarkup(record.text ?? record.description),
    type: stringValue(record.type),
  };
}

function congressBillEvidence(snapshot: JsonRecord | undefined) {
  if (!snapshot) return null;
  const summaries = arrayValue(snapshot.summaries)
    .map((summary) => ({
      date: stringValue(summary.updateDate ?? summary.actionDate),
      versionCode: stringValue(summary.versionCode),
      text: stripMarkup(summary.text),
    }))
    .filter((summary) => summary.text)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const inventory = normalizeBillTextVersions(snapshot.textVersions, {
    reportedCount: objectValue(objectValue(snapshot.bill).textVersions).count,
    endpointErrors: snapshot.endpointErrors,
  });
  const textVersions = inventory.versions.map((version) => ({
    key: version.key,
    date: version.date,
    type: version.label,
    formats: version.formats,
  }));

  return {
    actions: arrayValue(snapshot.actions)
      .map(actionRecord)
      .filter((action) => action.text)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 30),
    latestSummary: summaries[0] ?? null,
    summaries,
    textVersions,
    textCoverage: {
      importedCount: inventory.importedCount,
      reportedCount: inventory.reportedCount,
      partial: inventory.partial,
      warnings: inventory.warnings,
    },
    amendments: arrayValue(snapshot.amendments).map((amendment) => ({
      congress: numberValue(amendment.congress),
      type: stringValue(amendment.type),
      number: stringValue(amendment.number),
      description: stripMarkup(amendment.description),
      latestAction: actionRecord(objectValue(amendment.latestAction)),
    })),
    committees: arrayValue(snapshot.committees).map((committee) => ({
      name: stringValue(committee.name),
      chamber: stringValue(committee.chamber),
      type: stringValue(committee.type),
      systemCode: stringValue(committee.systemCode),
    })),
    endpointErrors: Array.isArray(snapshot.endpointErrors)
      ? snapshot.endpointErrors.filter(
          (message): message is string => typeof message === "string",
        )
      : [],
  };
}

function fecCandidateEvidence(snapshot: JsonRecord | undefined) {
  if (!snapshot) return null;
  const candidate = objectValue(snapshot.candidate);
  return {
    cycle: numberValue(candidate.cycle),
    office: stringValue(candidate.office_full ?? candidate.office),
    party: stringValue(candidate.party_full ?? candidate.party),
    incumbentStatus: stringValue(
      candidate.incumbent_challenge_full ?? candidate.incumbent_challenge,
    ),
    coverageStart: stringValue(candidate.coverage_start_date),
    coverageEnd: stringValue(candidate.coverage_end_date),
    receipts: numberValue(candidate.receipts),
    disbursements: numberValue(candidate.disbursements),
    cashOnHand: numberValue(candidate.cash_on_hand_end_period),
    debt: numberValue(candidate.debts_owed_by_committee),
    itemizedIndividualContributions: numberValue(
      candidate.individual_itemized_contributions,
    ),
    otherCommitteeContributions: numberValue(
      candidate.other_political_committee_contributions,
    ),
    federalFundsFlag: candidate.federal_funds_flag === true,
    committeeError: stringValue(snapshot.committeeError),
  };
}

function fecCommitteeEvidence(snapshot: JsonRecord | undefined) {
  if (!snapshot) return null;
  const committee = objectValue(snapshot.committee);
  return {
    category: fecCommitteeCategory(committee.committee_type),
    type: stringValue(committee.committee_type_full ?? committee.committee_type),
    designation: stringValue(
      committee.designation_full ?? committee.designation,
    ),
    organizationType: stringValue(
      committee.organization_type_full ?? committee.organization_type,
    ),
    party: stringValue(committee.party_full ?? committee.party),
    filingFrequency: stringValue(committee.filing_frequency),
    treasurer: stringValue(committee.treasurer_name),
    firstFiled: stringValue(committee.first_file_date),
    lastFiled: stringValue(committee.last_file_date),
  };
}

function fecIndependentExpenditureEvidence(snapshot: JsonRecord | undefined) {
  if (!snapshot) return null;
  const expenditure = objectValue(snapshot.expenditure);
  const indicator = stringValue(expenditure.support_oppose_indicator);
  return {
    committeeName: stringValue(expenditure.committee_name),
    candidateName: stringValue(expenditure.candidate_name),
    position:
      indicator === "S"
        ? "Support"
        : indicator === "O"
          ? "Oppose"
          : "Not reported",
    amount: numberValue(expenditure.expenditure_amount),
    date: stringValue(
      expenditure.expenditure_date ?? expenditure.dissemination_date,
    ),
    payee: stringValue(expenditure.payee_name),
    purpose: stringValue(
      expenditure.expenditure_description ?? expenditure.memo_text,
    ),
    amendmentIndicator: stringValue(expenditure.amendment_indicator),
    filingId: stringValue(expenditure.file_number),
  };
}

function fecReceiptEvidence(snapshot: JsonRecord | undefined) {
  if (!snapshot) return null;
  const receipt = objectValue(snapshot.receipt);
  return {
    contributorName: stringValue(receipt.contributor_name),
    city: stringValue(receipt.contributor_city),
    state: stringValue(receipt.contributor_state),
    employer: stringValue(receipt.contributor_employer),
    occupation: stringValue(receipt.contributor_occupation),
    amount: numberValue(receipt.contribution_receipt_amount),
    date: stringValue(receipt.contribution_receipt_date),
    memo: stringValue(receipt.memo_text),
    amendmentIndicator: stringValue(receipt.amendment_indicator),
    filingId: stringValue(receipt.file_number),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const entityId = decodeURIComponent(id);
    const db = getDb();
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);
    if (!entity) {
      return Response.json({ error: "Record not found." }, { status: 404 });
    }

    const [aliases, identifiers, links, analysisRows, snapshots] =
      await Promise.all([
        db
          .select()
          .from(entityAliases)
          .where(eq(entityAliases.entityId, entityId)),
        db.select().from(externalIds).where(eq(externalIds.entityId, entityId)),
        db
          .select()
          .from(relationships)
          .where(
            or(
              eq(relationships.fromEntityId, entityId),
              eq(relationships.toEntityId, entityId),
            ),
          ),
        db.select().from(analyses).where(eq(analyses.subjectEntityId, entityId)),
        db
          .select()
          .from(sourceRecords)
          .where(eq(sourceRecords.entityId, entityId))
          .orderBy(desc(sourceRecords.fetchedAt)),
      ]);

    const [officeRows, recentVotes, votePositions, billVotes, billRows] =
      await Promise.all([
        entity.entityType === "office"
          ? db.select().from(offices).where(eq(offices.entityId, entityId)).limit(1)
          : Promise.resolve([]),
        entity.entityType === "politician" || entity.entityType === "candidate"
          ? db
              .select({
                id: memberVotes.id,
                position: memberVotes.position,
                voteEntityId: memberVotes.voteEntityId,
                congress: rollCallVotes.congress,
                chamber: rollCallVotes.chamber,
                session: rollCallVotes.session,
                rollNumber: rollCallVotes.rollNumber,
                voteDate: rollCallVotes.voteDate,
                question: rollCallVotes.question,
                description: rollCallVotes.description,
                result: rollCallVotes.result,
                officialUrl: rollCallVotes.officialUrl,
              })
              .from(memberVotes)
              .innerJoin(
                rollCallVotes,
                eq(memberVotes.voteEntityId, rollCallVotes.entityId),
              )
              .where(eq(memberVotes.personEntityId, entityId))
              .orderBy(
                desc(rollCallVotes.voteDate),
                desc(rollCallVotes.rollNumber),
              )
              .limit(25)
          : Promise.resolve([]),
        entity.entityType === "vote"
          ? db
              .select({
                id: memberVotes.id,
                personEntityId: memberVotes.personEntityId,
                position: memberVotes.position,
                name: entities.canonicalName,
                stateCode: entities.stateCode,
                district: entities.district,
              })
              .from(memberVotes)
              .innerJoin(entities, eq(memberVotes.personEntityId, entities.id))
              .where(eq(memberVotes.voteEntityId, entityId))
              .orderBy(memberVotes.position, entities.canonicalName)
              .limit(500)
          : Promise.resolve([]),
        entity.entityType === "bill"
          ? db
              .select()
              .from(rollCallVotes)
              .where(eq(rollCallVotes.billEntityId, entityId))
              .orderBy(
                desc(rollCallVotes.voteDate),
                desc(rollCallVotes.rollNumber),
              )
              .limit(50)
          : Promise.resolve([]),
        entity.entityType === "bill"
          ? db.select().from(bills).where(eq(bills.entityId, entityId)).limit(1)
          : Promise.resolve([]),
      ]);

    const [
      electionRows,
      committeeRows,
      candidacyRows,
      transactionRows,
      courtCaseRows,
      caseChallengeRows,
    ] =
      await Promise.all([
        entity.entityType === "election"
          ? db
              .select()
              .from(elections)
              .where(eq(elections.entityId, entityId))
              .limit(1)
          : Promise.resolve([]),
        entity.entityType === "committee"
          ? db
              .select()
              .from(committees)
              .where(eq(committees.entityId, entityId))
              .limit(1)
          : Promise.resolve([]),
        entity.entityType === "election"
          ? db
              .select()
              .from(candidacies)
              .where(eq(candidacies.electionEntityId, entityId))
          : entity.entityType === "politician" || entity.entityType === "candidate"
            ? db
                .select()
                .from(candidacies)
                .where(eq(candidacies.candidateEntityId, entityId))
            : Promise.resolve([]),
        entity.entityType === "contribution" ||
        entity.entityType === "independent_expenditure"
          ? db
              .select()
              .from(moneyTransactions)
              .where(eq(moneyTransactions.id, entityId))
              .limit(1)
          : entity.entityType === "contributor"
            ? db
                .select()
                .from(moneyTransactions)
                .where(eq(moneyTransactions.contributorEntityId, entityId))
                .orderBy(desc(moneyTransactions.transactionDate))
                .limit(50)
            : entity.entityType === "committee"
              ? db
                  .select()
                  .from(moneyTransactions)
                  .where(eq(moneyTransactions.committeeEntityId, entityId))
                  .orderBy(desc(moneyTransactions.transactionDate))
                  .limit(50)
              : entity.entityType === "politician" ||
                  entity.entityType === "candidate"
                ? db
                    .select()
                    .from(moneyTransactions)
                    .where(eq(moneyTransactions.candidateEntityId, entityId))
                    .orderBy(desc(moneyTransactions.transactionDate))
                    .limit(50)
                : Promise.resolve([]),
        entity.entityType === "court_case"
          ? db
              .select()
              .from(courtCases)
              .where(eq(courtCases.entityId, entityId))
              .limit(1)
          : Promise.resolve([]),
        entity.entityType === "court_case"
          ? db
              .select()
              .from(caseChallenges)
              .where(eq(caseChallenges.caseEntityId, entityId))
          : entity.entityType === "bill" ||
              entity.entityType === "executive_order"
            ? db
                .select()
                .from(caseChallenges)
                .where(eq(caseChallenges.challengedEntityId, entityId))
            : Promise.resolve([]),
      ]);

    const relatedIds = [
      ...new Set(links.flatMap((link) => [link.fromEntityId, link.toEntityId])),
    ].filter((relatedId) => relatedId !== entityId);
    const candidacyEntityIds = candidacyRows.flatMap((row) => [
      row.candidateEntityId,
      row.electionEntityId,
    ]);
    const transactionEntityIds = transactionRows.flatMap((row) => [
      row.id,
      row.contributorEntityId,
      row.committeeEntityId,
      row.candidateEntityId,
    ]);
    const legalLinkEntityIds = caseChallengeRows.flatMap((row) => [
      row.caseEntityId,
      row.challengedEntityId,
    ]);
    const detailEntityIds = [
      ...new Set(
        [
          ...relatedIds,
          ...candidacyEntityIds,
          ...transactionEntityIds,
          ...legalLinkEntityIds,
        ].filter((value): value is string => Boolean(value)),
      ),
    ];
    const relatedEntities = detailEntityIds.length
      ? await db.select().from(entities).where(inArray(entities.id, detailEntityIds))
      : [];
    const relatedById = new Map(
      relatedEntities.map((related) => [related.id, related]),
    );

    const transactionIdentifiers = transactionRows.length
      ? await db
          .select()
          .from(externalIds)
          .where(inArray(externalIds.entityId, transactionRows.map((row) => row.id)))
      : [];
    const transactionUrlById = new Map(
      transactionIdentifiers.map((identifier) => [
        identifier.entityId,
        identifier.officialUrl,
      ]),
    );

    const analysisIds = analysisRows.map((analysis) => analysis.id);
    const findings = analysisIds.length
      ? await db
          .select()
          .from(analysisFindings)
          .where(inArray(analysisFindings.analysisId, analysisIds))
      : [];

    const parsedSnapshots = snapshots.map((snapshot) => ({
      ...snapshot,
      parsed: parseSnapshot(snapshot.rawJson),
    }));
    const congressSnapshot = parsedSnapshots.find(
      (snapshot) => snapshot.parsed.kind === "congress_bill_bundle",
    );
    const billVersionInventory = congressSnapshot
      ? normalizeBillTextVersions(congressSnapshot.parsed.textVersions, {
          reportedCount: objectValue(objectValue(congressSnapshot.parsed.bill).textVersions).count,
          endpointErrors: congressSnapshot.parsed.endpointErrors,
        })
      : null;
    const latestBillAnalysis = entity.entityType === "bill"
      ? analysisRows.filter((row) => row.analysisType === "bill_explanation")
          .sort((a, b) => b.analysisVersion - a.analysisVersion)[0]
      : null;
    const analysisVersionReference = latestBillAnalysis
      ? parsedSnapshots.find((row) => row.id === `${latestBillAnalysis.id}:text-reference`)?.parsed
      : null;
    const aiTextVersionStatus = latestBillAnalysis
      ? compareAnalysisVersion(billVersionInventory ?? { versions: [], reportedCount: null, importedCount: 0, partial: true, warnings: [] },
          analysisVersionReference)
      : "not_generated";
    const fecCandidateSnapshot = parsedSnapshots.find(
      (snapshot) => snapshot.parsed.kind === "fec_candidate_total",
    );
    const fecCommitteeSnapshot = parsedSnapshots.find(
      (snapshot) => snapshot.parsed.kind === "fec_committee",
    );
    const fecReceiptSnapshot = parsedSnapshots.find(
      (snapshot) => snapshot.parsed.kind === "fec_schedule_a_receipt",
    );
    const fecIndependentExpenditureSnapshot = parsedSnapshots.find(
      (snapshot) =>
        snapshot.parsed.kind === "fec_schedule_e_independent_expenditure",
    );

    const sourceIds = [
      ...new Set([
        ...links.map((link) => link.sourceId),
        ...snapshots.map((snapshot) => snapshot.sourceId),
        ...findings.flatMap((finding) =>
          finding.sourceId ? [finding.sourceId] : [],
        ),
        ...billRows.flatMap((row) => (row.sourceId ? [row.sourceId] : [])),
        ...courtCaseRows.flatMap((row) =>
          row.sourceId ? [row.sourceId] : [],
        ),
        ...caseChallengeRows.flatMap((row) =>
          row.sourceId ? [row.sourceId] : [],
        ),
      ]),
    ];
    const evidence = sourceIds.length
      ? await db.select().from(sources).where(inArray(sources.id, sourceIds))
      : [];

    return Response.json({
      record: { ...entity, type: publicEntityType(entity.entityType) },
      aliases,
      identifiers,
      relationships: links.map((link) => ({
        ...link,
        relatedEntity:
          relatedById.get(
            link.fromEntityId === entityId ? link.toEntityId : link.fromEntityId,
          ) ?? null,
        direction: link.fromEntityId === entityId ? "outgoing" : "incoming",
      })),
      analyses: analysisRows.map((analysis) => ({
        ...analysis,
        findings: findings.filter(
          (finding) => finding.analysisId === analysis.id,
        ),
      })),
      evidence,
      sourceSnapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        sourceId: snapshot.sourceId,
        externalId: snapshot.externalId,
        fetchedAt: snapshot.fetchedAt,
        transformedAt: snapshot.transformedAt,
        kind: stringValue(parseSnapshot(snapshot.rawJson).kind),
      })),
      quality: {
        identifierCount: identifiers.length,
        sourceCount: evidence.length,
        relationshipCount: links.length,
        evidenceClasses: links.reduce<Record<string, number>>((counts, link) => {
          counts[link.evidenceClass] = (counts[link.evidenceClass] ?? 0) + 1;
          return counts;
        }, {}),
        latestSourceAt:
          snapshots
            .map((snapshot) => snapshot.fetchedAt)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null,
        coverageNotes: evidence
          .map((source) => source.coverageNote)
          .filter((note): note is string => Boolean(note)),
      },
      details: {
        office: officeRows[0] ?? null,
        bill: billRows[0] ?? null,
        election: electionRows[0] ?? null,
        committee: committeeRows[0] ?? null,
        courtCase: courtCaseRows[0] ?? null,
        candidacies: candidacyRows.map((row) => ({
          ...row,
          candidate: relatedById.get(row.candidateEntityId) ?? null,
          election: relatedById.get(row.electionEntityId) ?? null,
        })),
        recentVotes,
        votePositions,
        relatedVotes: billVotes,
        money: transactionRows.map((row) => ({
          ...row,
          contributor: row.contributorEntityId
            ? relatedById.get(row.contributorEntityId) ?? null
            : null,
          committee: row.committeeEntityId
            ? relatedById.get(row.committeeEntityId) ?? null
            : null,
          candidate: row.candidateEntityId
            ? relatedById.get(row.candidateEntityId) ?? null
            : null,
          contribution: relatedById.get(row.id) ?? null,
          officialUrl: transactionUrlById.get(row.id) ?? null,
        })),
        legalLinks: caseChallengeRows.map((row) => ({
          ...row,
          case: relatedById.get(row.caseEntityId) ??
            (row.caseEntityId === entityId ? entity : null),
          challengedRecord:
            relatedById.get(row.challengedEntityId) ??
            (row.challengedEntityId === entityId ? entity : null),
        })),
        billEvidence: congressBillEvidence(congressSnapshot?.parsed),
        aiTextVersionStatus,
        financeSummary: fecCandidateEvidence(fecCandidateSnapshot?.parsed),
        committeeEvidence: fecCommitteeEvidence(fecCommitteeSnapshot?.parsed),
        receiptEvidence: fecReceiptEvidence(fecReceiptSnapshot?.parsed),
        independentExpenditureEvidence: fecIndependentExpenditureEvidence(
          fecIndependentExpenditureSnapshot?.parsed,
        ),
        aiConfigured: hasBillAnalysisProvider(env),
      },
    });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
