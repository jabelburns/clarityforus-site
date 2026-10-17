# Clarity for US — Vision and data priorities (October 17, 2026)

## Product definition
One nonpartisan research workflow answering: What happened? Who is connected? Who benefits, who pays, and what is uncertain? Keep Billwise, Follow the Funds and the Supreme Court Tracker as three lenses into ONE source-provenance-backed civic graph. Add executive orders, lobbying, federal awards and presidential funding as distinct legal and financial record classes.

## Priority visitor journey
Search → authoritative person/bill/committee/case record → source-linked timeline → documented graph edge with source, effective date, identity and financial classification → six-part Who Benefits? explanation → comparable contextual analytics. No inferred guilt, influence scores, or endorsement.

## Verified v28 source capabilities
- Working source implementations for entity search, record dialogs, sourced relationships, Congress.gov bills, House Clerk votes, FEC candidates/receipts/outside spending, Federal Register orders, a CourtListener adapter and an on-demand AI bill explanation. Existence of a connector does not establish complete live coverage.
- The nine-stop landing graph remains illustrative rather than a fully navigable evidence-backed path explorer.
- October 15 owner-supplied DB assessment reported 1,600 entities, 2,026 relationships, 52 bills, 19 roll calls, 280 money transactions and 3 cases. These are historical Site-reported rows, not nationwide inventory or independently audited current totals.
- Senate member-roll call ingestion, full GovInfo bill-text/version backfill, LDA lobbying reports, USAspending federal awards, CBO impact studies, presidential transition/library funding and state data are not fully implemented in the recovered v28 code.

## Six sequenced workstreams
1. Evidence integrity / transparency — fail invented AI source IDs (never silently replace them); latest analysis version only; clickable AI citations and graph-edge source; read-only public analytics with explicit coverage limitations. Local v28 patch built, 8/8 scoped tests pass; NOT deployed.
2. Federal completion — Congress.gov 119th Congress backfills and verified source totals; House + Senate recorded positions, GovInfo text/version history, FEC 2026 cycle including PAC/IE, CourtListener connectivity and validated matches; use checkpointed idempotent refreshes.
3. Graph — identity-safe two-to-three-hop paths. Every edge requires verified IDs, source provenance, category, dates and evidence class. Do not auto-merge on names.
4. Deep Billwise — official text hash and analysis staleness/versioning; section-linked citations; CBO studies where independently available; court challenges require filed documents.
5. Follow the Funds expansion — cycle-aligned money/IE timelines and comparisons; lobbying LD-1/2/203; USAspending award identities and agencies; presidential campaign/IE/inauguration/transition/library disclosures separately labeled.
6. Public beta / states — production D1 backup, auth hardening, clean build/staging test, phone/keyboard checks, corrections; Kansas state data next.

## Analytic integrity rules
- Database counts reflect records imported by Clarity, NOT national completeness without an official denominator.
- Never add independent expenditures, contributions, transfers, refunds, lobbying expenses or award obligations into an implied single influence total.
- An employee donation is not automatically a corporate donation; a Super PAC expenditure is not a direct contribution to a candidate; documented links do not prove causation or wrongdoing.
- An AI bill analysis cites only supplied source IDs; no outside evidence label if no independent source was supplied.
- FEC contributor names/addresses cannot be used for commercial solicitation or nonprofit fundraising: https://www.fec.gov/updates/sale-or-use-contributor-information/

## Development snapshot
Review-only ZIP, based on recovered source-v28: Clarity-Vision-Data-Analytics-Sprint1-2026-10-17.zip (9 changed/new code and documentation files plus README); SHA256 3b2a69206b67d390dc56e7b769e17623e4b32c9fb300f8e287d6f03b40703772. It passes 8/8 local tests and a 124-file JavaScript/TypeScript syntax parse. Full dependency build not run because package registry is unreachable. No production, GitHub main, Site database, domains or secrets changed.

Sources: https://api.congress.gov/ ; https://api.open.fec.gov/developers/ ; https://lda.gov/api/ ; https://api.usaspending.gov/docs/
See GitHub Issues #2–#4 for existing recovery/security blockers. Do not merge docs-only draft PR #1 as the active Site migration.