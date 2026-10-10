# ChatGPT Sites baseline — Clarity for US
Recorded: 2026-10-10
Status: **snapshot-based inventory, not a source-code export or runtime verification**

## Existing Site identity
- Site: [Clarity for US](https://clarity-for-us.jabelburns.chatgpt.site)
- Product/slug: `clarity-for-us`
- Located in the owner's ChatGPT Sites Library as an **active** Site; snapshot metadata reported source version **19**.
- Existing Sites implementation and D1 runtime are **not** part of this GitHub repository.
- This document was compiled from the owner's saved, rendered Site-text snapshot. It cannot reveal the complete HTML/CSS/JS, application backend, database DDL, secret values, jobs or hosting configuration, nor prove the live Site currently works.

## What the existing Site already displays or reports
**Navigation:** Explore, Data status, Bill analysis, The system / Clarity Graph, Sources, Roadmap, and nonprofit information.

**Search/user-facing experience:** unified public-record search; type filters; linked record details, source records and design-example cards. The visible interface calls out **ten** categories:
1. Public officials
2. Candidates and elections
3. Contributions
4. Bills and laws
5. PACs and Super PACs
6. Contributors
7. Votes
8. Executive orders
9. Presidential funding
10. Court cases

**Clarity Graph:** relationship-trace design connects contributor → committee → presidential funding → candidate/election → officeholder → bill/vote → beneficiaries/impact → executive order → court challenge. The visible example explicitly says **illustrative trace**, so do not claim its complete data/interaction is implemented without testing.

**Analysis lens:** “Who benefits?” is required on bills. UI describes six questions: what changes; who benefits; who pays/carries risk; who backs/opposes it; what might be challenged; what remains uncertain. UI separates source evidence from AI inference and emphasizes nonpartisanship.

**Visible data-status labels and counts (snapshot, NOT independently verified):**
- D1 civic graph: **1,163 entities**
- **522 officials**, **5 candidates**, **20 bills**, **60 money records**
- Search currently displays **34 records in this view**, including both source-backed data and clearly marked illustrative design examples; **34 must not be interpreted as whole database count**
- Federal Register and House Clerk labeled live / no key
- Congress.gov and OpenFEC labeled protected connectors configured
- Sourced AI bill analysis labeled analysis provider configured
- Owner-only “Refresh official records” control visible
- Current House roster/recent House votes/executive orders described as live federal records; detailed Congress/FEC/court/AI integrations and production coverage are mixed or not fully verified.

**Proposed/future features explicitly identified in the rendered roadmap:** House committee assignments and historical terms; presidential/inaugural finance detail; AI correction/review; certified election data; freshness tracking; federal cases and appeals; Kansas and later states; saved alerts; CSV/JSON exports and public API.

## Must-preserve behaviors to verify during owner-authorized inspection
| Surface | Preservation criterion | Current validation |
|---|---|---|
| Home and branding | Headlines, navigation, link targets, mobile appearance | Text snapshot only |
| Explore/search/filter | Search results, type filters, record counts, correct detail pages | Visible UI text; interactions not tested |
| Source-backed vs illustrative | Clear badges and coverage warnings | Labels visible; underlying claims not verified |
| Record details & Clarity Graph | Entity links, edge provenance, source destinations | Concept shown; interactions not tested |
| Bill analysis | Owner-triggered analysis, citations and result handling | Provider status reported; runtime not verified |
| Data status/refresh | Owner-only permissions, supported connectors, idempotent ingestion | UI reports it; auth/runtime not tested |
| D1 database | Preserve live data, schema, migration history, backups | Counts reported only; no direct D1 access |
| Secrets | Preserve *names/configuration requirements* without exposing values | Values neither inspected nor collected |

## Migration and export block
**No complete source export has been obtained.** The owner's saved Library snapshot contains rendered page text, **not** the underlying application source. Public ChatGPT Sites help describes creating/editing/versioning/publishing but does not document a verified one-click full source-and-D1 export. Do not represent a ChatGPT conversation export, rendered HTML scrape, Vercel landing page, or old GitHub repo as a complete replacement for the current Site.

### Next safe actions
1. In the **original Site editing context**, request an inventory of source files, routes, Cloudflare/D1 schema, data-handling logic, job schedules, deployment configuration, and complete export capabilities. Explicitly request **no changes/no deploy**.
2. If a true, owner-authorized downloadable source archive is available, inspect contents and remove credentials and sensitive data before any GitHub import.
3. If no export is available, document technical constraints, preserve the Site unchanged, and plan feature-parity transfer with verified acceptance tests. Treat inaccessible runtime/data as protected assets, not disposable.
4. If an archive is provided, create a **new migration branch**, never push it into `main` or deploy automatically. Validate file manifest, scan for secrets, make build reproducible, compare behavior and database schemas.
5. Stage a preview and only cut over after side-by-side verification and rollback/backup review.

### Non-goals
- No replacement UI generated from this text-only snapshot.
- No mutation of existing D1, API keys, domain, or production deployment.
- No code/data scraping as a substitute for owner-authorized source export.
