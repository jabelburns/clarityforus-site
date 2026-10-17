# Clarity release integration audit — House roll-call D1 query budget (2026-10-17)

**Scope:** private offline v33 staging code only; no production Site/D1/automation/DNS or app-source GitHub publication.

## Corrected functional blocker
Original v33 House roll import persisted the ~435 member entities, identifier links, and member votes in chunks of 8, 12 and 15 rows. For one full vote that is **55 + 37 + 29 = 121 SQL statements** for those three stages alone. Cloudflare Workers Free permits **50 D1 queries per invocation**. For the budget-limited configuration this is a genuine release-readiness risk; it may not affect paid limits and cannot establish the historical cause of any previously incomplete live data.

The v33.1 private staging patch replaces those loops with three **parameterized SQLite JSON1** `INSERT ... SELECT ... FROM json_each(?)` queries using Drizzle bound JSON strings. One query for entities, one for external IDs and one for per-member votes. Original member names are preserved on conflict; existing official ID and vote position rows update idempotently. No schema changes or new API keys.

Official compatibility: https://developers.cloudflare.com/d1/sql-api/query-json/ confirms D1 JSON1 `json_each` plus JSON array bound parameters. https://developers.cloudflare.com/d1/platform/limits/ documents D1 50 Free / 1000 Paid queries and 100 bound params per SQL query.

## Verified offline
- **60/60 Node tests pass** across v33's seven targeted suites (8+10+13+12+9+5+3). Prior 63-test count in v33 status was a reporting mistake; the actual executed test runner enumerated **60**.
- Existing synthetic FEC finance SQLite schema regression PASSED.
- **New regression test** `tests/house-bulk-sql.py` extracts the three SQL statements from the actual changed route, executes them on recovered SQLite migrations with **435 synthetic House members**, and checks: full records, 3 statements, safe replay with corrected positions, preservation of member names, identifier URL updates, SQLite integrity and foreign keys. PASSED.
- **142** JS/TS source files parse, 0 syntax errors; browser JavaScript `node --check` passes.
- ZIP CRC and per-file manifests checked. Private two-file patch SHA-256 `4c967793095750543e33114b863b98e71fe835a09ae99233aa81329b74f382a4`. Private updated full staging ZIP SHA-256 `c62cfe6bcfd7b78ac14c83d8dbf8503011ca4d30c60d2207e8d900b5254353c6`.

## Outstanding release gates
- Project dependencies unavailable: local npm registry name resolution `EAI_AGAIN`; cannot run installed Vinext build, lint, typecheck, nor existing end-to-end mocked ingestion suite. A successful syntax parse **is not** a successful build.
- No connected first-party Sites editor or D1 administration tool is exposed; no authenticated real-worker request, no staging D1 live query measurements and no verified production database backup.
- Staged scheduler code requires separate `SCHEDULED_INGEST_TOKEN`, but existing ChatGPT scheduled refresh cannot be assumed to attach it. **Do not publish full v33.1 until a supported replacement scheduled caller is verified**, or current daily refresh will break.
- A separate FEC audit finding: Schedule E updates can leave an old support/opposition relationship because its ID includes the position; this may cause apparent contradictory classifications after corrections. Reconcile current vs superseded evidence without deleting historical filing provenance (tracked in Issue #9).
- The official live ChatGPT Site source was last verified as v28. The v33.1 local label does not represent a published Site version. Preserve all actual live edits and records when planning an authorized staging installation.

Deployment recommendation: first stage the **minimal House query-budget patch** separately against the latest authorized Site source. Re-run full dependencies/test and one real 435-member roll on staging; confirm ≤50 total D1 queries per invocation. Integrate all feature work and service authentication only after scheduler + backup readiness.