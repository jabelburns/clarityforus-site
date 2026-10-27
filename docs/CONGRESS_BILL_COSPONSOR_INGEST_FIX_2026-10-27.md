# Congress.gov sponsor/cosponsor ingestion — staged remediation (Oct 27 2026)

**Scope:** Review-only code in draft PR #11 against `clarity-sites-v33-1-handoff`. **No live Site, remote D1, scheduled refresh, Cloudflare account or production branch modified.**

## Bugs corrected

1. **D1 query budget exceeded:** `app/api/ingest/congress/route.ts` formerly executed four separate Drizzle writes **for every sponsor/cosponsor** (entities, external IDs, bill_sponsors, relationships). One synthetic bill with 100 cosponsors therefore required 400 per-member D1 writes, plus fixed bill metadata queries. This cannot fit the Cloudflare Free Worker D1 50-query invocation limit.
2. **Silent 100-cosponsor truncation:** `lib/congress-gov.ts` formerly fetched just one `/cosponsors?limit=100` page. Its stored raw source record, bill_sponsors table and graph could silently exclude additional cosponsors.
3. **Incomplete Congress bill cursor advanced:** `app/api/ingest/backfill/route.ts` previously retried partial-enrichment warnings only for FEC/outside-spending, not Congress. If a Congress.gov optional endpoint failed, the backfill would advance despite a source gap.

## Staging implementation

- Sponsor and cosponsor graph upserts now use **four SQLite JSON1 statements per chunk**, with **200 sponsors per chunk** and one bound JSON parameter per statement. Current Bioguide-based identities and graph relationship IDs are unchanged. Non-null state/district refresh is retained; established member canonical names are not overwritten. Sponsor joined/withdrawn dates and evidence source are updated on replay.
- Cosponsor endpoint fetch uses documented max **250 records per page**, bounded to at most four pages. It requests sequential offsets without blindly following untrusted `pagination.next` URLs. If an incomplete or stalled upstream page is detected, it emits an explicit source warning rather than accepting a truncated result. The complete retrieved set is included in the bill's raw source snapshot.
- Congress backfill now treats `partialEndpointErrors` as a **retry condition**, retains the prior durable cursor, and records the partial error. A subsequent successful call may continue.
- Incomplete **cosponsor** pages now fail the direct Congress ingestion request with HTTP 500 and cause its ingest run to be marked failed; the backfill retains its existing cursor for the next attempt. Other optional endpoint errors remain explicitly reported as `partialEndpointErrors` and are retryable in the backfill path. A full fail-closed policy for all optional publisher endpoints still requires a separate product decision, because some resources are genuinely unavailable for older bills.

## CI evidence

**Green:** [GitHub Actions run 40604445302](https://github.com/jabelburns/clarityforus-site/actions/runs/40604445302) on commit `6f97dd1ce524940eb4bde8fff66105fa721acfac`.

- 100-cosponsor Congress backfill completes using **16 simulated D1 queries** (including backfill bookkeeping) with all 100 sponsor records and edges.
- 300-cosponsor bill requests offsets **0 and 250** and imports all 300 using **17 simulated D1 queries**.
- Direct Congress import and replay with 100 members use **13 simulated D1 queries each**; no duplicate sponsors; curated member name preserved.
- A synthetic **503 response on cosponsor page 2** makes both direct ingestion and Congress backfill return HTTP 500; the backfill retains its existing offset/batches, and a subsequent retry advances and restores all 300 sponsor links.
- 16 ingestion regressions, suite lint/build, 23-table local D1 schema inventory, House 435-position local Worker replay and native Wrangler local SQL export/restore all passed.

**Caveat:** Source queries were measured with the Node SQLite-backed D1 adapter, not a live remote Cloudflare Worker. D1 query billing, runtime limits and other middleware/service interactions must be confirmed on an independently owned, nonproduction D1 service before launch.

## Remaining follow-ups

- Review whether all other Congress.gov optional endpoints (actions, amendments, committees, text, summaries) need separate complete-pagination handling, where partial data may affect the public graph.
- Verify official source record coverage, dates, withdrawn status and publisher pagination metadata on a separated owner-controlled staging Worker, not on the existing Sites DB.
- Implement a staging writer that treats `partialEndpointErrors` as retryable and enforces publisher rate limits, stable cursors and network timeouts.
- Do **not** merge or deploy until separate D1 staging, backups/restore, current live Site parity, scheduler secret handling and public records validation pass.

Official API: https://github.com/LibraryOfCongress/api.congress.gov and https://api.congress.gov/
Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
