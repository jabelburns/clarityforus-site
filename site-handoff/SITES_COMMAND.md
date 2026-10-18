# Command to paste in the existing Clarity ChatGPT Site editor

Use @Sites to work with my **existing** Clarity for US Site, slug **`clarity-for-us`**.

I have put our reviewed **v33.1 staging application source archive** in GitHub, **not** in the `main` branch:
https://github.com/jabelburns/clarityforus-site/tree/clarity-sites-v33-1-handoff

The archive is named **`Clarity-v33.1-GitHub-Handoff-Sanitized.zip`** at the branch root. Please read the **`source/`** directory inside this ZIP. The ZIP omits the original platform-specific `.openai/hosting.json`; retain the current Site hosting configuration and `DB` binding.

**Do a read-only integration review first.** Compare the actual latest Site source against this staging archive and report any newer conflicting modifications. Reconcile all five feature sprints, 435-member House bulk import optimization, and security changes without discarding existing working behavior.

Perform clean dependency installation, build, full available tests (including ingestion), and a controlled validation against an isolated staging database, if supported. Verify the AI source citations, Senate member roll calls, official bill text versions, evidence-backed graph, FEC finance classification, House vote query budget, mobile UI and access controls.

**Critical scheduled-refresh blocker:** v33.1 uses `SCHEDULED_INGEST_TOKEN` to authenticate incoming cron calls. Our current daily external refresh must be updated and verified before changing the live scheduled-ingest endpoint. Preserve its existing behavior in production.

Do **not** publish or deploy, change secrets, change GitHub `main`, modify/reset/refresh live D1, modify the existing schedule, change visibility or use production D1 from a writable preview. If a safe staging test is unavailable, explain exactly which checks are blocked. Prepare a review-only draft and give me a clear go/no-go recommendation. Do not claim this staging branch is already running on Sites.
