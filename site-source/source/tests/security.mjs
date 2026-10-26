import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeScheduledBearer } from "../lib/scheduled-auth.mjs";
const secret = "test-only-random-like-scheduler-token-abcdef-0123456789";

test("rejects unset scheduled secret, including when a header exists", async () => {
  assert.equal((await authorizeScheduledBearer(`Bearer ${secret}`, undefined)).status, 503);
  assert.equal((await authorizeScheduledBearer(`Bearer ${secret}`, "short")).status, 503);
});
test("rejects missing, malformed and non-bearer credentials", async () => {
  for (const header of [null, "", "Basic abc", "Bearer ", "Bearer one two", "bearer abc"]) {
    const result = await authorizeScheduledBearer(header, secret);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  }
});
test("rejects wrong tokens without reflecting secrets", async () => {
  for (const guess of [secret.slice(0, -1), secret + "a", "x".repeat(80)]) {
    const result = await authorizeScheduledBearer(`Bearer ${guess}`, secret);
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});
test("rejects unusually long authorization headers", async () => {
  const result = await authorizeScheduledBearer(`Bearer ${"a".repeat(8200)}`, secret);
  assert.equal(result.status, 403);
});
test("accepts the configured token exactly", async () => {
  const result = await authorizeScheduledBearer(`Bearer ${secret}`, secret);
  assert.deepEqual(result, {ok: true, status: 200});
});
