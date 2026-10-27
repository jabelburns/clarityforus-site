# Clarity for US — isolated database rebuild plan (Oct 27, 2026)

**Decision:** Continue app development and build a **new database in an isolated environment** rather than waiting indefinitely for an unavailable Sites-managed D1 export. **Do not delete, overwrite, backfill, migrate, or deploy into the existing `clarity-for-us` Site or its bound `DB`.** Do not change its 5:00 AM America/Chicago automatic refresh.

**Evidence:** An authorized read-only Sites assessment inspected 23 production app tables in deployed source v28 and reported 35,082 rows. Full count/method/timing metadata are preserved in [PRODUCTION_D1_READONLY_INVENTORY_2026-10-27.json](./PRODUCTION_D1_READONLY_INVENTORY_2026-10-27.json). This file contains **only aggregate counts**. Thirteen tables were counted by verified app `COUNT(*)`, ten by complete Sites pagination (with some field values truncated), and all 13 direct counts remained stable across the inspection window **2026-10-27 16:07–16:14 UTC**. This is **not a transactional snapshot, export or database backup**. The live migration ledger and physical D1 owner IDs were not exposed.

Cloudflare documents that native exports can block database requests. The Sites-managed binding does not expose that native export via available Sites owner tools. A private export remains an optional parallel support escalation, not a prerequisite to **nonproduction** rebuilding. Native provider references:
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/
- https://developers.cloudflare.com/d1/platform/limits/

## Phase 0: protect the original and define the new boundary

- Keep the existing live `clarity-for-us` Site, original managed `DB`, deployment, access controls, owner setting and daily 5 AM writer unchanged.
- Leave GitHub `main` (old static landing site) and `clarity-sites-v33-1-handoff` (immutable v33.1 sanitized ZIP + original SHA manifest) as separate baselines. Work only in a dedicated review branch / draft PR.
- Compare staging v33.1 with the latest **authorized** source currently deployed in Sites before implementing features or promotion. The assessment reported deployed v28 commit `a66c3ea8b41b4118ebabe52da49529d8baf7fc51`, not an independently obtained new export.
- The new database must be bound only to new isolated test Workers/Pages/Sites, using unrelated credentials. Do not copy real production keys or platform-specific `.openai/hosting.json` into GitHub.
- Maintain an explicit independent backup policy for the *new* owner-controlled database from day one, if an owned D1 service is selected.

## Phase 1: build a controlled empty staging DB

