# Clarity for US — Phase 0 source preservation and recovery runbook
Prepared 2026-10-15. This is a **plan, not an executed backup or restore**.

## Strict no-change boundary
Do not change the live ChatGPT Site, visibility, DNS, D1 data, secrets, cron jobs or Vercel production.
Do not merge PRs, deploy previews intentionally, or publish confidential data.
Source and backups remain private; GitHub repository is **public**.

## A. Inventory from original authorized Site editing context
Open the **existing** `clarity-for-us` Site's editing conversation, not a new Site or the Vercel landing project. Request a read-only inventory:
1. All frontend and server file paths, exact package/build manifests, runtime versions and assets.
2. Route table, API endpoints, auth roles, environment and deployment design.
3. D1 binding names, schema, tables, indexes, migrations, retention, storage location and safe export/backup options. **Schema and names only** in public documentation.
4. Scheduled tasks, ingestion source list, checkpoint/cursor storage, retry logic, health status.
5. Connector and secret **names**, scope, expiration and target environments only; **do not request or display values**.
6. The supported owner-authorized mechanism to export **complete source code**, configuration templates and recoverable data. If unavailable, obtain the individual allowed files and document missing proprietary components.
7. Any custom access restriction that causes unauthenticated visitors to receive HTTP 401; determine the intended public/private-beta posture without altering it.

Do not treat UI snapshots, screenshot transcription or old GitHub landing as a source export.

## B. Capture and secure source
- Save a true source archive, if supported, outside the public repository; compute checksums and inventory file paths.
- Scan all exports for keys/tokens, personally identifying fields, private DB rows, .env files and build artifacts; exclude them from public commits.
- Create sanitized `.env.example` listing names and descriptions only.
- Record exact dependency/lockfile versions, backend bindings and migration order.
- Confirm static assets and licenses; preserve all working routes.

## C. Database recovery rehearsal
1. Obtain owner-authorized snapshot or documented export of D1 at a fixed timestamp, with schema and relevant migration files.
2. Keep the database backup private and encrypted; record checksum, timestamp and retention location in **private** notes.
3. Record non-sensitive table-level counts and referential-integrity indicators for baseline.
4. Restore a copy into an **isolated staging database**, not production.
5. Verify sample public record IDs and sourced cross-entity edges; compare table counts and content checksums where safe.
6. Confirm restore does not require rotating or copying production keys into GitHub.
7. Log tested restore steps and recovery time. Until the restore succeeds, status is **NOT RECOVERABLE VERIFIED**.

## D. Feature parity evidence
- From authenticated editor/owner context, capture desktop and narrow-screen screenshots for: Home, Search, filters, member/candidate, bill, money, vote, order, court, graph, AI analysis, Data status/admin.
- Run every case in `PHASE0_ACCEPTANCE_MATRIX.md`, recording PASS / FAIL / BLOCKED and URLs/source IDs where public.
- Preserve source-backed vs illustrative/demo labels.
- Compare candidate replacement previews against these screenshots and test results.

## E. Parallel GitHub staging
- Keep `main` and the live Site intact.
- Use existing draft PR #1 for documentation only and a **new migration branch** for any recovered real application source.
- Establish reproducible clean build, CI checks, secret scanning, preview parity testing, regression tests.
- Avoid an automatic production promotion. Authorize any cutover separately after complete backups, functional parity and rollback rehearsal.

## F. No-export contingency
If the Site cannot provide complete source:
- Formally record exactly what is unavailable.
- Leave the Site live and keep updating it only through normal authorized workflow.
- Recreate behavior in controlled vertical slices using official data sources and portable components. Never pretend a visual imitation contains the original source or D1 data.
- Move data only through supported authorized export/import mechanisms, or rebuild public official datasets while preserving provenance; never rely on scraping private authenticated output.

## G. Production cutover readiness
Before any cutover, require:
- Reproducible code and database migrations, secrets scoped server-side;
- Verified staging restore and backup;
- Parity tests with no critical regressions;
- Security/privacy/access review;
- Documented domain/hosting cutover and rollback;
- Explicit owner approval of the specific target deployment.

## Current decision log
2026-10-15:
- Active Site reported as version 28 via Library.
- Unauthenticated external HTTP request returned 401 login page; public access intent unknown.
- GitHub default branch and Vercel production point to old static landing.
- Site code/runtime/D1 export capability unavailable through the tools in this audit.
- Safe next action: authorized read-only source manifest and D1 backup discovery, **not** migration or deployment.
