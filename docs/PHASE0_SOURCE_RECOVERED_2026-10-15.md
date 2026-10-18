# Clarity for US — Phase 0 recovered-source assessment (2026-10-15)

**Status:** Source recovered; operational database recovery and authenticated runtime verification remain outstanding.

## Export verified offline
- Owner-supplied `Clarity-for-US-source-v28.zip`: 152 ZIP entries, including **149 saved-version-28 application source files**, `source-manifest.json`, `schema-from-migrations.sql`, and `Clarity-for-US-recovery-inventory.md`.
- Source manifest verified **149/149 matching SHA-256 and byte sizes**. ZIP SHA-256: `5e16cecc50f9d59d70d5a394296d4b2941a6cef20080b1dc595347b6d2b371b1`.
- Recovery inventory attributes this exported source to Site source commit `a66c3ea8b41b4118ebabe52da49529d8baf7fc51`, deployment revision 18, with v28 saved/deployed; the ZIP alone cannot independently re-query Site commit history.
- Framework: Vinext/React on Cloudflare Workers, D1 via Drizzle, `pnpm-lock.yaml`, frontend `public/index.html` / `public/app.js` / `public/styles.css`.
- **15** app API route files (including nine ingestion routes); home redirects to static HTML. The routes, database schema, unit/regression tests and frontend are genuinely present in export.
- SQL migrations `0000_amused_stature.sql` and `0001_flippant_thunderbolt.sql` apply successfully to a temporary **in-memory SQLite** database: **23 tables, 31 explicit indexes, 39 foreign-key definitions**; SQLite integrity and FK checks pass for empty schema.
- JavaScript parse checks passed for `public/app.js`, `tests/ingestion.mjs`, `scripts/run-framework.mjs`. Offline targeted scanning found **no high-confidence embedded private-key/OpenAI/GitHub/Google/JWT token patterns**, but this is not a complete secret/license/dependency audit.
- No node_modules were included; package install, full build, TypeScript/lint and the D1-mocked regression suite were **not executed**.
- The enabled cloud automation **Refresh Clarity federal records** was independently verified, scheduled **daily 05:00 America/Chicago**. This external schedule is not bundled as a Cloudflare cron trigger.

## Runtime and data boundaries
- Recovered D1 binding name: `DB`. The archive provides schema/migrations only, **NOT** production database rows, applied migration ledger, existing source records, AI analyses, owner identity, import logs, or backfill cursors.
- The inventory reports registered names `CONGRESS_API_KEY`, `FEC_API_KEY`, `COURTLISTENER_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `INGEST_TOKEN`; optional/declaration names `OPENAI_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `LEGISCAN_API_KEY`, `TRANSPARENCY_REPL_URL`. **No secret values recovered or recorded.**
- The Site is currently owner-restricted/custom access; earlier unauthenticated live request returned HTTP 401. Authenticated end-to-end testing remains blocked.
- Only schema table **names** were reportedly compared to the live Sites overview; production column/index/schema drift, D1 backup/export and restore have NOT been independently verified.

## Findings requiring fixes before any public deployment
1. **P0 — scheduled ingestion route relies on platform privacy:** `app/api/ingest/scheduled/route.ts` checks only that the server environment has `INGEST_TOKEN`, then invokes internal write handlers using that secret, but does **not authenticate the incoming caller**. If publicly reachable, this could be abused to trigger data writes/API costs. Do not widen access before explicit caller verification.
2. **P0 — first-visitor owner assignment:** `lib/site-admin.ts` provisions `site_settings.owner_user_id` on the first request with an authenticated platform user ID, if absent. Preserve/verify owner setting before public access or a fresh DB restore; replace with explicit secure owner provisioning.
3. **P1 — status exposure:** `GET /api/status` exposes backfill job data and latest ingest metadata without application-layer auth. Define a minimal public status representation and protect operational details before release.
4. **P0 — Site-specific portability:** ChatGPT auth and service identity headers, routes, D1 binding injection and external scheduled automation require a verified equivalent implementation outside Sites.
5. **P0 — no actual recoverable production DB backup or staging restore yet.** Schema recreation is not data recovery.

## Remaining Phase 0 gates
- Obtain owner-authorized **production D1 backup/export** or document supported alternatives, privately preserve it, restore to isolated staging and reconcile row counts/source IDs/relations.
- Verify actual live schema/indexes/migration ledger and stored backfill checkpoints against recovered migrations.
- Execute full clean install/build, targeted security/license scanning, unit/ingestion tests and authenticated feature-parity matrix.
- Confirm intended public-access policy and verify ownership/auth before any visibility change.
- Stage source in a **private review workspace** or receive explicit approval to import it to this **public repository**. Do not automatically publish it or merge/deploy old `main`.

This document is sanitized audit metadata only. The complete 149 source files and all production D1 records remain outside this public GitHub repository. No production system was modified. See `PHASE0_AUDIT_2026-10-15.md`, `PHASE0_ACCEPTANCE_MATRIX.md`, `PHASE0_RECOVERY_RUNBOOK.md` and GitHub Issue #2.
