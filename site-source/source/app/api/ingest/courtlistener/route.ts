import { desc, eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  bills,
  caseChallenges,
  courtCases,
  entities,
  executiveOrders,
  externalIds,
  ingestRuns,
  relationships,
  sourceRecords,
  sources,
} from "@/db/schema";
import { apiError, normalizeName } from "@/lib/civic-data";
import {
  quoteCourtListenerQuery,
  searchCourtListenerCases,
  type CourtListenerCaseHit,
} from "@/lib/courtlistener";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

type LegalSearchTarget = {
  entityId: string;
  entityType: "bill" | "executive_order";
  name: string;
  query: string;
};

async function targetForEntity(entityId: string) {
  const db = getDb();
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!entity) throw new Error("The requested legal-link target was not found.");

  if (entity.entityType === "bill") {
    const [bill] = await db
      .select()
      .from(bills)
      .where(eq(bills.entityId, entityId))
      .limit(1);
    if (!bill) throw new Error("The requested bill record is incomplete.");
    return {
      entityId,
      entityType: "bill",
      name: entity.canonicalName,
      query: quoteCourtListenerQuery(bill.title),
    } satisfies LegalSearchTarget;
  }

  if (entity.entityType === "executive_order") {
    const [order] = await db
      .select()
      .from(executiveOrders)
      .where(eq(executiveOrders.entityId, entityId))
      .limit(1);
    if (!order) throw new Error("The requested executive-order record is incomplete.");
    const phrase = order.executiveOrderNumber
      ? `Executive Order ${order.executiveOrderNumber}`
      : entity.canonicalName;
    return {
      entityId,
      entityType: "executive_order",
      name: entity.canonicalName,
      query: quoteCourtListenerQuery(phrase),
    } satisfies LegalSearchTarget;
  }

  throw new Error("CourtListener matching currently supports bills and executive orders.");
}

async function recentTargets(limit: number) {
  const db = getDb();
  const executiveLimit = Math.min(2, limit);
  const orderRows = await db
    .select({
      entityId: executiveOrders.entityId,
      name: entities.canonicalName,
      number: executiveOrders.executiveOrderNumber,
    })
    .from(executiveOrders)
    .innerJoin(entities, eq(executiveOrders.entityId, entities.id))
    .orderBy(desc(executiveOrders.publicationDate))
    .limit(executiveLimit);

  const remaining = Math.max(0, limit - orderRows.length);
  const billRows = remaining
    ? await db
        .select({
          entityId: bills.entityId,
          name: entities.canonicalName,
          title: bills.title,
        })
        .from(bills)
        .innerJoin(entities, eq(bills.entityId, entities.id))
        .orderBy(desc(bills.latestActionDate), desc(entities.updatedAt))
        .limit(remaining)
    : [];

  return [
    ...orderRows.map(
      (row) =>
        ({
          entityId: row.entityId,
          entityType: "executive_order",
          name: row.name,
          query: quoteCourtListenerQuery(
            row.number ? `Executive Order ${row.number}` : row.name,
          ),
        }) satisfies LegalSearchTarget,
    ),
    ...billRows.map(
      (row) =>
        ({
          entityId: row.entityId,
          entityType: "bill",
          name: row.name,
          query: quoteCourtListenerQuery(row.title),
        }) satisfies LegalSearchTarget,
    ),
  ];
}

