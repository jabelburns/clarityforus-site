import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { auditHouseQueryBudget } from "../tools/audit-house-query-budget.mjs";

const root = resolve(import.meta.dirname, "..");
const original = {
  route: readFileSync(resolve(root, "app/api/ingest/house-votes/route.ts"), "utf8"),
  auth: readFileSync(resolve(root, "lib/site-admin.ts"), "utf8"),
  helper: readFileSync(resolve(root, "lib/house-clerk.ts"), "utf8"),
};

test("static source audit conservatively bounds the full House route D1 calls", () => {
  const result = auditHouseQueryBudget(original);
  assert.equal(result.mode, "STATIC_SOURCE_BOUND_NOT_RUNTIME_MEASUREMENT");
  assert.equal(result.maxRollCalls, 2);
  assert.equal(result.maxDirectD1CallsPerRoll, 12);
  assert.equal(result.otherRouteD1CallsConservative, 3);
  assert.equal(result.ownerAuthD1CallsConservative, 3);
  assert.equal(result.directRouteAndOwnerAuthUpperBound, 30);
  assert.equal(result.directRouteAndServiceAuthUpperBound, 27);
  assert.equal(result.noActualHandlerRequestExecuted, true);
});

test("audit rejects increased roll limit even when syntax otherwise parses", () => {
  const route = original.route.replace("Math.min(requestedLimit, 2)", "Math.min(requestedLimit, 10)");
  assert.notEqual(route, original.route);
  assert.throws(() => auditHouseQueryBudget({ ...original, route }), /two-roll hard limit changed/);
});

test("audit rejects additional unreviewed D1 write inside roll loop", () => {
  const anchor = "let positionsWritten = 0;";
  assert.ok(original.route.includes(anchor));
  const extra = "\n      for (const fakeRollCall of [] as never[]) {" +
    "\n        await db.insert(ingestRuns).values({id: String(fakeRollCall)});" +
    "\n      }\n";
  const route = original.route.replace(anchor, anchor + extra);
  assert.throws(() => auditHouseQueryBudget({ ...original, route }), /changed from 12\/roll|unawaited\/nested DB operations/);
});

test("audit rejects extra database query in the owner-authentication path", () => {
  const anchor = "const db = getDb();";
  const auth = original.auth.replace(anchor,
    anchor + "\n  await db.select().from(siteSettings);");
  assert.notEqual(auth, original.auth);
  assert.throws(() => auditHouseQueryBudget({ ...original, auth }), /Owner validation query count changed/);
});

test("audit rejects a House fetch helper acquiring an unexpected direct D1 dependency", () => {
  const helper = original.helper + "\nconst injected = getDb();\n";
  assert.throws(() => auditHouseQueryBudget({ ...original, helper }), /must not use D1 directly/);
});

test("audit fails closed if route changes to non-awaited database execution", () => {
  const needle = "await db.run(sql" + String.fromCharCode(96) + "INSERT INTO entities (";
  assert.ok(original.route.includes(needle));
  const route = original.route.replace(needle,
    "db.run(sql" + String.fromCharCode(96) + "INSERT INTO entities (");
  assert.throws(() => auditHouseQueryBudget({ ...original, route }), /unawaited\/nested DB operations/);
});
