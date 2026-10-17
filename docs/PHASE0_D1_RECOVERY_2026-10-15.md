# Phase 0 — D1 recovery assessment received (2026-10-15)

**Status: PARTIAL. Recovered schema verified; live data backup and isolated restore remain unavailable.**

## Package verification (offline)
Owner-provided `Clarity-for-US-D1-recovery-assessment-2026-10-15(1).zip` has SHA-256:
`90fbe37694f11245eb4ae633c589010371c44575759c284a404b593c42099c1c`

- Archive CRC integrity **PASS**.
- `SHA256SUMS.txt`: **6/6** declared files match.
- Six schema/migration/snapshot files are **byte-identical** to the source-v28 archive.
- Both SQL migrations apply to temporary in-memory SQLite in documented order, generating **23 expected tables, 31 explicit indexes, 39 FK definitions**.
- SQLite integrity_check **ok** and foreign_key_check empty on the **empty reconstructed schema**.
- This is a local schema test **only**, not an actual D1 data recovery or production integrity check.

## Package-reported production counts
Supplied read-only status report timestamp: **2026-10-15T23:44:23.164Z**. These counts are **reported by the owner-supplied Site assessment, not independently queried by this audit**.

| Data | Reported count |
|---|---:|
| entities | 1,600 |
| relationships | 2,026 |
| member_votes | 7,789 |
| money_transactions | 280 |
| offices | 439 |
| bills | 52 |
| executive_orders | 50 |
| committees | 26 |
| candidacies | 21 |
| votes | 19 |
| elections | 18 |
| court_cases | 3 |
| analyses | 0 |

Entity subsets reported: politicians 539; candidates 49; contributors 89; contribution entities 230; independent-expenditure entities 50. They are subsets, not separate total row counts. An earlier **1,597 connected-record** UI figure is from a different reported time/definition and should not be conflated with the 1,600 `entities` table rows.

**Ten tables without validated counts**: `analysis_findings`, `backfill_jobs`, `bill_sponsors`, `case_challenges`, `entity_aliases`, `external_ids`, `ingest_runs`, `site_settings`, `source_records`, `sources`.

## Critical limitation
The ZIP **does NOT contain** a production D1/SQLite dump, row exports, provenance records, external IDs, saved cursor state, site settings or production secrets. Its README explains that available Site tools permit only bounded row reading, without arbitrary SQL, atomic snapshot or downloadable backup. Do not mistake schema recreation or re-ingestion from third-party official APIs for exact restoration.

## Phase 0 next steps
1. Request native platform-level D1 snapshot/backup/export via authorized owner or Sites/Cloudflare support; verify feasibility without changing production.
2. If unavailable, design and security-review a **strictly authorized, read-only, snapshot-aware, versioned export mechanism** capable of capturing all 23 tables privately with hashes, completeness checks and reconciliation. Do **not** expose sensitive operational/private rows via public endpoints.
3. Restore a **real record-level backup** to isolated staging; compare stable record IDs, edge references, source evidence, row counts and backfill cursors at fixed timestamp.
4. Run source clean install/build/regression/security tests and authorized live feature tests.
5. Ensure public access and owner/system-service authentication are hardened, particularly the existing scheduler auth issue #3.

**No production code, D1 data, domains, secrets or live access permissions were changed during this audit.** Keep issue #2 open.