# Clarity for US — D1 backup and v33.1 release gates (2026-10-26)

**Status: NOT RELEASE READY.** This document is operational guidance, not a claim that a production backup exists. Nothing below authorizes editing the live database, changing the Site, modifying the daily refresh, or deploying a release.

## Verified as of 2026-10-26

- Public repository `jabelburns/clarityforus-site`: `main` remains the old landing page, **not** the running ChatGPT Site.
- The reviewed `clarity-sites-v33-1-handoff` branch now contains the sanitized source ZIP and unpacked 173-file manifest; the archive verification job passed.
- The separate `codex/v33-1-ci-review-2026-10-26` branch fixes two lint findings and runs a pinned dependency installation, feature/security and ingestion tests, 435-member House bulk SQL regression, synthetic FEC finance SQLite test, offline D1 restore tests, lint and Vinext build. This is **CI only**, with a disposable `.openai/hosting.json` containing the local name `DB`, no real platform identifier or credential.
- The scheduled ChatGPT task `Refresh Clarity federal records` is enabled daily at **5:00 AM America/Chicago**. Its existing prompt uses the Site's unattended writer to POST ingestion steps, but **there is no verified evidence its requests contain the new separate `Authorization: Bearer <SCHEDULED_INGEST_TOKEN>` header.** No task changes have been made.
- No owner-controlled access to the real Sites-managed D1 instance, no production SQL/row export, no independent 23-table count baseline, no authenticated UI parity run, and no isolated restore of real data are currently available. A 2026-10-15 recovery assessment reported partial live counts only; it is NOT a row backup.

## 1. Preferred: native, authorized full D1 SQL export

1. In the **actual authorized Sites editing environment**, determine whether the Site's managed `DB` binding maps to a D1 database that is listed in an **owner-controlled Cloudflare account**. The Sites project ID, a placeholder UUID in source, and the binding name `DB` are not proof of Cloudflare database ownership or access. Do not guess identifiers.
2. If accessible and the account owner authorizes the impact, use Cloudflare's supported D1 export. Example only after confirming `<ACTUAL_D1_NAME>` and the correct account:
   ```sh
   npx wrangler d1 export <ACTUAL_D1_NAME> --remote --output=./clarity-private-d1.sql
   ```
   This captures schema **and** rows unless `--no-data` is specified. Cloudflare states that a running export can block database queries; choose an appropriate maintenance window and coordinate with the existing 5:00 AM job. Do **not** attempt this against an unknown database.
3. Keep the SQL outside public GitHub and public chat; it may contain owner IDs, settings, import jobs, source records, sensitive contributor data, and persistent internal IDs. Apply private encrypted storage, access controls and retention.
4. Cloudflare Time Travel provides point-in-time rollback **on the same D1 instance**, with retention limits. **Never run `d1 time-travel restore` on production as a backup test**; it overwrites the production database. Time Travel does not itself deliver a portable SQL data export.

Official references (checked Oct 26, 2026):
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/platform/limits/

If account-controlled export is **not supported for this Sites-managed DB**, explicitly record the provider access limitation and seek a platform-supported owner-authorized export. The private, owner-gated logical-export fallback described in Issue #4 remains **review-only, not deployed**; do not install a public export endpoint or disable owner controls.

## 2. Verify a real export OFFLINE, without writing to production

A tested source-only CLI on this PR branch is:

```sh
python3 site-source/source/tools/verify_d1_export.py /private/location/clarity-private-d1.sql
```

It imports trusted SQL into a disposable local SQLite database, derives the expected 23 tables and named indexes from the original two migrations, checks integrity and foreign keys, and prints table counts and the export SHA-256 **without printing record contents**. The SQL is never committed by this tool. It fails on empty, missing-table, damaged-schema or invalid referential data.

For a separately captured **complete**, independent table-count baseline (all 23 known app tables), supply a private JSON file:

```json
{"tables": {"<every_application_table>": 0}}
```

The example illustrates the format ONLY; do not invent zeros or replace real counts. Then run:

```sh
python3 site-source/source/tools/verify_d1_export.py /private/location/clarity-private-d1.sql --expected-counts /private/location/counts.json
```

- `RESTORE_ONLY_BASELINE_UNVERIFIED`: isolated structure, data presence and referential integrity verified, **not** an independently complete production backup.
- `RESTORE_AND_COUNTS_MATCHED`: local restore and all independent table counts match. An authorized native point-in-time export origin still must be established.
- `BASELINE_MISMATCH` / `RESTORE_FAILED`: **STOP**. Do not replace or migrate the live database.

Do not use a stale Oct 15 partial count snapshot as a hard equality baseline for a continuously ingesting Oct 26 database. Record independently gathered counts, capture time, migration versions and export hash in private evidence.

## 3. Isolated application staging (after real data is recoverable)

- Compare latest **authorized** Site source/hosting configuration against v33.1; v28 was the last independently verified source, and there may be newer live modifications.
- Restore the verified SQL into a separate test database/account with unrelated credentials and no production binding. Confirm all 23 app tables, import checkpoints, historical relationships, vote positions, elections and protected owner state.
- Prove a 435-member House roll with its **complete** D1 request/query budget under a realistic nonproduction Worker; the SQLite regression verifies only the three bulk writes, not total request costs.
- Test search, individual official-source links, House/Senate votes, bill text versions, candidate/FEC disclosures, PAC/Super PAC classifications, CourtListener pending/blocked state, graph privacy, AI citation integrity, owner-only refresh, mobile behavior, and error/empty-state handling against the documented 23-case parity matrix.
- Compare official publisher totals and live cursor progress. Staging must never run backfills or cron jobs against production D1.
- Capture a reviewed rollback (versioned source, verified private SQL dump, validated permissions, and scheduler fallback) **before** granting deployment approval.

## 4. Scheduled-refresh cutover: do not disrupt the live task

Current source v33.1 `app/api/ingest/scheduled/route.ts` requires a new incoming `SCHEDULED_INGEST_TOKEN` Bearer credential **before** it calls the internal ingest handlers. The old separate `INGEST_TOKEN` is used for the protected internal calls and is not an interchangeable service credential.

The enabled automation is a 5:00 AM task using an unattended Site writer. Its task prompt does not establish support for arbitrary outgoing HTTP `Authorization` headers. A prompt edit is **not** a credential migration.

Release gate:
1. Verify a trusted, secret-capable scheduler delivery mechanism that can send the new Authorization header without putting a token in source, prompts, chat, GitHub, public logs or URLs.
2. Stage a distinct, at-least-32-character secret through protected runtime settings and the staged caller configuration. Never use production keys for mock CI.
3. Test rejected anonymous requests, invalid service token, authorized one-batch ingestion, response status, duplicate/idempotent cursor preservation and failure alerts in isolation.
4. Arrange an atomic cutover and immediate rollback option; only then swap the Site endpoint and scheduled caller. Retain today's enabled production task unchanged until those checks succeed.

## Decision

**NO-GO production migration.** The source CI gate can be completed on the review branch, but the real D1 export/restore, live-source parity, authenticated test environment and scheduled-credential cutover are mandatory. Keep draft PR #11 open and keep original handoff ZIP/hash unchanged until a reviewed new sanitized package is generated.

Related issues: #2 (source), #3 (scheduled auth), #4 (backup), #5 (feature parity), #10 (House query budget), and draft PR #11.
