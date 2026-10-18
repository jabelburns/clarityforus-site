# Sprint 5 — FEC candidate finance explorer (2026-10-17)

**Status: offline staged implementation COMPLETE; no production deployment, refresh or database modification.**

## Feature
- Candidate/politician detail dialog now has an opt-in **Follow the Funds** panel with a selectable two-year transaction-date window.
- New read-only `GET /api/analytics/campaign?candidate=<id>&cycle=<even-year>` returns imported Schedule A receipts separately from Schedule E independent expenditures, which are split into support, opposition, unreported or conflicting position groups.
- Aggregation uses candidate-linked FEC `money_transactions` and documented Schedule E relationship codes. It avoids duplicate counting when multiple graph edges exist, uses signed cents, validates safe integers and exposes only grouped counts and amounts.
- Up to twelve original FEC HTTPS source pages are provided; the panel clearly labels them as source pages, not necessarily line-level filing citations.
- Endpoint rejects bad candidate IDs, invalid years and any entity type other than candidate/politician. Individual donor names, addresses, employers and contribution-level records are not returned.
- No new D1 migration, no new external API key, no changes to ingestion or the existing daily refresh automation.

## Verification
- **52/52 targeted Node tests PASS** across Sprints 1–5; Sprint 5 adds nine tests for cycle windows, hostile input, disparate financial categories, reported support/oppose, conflicts, refunds, invalid totals and zero-record claims.
- **Synthetic SQLite schema test PASS**, applying both recovered migrations and exercising support/opposition and conflicting claims in a sample database, validating referential integrity.
- **137 JS/TS source files parse with zero syntax errors**; the browser app passes `node --check`.
- Minimal patch: seven files, SHA256 `e049ecd27aa4c393adca09a4ea67bc22b27b8df559dd071c8f9d77513a6b82e9`.
- Complete private **v32 staging source** (167 source files + manifest/readme), SHA256 `450631dfdd546ef7e4aa179e6996ba7309713d51439a6c182865366c7f62f7f2`.
- Both ZIP archives CRC-verified, file-level SHA-256 checked against their manifests.

## Important interpretation
- Original v28 FEC Schedule A ingestion was *deliberately a bounded sample*, and Schedule E ingestion can be partial. These numbers must **never** be described as candidate totals raised, total spending, or total FEC disclosures.
- Cycle selector applies only a two-calendar-year **transaction-date** window, not a verified filed FEC cycle for each record.
- Separate receipts, outside support, outside opposition and uncertain positions. Do not add them into one headline total or suggest an improper relationship.
- This view shows no donor PII and must not be used to solicit FEC contributors. Source: https://www.fec.gov/updates/sale-or-use-contributor-information/

## Remaining integration checks
1. Reconcile staged v32 with the actual latest editable Sites code (current Site last verified source v28); avoid overwriting changes.
2. On authorized staging, install dependencies and run the full `pnpm build`, `pnpm lint`, existing ingestion tests, a read-only D1 query against one candidate with Schedule A/E examples, desktop/mobile browser and accessibility regression.
3. Confirm the candidate-level return payload, evidence URLs, no donor fields, mixed amendment/refund handling and handling of incomplete imported data.
4. Secure supported live D1 backup and scheduled-ingest owner authentication (#2–#4) before widening public access.
5. For real campaign totals and comparisons: implement FEC summary reports, fully checkpointed receipts/expenditure coverage, amendment versioning and official cycle IDs instead of relying on imported samples.

No recovered application source or private records were committed to this **public** GitHub repository; staged code is privately available as ZIPs to the owner.