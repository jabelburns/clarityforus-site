# Feature Sprint 3 — Bill text version integrity (2026-10-17)

**State:** Developed against the previous v29 staging candidate. **Not installed in the current production ChatGPT Site**, which was last verified as version 28. Production database and external daily refresh remain unchanged.

## Implemented in private staging source
- Pure official bill-version normalization utility (`lib/bill-text-versions.mts`) groups several XML/HTML/PDF formats under a single official date-and-type version, validates Congress.gov/GovInfo HTTPS URLs, and warns about incomplete or failed source-list coverage.
- Existing Congress.gov `/bill/{congress}/{type}/{number}/text` hydration raised bounded result count from 20 to 250 per call; no silent claim of full coverage when the source reports more versions.
- New **read-only** `GET /api/bills/[id]/versions` exposes published links, version count, reported total, source retrieval time and coverage warnings. No new private data is exposed.
- Bill profile dialog groups text versions correctly and links original version formats, disclosing source incompleteness.
- New AI bill explanations persist an exact version reference (`source_records` row keyed by generated analysis ID) to identify when a subsequently ingested official version differs from the one examined. This uses existing source records, **no migration**.
- Record dialog and bill analysis GET return `newer_version_available`, `same_version_reference`, `unverified` or `not_generated`. Matching a link does NOT prove that official text bytes have remained unchanged.
- Fail closed for PDF-only latest versions, source-text endpoint failures, incomplete version counts, and ambiguous multiple versions dated the same day; never quietly analyze superseded readable text.

## Verifications
- **31/31 dependency-free scoped tests pass**, including 13 bill-version cases, 10 Senate roll-call cases, and 8 original AI/analytics cases.
- **131** JavaScript/TypeScript source files parse with zero syntax diagnostics; `public/app.js` also passes `node --check`.
- Final eight-file patch ZIP: `Clarity-Sprint3-Bill-Versions-Patch-2026-10-17.zip`, SHA256 `f7056eccbd45636deca08f92fce0bf30f95a49c7decb888626859de742a85849`; full staging source `Clarity-v30-Staging-Source-2026-10-17.zip`, SHA256 `6afbffb3b91aa3e7bd9653436f26e1cbd4fa40461994e2f21eab10172b21b6a7`.
- Both archives passed ZIP CRC checks; individual files have SHA-256 manifest entries.
- No clean dependency-installed Vinext build, full TypeScript type check, authenticated live browser or D1 end-to-end regression was possible. This is **not a deployed feature**.

## Limitations and next step
- No full text-package archival. The existing analysis generator can fetch and store a *bounded* readable snapshot when explicitly asked by an authorized owner, but the new version index itself stores **links and labels**, not all original bill text bytes.
- Pagination beyond 250 versions, source hash snapshots, exact effective version timestamps, GovInfo package storage, and stale-by-content-hash remain open.
- A complete production D1 export and staging restore are still open; scheduler caller-auth hardening remains open.
- Rebase on the **latest actual Site editing source** before installation; run dependency-installed build, database tests and a one-bill test, then advance 119th Congress backfill cautiously.

Official API semantics: https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md
Primary data sources: https://api.congress.gov ; https://www.govinfo.gov/developers

No source files or private records in this documentation-only GitHub branch; local full source staging ZIP is available to the owner separately.