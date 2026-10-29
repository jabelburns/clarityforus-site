# Clarity for US — coding agent operating rules

This repository is a **review/staging workspace**, not the live ChatGPT Sites runtime. The existing authorized Site is `clarity-for-us` and its Sites-managed D1 binding is named `DB`. The bound production database is **not** proven to be under the operator's personal Cloudflare account. Never treat a Sites project ID, a D1 binding name, or a locally generated placeholder UUID as that live D1's real provider identifier.

## Cloudflare connection setup

The official instructions are at https://developers.cloudflare.com/agent-setup/prompt.md and https://developers.cloudflare.com/agent-setup/codex/ .

- This repo's `.codex/config.toml` pre-registers the official Cloudflare API MCP endpoint `https://mcp.cloudflare.com/mcp`. Codex loads project MCP config **only when the checkout is trusted**.
- On the *operator's persistent Codex environment*, when Cloudflare setup is requested and Cloudflare Skills are not yet installed, install the official skills with `npx -y skills add cloudflare/skills --skill '*' --yes --global`. Do not run arbitrary replacement install scripts.
- Check `codex mcp list`. If the project config did not load, use `codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp` in the operator's environment only if an equivalent entry does not already exist.
- Use `codex mcp login cloudflare` to initiate OAuth when needed. The account owner must personally choose the Cloudflare account and authorize the requested scopes in the trusted browser. **Never request or log credentials, cookies, tokens, or authorization codes in chat or repository files.**
- After authorization, perform a **read-only account and D1 inventory** first. Do not presume that the Sites-managed production D1 is accessible from the authorized account.

## Hard deployment and data-safety boundaries

- Do not publish/deploy/merge production, update DNS, trigger a refresh, migrate a remote database, restore Time Travel, or change the existing Site's access controls, secrets, bindings, schedules, or rows without explicit scope-specific approval.
- New staging must be a **separately created and independently verified** account-owned Cloudflare D1 database with its own UUID, not the original Sites-managed `DB`. No remote D1 creation or writes until target ownership and isolation are independently established.
- Current rebuild plan: `docs/CLARITY_ISOLATED_REBUILD_PLAN_2026-10-27.md`; provider setup gate: `docs/NEW_ISOLATED_D1_STAGING_BOOTSTRAP_2026-10-27.md`.
- All local tests must use synthetic fixtures and the disposable Wrangler D1 profile. Keep the original GitHub `main` and `clarity-sites-v33-1-handoff` unchanged; use the existing draft PR #11 for review.
- GitHub source and CI tests **cannot** substitute for a live D1 backup, provider-authorized staging deployment, row-level source reconciliation, or a verified restore.

## Testing

Run from `site-source/source` using pinned dependencies. Validate the existing GitHub CI workflow `.github/workflows/clarity-v33-staging-review.yml`; it performs lint, build, synthetic ingestion regressions, and local-only D1 SQL export/restore. No remote credential or production Site is necessary for that pipeline.
