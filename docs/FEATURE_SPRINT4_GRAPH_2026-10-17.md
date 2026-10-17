# Sprint 4 — Evidence-backed Clarity Graph (2026-10-17)

**Status:** Local staging code completed, tested and packaged. **NOT live on the current ChatGPT Site**; no D1 writes or production changes.

## Implemented
- `GET /api/graph/neighborhood?center=<entity-id>&depth=2`: bounded public read-only two-hop civic graph traversal, built on the **existing 23-table D1 schema**, no migration.
- `lib/graph-explorer.mts`: deterministic root-to-record paths preserving relationship direction, classification, amount/currency, dates, description and **original HTTPS source evidence**. Missing or unsafe evidence prevents the relationship from appearing in paths; no fabricated inferred edges.
- Record dialogs: “Trace documented connections” panel, opt-in "Explore evidence paths", linked records and original filings with evidence class, context, truncation and noncausation disclaimers. Current homepage 9-stage example **remains explicitly illustrative**.
- Bounds: two hops, 36 result paths, 16 frontier records per level, 150 relationship rows per hop; batched D1 lookups stay within conservative per-invocation query budget (requires measurement in actual Worker runtime).
- Does not expand individual contributor identity nodes through multi-hop graph. Source facts and potential/inferred legal links are visibly distinguished.
- Server-side input validation, HTTPS-only outgoing source URLs, strict text escaping in the UI, no graph database writes, no new scheduled background job.

## Verifications
- **12/12 new graph tests PASS**, including source omission, unsafe URLs, graph direction, no invented links, contributor privacy suppression, loops, truncated output, and fanout caps.
- **43/43 combined tests PASS** across Sprint 1 AI and analytics, Sprint 2 Senate votes, Sprint 3 official bill versions, and Sprint 4 graph.
- **134** TS/TSX/MTS/JS/MJS source files parsed by TypeScript compiler with no syntax errors; `node --check public/app.js` passed.
- ZIP CRC and per-file SHA-256 manifests verified: six-file incremental patch and **163-file complete v31 staging tree**.
- **Not verified:** package-installed full application build/typecheck, Cloudflare D1 runtime queries, automated e2e browser/mobile/a11y tests, real Site integration.
- Current Sites Library metadata remained version **28** when last checked. Sprints 1–4 are not deployed or ingested into production.

## Recovered artifacts (delivered privately, not committed to public GitHub)
- `Clarity-Sprint4-Evidence-Graph-Patch-2026-10-17.zip`: 6 files changed/new relative to **v30 staging**, SHA-256 `a4d7caf786157197dfb6ae6b55f305f084b42e345cda565d9a57afcbae71ddfd`.
- `Clarity-v31-Staging-Source-2026-10-17.zip`: 163 files, with Sprints 1–4 integrated, SHA-256 `1e4536590065bc439b25ae87bfeaf06fce3a60df25f0ad986defeba979ca73b4`.
- `Clarity-Sprint4-Evidence-Graph-Report-2026-10-17.md`.

## Integration and next product milestone
1. Reconcile **current, real ChatGPT Site editor source** with recovered v28 and staged v31. Do not overwrite later production edits.
2. In an authorized isolated staging environment, install dependencies and run test:vision, test:senate, test:bill-versions, test:graph, test:ingestion, lint, build.
3. Verify authenticated and public read-only browser paths using staging D1, evidence links, input and query limits, and mobile keyboard navigation.
4. If approved, deploy a reviewed change with backup/rollback and coordinated scheduler authentication; preserve 2026 federal records and D1 backfill cursors.
5. Then prioritize 119th Congress source-total reconciliation, data completeness, FEC money category accuracy, and CourtListener; add LDA and USAspending once records can be connected by official ID.

**No site modification, D1 writes, scheduled ingestion, GitHub source publication, production deployment or secret retrieval occurred.**
