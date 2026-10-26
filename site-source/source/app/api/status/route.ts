import { count, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import {
  analyses,
  backfillJobs,
  bills,
  candidacies,
  committees,
  courtCases,
  elections,
  entities,
  executiveOrders,
  ingestRuns,
  memberVotes,
  moneyTransactions,
  offices,
  relationships,
  siteSettings,
  votes,
} from "@/db/schema";
import { apiError, CLARITY_SCHEMA_VERSION } from "@/lib/civic-data";
import { requestUserId } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

async function tableCount(table: SQLiteTable) {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const [
      entityCount,
      billCount,
      voteCount,
      officeCount,
      memberVoteCount,
      politicianCount,
      candidateCount,
      contributorCount,
      contributionCount,
      independentExpenditureCount,
      electionCount,
      candidacyCount,
      committeeCount,
      orderCount,
      caseCount,
      moneyCount,
      relationshipCount,
      analysisCount,
      latestRun,
      ownerSetting,
      backfills,
    ] = await Promise.all([
      tableCount(entities),
      tableCount(bills),
      tableCount(votes),
      tableCount(offices),
      tableCount(memberVotes),
      db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.entityType, "politician")),
      db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.entityType, "candidate")),
      db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.entityType, "contributor")),
      db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.entityType, "contribution")),
      db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.entityType, "independent_expenditure")),
      tableCount(elections),
      tableCount(candidacies),
      tableCount(committees),
      tableCount(executiveOrders),
      tableCount(courtCases),
      tableCount(moneyTransactions),
      tableCount(relationships),
      tableCount(analyses),
      db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(1),
      db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, "owner_user_id"))
        .limit(1),
      db.select().from(backfillJobs).orderBy(desc(backfillJobs.updatedAt)),
    ]);

    // Operations telemetry is for the owner; public consumers still receive
    // count and connector-availability fields required by the existing UI.
    const isOwner = Boolean(
      ownerSetting[0]?.value && requestUserId(request) === ownerSetting[0]?.value,
    );
    return Response.json({
      schemaVersion: CLARITY_SCHEMA_VERSION,
      database: {
        status: "ready",
        counts: {
          entities: entityCount,
          bills: billCount,
          votes: voteCount,
          houseOffices: officeCount,
          memberVotes: memberVoteCount,
          politicians: politicianCount[0]?.value ?? 0,
          candidates: candidateCount[0]?.value ?? 0,
          contributors: contributorCount[0]?.value ?? 0,
          contributions: contributionCount[0]?.value ?? 0,
          independentExpenditures:
            independentExpenditureCount[0]?.value ?? 0,
          elections: electionCount,
          candidacies: candidacyCount,
          committees: committeeCount,
          executiveOrders: orderCount,
          courtCases: caseCount,
          moneyTransactions: moneyCount,
          relationships: relationshipCount,
          analyses: analysisCount,
        },
        ...(isOwner ? { latestIngest: latestRun[0] ?? null, backfills } : {}),
      },
      connectors: {
        federalRegister: { status: "ready", credentialRequired: false },
        houseClerk: { status: "ready", credentialRequired: false },
        congress: {
          status: env.CONGRESS_API_KEY ? "configured" : "awaiting_secret",
          credentialRequired: true,
        },
        fec: {
          status: env.FEC_API_KEY ? "configured" : "awaiting_secret",
          credentialRequired: true,
        },
        aiAnalysis: {
          status:
            env.OPENAI_API_KEY || env.GROQ_API_KEY || env.XAI_API_KEY
              ? "configured"
              : "awaiting_secret",
          credentialRequired: true,
          providers: [
            env.OPENAI_API_KEY ? "openai" : null,
            env.GROQ_API_KEY ? "groq" : null,
            env.XAI_API_KEY ? "xai" : null,
          ].filter(Boolean),
        },
        courtListener: {
          status: env.COURTLISTENER_API_KEY
            ? "configured"
            : "awaiting_secret",
          credentialRequired: true,
        },
      },
      ownerInitialized: ownerSetting.length === 1,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        schemaVersion: CLARITY_SCHEMA_VERSION,
        database: { status: "unavailable", error: apiError(error) },
      },
      { status: 503 },
    );
  }
}
