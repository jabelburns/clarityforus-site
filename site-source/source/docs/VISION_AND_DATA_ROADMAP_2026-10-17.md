# Clarity for US — Product vision, coverage and implementation contract

Date: October 17, 2026. Baseline: recovered Site source v28, not a live authenticated assessment.

## North star
A politically neutral civic research workflow answering **What happened?**, **Who is connected?**, and **Who benefits, who pays, and what remains unknown?**. The three original applications—Billwise (laws), Follow the Funds (financial disclosures) and Supreme Court Tracker (courts)—become lenses over ONE provenance-backed federal record graph. Executive orders, presidential funding, lobbying and federal awards are integrated as distinct legal/record types; do not fabricate connections.

## Product screens, not separate disconnected apps
1. **Search / Explore:** person, committee, bill, vote, order, award, lobbying report, case; filters, empty/loading/error states and coverage disclosures.
2. **Record page:** title and timeline, source IDs and publisher links, legal category, actionable summary, confirmed edges and evidence for every edge; candidate vs officeholder dates must be unambiguous.
3. **Follow the system:** start with a person or bill, traverse one sourced edge at a time, show exact source, reporting date and the type of financial activity. Explicitly separate source fact from contextual association from reasoned hypothesis.
4. **Who Benefits? bill desk:** bill version and hash, source text, factual plain-English explanation, six fixed answers, uncertainty, estimates from independently supplied studies where available, related votes and filed lawsuits only after verification; user can inspect each cited document.
5. **Compare & analyze:** equal-cycle financial comparisons, source-backed disclosure trends, recorded vote histories, source coverage and freshness; NO ideological/risk-of-corruption scoring and no misleading totals.
6. **Data coverage / methodology:** public summary of which sources have actually been ingested, status vs configured key, freshness, source gaps, known limitations and correction mechanism. Owner-only diagnostic logs remain private.

## Definition of a documented graph connection
A graph edge must have (1) both verified entity identifiers, (2) a typed relation, (3) source-system and immutable source ID, (4) source URL retrievable by an ordinary researcher, (5) reporting/event date and cycle where relevant, (6) proof class: official record / contextual disclosure / clearly labeled inference. Do not auto-merge on name alone or treat a donation as evidence of improper influence. Source search matches that have not been checked remain **potential matches**, not confirmed court challenges.

## AI bill analysis: the enforceable rules
- Existing six keys: what_changes, who_benefits, who_pays, support_opposition, legal_exposure, uncertainty.
- Model text is always AI-generated explanation, never a government record. Cite only IDs actually supplied to the model; reject hallucinated citations rather than silently substituting legitimate source IDs.
- No independent cost study, court filing, lobbying record or fiscal estimate is present in the current basic bill packet; do not label such statements as verified outside evidence.
- Show each AI finding's source URL and only the latest analysis version. Do not show old versions mixed into new answers.
- **Next tranche:** persist exact normalized text/version/hash and cache by hash; mark old analysis stale on changed text; support material section/page citations and CBO/CRS sources when lawfully accessible; human correction/feedback and regeneration budgets.

## Data coverage priorities (actual recovered source)
| Order | Topic | Baseline | Next verifiable step |
|---|---|---|---|
| 1 | Federal bills | Congress.gov ingestion, bounded 119th Congress cursor; reported 52 bills | Durable full bill/text/actions/cosponsors/amendments backfill and upstream total reconciliation; GovInfo version text |
| 2 | Votes | House Clerk + backfill; reported 19 roll calls and 7,789 member-vote rows | Complete House window and Senate XML roll calls, maintain question type/motion, reconcile tallies, member IDs |
| 3 | Candidates/PACs | OpenFEC/2026 FEC + outside spending cursors; reported 26 committees, 21 candidacies, 280 transactions | FEC amended/superseded filing treatment; do not sum receipts, transfers and outside spending; separate support/oppose; full cycle coverage |
| 4 | Court cases | CourtListener connector; 3 cases reported | Confirm token/rate limits, ingest dockets/opinions, keep candidate search matches provisional pending filed-doc evidence |
| 5 | Executive orders | Federal Register route in source; 50 reported | Connect issued/revoked/superseded orders to authoritative records, date-aware president/agency links |
| 6 | Lobbying | Not an implemented v28 connector/table | LDA.gov LD-1/LD-2/LD-203 registrant/client/issue filings; safe stable IDs; lobby expenses ≠ donations |
| 7 | Federal spending | Not implemented in v28 schema | USAspending recipient/award/action/agency; distinguish obligations, outlays, award totals, amendments |
| 8 | Legislative costs | Not separate integrated data | CBO published estimates and explicit fiscal-year windows; no fabricated dollar estimates |
| 9 | Presidential funding | Home page vision, no dedicated full operational schema | Campaign vs outside spending vs inauguration vs transition vs library sources; label unequal reporting and voluntary gaps |
| 10 | States | Future, begin Kansas | Official state-legislative bills/votes, jurisdiction ID namespace, then additional states |

Historical baseline counts above came from the owner-provided October 15 Site D1 assessment, not a new production query. Validate both date and source counts before describing any dataset as complete.

## Roadmap / release gates
**A. Evidence quality + analytics (prepared in local patch):** reject false AI citations; only newest version; hyperlinks for source evidence; read-only dashboard with precise methodology and no unsourced national comparisons. Dependency-free tests must pass. No prod change until staged review.

**B. Current federal dataset completion:** resume checkpointed Congress/FEC/House backfills, verify CourtListener, add Senate votes, GovInfo text. Publish audited coverage reports for the selected 119th Congress + 2026 cycle. Zero overwrite-based refreshes.

**C. Real Clarity Graph:** interactive record-to-record navigation (2–3 hops), evidence link for every edge, confidence/provenance labels, user-visible breaks where IDs cannot be proved. Do not infer coordination or causation.

**D. Deep Billwise:** latest bill text version + section-scoped citations, plain English, 'Who Benefits?' findings, CBO amounts when present, vote/motion subtleties, append-only analysis version history with stale flag.

**E. Follow the Funds and spending:** campaign/committee/person graph, money timelines, PAC and IE support/oppose, lobbying disclosures, award data. Fair, period-aligned candidate comparisons.

**F. Public beta & next states:** authentication/privacy hardening, scan/donor privacy review, database backup, build/CI, staging parity, accessibility/mobile testing, corrections, Kansas state coverage and scheduled coverage alerts. Launch only after release tests.

## Release requirements / excluded inferences
- No source/DB loss or unilateral production replacement. The ChatGPT Site still hosts the active app, and GitHub main is an unrelated old landing page.
- No public exposure of user IDs, operational backfill cursors, API keys, private raw donor residential data or export tokens.
- FEC contributor records have restrictions on commercial reuse and soliciting donations. A nonprofit cannot harvest FEC individual names for fundraising.
- No 'influence score', claim that money caused a vote, guilt by association, automatic partisan conclusion, or campaign endorsement by Clarity.
- Feature complete only when connected to real official records, tested, independently reproducible, and labeled with coverage gaps. Illustrative roadmap art is not functioning navigation.

## Primary developer resources
- Congress.gov API: https://api.congress.gov/
- OpenFEC: https://api.open.fec.gov/developers/
- LDA: https://lda.gov/api/
- USAspending: https://api.usaspending.gov/docs/
- Federal Register: https://www.federalregister.gov/developers/documentation/api/v1
- CourtListener: https://wiki.free.law/c/courtlistener/help/api/rest/v4/rest-api-v47
