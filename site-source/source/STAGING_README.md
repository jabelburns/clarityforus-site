# Clarity for US v33 staging and security consolidation

- Based on the user-provided v32 staging source, not on a fresh authenticated export of the live Site. The last independently verified Site source version was v28.
- Combines all five existing feature sprints with the earlier Phase 0 security patch. Retains the added Senate and backfill-Senate scheduled steps.
- 63/63 targeted Node tests passed and 141 source JS/TS syntax parsings passed. Synthetic SQLite financial test passed. These DO NOT establish a successful production build, real D1 runtime performance, or end-to-end Site functionality.
- Untrusted/public requests to the scheduled refresh route now fail unless a new independent bearer service token is configured. Owner provisioning on an empty database requires trusted server-side CLARITY_OWNER_USER_ID; nonowner status responses no longer expose refresh cursors.

CRITICAL CUTOVER: The current scheduled refresh task cannot be assumed to send the new SCHEDULED_INGEST_TOKEN. DEPLOYING THIS CANDIDATE BEFORE MODIFYING AND TESTING THE SCHEDULER WILL STOP THE EXISTING DAILY REFRESH. Do not deploy or expose production until the same token has been configured server-side and via an approved scheduler mechanism. Do not paste any token into GitHub/issues or chat.

- Does not contain live database rows, secrets, R2 files or production exports.
- Original public GitHub repository main still contains an older landing page; this ZIP is delivered locally and has NOT been committed as public code or deployed.
- Next: verify owner-authorized Sites code source, reconcile any v28+ edits, run pnpm install/build/lint/ingestion with deps, validate an isolated D1 restore and full Site browser tests, then deploy using a reviewed rollback and scheduler migration.
