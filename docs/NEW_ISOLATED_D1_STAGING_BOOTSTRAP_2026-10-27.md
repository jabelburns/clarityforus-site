# New Cloudflare D1 staging bootstrap — review-only procedure

**Status: PREPARED, NOT EXECUTED AGAINST CLOUD.** This runbook applies only to a **new, independent Cloudflare D1 database** under an account controlled by the project owner. It does not authorize writes/deployment to the existing Sites-managed live \`clarity-for-us\` application or its bound \`DB\`. The managed Site's real D1 database identifier was not exposed, so a matching binding name (\`DB\`) does not prove either sameness or separation.

## Current engineering evidence

- Source: sanitized 173-file v33.1 handoff plus review-only PR #11; neither deployed nor merged.
- Cloudflare D1 **local-only** Wrangler export/restore verified all 23 application tables and their indexes/foreign keys in Actions, using a disposable all-zero UUID.
- House batch: the 435-person fictional roll-call importer **successfully ran the route's three parameterized JSON1 bulk SQL operations** in a local Worker, re-ran without duplicates, corrected source/vote data, and retained existing member identities and a simulated failure cursor.
- Conservative **static** query-count audit of v33.1: max two House roll calls, 12 direct database operations per roll, three surrounding status operations, plus three owner-authentication operations = upper bound **30 direct D1 calls**. A valid service bearer uses zero owner DB lookups, yielding 27 conservative direct calls. The audit fails if source/query structure changes; it is not an observed complete HTTP request or a guarantee about middleware/framework internals.
- Cloudflare D1's published Free-tier per-Worker query limit is 50. See https://developers.cloudflare.com/d1/platform/limits/ . The full remote end-to-end request still requires measurement.

## Step A: provider ownership and brand-new database (operator action only)

From the **project owner's independently controlled Cloudflare account**, using a separately authorized local Wrangler CLI or Cloudflare dashboard:

1. Authenticate under the account the owner actually controls, without publishing account access tokens or session secrets.
2. **Inspect existing databases first** (e.g., \`pnpm exec wrangler d1 list\`). Do not infer that the bound managed Sites \`DB\` exists in this account, or guess its ID.
3. Choose an unambiguous new name, e.g. \`clarity-rebuild-staging\`, and create a **brand-new D1 database** only after confirming its intended account: \`pnpm exec wrangler d1 create clarity-rebuild-staging\`. **Do not use** \`--update-config\`; no production configuration should be modified.
4. Independently verify the resulting newly allocated account and D1 UUID in the authorized Cloudflare dashboard / \`wrangler d1 info\`. If ownership, ID provenance, separation, or cost limits are unclear, stop.

The current connected GitHub tools **cannot create or inspect this Cloudflare account or remotely provision D1**. No remote D1 has been created by this PR.

## Step B: generate a reviewable config, without any remote operation

In a **private local workspace**, create \`/private/clarity-staging-target.json\` with six keys. Replace illustrative fake IDs with verified new IDs.

\`\`\`json
{
  "purpose": "clarity-independent-rebuild-staging",
  "account_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "database_id": "7e934a7e-e3c7-4f3a-90b2-7a07acf7e9bd",
  "database_name": "clarity-rebuild-staging",
  "worker_name": "clarity-rebuild-worker-staging",
  "owner_verified_new_database": true
}
\`\`\`

The example IDs are **not real account or database IDs**. Set \`owner_verified_new_database\` to \`true\` **only after an actual independent owner check**; the validator cannot prove identity or account isolation from string shape alone.

From \`site-source/source\`:

\`\`\`sh
python3 tools/prepare_isolated_d1_target.py \
  --target /private/clarity-staging-target.json \
  --output /private/wrangler.staging-review.json
\`\`\`

This utility **only** validates and emits non-secret JSON. It refuses production/live resource-like names, invalid/CI-placeholder IDs, extra fields, missing owner verification, and overwrites. The output declares a new staging D1 binding named \`DB\`, with \`workers_dev=false\` and **no** triggers, public route, secrets, scheduled tasks or deployment actions. The source repository ignores locally named staging target/config JSON.

The script does not run \`wrangler\`, send network requests, create a cloud resource, migrate data, or prove that a real database is separate. **Do not commit the manifest or generated output to public GitHub**, even though the IDs themselves are not API credentials.

## Step C: independent remote target checks (NOT PERFORMED)

Once a brand-new owned database has been authenticated, inspected and explicitly approved for remote staging writes, run **read-only** checks first from the authorized environment using the generated config:

\`\`\`sh
pnpm exec wrangler d1 info clarity-rebuild-staging
pnpm exec wrangler d1 execute clarity-rebuild-staging --remote \
  --config /private/wrangler.staging-review.json \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
\`\`\`

A database containing unexpected Clarity application tables, imported rows or someone else's schema is **not** a fresh destination; stop and investigate. Never delete or reset it automatically.

**Only after a separate, explicit reviewed approval** should the two original migrations be applied against that **new** verified target:

\`\`\`sh
pnpm exec wrangler d1 execute clarity-rebuild-staging --remote \
  --config /private/wrangler.staging-review.json \
  --file drizzle/0000_amused_stature.sql
pnpm exec wrangler d1 execute clarity-rebuild-staging --remote \
  --config /private/wrangler.staging-review.json \
  --file drizzle/0001_flippant_thunderbolt.sql
\`\`\`

These last commands **write** to the remote database. They are an **operator runbook, not an automation or an action taken here**. Before any actual execution, inspect the exact Cloudflare account, UUID and pending SQL. Consider the provider's query/operation billing. Do not execute them against the live Sites-managed \`DB\`.

## Step D: new staging acceptance and public-source rebuild

- Record new schema/index/foreign-key inventory, 23 exact counts and migration hashes in private staging evidence.
- Establish **a complete private backup of the new staging database** immediately once it contains valuable records and prove a restore into another disposable environment before further migration.
- Use the existing official-API importers with staging-only credentials to progressively ingest House membership and votes, Congress.gov legislation, Senate votes, Federal Register executive orders, FEC finance and CourtListener when configured.
- Bound all batch sizes, preserve cursors on partial failures, upsert by source-defined stable identifiers, and keep manual identity conflicts separate pending review.
- Check real D1 Worker query counts/latency for the entire two-roll House route (not only the three bulk statements), together with idempotent replay, verified source URLs and date coverage.
- Audit owner-only authentication and the independent protected scheduler: \`SCHEDULED_INGEST_TOKEN\` requires a secret-capable caller; the existing Sites 5 AM unattended writer has **not** been proven to support it.
- Compare historical production counts and individual records **as evidence, not equality targets**. The v28 existing Sites DB assessment observed 35,082 records across 23 app tables; these separate reads are not a recoverable or consistent SQL snapshot.
- Keep the current Sites v28 and daily 5:00 AM Central refresh untouched. A separately approved release plan, rollback, authenticated UI parity and private backup are required before a future traffic cutover.

**Links:** [Rebuild issue #12](https://github.com/jabelburns/clarityforus-site/issues/12), [House query-budget issue #10](https://github.com/jabelburns/clarityforus-site/issues/10), [recovery issue #4](https://github.com/jabelburns/clarityforus-site/issues/4), [draft PR #11](https://github.com/jabelburns/clarityforus-site/pull/11).

Official Cloudflare references: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/workers/wrangler/commands/d1/ .
