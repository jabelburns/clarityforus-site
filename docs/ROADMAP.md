# Clarity for US — preservation-first development roadmap
Prepared 2026-10-10. The existing ChatGPT Sites prototype is a separate, unverified source of working features; do **not** replace it with this minimal GitHub landing page.

## Definition of done for every phase
- Changes land via reviewed PR, not a direct `main` rewrite.
- Actual commands/results, screenshots and regression tests recorded.
- Existing user-visible behavior preserved, or a clearly scoped deliberate change approved.
- Source, fetched-at time, coverage and limitations visible for factual political data.
- No public API secret in source or frontend; rollback/cutover documented.

## Phase 0 — inventory and preservation (P0, prerequisite to any cutover)
**Goal:** establish a baseline for everything already working.
1. With owner-authorized Sites access, make a complete UI/route inventory and screenshots of the current Clarity prototype (home, search, politician/candidate, bills, money, court, executive orders, graph and AI panels). Mark a view as working, demo-only, broken or not present.
2. Record access settings, data storage, scheduled jobs, data model, API connectors, source URLs, custom domain/DNS, and list of secret **names only**, never values.
3. Determine whether Sites supports a code/data export or an owner-authorized migration path. If not, specify measured feature-parity work; never assume the prototype source exists in GitHub.
4. Capture acceptance tests for every working action, visual baseline, and records known to load. Do not publish or alter the existing Site.
5. Assess recoverability of Billwise and Follow the Funds only as optional sources. Locate Supreme Court Tracker source.

**Deliverable:** `docs/SITES_BASELINE.md`, feature matrix, migration design, rollback strategy, and prioritized issues. **Gate:** no source-code migration until the owner signs off on the inventory.

## Phase 1 — development foundations (P0)
**Goal:** a maintainable GitHub-based app in parallel with the Site.
- Preserve `index.html` and `logo.png`; add a new application under an isolated subdirectory/workspace, without changing current published routes.
- Decide stack using actual Site portability and running constraints. React/TypeScript frontend, a server-side API, and a relational datastore with provenance are reasonable candidates, **not yet final**. Keep Cloudflare Worker/D1 vs Postgres as an explicit architecture decision.
- Implement reproducible setup, `.env.example` with placeholder names, lint/typecheck, unit-test harness, CI, preview deploy, security scanning and accessible navigation.
- Establish feature flags; never enable incomplete integrations in production.

**Acceptance:** clean checkout can run setup, test, and preview; zero changes to public landing or Sites.

## Phase 2 — canonical data model and provenance (P0)
**Goal:** reliable cross-linking that is not name-based guesswork.
- Entities: people, offices, office terms, candidates, elections, committees/PACs, donors/organizations, contributions, lobbying filings, bills and versions, sponsors, votes and roll calls, executive orders, federal spending/awards/programs, court cases/dockets/events/decisions, jurisdictions, source records and relationships.
- Preserve upstream identifiers, election cycles, dates, legal entity type and jurisdiction; use join/link tables with explicit relation kind, evidence and confidence.
- Include versioned source snapshots, import-run logs, source authority, effective dates, timestamps, deduplication/merge review, and reprocessing without duplicate links.
- Use additive migrations, sample data fixtures, and migration rollback tests.

**Acceptance:** one sample person can be linked to several offices/elections/cycles and distinct same-name people stay separate; each displayed relationship links to source evidence.

## Phase 3 — authoritative data ingestion (P1, vertical slices)
**Goal:** current, searchable records with accountable provenance.
- Begin with Congress.gov legislation and roll calls; Federal Register executive orders; FEC contributions/committees/candidates, using existing keys only after rotation/security review.
- Extend to House/Senate lobbying filings, USAspending.gov federal spending/recipients, and court data (official judicial sources and/or CourtListener where rights and coverage permit).
- Model legislation challenges through documented case-to-bill relationships, **not** keyword coincidences or unsupported claims. Add state data only when per-state coverage is defined.
- Jobs must support pagination, rate-limit backoff, retries, checkpoints, historical backfills, update cadence, stale-data signals and reconciliation/health alerts.

**Acceptance:** each ingestion task has deterministic sample tests, run audit, freshness indicator and clear error reporting; no AI-generated record masquerades as authoritative data.

