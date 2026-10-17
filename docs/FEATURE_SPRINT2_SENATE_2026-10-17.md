# Feature Sprint 2 — U.S. Senate votes and public coverage analytics
Recorded: October 17, 2026. Status: **offline implementation completed; live deployment/testing still pending**.

## Source
- Baseline remains owner-recovered ChatGPT Site v28; current Library metadata source version 28.
- Combined output includes Sprint 1 (AI bill citation integrity, latest saved analysis, direct evidence links, imported-data coverage dashboard) and Sprint 2 (Senate vote ingest, backfill and roll-call counts).
- Source v29 is a **staging candidate**, not an authorized publication or an already-deployed Site version.
- Local patch ZIP `Clarity-Feature-Sprint2-Senate-2026-10-17.zip` is **16 changed source files**, plus README, status and manifest.
- Local full candidate ZIP `Clarity-v29-Staging-Source-2026-10-17.zip` contains the entire rebuilt source tree with both sprints. No live D1 records or secrets.
- Final patch ZIP SHA-256: `97c452b16ab86fa19057a51e7aa5af47bd8287820b1f3aa7d0d6f42c70440e4a`.
- Full staging ZIP SHA-256: `d8f6b50304432a5fa6cf776e2efcb00b288935c32308ac0312e1387b64857e59`.

## Data pipeline
- New official source: Senate.gov Senate Legislative Information System XML, individual member vote list, and current Senate roster.
- `lib/senate-votes-core.mts`: normalizes Senate vote/list/roster records, validates individual positions against official tallies, preserves voting question and measure type; non-bill nominations/standalone amendments never become fictional bills.
- `lib/senate-lis.ts`: bounded official HTTPS/XML reader for 119th Congress sessions 1 and 2, one roll call per request.
- `app/api/ingest/senate-votes/route.ts`: idempotent source, external ID, record, votes/member_positions and `concerns`-edge upserts in the existing 23-table schema. No new migration.
- `lib/ingest-progress.ts` and `app/api/ingest/backfill/route.ts`: stable Senate `congress:119,session:2→1,beforeRoll` cursor, with progress validation and nonadvancing-cursor rejection.
- `app/api/ingest/scheduled/route.ts`: adds disabled-in-practice logical step names `senate-votes` and `backfill-senate-votes`. The **existing external automation does not yet call these steps**. Do not update production automation or widen access until scheduled-ingest authentication issue #3 is resolved.
- Matching Senate LIS IDs to Bioguide IDs uses exact unique member label/party/state correspondence from **two official Senate.gov feeds**; unmatched/ambiguous people remain separate provisional LIS identities. Never fuzzy-merge identities.
- `app/api/analytics/overview/route.ts` and `public/app.js`: read-only `rollCallsByChamber` panel; counts are imported roll calls, not nationwide completeness or passed-bill totals.

## Quality verification
- **18/18 offline tests PASS**: 10 Senate tests including a 100-member roll, source-vote tally reconciliation, nomination/amendment classification, duplicate/provisional identity rules and rollback-safe cursor logic; plus 8 bill-AI/source-analytics tests.
- **128 JS/TS/MTS/TSX/MJS files parse cleanly** using local TypeScript compiler; this is syntax validation, not a clean build or full typing check.
- All patch files packaged with a per-file SHA-256 manifest; ZIP CRC verification passed.
- Official upstream Senate XML listing/vote/roster shapes were checked against live senate.gov XML via read-only retrieval; no authenticated Site, D1 writes or API backfills were performed.
- Cloudflare Workers Free D1 documented max 50 queries per Worker invocation, 100 bound parameters per query; route defaults to **one** roll call with bounded inserts. Actual D1 runtime budget still needs measurement.
- The pinned dependencies were not available to perform `pnpm build`, full Drizzle/ingestion tests, or authenticated UI smoke tests. Do not claim they passed.

## Next safe deployment gate
1. Compare archived source-v28 changes to the latest active Site and apply in an authorized staging context. Keep production code and D1 intact; secure backup preferred.
2. Install dependencies and execute full suite: `pnpm run test:vision`, `pnpm run test:senate`, `pnpm run test:ingestion`, `pnpm run lint`, `pnpm run build`.
3. Authorize **one** Senate roll in a staging DB; verify source/member counts, exact Bioguide mappings, idempotent replay and total D1 queries.
4. Inspect search and person/vote/bill paths, analytics UI, graph and AI citations on desktop/mobile.
5. Roll out incremental Senate backfill in controlled batches, then coordinate new scheduled steps with a protected service-auth mechanism.
6. Existing open issues #2–#4 remain production migration/security/backup blockers; do not merge draft audit PR #1 as an app replacement.

## Official references
- https://www.senate.gov/general/common/generic/XML_Availability.htm
- https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_2.xml
- https://www.senate.gov/legislative/LIS/roll_call_votes/vote1192/vote_119_2_00119.xml
- https://www.senate.gov/general/contact_information/senators_cfm.xml
- https://developers.cloudflare.com/d1/platform/limits/