function caseDescription(hit: CourtListenerCaseHit) {
  return [
    `${hit.courtName} docket ${hit.docketNumber}.`,
    hit.filedDate ? `Filed ${hit.filedDate}.` : null,
    hit.natureOfSuit ? `Nature of suit: ${hit.natureOfSuit}.` : null,
    "Imported from a CourtListener exact-query result; inspect the docket evidence before treating it as a confirmed legal challenge.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function writeMatch(
  target: LegalSearchTarget,
  hit: CourtListenerCaseHit,
  now: string,
) {
  const db = getDb();
  const caseEntityId = `court-case:courtlistener:${hit.docketId}`;
  const sourceId = `courtlistener:docket:${hit.docketId}`;
  const relationshipId = `${caseEntityId}:possible-legal-link:${target.entityId}`;
  const linkDescription = `CourtListener returned this docket or a filing in response to the exact query ${target.query} for ${target.name}. This is a discovery lead, not proof that the case challenges the measure.`;

  await db
    .insert(sources)
    .values({
      id: sourceId,
      sourceSystem: "courtlistener",
      recordType: "recap_search_match",
      publisher: "Free Law Project / CourtListener",
      title: `${hit.caseName} — ${hit.courtName} ${hit.docketNumber}`,
      url: hit.officialUrl,
      documentDate: hit.filedDate,
      retrievedAt: now,
      coverageNote:
        "CourtListener search and RECAP docket metadata can be incomplete. An exact-query result is stored as a possible legal link, not a verified challenge, until the complaint, order, opinion, or other docket evidence is reviewed.",
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        title: `${hit.caseName} — ${hit.courtName} ${hit.docketNumber}`,
        url: hit.officialUrl,
        documentDate: hit.filedDate,
        retrievedAt: now,
      },
    });

  await db
    .insert(entities)
    .values({
      id: caseEntityId,
      entityType: "court_case",
      canonicalName: hit.caseName,
      normalizedName: normalizeName(
        `${hit.caseName} ${hit.docketNumber} ${hit.courtName}`,
      ),
      jurisdictionLevel: "federal",
      description: caseDescription(hit),
      status: "candidate_match",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: entities.id,
      set: {
        canonicalName: hit.caseName,
        normalizedName: normalizeName(
          `${hit.caseName} ${hit.docketNumber} ${hit.courtName}`,
        ),
        description: caseDescription(hit),
        status: "candidate_match",
        updatedAt: now,
      },
    });

  await db
    .insert(courtCases)
    .values({
      entityId: caseEntityId,
      court: hit.courtName,
      docketNumber: hit.docketNumber,
      filedDate: hit.filedDate,
      terminatedDate: hit.terminatedDate,
      caseStatus: hit.caseStatus,
      natureOfSuit: hit.natureOfSuit,
      opinionStatus: hit.opinionStatus,
      officialUrl: hit.officialUrl,
      sourceId,
    })
    .onConflictDoUpdate({
      target: courtCases.entityId,
      set: {
        court: hit.courtName,
        docketNumber: hit.docketNumber,
        filedDate: hit.filedDate,
        terminatedDate: hit.terminatedDate,
        caseStatus: hit.caseStatus,
        natureOfSuit: hit.natureOfSuit,
        opinionStatus: hit.opinionStatus,
        officialUrl: hit.officialUrl,
        sourceId,
      },
    });

  await db
    .insert(externalIds)
    .values({
      entityId: caseEntityId,
      sourceSystem: "courtlistener",
      externalId: hit.docketId,
      officialUrl: hit.officialUrl,
      isPrimary: true,
      verifiedAt: now,
    })
    .onConflictDoUpdate({
      target: [externalIds.sourceSystem, externalIds.externalId],
      set: {
        entityId: caseEntityId,
        officialUrl: hit.officialUrl,
        verifiedAt: now,
      },
    });

  await db
    .insert(sourceRecords)
    .values({
      id: `${sourceId}:match:${target.entityId}`,
      sourceId,
      entityId: caseEntityId,
      externalId: `${hit.docketId}:match:${target.entityId}`,
      rawJson: JSON.stringify({
        kind: "courtlistener_recap_search_match",
        target: {
          entityId: target.entityId,
          entityType: target.entityType,
          name: target.name,
          query: target.query,
        },
        hit: hit.raw,
        snippet: hit.snippet,
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
    .insert(caseChallenges)
    .values({
      id: relationshipId,
      caseEntityId,
      challengedEntityId: target.entityId,
      challengeType: "possible_reference",
      legalQuestion: linkDescription,
      currentOutcome: null,
      sourceId,
    })
    .onConflictDoUpdate({
      target: caseChallenges.id,
      set: {
        legalQuestion: linkDescription,
        sourceId,
      },
    });

  await db
    .insert(relationships)
    .values({
      id: relationshipId,
      fromEntityId: caseEntityId,
      toEntityId: target.entityId,
      relationshipType: "potential_legal_link",
      description: linkDescription,
      confidence: 0.5,
      evidenceClass: "search_match",
      sourceId,
    })
    .onConflictDoUpdate({
      target: relationships.id,
      set: {
        description: linkDescription,
        confidence: 0.5,
        evidenceClass: "search_match",
        sourceId,
      },
    });

  return { caseEntityId, relationshipId };
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
    if (!env.COURTLISTENER_API_KEY) {
      return Response.json(
        { error: "The CourtListener API token is not configured." },
        { status: 503 },
      );
    }

    const requestUrl = new URL(request.url);
    const targetId = requestUrl.searchParams.get("target_id")?.trim() || null;
    const targetLimit = Math.min(
      Math.max(Number(requestUrl.searchParams.get("target_limit") ?? 4) || 4, 1),
      4,
    );
    const caseLimit = Math.min(
      Math.max(Number(requestUrl.searchParams.get("case_limit") ?? 3) || 3, 1),
      5,
    );
    const targets = targetId
      ? [await targetForEntity(targetId)]
      : await recentTargets(targetLimit);
    if (!targets.length) {
      return Response.json(
        { error: "No eligible bills or executive orders are available to match." },
        { status: 409 },
      );
    }

    const db = getDb();
    const runId = `courtlistener:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "courtlistener",
      status: "running",
    });

    try {
      const searched = await Promise.all(
        targets.map(async (target) => {
          try {
            return {
              target,
              hits: await searchCourtListenerCases(
                env.COURTLISTENER_API_KEY!,
                target.query,
                caseLimit,
              ),
              error: null as string | null,
            };
          } catch (error) {
            return {
              target,
              hits: [] as CourtListenerCaseHit[],
              error: apiError(error),
            };
          }
        }),
      );
      const successfulSearches = searched.filter((result) => !result.error);
      if (!successfulSearches.length) {
        throw new Error(
          searched[0]?.error ?? "CourtListener searches did not complete.",
        );
      }

      const now = new Date().toISOString();
      const writes = [];
      for (const result of successfulSearches) {
        for (const hit of result.hits) {
          writes.push(await writeMatch(result.target, hit, now));
        }
      }
      const uniqueCases = new Set(writes.map((write) => write.caseEntityId));

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: successfulSearches.reduce(
            (sum, result) => sum + result.hits.length,
            0,
          ),
          recordsWritten: uniqueCases.size,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        targetsSearched: successfulSearches.length,
        casesMatched: uniqueCases.size,
        possibleLegalLinks: writes.length,
        warnings: searched.flatMap((result) =>
          result.error
            ? [`${result.target.name}: ${result.error}`]
            : [],
        ),
        evidenceNote:
          "Matches are discovery leads. A docket or filing must be reviewed before a possible link is labeled a confirmed legal challenge.",
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
