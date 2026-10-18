# Phase 0 execution status — 2026-10-15

**Verdict: source recovery and offline security/recovery preparation COMPLETE; full Phase 0 remains BLOCKED by genuine production D1 backup and authenticated runtime checks.**

## Latest verified work
- v28 source ZIP: 149/149 manifest SHA-256 entries match; ZIP CRC pass. Original source retained unchanged.
- D1 assessment ZIP: 6/6 declared hashes match, schema files identical to source v28, ZIP CRC pass.
- Two offline migrations create 23 tables, 31 explicit indexes and 39 FK declarations with valid SQLite integrity.
- Local D1 recovery toolkit: **3/3 synthetic data / SQL restore / incomplete export rejection tests pass**.
- New *private, un-deployed* security patch: **8/8 standalone Node tests pass**; patched copy parses **125 source files with zero syntax parse diagnostics**. Artifact SHA-256: `d983d28cb0c3e3adf5b884354ec73e27a21808e502c96307a277dd27e0f9054f`.
- Patch proposes: separate incoming `SCHEDULED_INGEST_TOKEN`, explicit configured first-owner bootstrap, and redaction of owner-only job cursors from unauthenticated `/api/status`. Changed files **remain local** and have **not** been pushed into the public repo or deployed.
- No full Vinext/pnpm build or D1-mocked end-to-end ingestion test: pinned dependencies unavailable and package registry unreachable from local execution.
- Saved Site is ChatGPT-auth protected (previous unauthenticated HTTP 401). No authenticated real Site/preview parity run.

## Production blocker
The recovered archives contain **schema/migration definitions but no production table rows, no backups, no backfill cursors, no owner settings and no source provenance record dump**. The dataset inventory reports counts but does not equal an export. **No record-level D1 restore has been performed.** A Sites-managed D1 binding name `DB` does not reveal an owner-controlled Cloudflare account or database UUID. Wrangler's documented D1 export is only usable if access to the **same actual** database is verified.

Direct Cloudflare/Sites/D1 administration actions are not available in the currently connected tools. Do not claim platform backup completed or attempt an unauthorized export.

## Safety and planned cutover
The installed daily Clarity refresh automation was **not modified**. The security patch *must not* be deployed before a supported way for the existing scheduled caller to attach the new server-managed service credential; deploying the patch in isolation would break scheduled updates. Existing Sites authentication headers must not be trusted when porting to an unrelated public host without a verified auth gateway.

## Phase 0 remaining gates
1. Owner-authorized native production D1 export or equivalent consistent full backup of all 23 tables.
2. Isolated record-level restore and count/hash/source-ID/cursor reconciliation at a documented capture point.
3. Full source clean install/build and ingestion regression suite against a non-production DB.
4. Authorized UI feature parity tests and deliberate public-access policy.
5. Auth hardening staging tests and a tested rollback prior to any public launch.

## Read-only verification sources
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/d1/worker-api/d1-database/ (Worker `dump()` is **alpha-only**; do not mistake it for a modern D1 export)
- https://github.com/jabelburns/clarityforus-site/issues/2
- https://github.com/jabelburns/clarityforus-site/issues/3
- https://github.com/jabelburns/clarityforus-site/issues/4

No GitHub source migration, live Site write, database change, deployment, secret change or DNS change occurred.
