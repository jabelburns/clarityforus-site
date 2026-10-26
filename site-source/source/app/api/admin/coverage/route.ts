import { count, desc, gt, inArray, max } from "drizzle-orm";
import { getDb } from "@/db";
import {
  backfillJobs,
  entities,
  ingestRuns,
  sources,
} from "@/db/schema";
import { apiError } from "@/lib/civic-data";
import { requireSiteOwner } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = await requireSiteOwner(request);
    if (!owner.ok) {
      return Response.json({ error: owner.error }, { status: owner.status });
    }

    const db = getDb();
    const [jobs, runs, freshness, possibleDuplicates] = await Promise.all([
      db.select().from(backfillJobs).orderBy(desc(backfillJobs.updatedAt)),
      db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(20),
      db
        .select({
          sourceSystem: sources.sourceSystem,
          records: count(),
          latestRetrievedAt: max(sources.retrievedAt),
        })
        .from(sources)
        .groupBy(sources.sourceSystem)
        .orderBy(sources.sourceSystem),
      db
        .select({
          normalizedName: entities.normalizedName,
          stateCode: entities.stateCode,
          matches: count(),
        })
        .from(entities)
        .where(inArray(entities.entityType, ["candidate", "politician"]))
        .groupBy(entities.normalizedName, entities.stateCode)
        .having(gt(count(), 1))
        .limit(25),
    ]);

    const now = Date.now();
    const normalizedJobs = jobs.map((job) => ({
      ...job,
      stalled:
        job.status === "running" &&
        now - Date.parse(job.updatedAt) > 2 * 60 * 60 * 1000,
    }));
    const failedRuns = runs.filter((run) => run.status === "failed");

    return Response.json({
      checkedAt: new Date(now).toISOString(),
      jobs: normalizedJobs,
      recentRuns: runs,
      sourceFreshness: freshness,
      identityReview: {
        possibleDuplicateCount: possibleDuplicates.length,
        items: possibleDuplicates,
        rule:
          "Only one exact name, state, office, and district match may merge automatically. Ambiguous candidates remain separate.",
      },
      alerts: {
        stalledJobs: normalizedJobs.filter((job) => job.stalled).length,
        blockedJobs: normalizedJobs.filter((job) => job.status === "blocked").length,
        failedRecentRuns: failedRuns.length,
      },
    });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