- Use the two existing reviewed source migrations `0000_amused_stature.sql`, `0001_flippant_thunderbolt.sql`; verify exactly 23 app tables and all expected indexes/FKs.
- CI already passes a Wrangler **local-only**, synthetic data export/restore and table-count inventory using placeholder D1 UUID. [Example passing run](https://github.com/jabelburns/clarityforus-site/actions/runs/40430013931). This is **not a remote staging D1 instance**.
- Add an isolated remote staging environment only after its account, new D1 ID, platform bindings and credential ownership are established. Do not attach the existing Site's managed `DB` to that environment.
- Require independent `PRAGMA integrity_check`, `PRAGMA foreign_key_check` and no unauthorized owner bootstrap; build/lint and mock authentication checks must pass.

## Phase 2: reconstruct official-source data, source by source

**Use repeatable, add/upsert-only ingestion with stable official IDs, source evidence URLs, retrieval timestamps, bounded batches, durable cursors and idempotent retries.** Start with a known congress/election period and document data windows. Compare counts and provenance; published totals can change with amended disclosures.

1. House: official membership, roll metadata, individual voting positions, bills/measure links. Preserve 435-member roll and all positions; total D1 Worker query budget (not just three bulk SQL statements) must pass in an actual **isolated** D1 Worker.
2. Congress.gov: bills, sponsors, cosponsors, committee references, action dates and official text versions; preserve each official version/format, never invent bill-to-person relationships.
3. Senate LIS: official roll details and roster identity, session/history cursor, individual positions; no fuzzy identity matches.
4. Federal Register: executive orders, signers and citation metadata, retaining direct official links.
5. FEC: candidates, committees, candidacies, receipts and independent expenditures. Separate itemized receipts, PAC/Super PAC disclosures and support vs opposition; track amendments/refunds; exclude personal contributor details from public APIs.
6. CourtListener/court records: only when proper API access exists; record blocked/missing access explicitly rather than inventing case links.
7. Derive and verify `entities`, `external_ids`, `entity_aliases`, `relationships`, `source_records` and `sources` **only from grounded publisher records**, with conflict and duplicate review. Keep source-backed evidence tied to every graph edge.

A failed batch must retain its prior successful cursor. Never infer database completeness from one successful run or a zero-row response.

## Table coverage and irreplaceable/operational state

- **Historical source-grounded rebuild targets:** `bills`, `bill_sponsors`, `candidacies`, `committees`, `court_cases`, `case_challenges`, `elections`, `entities`, `entity_aliases`, `executive_orders`, `external_ids`, `member_votes`, `money_transactions`, `offices`, `relationships`, `source_records`, `sources`, `votes`. Coverage must be reconciled by source URL, official record identifiers and date window, not just counts. **Some historical raw records, manual aliases or source snapshots may be unavailable for re-fetch.**
- **Fresh-instance operational tables:** `backfill_jobs` (5 live rows), `ingest_runs` (223 live rows), `site_settings` (1 live row). These must be created/configured anew for the new environment, **not copied from a public pagination scrape**. Historical ingestion log continuity and owner setting are **not preserved** absent a genuine private backup.
- **Saved AI history:** `analyses` and `analysis_findings` reported zero live rows. Do not fabricate prior analyses; require fresh source-version-grounded citations for any new analysis.

**Owner-specific settings, manually reviewed identity links, historical raw snapshots and private records are potentially irrecoverable without a supported private export.** Treat this as a known difference requiring an explicit release decision, never conceal it by counting newly fetched equivalents.

## Phase 3: run a documented independent baseline comparison

Tool:

```sh
python3 site-source/source/tools/compare_rebuild_counts.py
python3 site-source/source/tools/compare_rebuild_counts.py --candidate-counts /PRIVATE/metadata-only-staging-counts.json
```

An optional candidate counts file has exactly `{"tables": {"analyses": 0, "...": 0}}`, with real nonnegative integer values for all 23 named tables. All staging table counts must be independently measured. The tool reports historical-versus-staging deltas and groups source-data reingestion, identity-review, and operational-state differences. **Matching counts never prove correct identities, amount totals, provenance, restored owner state, consistency, or safe cutover.** This is a **dashboard check**, not migration certification.

Independently test sample official source URLs/IDs, row-level foreign key relationships, roll-call totals, FEC transaction type and cents, current bill-text versions, exact congressional date windows, and identity review queue.

## Phase 4: design scheduled ingestion for the NEW staging service

The v33.1 route requires an independent incoming `SCHEDULED_INGEST_TOKEN` Bearer header plus protected internal `INGEST_TOKEN`. The current 5 AM owner-authenticated Sites writer has **not** been proven to support that header. Do **not** paste a token into its natural language prompt or deploy hardened v33.1 there prematurely.

An independently controlled scheduler for new staging (such as a platform native scheduled Worker/cron or a secret-capable protected job) must be tested with nonproduction credentials, authenticated service calls, 401/403 failure behavior, batch replay, cursor persistence, rate limits and alerting. If that cannot be configured, leave staging ingestion manually/explicitly triggered in protected test-only workflows.

## Phase 5: compare product behavior and evaluate cutover

- Authenticated desktop and mobile smoke/parity matrix: civic search, politicians, bills, sponsor/roll positions, legislative text, official sources, finance and Super PAC links, graph paths, judicial records, bill AI citations, freshness, permissions and owner-only status.
- Verify safe privacy and donor-data boundaries, no false causal claims, and explicit "not available" for missing upstream data.
- Document count and record-level differences, especially manual identities/operational history.
- Only after independently owned staging D1, tested backups/restores, completed feature parity, working scheduler and an owner-approved rollback should a new service be considered for public launch. Keep the original site live as a read-only reference through transition; do not switch DNS, deployment, or traffic in this review PR.

## Gate status at authoring

| Gate | Status |
| --- | --- |
| Recovered source and sanitized staging GitHub code | PASS (existing handoff) |
| Source lint/test/build and local Wrangler D1 export restore | PASS (synthetic/CI only) |
| Real existing Sites-managed D1 SQL export | UNAVAILABLE via current tools |
| Production individual row recovery | NOT VERIFIED |
| New independently controlled remote staging D1 | NOT CREATED |
| Actual official-source staged reingestion | NOT STARTED |
| Independently validated row-level source parity | NOT STARTED |
| Trusted production scheduler cutover | NOT VERIFIED |
| Production release | **NO-GO** |

This strategy does not claim zero historical data loss. It separates rebuilding reproducible public records from recovery of the prior database's private and manual state.
