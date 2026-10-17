# Phase 0 continuation — export access and offline restore verification
Date: 2026-10-15
Status: **local recovery tools PASS; production D1 export/restore still BLOCKED**.

## New confirmed results
- Recovered Site v28 source: **111 TS/TSX/JS/MJS files** examined for syntax using the local TypeScript parser / Node checks; **0 parse errors**.
- Clean dependency install/full production app build **not run**: `pnpm@11.25.0` was not cached and the local container could not resolve `registry.npmjs.org`. Therefore **do not claim the v28 application builds or its ingestion suite passes**.
- A standard-library Python **offline D1 recovery toolkit** was prepared locally, SHA-256 `bbdf94333918ff5a9d1069d43a19376a5c24fd1e40ebaa0f29cf22372bce6699` for the complete 7-file ZIP. The toolkit does not contact Cloudflare/Sites and contains **no production row data or credentials**.
- Three tests PASS in a clean extracted toolkit directory:
  1. 23-table schema with synthetic entity, graph edge, owner setting and backfill cursor — SQLite snapshot/restore retains values and digests;
  2. SQL export from synthetic database imports to a new isolated SQLite file;
  3. incomplete SQL export is rejected and partial destination file is removed.
- Both recovered migrations are provided in the local toolkit solely to run tests. The package also includes a historical counts JSON from the owner-supplied D1 assessment.
- Freshly verified Cloudflare documentation confirms **native D1 SQL export** using `wrangler d1 export <database> --remote --output=...` and via its authenticated REST API. Native D1 **Time Travel** is also documented for authorized databases. However, this Site is on a platform-managed Cloudflare Worker/D1 environment, and we have **not verified** account ownership, underlying Cloudflare database ID, or whether the platform grants this project direct API/Wrangler export access. Do not request or paste account tokens into GitHub.
- Cloudflare's export API warns that exports may temporarily interrupt the database's serving queries; plan any authorized export carefully. Do not call Time Travel restore on production: **it overwrites the database**.

## Outstanding required actions
1. Discover **authorized native D1 export route** for this Sites-managed database (direct Cloudflare owner access if actually available; otherwise Sites/platform support). First verify that it is the same D1 binding **DB**, not an unrelated user Cloudflare account.
2. Perform a private full-data SQL export at a documented timestamp/bookmark; never store data in the public GitHub repository.
3. Run the offline verification toolkit against that export, create a manifest (23 tables, row counts, hashes, FK checks), and restore it to an isolated staging database. Compare source records, owners, logs and cursors.
4. Test full build/ingestion suite with dependencies available, and authenticated live/preview feature parity.
5. Resolve scheduler auth and first-visitor owner initialization **before** broadening public access (issue #3).

**No production reads/writes/deployments, schema migrations, secret retrieval, permission changes or source publication were performed.**

## Sources
- Native D1 import/export: https://developers.cloudflare.com/d1/best-practices/import-export-data/
- REST D1 export API: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/
- D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Prior Clarity recovery findings: [Phase 0 source](./PHASE0_SOURCE_RECOVERED_2026-10-15.md), [D1 audit](./PHASE0_D1_RECOVERY_2026-10-15.md).
