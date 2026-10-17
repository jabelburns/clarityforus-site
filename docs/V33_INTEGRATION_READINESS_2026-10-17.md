# Clarity v33 integration readiness — 2026-10-17

**Result: local staging candidate prepared; production deployment remains gated.**
The owner-provided combined v32 development source was merged with the previously reviewed scheduler/owner/status security hardening without losing the Senate vote or backfill-Senate scheduled steps. Original Site and Vercel production **were not modified**.

## Artifact identity (private owner downloads; not in public GitHub)
- Complete `Clarity-v33-Integrated-Staging-Source-2026-10-17.zip`: SHA-256 `8e807d6a63cd0f9781050938864cc121d8d6d62f33a6272185bc87872f102e6e`, 173 source/supporting files.
- Minimal `Clarity-v32-to-v33-Security-Integration-Patch-2026-10-17.zip`: SHA-256 `046f9131ff476e580bfa3557a59860804966ea195352931db8f150d13e44972f`, 11 file entries including the README.
- Combined version includes the earlier five local feature sprints: AI citations and coverage, Senate roll-call ingestion, official bill text versions, two-hop evidence graph, and candidate finance analytics.
- No original v28 source paths were removed in transition to v32. Credentials and private D1 rows are not in these archives.

## Tests completed
- **63/63** dependency-free Node tests pass (five feature suites + Phase 0 auth/owner/telemetry tests + new scheduler step-preservation contracts).
- **141** JS/TS source files TypeScript syntax-parsed without errors; browser JS `node --check` passes.
- Offline synthetic SQLite campaign-finance regression passed against original D1 migrations.
- ZIP CRC integrity and manifest per-file SHA-256 match.
- Targeted embedded-secret token pattern search found no high-confidence matches, but is not a full security audit.
- **Not run:** complete pinned dependency install, Vinext build, lint, existing D1-mocked ingestion tests, authenticated staging D1/browser/mobile tests. `registry.npmjs.org` returned DNS `EAI_AGAIN` from this environment.

## Critical cutover ordering
**DO NOT DEPLOY v33 to the current Site without replacing/testing the existing scheduled refresh caller first.** The merged `/api/ingest/scheduled` route rejects callers lacking a **distinct, server-only** `SCHEDULED_INGEST_TOKEN`. The existing external daily Clarity automation does not currently supply that bearer header. A unilateral deployment breaks scheduled refresh. New/empty D1 requires trusted server-side `CLARITY_OWNER_USER_ID`; existing owner settings remain authoritative. Public `/api/status` suppresses owner-only ingestion/backfill telemetry.

## Integration boundaries
Current ChatGPT Site Library last verified code **version 28**. Staging code `v33` is a **local label**, not a verified Site deployment version. Available connected tools can inspect GitHub and the saved rendered Site but cannot edit the actual ChatGPT Sites project or access its managed D1 backup. The GitHub repository is **public**, and its `main` branch is the older landing page; the private review source archive was not uploaded as a public repo.

## Required next steps
1. In authorized original Sites editing context, compare fresh source with v28/v33 and preserve intervening edits.
2. Use a separate staging D1, install dependencies, run full build/lint/ingestion suite and authenticated regression across AI/Senate/bills/graph/finance.
3. Obtain a real recoverable production D1 export and staging restore, or document and approve a tested backup alternative (Issue #4).
4. Coordinate a server-managed scheduled service credential with the external automation and test one end-to-end call **before** promoting the protected route (Issue #3).
5. Confirm rollback, mobile accessibility, per-invocation D1 cost and evidence semantics; only then consider production deployment.

No production changes, new ingests, DNS edits, secret retrieval or GitHub source publication occurred. Prior reports in this branch document earlier Sprints 1–5 and schema recovery.