## Phase 4 — unified public discovery and politician profiles (P1)
**Goal:** search for president, representatives, senators and election candidates in one place.
- Global search by name, office, bill, organization and funding committee; filters for election year, party, state, office and term.
- Canonical politician/candidate profile: offices, election/candidacy timeline, roll-call votes, sponsored bills, contributing committees and donors, related executive orders (where applicable), lobbying links, cases and spending impacts backed by evidence.
- Every data block includes coverage boundary, cycle and update timestamp. Provide accessible navigation and mobile layout.

**Acceptance:** a user can move from politician to bill to vote to contributing committee and back without losing entity context; ambiguous names are disambiguated.

## Phase 5 — Clarity Graph and “Who benefits?” (P1)
**Goal:** transparent relationships, not guilt by association.
- Typed, navigable graph of politicians, committees, bills, votes, lobbying, orders, spending beneficiaries and litigation.
- Each edge includes its factual provenance; calculated and AI-inferred edges have distinct visual treatment and a human-readable methodology.
- Benefit analysis: potential beneficiaries and adversely affected groups, amounts when supportable, costs/tradeoffs, supporting/counter evidence, relevant dates, and confidence/unknowns.
- Build investigation trails, source cards and a correction mechanism.

**Acceptance:** each graph edge opens its source; inferred benefits are clearly marked as hypotheses and can be challenged by available evidence.

## Phase 6 — AI bill and policy analysis (P2)
**Goal:** useful, nonpartisan plain-English analysis from exact current bill text.
For each analysis provide:
1. What the bill/order changes and which **version/date** was analyzed.
2. Who is affected and why.
3. Who may benefit, who may be disadvantaged, and limitations of the evidence.
4. Funding sources, costs and fiscal effects (only if documented).
5. Legal considerations, litigation status and implementation risks (with allegation/status labeling).
6. Sources, uncertainty, counterarguments and what would change the conclusion.

Add retrieval with cited primary text, editorial prompts, model/version timestamp, human review for sensitive interpretations, and regression evaluation for hallucinations/partisanship.

**Acceptance:** citations map to quoted record passages and incorrect or unsubstantiated beneficiary claims are rejected by tests/editorial review.

## Phase 7 — public release and operations (P2)
- Data coverage/freshness dashboard, scheduled ingestion, telemetry, error budgets, backups/recovery, accessibility/security checks, SEO, privacy policy and correction request process.
- Release using a **parallel preview** and side-by-side feature checklist; seek explicit owner approval before swapping domain or retiring Sites.
- Continue to maintain the published Site until migrated functionality is verified and recoverable.

**Acceptance:** documented cutover/rollback rehearsal and zero unreviewed user-facing regressions.

## Prioritized first Codex tasks
1. **Read-only** baseline: inspect `AGENTS.md` and this audit, then identify missing details required to inventory the Sites prototype; don't touch code.
2. Create a feature-parity test template and a source-of-truth matrix for Sites vs GitHub vs legacy prototypes.
3. Propose the minimal Phase 1 architecture with trade-offs and estimated recurring infrastructure costs; do not select a DB based only on past chat suggestions.
4. Add CI and a non-destructive smoke test for the static landing page on a branch, as a separate PR.
5. Once Phase 0 baseline is approved, implement the first source-backed vertical slice: politician → bill → roll-call vote, without breaking the original Site.

## Codex Cloud quickstart
1. Open Codex in the ChatGPT desktop app or web client. Sign in with the same ChatGPT account.
2. Connect/authorize GitHub if prompted, granting access to `jabelburns/clarityforus-site`. A GitHub connector in ChatGPT does not guarantee that the Codex Cloud environment was created.
3. Create/publish a Codex Cloud environment using this repo. Use `main` after the audit PR is reviewed and merged; until then, select `codex/audit-roadmap-2026-10-10` where branch selection is supported.
4. Start in **Ask/read-only** mode with: “Read AGENTS.md, docs/CODEBASE_AUDIT.md and docs/ROADMAP.md. Inventory what is verified in GitHub. Explain what is missing from the current Sites baseline. Do not change files or deploy.”
5. Only then assign a scoped Code task on a **new task branch**. Review its PR, tests and deployment effects before merging.
