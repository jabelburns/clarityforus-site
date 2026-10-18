# AGENTS.md — Clarity for US

## Mission and product boundary
Build one nonpartisan civic-transparency website for Clarity for US. People should be able to search a politician, candidate, office, election, bill, vote, donor, PAC, lobbying disclosure, executive order, federal spending record, court case, or decision and follow sourced links among them. The central analytical question is: **Who benefits?**

## CRITICAL: preserve working features and separate environments
- **Never overwrite, delete, or replace** the current `index.html` or `logo.png` without a reviewed, tested migration.
- The advanced ChatGPT Sites prototype is **not** in this GitHub repository. Do not pretend it is. Do not recreate from memory and claim feature parity. First inventory and preserve it, including its user-facing behavior and data, with owner-authorized access.
- This repository currently contains only a landing page and its image. See `docs/CODEBASE_AUDIT.md` for verified repository inventory and `docs/ROADMAP.md` for sequencing.
- The separate `jabelburns/billwise` and `jabelburns/follow-the-funds` repositories are reference material, **not** automatically deployable or authoritative.
- Do not change the published Sites prototype, DNS, production databases, production secrets, or production deployments as part of a repository-only task.
- Make incremental changes on a task branch; submit a pull request; do not merge, force-push, or deploy without explicit approval.

## Working style
1. Inspect the actual code and dependencies first. Record what is verified, missing, planned, or inaccessible, with links to evidence.
2. For a change touching existing behavior, document its baseline and add a regression check before modifying it. Keep old behavior available until the replacement is validated.
3. Prefer small vertical slices with demonstrable acceptance criteria. Preserve working routes, layout, accessibility, and branding. Avoid unrelated rewrites and framework churn.
4. Run available tests/builds and report exact commands and results. If no test suite exists, say so; do not claim passing tests.
5. For database/schema changes, use additive migrations first and provide rollback and backfill plans.
6. Keep integration jobs retryable/idempotent; store upstream IDs, fetched-at timestamps, original-source URLs, and change history. Show when data may be stale or incomplete.
7. Avoid committing secrets, API keys, `.env` files, real private data, generated credential dumps, or GitHub Actions logs containing credentials. Keys should be server-side secrets. Treat previously shared keys as exposed and rotate them before production use.

## Accuracy and neutrality
- Attribute votes, donations, legislation, litigation, and spending to the **correct legal entity, person, office, jurisdiction, election cycle, and date**. Use stable identifiers, not name matching alone.
- Present primary-source records with citation links and timestamps. Clearly distinguish factual links from calculated relationships and AI inferences.
- Contributions or connections do **not** prove improper influence. Never describe a beneficiary or conflict as established without supporting evidence.
- AI explanations must cite verifiable bill text/versions and authoritative records, disclose uncertainty and coverage gaps, and separate facts, forecasts, allegations, and opinions.
- Follow a nonpartisan editorial approach. Apply the same rules to all parties and candidates.

## Product priorities
1. Preserve and inventory the existing Sites experience.
2. Establish a tested source-controlled web app and deployment path alongside (not over) that experience.
3. Build a consistent political-entity graph and source provenance model.
4. Ingest authoritative elections, contributions, legislation, votes, executive orders, spending, lobbying, and court data.
5. Add unified search and complete politician/candidate profiles.
6. Add the evidence-backed Clarity Graph, benefit analysis, and AI explanations.

## PR checklist
- What changed and why?
- What existing features were preserved or deliberately affected?
- Evidence: tests/build output, screenshots or manual checks.
- Security/secret/data provenance implications.
- Required migrations, rollback steps, deployment impact.
- Outstanding gaps and unverified assumptions.

Do not mark a feature complete based only on an interface mockup or static demo data.
