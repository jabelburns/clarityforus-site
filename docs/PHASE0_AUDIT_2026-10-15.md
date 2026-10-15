# Clarity for US — Phase 0 preservation audit
Date: 2026-10-15 | Audit type: non-destructive, source-vs-deployment comparison
Status: **PARTIAL — source/data recovery and authorized app testing blocked**

## Evidence legend
- **VERIFIED**: read from authorized GitHub, Vercel, or Site Library metadata, or independent unauthenticated HTTP fetch.
- **SNAPSHOT**: visible text in owner Library's rendered Site snapshot. This is **not** a database query, runtime test or source export.
- **UNVERIFIED**: cannot inspect directly with the currently available authorization/tools.
- **BLOCKED**: requires original Site editing access, a supported export, or an owner-authorized operational action.

## Verified infrastructure
- **Active Site:** https://clarity-for-us.jabelburns.chatgpt.site ; Library marks it active, slug `clarity-for-us`, source version **28** and projection revision **61**; access mode **custom** (VERIFIED metadata).
- **External public access:** a fresh unauthenticated request returned HTTP **401** and a **"Log in to access / Continue with ChatGPT"** page. No authenticated route testing was possible. It may be intentional; do not change permissions as part of this audit (VERIFIED external behavior).
- **GitHub:** `jabelburns/clarityforus-site` is public. Default `main` contains the earlier `index.html` static landing page and `logo.png`, not the active application's source (VERIFIED).
- **Vercel:** `clarityforus-site` production remains at GitHub `main` commit `865f7b3dca994682be65c7b1eee1beaf5f49b96d`; audit branch deployments are **preview** builds, not an active Sites export (VERIFIED).
- **Audit branch:** `codex/audit-roadmap-2026-10-10` with draft PR #1 and preservation instructions; issue #2 tracks source recovery (VERIFIED).
- **Full export / source / D1 bytes:** not available to this audit. Library text is a rendered snapshot only (BLOCKED).

## Current Sites snapshot (reported UI labels, not reconciled DB data)
- Home presents **1,597 connected records**, **539 officials**, **52 bills**, **50 executive orders**.
- Primary visible navigation: Search, How it works, Sources & roadmap, About.
- Search screen contains a query field and type choices for Politicians, Candidates & elections, Bills, Money records, PACs & Super PACs, Contributors, Court cases, Votes, Executive orders and Presidential funding.
- Snapshot defaults to **24 displayed politician records**. Its duplicated textual labels and 0 counts for other categories **cannot** be interpreted as actual duplicate DB rows or missing datasets without interactive inspection.
- Record tiles say **View record** and **Open evidence and connected records**.
- Clarity Graph intro distinguishes official record links from contextual disclosure and warns that connection alone does not prove influence.
- Data and owner controls, explanation and roadmap sections are linked but not runtime-tested.
- Older Oct 10 Site baseline reported a D1-backed graph, connector names and an owner-only refresh control. These are *historical snapshot claims*, not production runtime verification on Oct 15.

## Major discrepancies and risks
1. Active Site implementation is NOT in the repository currently linked to the Vercel landing project. Do not merge/redeploy that landing as a replacement.
2. The externally observed login gate conflicts with an assumption of openly browsable public access; confirm whether ChatGPT-only/custom access is intended now or for beta.
3. Backend/API route inventory, D1 schema and indexes, data counts, durable backups and job schedules are not inspectable from rendered text.
4. Full source or D1 export capability is not established. HTML, screenshots or saved Library text would not constitute a functional backup.
5. A visible graph/design statement is not proof that provenance edges are linked to actual records. Interactions and evidence URLs require authenticated tests.
6. Reported `COURTLISTENER_API_KEY` setup in previous project chats remains an operational verification item; no secret values should ever be copied into this public repo.
7. Related projects exist: `billwise`, `follow-the-funds`, `supreme-court-tracker`, and `landing`; see `CODEBASE_AUDIT.md`. They are not substitutes for missing active-Site source.

## Phase 0 item status
| Item | Status | Evidence / required work |
|---|---|---|
| 0.1 Identify active Site and URLs | **Verified** | Library metadata and URL |
| 0.2 Record frontend pages and behavior | **Partial** | Saved rendered text; no interactive navigation |
| 0.3 Recover complete source/routes/assets | **Blocked** | Original Site editing/export context required |
| 0.4 Inventory DB schema/migrations/indexes | **Blocked** | Owner-authorized D1 inspection or code export |
| 0.5 Verify backup + test restore | **Blocked** | No confirmed D1 export/restore mechanism |
| 0.6 Record secret names/permissions | **Partial** | Prior conversation only; active runtime config unavailable |
| 0.7 Capture desktop/mobile baseline | **Blocked** | External request is 401; authenticated access required |
| 0.8 Record regression acceptance plan | **Documented** | `PHASE0_ACCEPTANCE_MATRIX.md`; execution pending |
| 0.9 Separate Sites/GitHub/Vercel | **Verified** | GitHub default branch and Vercel deployment metadata |
| 0.10 Prepare recovery and rollback procedure | **Documented** | `PHASE0_RECOVERY_RUNBOOK.md`; not yet exercised |

## Gate for Phase 0 completion
- Authenticated, owner-authorized Site inventory and behavior capture;
- Actual source file manifest/export OR explicitly signed-off no-export behavioral-reconstruction plan;
- Database schema, privacy-safe counts, successful backup and tested restore;
- Operational owner-only credentials/configuration audited **by name/scope, never value**;
- Feature-parity checks documented and executed for all currently working routes;
- Public access decision recorded without silently changing auth;
- Written production preservation/cutover/rollback plan.

Until then **keep Issue #2 open** and keep the working Site, D1, DNS, production secrets and Vercel production untouched.

## Supporting primary records
- GitHub issue: https://github.com/jabelburns/clarityforus-site/issues/2
- Draft PR: https://github.com/jabelburns/clarityforus-site/pull/1
- Existing baseline: docs/SITES_BASELINE.md
- Existing source audit: docs/CODEBASE_AUDIT.md
- Existing roadmap: docs/ROADMAP.md
