# Congress.gov full bill-subresource pagination — reviewed staging change

**Scope:** only review branch `codex/v33-1-ci-review-2026-10-26`. The live managed Sites `clarity-for-us` and its D1 `DB` remain intact; no new remote staging database, site deployment, official-data refresh or private source data export was undertaken.

## Verified upstream contract

The [Library of Congress API README](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/README.md) says v3 list responses carry a data collection, pagination count, and next/previous page URLs. The official API has adjustable `limit` and `offset`; `limit` is capped at 250. Each bill has actions, amendments, committees, cosponsors, summaries, and text endpoints. The paginator **does not request arbitrary next-page URLs**: it calculates the next numeric offset and retains the fixed official API route, API key and bill identity.

## Code implemented in the review branch

- `lib/congress-gov.ts`: add `completeBillSubresource` and use it for `actions`, `summaries`, `textVersions`, `amendments` and `committees`. The prior 250/page cosponsor pagination remains in place.
- Each subresource collects all available pages at most **8 × 250** (hard safety bound) and tracks the reported row count. If the API reports a `next` marker, page length must advance; missing/inconsistent totals, invalid/missing row collections, extra/missing rows, upstream HTTP failures and attempts to exceed the safety bound all become **explicit failures**, never a silently complete data set.
- `app/api/ingest/congress/route.ts`: before writing bill, source snapshot or graph edges, reject any `endpointErrors`. Failed ingest runs are recorded; `app/api/ingest/backfill/route.ts` preserves the bill offset on failure.
- Until per-amendment and per-committee graph writes are bulked, the route also **rejects** a projected workload exceeding **40 direct D1 operations**. Current source estimate per one-bill import is `7 + 4*ceil((sponsors + cosponsors)/200) + 3*amendments + 2*committees`; the limit reserves space for owner authentication and backfill bookkeeping under Cloudflare Free-tier's published 50 queries per invocation. **This is an estimate and not a remote Worker query trace.** Large bills are explicitly blocked rather than imported partially. Such bills require future bulk graph writes.

## Tested

**[GitHub Actions #40808536871 — SUCCESS](https://github.com/jabelburns/clarityforus-site/actions/runs/40808536871)**, synthetic-only tests on review commit `f423c91a07d1431b67a2883b054fff6f13874dd3`:

- 300 actions, 270 summaries and 280 text versions from two API pages each are retained in a bill's persisted `source_records.raw_json` (all six calls use offsets 0 and 250). Mock-D1 13 queries to ingest this bill with one committee.
- Page-two HTTP 503 causes a direct/backfill request to fail, but leaves the previous raw source snapshot and durable cursor unchanged. Retry succeeds when upstream recovers.
- False final-page marker with pagination count 300 is rejected even if the first 250 records arrived.
- A bill requiring too many amendment graph writes fails without altering its prior official source snapshot.
- Previous 300-cosponsor test still passes with 17 mocked D1 operations; 435-vote local Worker replay, full suite of **19 ingestion regressions**, lint, build and local 23-table D1 export/restore all pass.

## Unresolved limitations and launch gates

1. **This does not create a remote staging D1**, download source rows from actual Congress.gov, or verify a real Worker request on an owned Cloudflare D1 database. The required Cloudflare account/API authorization is not exposed via connected tools.
2. A request for a bill with **over 2,000 records in a subresource** now fails loudly (no silent truncation). It needs a durable per-bill endpoint cursor/snapshot or separately staged bulk pipeline to support larger lists.
3. A very large **amendment/committee** graph may fail the 40-query preflight. A separate bulk-write implementation, followed by real route-level tests, is required for full large-bill coverage.
4. Upstream `404` for a legitimately absent optional subresource currently causes a failed bill import. Determine **endpoint-specific not-applicable semantics** from official publisher documentation before normalizing any 404 to an empty complete list. Never suppress a temporary failure to make backfills appear complete.
5. Rebuild traversal currently uses Congress.gov list offsets sorted by latest update. Updates can shift the list during a multi-batch crawl, so an independent stable coverage/reconciliation plan is required before claiming complete congress-wide historical backfill.
6. The actual live production v28 schema/data cannot be exported fully via current Sites tools, and manual/private identities and owner settings cannot be guaranteed from public-source reingestion.

**Cutover remains NO-GO.** Track the work under [#13](https://github.com/jabelburns/clarityforus-site/issues/13) and [isolated rebuild #12](https://github.com/jabelburns/clarityforus-site/issues/12). Owner-facing Cloudflare setup instructions remain in `docs/NEW_ISOLATED_D1_STAGING_BOOTSTRAP_2026-10-27.md`.
