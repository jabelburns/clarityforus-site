# Clarity for US — Sites v33.1 source handoff

**Purpose:** provide a single, reviewed GitHub handoff point for the source of the existing ChatGPT Site **`clarity-for-us`** without replacing GitHub's current `main` landing site.

**Current branch:** `clarity-sites-v33-1-handoff` (NOT production). This repository is **PUBLIC**.

## Upload artifact (one-time step)

Upload the exact file `Clarity-v33.1-GitHub-Handoff-Sanitized.zip` to this branch's **root directory** with GitHub's **Add file → Upload files**. GitHub connector text-write actions currently cannot ingest binary user-upload attachments directly, which is why the ZIP is not yet in this branch.

Expected SHA-256 of that ZIP:

```
f5655cc22ae17ac2eb64b015a8c5af83f30b2caac893d11268b14190d70a5d02
```

The ZIP contains 173 application/source/support files under `source/`, plus `GITHUB_HANDOFF.md` and `SOURCE_MANIFEST.json`. Its contents were CRC-checked and scanned for common credential patterns. It excludes the original `source/.openai/hosting.json` (Sites internal project identifier), the old output manifest and an integration report. **No production D1 rows, environment secret values or API credentials are included.**

The `v33.1` designation is a staging candidate label, not a deployed Sites version. The last verified current Site was source version 28. Do not treat this branch's `index.html` as the current Site: `main` contains the older GitHub landing page.

## Sites instructions

Read and use [SITES_COMMAND.md](./SITES_COMMAND.md). Sites should access the zip at the top level of **this** branch after upload and open the real source under `source/`. It MUST compare against the existing authorized Site before applying; do not overwrite newer live code.

## Mandatory cautions

- The existing Site is backed by managed D1 binding `DB`. This GitHub branch is **source backup only**, not a backup of stored records.
- The staging candidate includes a new `SCHEDULED_INGEST_TOKEN` incoming service-auth requirement. The **existing daily Clarity refresh may not supply that header**. Do not deploy this route before its caller is coordinated and tested.
- Keep original Site hosting configuration, DB binding, secrets, access mode, current refresh and live code untouched until staging reviews pass.
- No release unless the full package-installed build, existing ingestion regression suite, separate staging D1, UI feature parity and rollback/backup are verified.
- `main` and the old Vercel production landing are deliberately unchanged.

### Product changes included

AI bill citation integrity and latest-analysis display; coverage analytics; Senate roll calls and backfills; bill text versions and analysis freshness; source-backed two-hop Clarity Graph; candidate FEC finance analytics; House vote 435-member SQL bulk optimization; scheduled ingestion/owner/status security changes.

### Relevant tracking

- [Feature integration #5](https://github.com/jabelburns/clarityforus-site/issues/5)
- [House D1 query budget #10](https://github.com/jabelburns/clarityforus-site/issues/10)
- [Scheduler authentication #3](https://github.com/jabelburns/clarityforus-site/issues/3)
- [Production D1 backup #4](https://github.com/jabelburns/clarityforus-site/issues/4)
