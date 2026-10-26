import { env } from "cloudflare:workers";
import { authorizeScheduledBearer } from "@/lib/scheduled-auth.mjs";
import { POST as ingestCongress } from "@/app/api/ingest/congress/route";
import { POST as ingestFec } from "@/app/api/ingest/fec/route";
import { POST as ingestFecOutsideSpending } from "@/app/api/ingest/fec-outside-spending/route";
import { POST as ingestFederalRegister } from "@/app/api/ingest/federal-register/route";
import { POST as ingestHouseMembers } from "@/app/api/ingest/house-members/route";
import { POST as ingestSenateVotes } from "@/app/api/ingest/senate-votes/route";
import { POST as ingestHouseVotes } from "@/app/api/ingest/house-votes/route";
import { POST as runBackfill } from "@/app/api/ingest/backfill/route";

export const dynamic = "force-dynamic";

const steps = {
  "house-members": { path: "/api/ingest/house-members", handler: ingestHouseMembers },
  "house-votes": { path: "/api/ingest/house-votes?limit=10", handler: ingestHouseVotes },
  "senate-votes": { path: "/api/ingest/senate-votes?congress=119&session=2&limit=1", handler: ingestSenateVotes },
  "executive-orders": { path: "/api/ingest/federal-register", handler: ingestFederalRegister },
  bills: { path: "/api/ingest/congress?limit=5", handler: ingestCongress },
  candidates: { path: "/api/ingest/fec?limit=6", handler: ingestFec },
  "outside-spending": {
    path: "/api/ingest/fec-outside-spending?limit=24",
    handler: ingestFecOutsideSpending,
  },
  "backfill-congress": { path: "/api/ingest/backfill?dataset=congress", handler: runBackfill },
  "backfill-fec": { path: "/api/ingest/backfill?dataset=fec", handler: runBackfill },
  "backfill-outside-spending": { path: "/api/ingest/backfill?dataset=outside-spending", handler: runBackfill },
  "backfill-house-votes": { path: "/api/ingest/backfill?dataset=house-votes", handler: runBackfill },
  "backfill-senate-votes": { path: "/api/ingest/backfill?dataset=senate-votes", handler: runBackfill },
  "backfill-court": { path: "/api/ingest/backfill?dataset=courtlistener", handler: runBackfill },
} as const;

type StepName = keyof typeof steps;

function isStepName(value: string | null): value is StepName {
  return Boolean(value && Object.hasOwn(steps, value));
}

export async function POST(request: Request) {
  // Fail closed until the external scheduled task can send the separate
  // server-managed bearer credential. Do not deploy this route first.
  const service = await authorizeScheduledBearer(
    request.headers.get("authorization"),
    env.SCHEDULED_INGEST_TOKEN,
  );
  if (!service.ok) {
    return Response.json({ error: service.error }, { status: service.status });
  }
  if (!env.INGEST_TOKEN) {
    return Response.json(
      { error: "Scheduled ingestion is not configured." },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const stepName = requestUrl.searchParams.get("step");
  if (!isStepName(stepName)) {
    return Response.json(
      { error: "Unknown ingestion step.", allowedSteps: Object.keys(steps) },
      { status: 400 },
    );
  }

  const step = steps[stepName];
  const targetUrl = new URL(step.path, requestUrl.origin);
  const internalRequest = new Request(targetUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.INGEST_TOKEN}`,
      "content-type": "application/json",
      origin: requestUrl.origin,
    },
    body: "{}",
  });

  const response = await step.handler(internalRequest);
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
