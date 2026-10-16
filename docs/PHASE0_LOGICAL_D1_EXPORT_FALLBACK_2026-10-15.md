# Phase 0 continued — transactional D1 logical-export fallback prepared
Date: 2026-10-15 | Review-only artifact; no live Site deployment or database reads

## Why this exists
The Site v28 source and D1 schema have been recovered, but no genuine production D1 SQL/data backup is available through connected Sites controls. The owner has no verified Cloudflare account/database-ID access for this Site-managed D1 database. Native Cloudflare D1 export remains the first choice if authorized access becomes available.

## New tested alternative — private, manual, opt-in
A local review-only ZIP (delivered separately to owner) contains an optional **owner-only D1 logical export route**, a fixed v28 23-table schema lock, read-only batch snapshot logic, Python offline restore/validation, both recovered migrations and dependency-free synthetic-data tests.

**Delivered private ZIP SHA-256:** `eea989332726b88437a1ae2ae1604761773d71631d44831f245b538bf0c3aade`

Implementation design (not deployed):
- Explicit `CLARITY_D1_LOGICAL_EXPORT_ENABLED=true` gate, otherwise HTTP 404.
- Owner ID from verified Sites identity header must match BOTH configured `CLARITY_OWNER_USER_ID` and already-stored `site_settings.owner_user_id`; **no database owner bootstrap/write**.
- Separate 32+ character `CLARITY_D1_EXPORT_TOKEN`; cannot export using ordinary unauthenticated browser access. All secrets remain server-side.
- No-store, attachment-only response, no payload rows or secret values in logs/errors.
- One `D1.batch()` read transaction: **23 data selects, 23 count selects, one schema select** = 47 queries, plus one owner lookup = 48, below current Cloudflare Workers Free 50-query invocation limit.
- Validates all 23 expected application tables, column lists, counts and output limit; fails closed if partial or larger than 40 MiB.
- Private JSON logical export retains owner settings, ingested source records, identities, graph edges, monetary records, and durable backfill cursors. Python utility restores to a **new** isolated SQLite file using the recovered migrations and verifies hashes, counts, SQLite integrity and foreign-key consistency.
- The exported JSON is **not** a Cloudflare-native physical backup and omits certain platform metadata, secret values and automation configuration. Cloudflare runtime/Sites identity provenance must be verified in authorized staging before any optional deployment.

## Tests run, offline with synthetic data only
- **8/8 PASS** in the source directory AND **8/8 PASS** when re-executed from a newly extracted ZIP.
- Tests cover read-only single-batch snapshot; token, owner and disabled-by-default gate; no-store response; incomplete and changed schema rejection; oversized response rejection; protected owner ID/backfill cursor/graph preservation; Unicode/BLOB fidelity; private SQLite restore; no-overwrite and tamper rejection.
- Prior 8/8 standalone security tests for scheduled ingestion/owner bootstrap also pass, but their patch has NOT been deployed.

## Remaining Phase 0 gates
1. Confirm native D1 export availability for the **actual** Site-managed DB (preferred).
2. If unavailable, review and stage the opt-in logical fallback within the authorized **original Site editing context** with verified platform identity-header handling and secure server-side credentials. Do not expose the endpoint in an untrusted new hosting environment.
3. Authorize one private production capture, disable the export endpoint afterwards, verify **all 23 tables** and restore into isolated staging. Never post raw rows or owner settings to this public GitHub repository.
4. Full application clean install/build/ingestion tests and authenticated parity tests.
5. Coordinate separate scheduled-ingestion authentication fix with active daily automation; do not deploy uncoordinated.

Cloudflare sources:
- Transactional D1 batch: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Preferred native export: https://developers.cloudflare.com/d1/best-practices/import-export-data/

**This documentation records a prepared and tested fallback, NOT production backup completion.** Keep issues #2, #3 and #4 open. No live changes were made.
