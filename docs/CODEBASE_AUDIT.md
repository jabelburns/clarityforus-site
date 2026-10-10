# Repository audit — 2026-10-10

## Scope and confidence
Read-only inspection of the GitHub default branches of:
- [jabelburns/clarityforus-site](https://github.com/jabelburns/clarityforus-site)
- [jabelburns/billwise](https://github.com/jabelburns/billwise)
- [jabelburns/follow-the-funds](https://github.com/jabelburns/follow-the-funds)
- [jabelburns/supreme-court-tracker](https://github.com/jabelburns/supreme-court-tracker)
- [jabelburns/landing](https://github.com/jabelburns/landing)

This audit **did not** have authenticated access to the owner's ChatGPT Sites application, its source, storage, runtime, secrets, or deployment logs. Findings for the Sites prototype are therefore **unverified**, not proof of absence.

## Primary GitHub repository — verified
- Public repository; default branch `main`; most recent default-branch commit `865f7b3dca994682be65c7b1eee1beaf5f49b96d` (2025-07-14).
- Tree contains exactly two files: [index.html](https://github.com/jabelburns/clarityforus-site/blob/main/index.html) and [logo.png](https://github.com/jabelburns/clarityforus-site/blob/main/logo.png).
- `index.html` is a static landing page with a brand logo, heading “Clarity For Us” and tagline “Making our data work for us.”
- No repository-backed app routes, package manifest, server, database migrations, API ingestion, automatic tests, CI workflow, accessibility test, or deployment configuration was found on `main`.
- Before this audit branch, branches `main` and `clarityforus/landing` pointed to the same commit; there were no pull requests or issues returned by the repository APIs.

## Related repositories — verified
### Billwise: [repository](https://github.com/jabelburns/billwise)
- `backend/api.py`: Flask GET `/api/bills/<state>` reads local JSON files and returns 404 when absent. This is a prototype, not confirmed live service.
- `backend/bill_fetcher.py`: queries OpenStates for Kansas/California and summarizes up to five bills per state using deprecated `openai.ChatCompletion.create`. Its error path writes failure text in place of a summary.
- `frontend/index.html`: selection for federal demo, KS, CA, and fetches a hard-coded Replit development URL; backend only generates KS/CA datasets. Fetch success, deployment, and endpoint uptime were not tested.
- No dependency lockfile, runner, tests, or CI workflow was found in inspected tree.
- UI injects response data into `innerHTML` without visible escaping; treat as a possible XSS exposure until tested and sanitized.
- Preserve the bill-selection concept and existing data semantics, not the outdated implementation unchanged.

### Follow the Funds: [repository](https://github.com/jabelburns/follow-the-funds)
- Vite/React scaffold exists: `package.json`, `App.jsx`, `main.jsx`, `index.html`, CSS/config.
- `App.jsx` imports `./components/SearchBar`, but no such path appears in the default-branch tree; expect an unresolved import/build failure until confirmed.
- Tree has a gitlink entry `follow-the-funds-frontend`; there is no `.gitmodules` file in the same tree. Inspect whether that reference can be recovered, but do not assume its contents exist or are deployable.
- No working contribution query, FEC ingestion, or validated donor-to-candidate views in the inspected code.
- Preserve the intended funding exploration, not a claim of production readiness.

### Supreme Court Tracker: [repository](https://github.com/jabelburns/supreme-court-tracker)
- Substantial existing application prototype: FastAPI + SQLite backend, React/Vite/Tailwind frontend, case views, justice profiles, glossary, CSV/JSON/PDF export routes, and a GitHub Actions update workflow.
- Verified files include `backend/main.py`, `backend/utils/fetch_scotus.py`, `backend/utils/seed_db.py`, `frontend/src/App.jsx`, and `.github/workflows/update.yml`.
- **Not production-verified**: no app execution or current CourtListener data check has occurred. The default-branch tree did not include `backend/data/scotus.db` although the workflow attempts to commit that path; investigate data bootstrap and schedule reliability before reuse. The backend currently sets permissive CORS with credentials; reassess before deployment.
- This is genuine reusable source to analyze and adapt, not necessarily a drop-in module for the existing Sites D1 architecture.

### Separate Clarity landing scaffold: [repository](https://github.com/jabelburns/landing)
- A React/Vite/Tailwind ClarityForUs landing scaffold exists, along with bundled `node_modules` and `dist` directories. The README identifies this as a single-page landing website for `clarityforus.org/.com`, not the current ChatGPT Sites application.
- Do not use the bundled dependencies or old landing page as a replacement for the current Site.

## Deployment discovery — verified 2026-10-10
- Vercel project `clarityforus-site` is linked to `jabelburns/clarityforus-site` and **production** is deployed from GitHub `main` commit `865f7b3dca994682be65c7b1eee1beaf5f49b96d` (the old static landing).
- New documentation commits created Vercel **preview** deployments on the audit branch. These do not represent the ChatGPT Sites project, and do not indicate the full application source has been transferred.
- A Vercel source-file tree was not available for the preview deployment, so no alternate full source was recovered there.
- The active ChatGPT Site snapshot is recorded in `docs/SITES_BASELINE.md`. This snapshot is rendered text, **not source code or a D1 export**.

## Product requirements from prior planning — NOT verified as repository features
A single, searchable civic transparency hub with:
- Politician and candidate profiles: office, election history, voting record, sponsored bills, funders and affiliations.
- Legislation and versions; votes and lawmakers; bills' court challenges, injunctions, rulings, and appeals.
- PACs, donations and campaign funding by cycle; lobbying; federal funding/spending and award recipients.
- Executive orders and their impacts; court dockets/decisions; who benefits, who bears costs, sources and counterevidence.
- A cross-linked **Clarity Graph**, plainly labeled inferred relationships, and sourced, neutral AI bill analysis.

Treat any recent ChatGPT Sites changes as **potentially implemented in that separate prototype**. Inventory and confirm them with the owner and a working app before implementation or migration.

## Risks and constraints
| Priority | Risk | Required action |
|---|---|---|
| Blocker | GitHub is not the full Sites codebase | Inventory prototype, obtain owner-approved source/assets/data where supported, document feature parity |
| High | Accidentally replace functional Sites views | Stage parallel implementation, compare screenshots and functional behavior, explicit approval before cutover |
| High | API credentials previously shared outside secrets storage | Rotate affected credentials, store server-side only, verify no keys in commits or client bundles |
| High | Politician/donor identity collisions and unsupported implications | Stable source IDs, jurisdiction/cycle disambiguation, fact/inference separation, editorial verification |
| High | Billwise unescaped DOM rendering | Escape/sanitize external data and add security checks |
| Medium | Billwise deprecated SDK and broken/missing frontend references | Dependency upgrades, mock-based tests, controlled data adapter rewrite |
| Medium | No baseline CI or deployed repository app | First add non-invasive smoke check; then branch-only app scaffold |
| Medium | Unknown Sites portability, access and deployment | Inspect actual Site using owner-authorized workflow; do not assume automated source export |

## Evidence boundaries
Code was read via GitHub connector and repository tree APIs. **No application was built, executed, or live-tested in this audit.** The Sites URL was not available for authenticated inspection from this environment. Security findings are static indicators, not exploit verification.

## Immediate recommended next action
Create a Codex Cloud environment for `jabelburns/clarityforus-site`, read `AGENTS.md`, `docs/CODEBASE_AUDIT.md`, and `docs/ROADMAP.md`, then perform a **read-only** inventory of the owner-authorized Sites prototype before proposing any migration. Keep `main` and live Site unchanged.
