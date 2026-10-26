import { count, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  entities,
  memberVotes,
  moneyTransactions,
  relationships,
  sourceRecords,
  sources,
  votes,
} from "@/db/schema";
import { apiError } from "@/lib/civic-data";
import {
  ANALYTICS_LIMITATIONS,
  countSeries,
  moneySeries,
  sourceSeries,
} from "@/lib/analytics-summary";

export const dynamic = "force-dynamic";

/** Read-only, non-identifying coverage facts. No contributor names or addresses. */
export async function GET() {
  try {
    const db = getDb();
    const [types, edges, votePositions, money, sourceSnapshots, voteChambers] = await Promise.all([
      db.select({ key: entities.entityType, records: count() })
        .from(entities).groupBy(entities.entityType),
      db.select({ key: relationships.evidenceClass, records: count() })
        .from(relationships).groupBy(relationships.evidenceClass),
      db.select({ key: memberVotes.position, records: count() })
        .from(memberVotes).groupBy(memberVotes.position),
      db.select({
        key: moneyTransactions.transactionType,
        records: count(),
        netCents: sql<number>`coalesce(sum(${moneyTransactions.amountCents}), 0)`,
      }).from(moneyTransactions).groupBy(moneyTransactions.transactionType),
      db.select({
        key: sources.sourceSystem,
        records: count(),
        lastFetchedAt: max(sourceRecords.fetchedAt),
      }).from(sourceRecords)
        .innerJoin(sources, sql`${sourceRecords.sourceId} = ${sources.id}`)
        .groupBy(sources.sourceSystem),
      db.select({ key: votes.chamber, records: count() }).from(votes).groupBy(votes.chamber),
    ]);

    return Response.json({
      asOf: new Date().toISOString(),
      methodology: "clarity-coverage-v1",
      recordTypes: countSeries(types),
      relationshipEvidence: countSeries(edges),
      recordedVotePositions: countSeries(votePositions),
      rollCallsByChamber: countSeries(voteChambers),
      moneyByTransactionType: moneySeries(money),
      sourceSnapshots: sourceSeries(sourceSnapshots),
      limitations: ANALYTICS_LIMITATIONS,
    }, { headers: { "cache-control": "public, max-age=120, stale-while-revalidate=300" } });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 503 });
  }
}
