import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { backfillJobs } from "@/db/schema";
import { apiError } from "@/lib/civic-data";
import { advanceCursor, batchWarnings, type Cursor, type Dataset } from "@/lib/ingest-progress";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";
import { POST as ingestCongress } from "@/app/api/ingest/congress/route";
import { POST as ingestFec } from "@/app/api/ingest/fec/route";
import { POST as ingestOutside } from "@/app/api/ingest/fec-outside-spending/route";
import { POST as ingestSenateVotes } from "@/app/api/ingest/senate-votes/route";
import { POST as ingestHouseVotes } from "@/app/api/ingest/house-votes/route";
import { POST as ingestCourt } from "@/app/api/ingest/courtlistener/route";

export const dynamic = "force-dynamic";


const datasets: Dataset[] = ["congress", "fec", "house-votes", "senate-votes", "outside-spending", "courtlistener"];

function parseCursor(value: string | null): Cursor {
  try { return value ? JSON.parse(value) as Cursor : {}; } catch { return {}; }
}

function internalRequest(origin: string, path: string) {
  return new Request(new URL(path, origin), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.INGEST_TOKEN}`,
      "content-type": "application/json",
      origin,
    },
    body: "{}",
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  let jobId: string | null = null;
  try {
    const authorization = await authorizeIngestRequest(request);
    if (!authorization.ok) return Response.json({ error: authorization.error }, { status: authorization.status });
    if (!env.INGEST_TOKEN) return Response.json({ error: "Backfill is not configured." }, { status: 503 });

    const url = new URL(request.url);
    const requested = url.searchParams.get("dataset") as Dataset | null;
    if (requested && !datasets.includes(requested)) {
      return Response.json({ error: "Unknown backfill dataset.", allowedDatasets: datasets }, { status: 400 });
    }
    const db = getDb();
    let dataset = requested;
    if (!dataset) {
      const existing = await db.select().from(backfillJobs).where(eq(backfillJobs.status, "running"));
      dataset = datasets.find((name) => existing.some((job) => job.dataset === name)) ?? datasets[0];
    }
    const scope = dataset === "congress" || dataset === "senate-votes" ? "119" : dataset === "fec" || dataset === "outside-spending" ? "2026" : "federal";
    const id = `backfill:${dataset}:${scope}`;
    const [existing] = await db.select().from(backfillJobs).where(eq(backfillJobs.id, id)).limit(1);
    let cursor = parseCursor(existing?.cursor ?? null);
    // Reopen only legacy FEC completions: v1 inferred exhaustion from the
    // blended candidate count and incorrectly stopped at page 1.
    const legacyFec = dataset === "fec" && cursor.paginationVersion !== 2;
    if (existing?.status === "completed" && !legacyFec && dataset !== "courtlistener") {
      return Response.json({ ok: true, dataset, status: "completed", cursor, skipped: true });
    }
    if (legacyFec) cursor = { page: 1, paginationVersion: 2 };
    jobId = id;
    const now = new Date().toISOString();
    await db.insert(backfillJobs).values({ id, dataset, scope, status: "running", startedAt: existing?.startedAt ?? now, updatedAt: now })
      .onConflictDoUpdate({ target: backfillJobs.id, set: { status: "running", completedAt: null, lastError: null, updatedAt: now } });

    let response: Response;
    if (dataset === "congress") {
      response = await ingestCongress(internalRequest(url.origin, `/api/ingest/congress?congress=119&limit=1&offset=${cursor.offset ?? 0}`));
    } else if (dataset === "fec") {
      response = await ingestFec(internalRequest(url.origin, `/api/ingest/fec?cycle=2026&limit=10&page=${cursor.page ?? 1}`));
    } else if (dataset === "house-votes") {
      const year = cursor.year ?? new Date().getUTCFullYear();
      const before = cursor.beforeRoll ? `&beforeRoll=${cursor.beforeRoll}` : "";
      response = await ingestHouseVotes(internalRequest(url.origin, `/api/ingest/house-votes?year=${year}&limit=2${before}`));
    } else if (dataset === "senate-votes") {
      const session = cursor.session ?? 2;
      const before = cursor.beforeRoll ? `&beforeRoll=${cursor.beforeRoll}` : "";
      response = await ingestSenateVotes(internalRequest(url.origin,
        `/api/ingest/senate-votes?congress=119&session=${session}&limit=1${before}`));
    } else if (dataset === "outside-spending") {
      const parameters = new URLSearchParams({ cycle: "2026", limit: "50", page: String(cursor.page ?? 1), itemOffset: String(cursor.itemOffset ?? 0) });
      if (cursor.maxDate) parameters.set("maxDate", cursor.maxDate);
      response = await ingestOutside(internalRequest(url.origin, `/api/ingest/fec-outside-spending?${parameters}`));
    } else {
      if (!env.COURTLISTENER_API_KEY) {
        await db.update(backfillJobs).set({ status: "blocked", lastError: "CourtListener API key is not configured.", updatedAt: now }).where(eq(backfillJobs.id, id));
        return Response.json({ ok: false, dataset, status: "blocked", needs: "COURTLISTENER_API_KEY" }, { status: 200 });
      }
      response = await ingestCourt(internalRequest(url.origin, "/api/ingest/courtlistener?targetLimit=4&caseLimit=5"));
    }

    const text = await response.text();
    let body: Record<string, unknown>;
    try { body = JSON.parse(text) as Record<string, unknown>; }
    catch { throw new Error(`${dataset} returned HTTP ${response.status} with a non-JSON response; checkpoint retained.`); }
    if (!response.ok || body.ok !== true) throw new Error(typeof body.error === "string" ? body.error : `${dataset} batch failed.`);
    const progress = advanceCursor(dataset, cursor, body);
    const warnings = batchWarnings(body);
    // An enrichment failure must be retried before moving past the raw page.
    // Keep its frozen date even on retry so a day boundary cannot shift it.
    const retry = warnings.length > 0 && (dataset === "fec" || dataset === "outside-spending");
    const next = retry
      ? { ...cursor, ...(typeof body.maxDate === "string" ? { maxDate: body.maxDate } : {}) }
      : progress.next;
    const completed = !retry && progress.completed;
    const seen = Number(body.recordsSeen ?? body.candidatesWritten ?? body.rollCallsWritten ?? body.independentExpendituresWritten ?? body.casesMatched ?? 0);
    const written = Number(body.recordsWritten ?? body.candidatesWritten ?? body.rollCallsWritten ?? body.independentExpendituresWritten ?? body.casesMatched ?? 0);
    await db.update(backfillJobs).set({
      status: retry ? "retry" : completed ? "completed" : "running",
      lastError: warnings.length ? warnings.join("; ").slice(0, 2000) : null,
      cursor: JSON.stringify(next),
      recordsSeen: sql`${backfillJobs.recordsSeen} + ${seen}`,
      recordsWritten: sql`${backfillJobs.recordsWritten} + ${written}`,
      batchesCompleted: sql`${backfillJobs.batchesCompleted} + ${retry ? 0 : 1}`,
      completedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(backfillJobs.id, id));
    return Response.json({ ok: !retry, dataset, status: retry ? "retry" : completed ? "completed" : "running", cursor: next, batch: body });
  } catch (error) {
    const message = apiError(error);
    if (jobId) {
      await getDb().update(backfillJobs).set({ status: "failed", lastError: message.slice(0, 2000), completedAt: null, updatedAt: new Date().toISOString() }).where(eq(backfillJobs.id, jobId));
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
