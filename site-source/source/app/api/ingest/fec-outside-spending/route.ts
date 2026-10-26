import { and, eq, inArray, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  committees,
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
  fecCommitteeCategory,
  fecNumber,
  fecString,
  fetchFecIndependentExpenditures,
  sanitizedFecCommittee,
  sanitizedFecIndependentExpenditure,
} from "@/lib/fec";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function reportedCandidateName(record: JsonRecord) {
  const reported = fecString(record, "candidate_name") ?? "Unnamed candidate";
  const [last, first] = reported.split(",", 2).map((part) => part.trim());
  return first ? `${first} ${last}` : reported;
}

function spendingPosition(record: JsonRecord) {
  const indicator = fecString(record, "support_oppose_indicator");
  if (indicator === "S") return { verb: "support", label: "Supports" };
  if (indicator === "O") return { verb: "oppose", label: "Opposes" };
  return { verb: "mention", label: "Position not reported" };
}

function committeeOfficialUrl(committeeId: string, cycle: number) {
  return `https://www.fec.gov/data/committee/${encodeURIComponent(committeeId)}/?cycle=${cycle}`;
}

function candidateOfficialUrl(candidateId: string, cycle: number) {
  return `https://www.fec.gov/data/candidate/${encodeURIComponent(candidateId)}/?cycle=${cycle}&election_full=false`;
}

