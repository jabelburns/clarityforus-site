import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("scheduled endpoint authenticates incoming request before dispatching", () => {
  const route = read("app/api/ingest/scheduled/route.ts");
  assert.match(route, /authorizeScheduledBearer\(/);
  assert.ok(route.indexOf("authorizeScheduledBearer(") < route.indexOf("step.handler(internalRequest)"));
  assert.match(route, /env.SCHEDULED_INGEST_TOKEN/);
});
test("first visitor cannot claim ownership without configured bootstrap ID", () => {
  const admin = read("lib/site-admin.ts");
  assert.match(admin, /if \(!env.CLARITY_OWNER_USER_ID\)/);
  assert.match(admin, /env.CLARITY_OWNER_USER_ID !== userId/);
  assert.doesNotMatch(admin, /The first authenticated\s+visitor is therefore the owner/);
});
test("public status omits owner-only refresh cursors", () => {
  const status = read("app/api/status/route.ts");
  assert.match(status, /isOwner \? \{ latestIngest: latestRun\[0\] \?\? null, backfills \} : \{\}/);
  assert.match(status, /export async function GET\(request: Request\)/);
});