function independentExpenditureUrl(
  cycle: number,
  committeeId: string,
  candidateId: string,
) {
  const parameters = new URLSearchParams({
    data_type: "processed",
    committee_id: committeeId,
    candidate_id: candidateId,
    two_year_transaction_period: String(cycle),
  });
  return `https://www.fec.gov/data/independent-expenditures/?${parameters}`;
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
      Math.max(Number(requestUrl.searchParams.get("limit") ?? 24) || 24, 1),
      50,
    );
    const page = Math.max(
      1,
      Math.trunc(Number(requestUrl.searchParams.get("page"))) || 1,
    );
    const db = getDb();
    const runId = `fec-outside-spending:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "fec_independent_expenditures",
      status: "running",
    });

    try {
      const { bundles, nextPage, nextItemOffset, maxDate } = await fetchFecIndependentExpenditures(
        env.FEC_API_KEY,
        cycle,
        limit,
        page,
        {
          itemOffset: Math.max(0, Math.trunc(Number(requestUrl.searchParams.get("itemOffset"))) || 0),
          batchSize: 10,
          maxDate: requestUrl.searchParams.get("maxDate") ?? undefined,
        },
      );
      const now = new Date().toISOString();
      const candidateIds = [
        ...new Set(
          bundles
            .map(({ expenditure }) => fecString(expenditure, "candidate_id"))
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const knownCandidateIds = candidateIds.length
        ? await db
            .select()
            .from(externalIds)
            .where(
              and(
                eq(externalIds.sourceSystem, "fec"),
                inArray(externalIds.externalId, candidateIds),
              ),
            )
        : [];
      const candidateEntityByFecId = new Map(
        knownCandidateIds.map((row) => [row.externalId, row.entityId]),
      );
      const scheduleSourceId = `fec:schedule-e:${cycle}`;
      const scheduleUrl = `https://www.fec.gov/data/independent-expenditures/?data_type=processed&two_year_transaction_period=${cycle}`;

      await db
        .insert(sources)
        .values({
          id: scheduleSourceId,
          sourceSystem: "fec",
          recordType: "schedule_e_independent_expenditure",
          publisher: "Federal Election Commission",
          title: `Independent expenditures — ${cycle} cycle`,
          url: scheduleUrl,
          documentDate: now.slice(0, 10),
          retrievedAt: now,
          coverageNote:
            "A bounded set of recently reported non-notice Schedule E line items. Independent expenditures support or oppose candidates but are not contributions to candidates and are reported as not coordinated with candidate campaigns. Amended filings can change the record.",
        })
        .onConflictDoUpdate({
          target: sources.id,
          set: { retrievedAt: now, documentDate: now.slice(0, 10) },
        });

      let written = 0;
      const partialErrors: string[] = [];
      for (const bundle of bundles) {
        const expenditure = sanitizedFecIndependentExpenditure(
          bundle.expenditure,
        );
        const subId = fecString(expenditure, "sub_id");
        const committeeId = fecString(expenditure, "committee_id");
        const candidateId = fecString(expenditure, "candidate_id");
        const amount = fecNumber(expenditure, "expenditure_amount");
        const rawDate =
          fecString(expenditure, "expenditure_date") ??
          fecString(expenditure, "dissemination_date");
        if (!subId || !committeeId || !candidateId || amount === null || !rawDate) {
          continue;
        }

        if (bundle.committeeError) partialErrors.push(bundle.committeeError);
        const committee = bundle.committee ?? {};
        const committeeName =
          fecString(committee, "name") ??
          fecString(expenditure, "committee_name") ??
          `FEC committee ${committeeId}`;
        const committeeType = fecString(committee, "committee_type");
        const committeeCategory = fecCommitteeCategory(committeeType);
        const committeeEntityId = `committee:fec:${committeeId}`;
        const committeeSourceId = `fec:committee:${committeeId}:${cycle}`;
        const committeeUrl = committeeOfficialUrl(committeeId, cycle);
        const committeeSource = bundle.committee ? committeeSourceId : scheduleSourceId;

        if (bundle.committee) {
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
                "FEC committee registration. Committee type and designation can change by cycle.",
            })
            .onConflictDoUpdate({
              target: sources.id,
              set: {
                title: committeeName,
                documentDate: fecString(committee, "last_file_date"),
                retrievedAt: now,
              },
            });
        }

        await db
          .insert(entities)
          .values({
            id: committeeEntityId,
            entityType: "committee",
            canonicalName: committeeName,
            normalizedName: normalizeName(committeeName),
            jurisdictionLevel: "federal",
            stateCode: fecString(committee, "state"),
            description: `${committeeCategory}. Reported as an outside spender on FEC Schedule E; spending is not a contribution to or proof of coordination with a candidate.`,
            status: "active",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: entities.id,
            set: {
              ...(bundle.committee ? {
                canonicalName: committeeName,
                normalizedName: normalizeName(committeeName),
                description: `${committeeCategory}. Reported as an outside spender on FEC Schedule E; spending is not a contribution to or proof of coordination with a candidate.`,
              } : {}),
              updatedAt: now,
            },
          });
        await db
          .insert(committees)
          .values({
            entityId: committeeEntityId,
            committeeType,
            designation: fecString(committee, "designation"),
            party:
              fecString(committee, "party_full") ?? fecString(committee, "party"),
            treasurer: fecString(committee, "treasurer_name"),
            fecCommitteeId: committeeId,
          })
          .onConflictDoUpdate({
            target: committees.entityId,
            set: bundle.committee ? {
              committeeType,
              designation: fecString(committee, "designation"),
              party: fecString(committee, "party_full") ?? fecString(committee, "party"),
              treasurer: fecString(committee, "treasurer_name"),
            } : { entityId: committeeEntityId },
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
            set: { officialUrl: committeeUrl, verifiedAt: now },
          });
        if (bundle.committee) {
          await db
            .insert(sourceRecords)
            .values({
              id: `${committeeSourceId}:registration`,
              sourceId: committeeSource,
              entityId: committeeEntityId,
              externalId: `${committeeId}:${cycle}`,
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
        }

        const candidateName = reportedCandidateName(expenditure);
        const candidateEntityId =
          candidateEntityByFecId.get(candidateId) ?? `candidate:fec:${candidateId}`;
        await db
          .insert(entities)
          .values({
            id: candidateEntityId,
            entityType: "candidate",
            canonicalName: candidateName,
            normalizedName: normalizeName(candidateName),
            jurisdictionLevel: "federal",
            stateCode: fecString(expenditure, "candidate_office_state"),
            district: fecString(expenditure, "candidate_office_district"),
            description:
              "Federal candidate named in an FEC Schedule E independent-expenditure filing. This record does not establish ballot qualification.",
            status: "reported",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: entities.id,
            set: { updatedAt: now },
          });
        await db
          .insert(externalIds)
          .values({
            entityId: candidateEntityId,
            sourceSystem: "fec",
            externalId: candidateId,
            officialUrl: candidateOfficialUrl(candidateId, cycle),
            isPrimary: true,
            verifiedAt: now,
          })
          .onConflictDoNothing();
        candidateEntityByFecId.set(candidateId, candidateEntityId);

        const position = spendingPosition(expenditure);
        const date = rawDate.slice(0, 10);
        const amountCents = Math.round(amount * 100);
        const transactionEntityId = `independent-expenditure:fec:${subId}`;
        const officialUrl = independentExpenditureUrl(
          cycle,
          committeeId,
          candidateId,
        );
        const purpose =
          fecString(expenditure, "expenditure_description") ??
          fecString(expenditure, "memo_text");

        await db
          .insert(entities)
          .values({
            id: transactionEntityId,
            entityType: "independent_expenditure",
            canonicalName: `${formatMoney(amount)} ${position.verb}ing ${candidateName} — ${committeeName}`,
            normalizedName: normalizeName(
              `${committeeName} ${candidateName} ${position.verb} ${amount} ${date}`,
            ),
            jurisdictionLevel: "federal",
            stateCode: fecString(expenditure, "candidate_office_state"),
            description: `FEC Schedule E independent expenditure reported on ${date}. ${position.label} ${candidateName}. This was not a contribution to the candidate and is reported as independent of the campaign.${purpose ? ` Purpose: ${purpose}.` : ""}`,
            status: "reported",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: entities.id,
            set: {
              canonicalName: `${formatMoney(amount)} ${position.verb}ing ${candidateName} — ${committeeName}`,
              normalizedName: normalizeName(
                `${committeeName} ${candidateName} ${position.verb} ${amount} ${date}`,
              ),
              description: `FEC Schedule E independent expenditure reported on ${date}. ${position.label} ${candidateName}. This was not a contribution to the candidate and is reported as independent of the campaign.${purpose ? ` Purpose: ${purpose}.` : ""}`,
              updatedAt: now,
            },
          });
        await db
          .insert(externalIds)
          .values({
            entityId: transactionEntityId,
            sourceSystem: "fec_schedule_e",
            externalId: subId,
            officialUrl,
            isPrimary: true,
            verifiedAt: now,
          })
          .onConflictDoUpdate({
            target: [externalIds.sourceSystem, externalIds.externalId],
            set: { officialUrl, verifiedAt: now },
          });
        await db
          .insert(sourceRecords)
          .values({
            id: `${scheduleSourceId}:expenditure:${subId}`,
            sourceId: scheduleSourceId,
            entityId: transactionEntityId,
            externalId: subId,
            rawJson: JSON.stringify({
              kind: "fec_schedule_e_independent_expenditure",
              expenditure,
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
          .insert(moneyTransactions)
          .values({
            id: transactionEntityId,
            transactionType: "independent_expenditure",
            amountCents,
            transactionDate: date,
            contributorEntityId: null,
            committeeEntityId,
            candidateEntityId,
            memo: purpose,
            fecTransactionId: `schedule-e:${subId}`,
            filingId: fecString(expenditure, "file_number"),
            amendmentIndicator: fecString(expenditure, "amendment_indicator"),
            sourceId: scheduleSourceId,
          })
          .onConflictDoUpdate({
            target: moneyTransactions.id,
            set: {
              amountCents,
              transactionDate: date,
              committeeEntityId,
              candidateEntityId,
              memo: purpose,
              filingId: fecString(expenditure, "file_number"),
              amendmentIndicator: fecString(expenditure, "amendment_indicator"),
              sourceId: scheduleSourceId,
            },
          });

        const madeRelationshipId = `${committeeEntityId}:made:${transactionEntityId}`;
        await db
          .insert(relationships)
          .values({
            id: madeRelationshipId,
            fromEntityId: committeeEntityId,
            toEntityId: transactionEntityId,
            relationshipType: "made_independent_expenditure",
            description: `${committeeName} reported this ${formatMoney(amount)} independent expenditure. It was not a contribution to the candidate.`,
            startDate: date,
            amountCents,
            confidence: 1,
            evidenceClass: "source_fact",
            sourceId: scheduleSourceId,
          })
          .onConflictDoUpdate({
            target: relationships.id,
            set: {
              description: `${committeeName} reported this ${formatMoney(amount)} independent expenditure. It was not a contribution to the candidate.`,
              amountCents,
              sourceId: scheduleSourceId,
            },
          });
        const candidateRelationshipId = `${transactionEntityId}:${position.verb}:${candidateEntityId}`;
        await db
          .insert(relationships)
          .values({
            id: candidateRelationshipId,
            fromEntityId: transactionEntityId,
            toEntityId: candidateEntityId,
            relationshipType:
              position.verb === "support"
                ? "independent_support"
                : position.verb === "oppose"
                  ? "independent_opposition"
                  : "independent_spending_reference",
            description: `${committeeName} reported independent spending that ${position.verb === "mention" ? "named" : `${position.verb}d`} ${candidateName}. The FEC record identifies this as outside spending, not candidate-authorized spending.`,
            startDate: date,
            amountCents,
            confidence: 1,
            evidenceClass: "source_fact",
            sourceId: scheduleSourceId,
          })
          .onConflictDoUpdate({
            target: relationships.id,
            set: {
              description: `${committeeName} reported independent spending that ${position.verb === "mention" ? "named" : `${position.verb}d`} ${candidateName}. The FEC record identifies this as outside spending, not candidate-authorized spending.`,
              amountCents,
              sourceId: scheduleSourceId,
            },
          });
        written += 1;
      }

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: bundles.length,
          recordsWritten: written,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        requestedCycle: cycle,
        page,
        nextPage,
        nextItemOffset,
        maxDate,
        independentExpendituresWritten: written,
        noticeFilingsExcluded: true,
        partialErrors: [...new Set(partialErrors)],
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
