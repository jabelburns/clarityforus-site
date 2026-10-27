# Owner-authorized, read-only D1 recovery request for the EXISTING Clarity ChatGPT Site

**Copy the request below into the authorized editing conversation for the already existing** `clarity-for-us` **Site.** This is not a request to create or deploy a new Site. It should not be sent to GitHub Actions or an unrelated external service.

## Request for the existing Clarity for US Site

> Work only with the EXISTING authorized Site `clarity-for-us` and its current bound managed D1 database `DB`. Do a **read-only production D1 recovery assessment**. Do not deploy, publish, refresh, reset, alter schema, perform migrations, change visibility/secrets/cron, write rows, change source code or use Time Travel restore.
>
> 1. Identify the exact available supported backup/export capabilities for THIS Sites-managed D1 binding. Do not assume that my personal Cloudflare account controls the database, or that a Sites project ID is a D1 ID. Report whether a native point-in-time SQL export containing both schema and **all data** is available to the owner, through this Sites runtime or a platform-provided mechanism. Report any known brief read unavailability that exporting would cause **before** initiating it.
>
> 2. If a complete native export is available and can be generated without changes to the live database or the daily 5:00 AM Central refresh, create a **private, complete recoverable SQL export** with all application tables and state, not schema-only. Keep it in the existing authorized context, downloadable only by me; never commit to my PUBLIC GitHub repository, publish a URL, paste raw rows in the conversation, or include API credential values. Supply the secure private attachment if supported. If you cannot safely export without interrupting scheduled ingestion, report that as a blocker rather than initiating an export.
>
> 3. Read-only inventory: report the actual current table names and count of tables; schema migrations (if their ledger can be read); counts for **each** of the 23 existing application tables, not just UI record categories; any extra tables/schema drift; and UTC timestamps for the inspection and export. Distinguish exact database `COUNT(*)` results from estimates or cached UI counts. If query permissions, row limits or budgets block full inspection, say exactly which checks could not run.
>
> 4. If an export was generated, provide SHA-256 of the complete file, byte size, format, statement of whether schema/data/import checkpoints/relationships/owner settings are present, and an explicit guarantee/limitation about point-in-time consistency. Do **not** put private owner identifiers, donor personal data or other individual rows in your summary. Do not claim successful independent restoration if it has not been performed.
>
> 5. If native export is unavailable, report the exact provider/tool limitation. Determine whether a private owner-gated logical snapshot is supported without deploying an unreviewed endpoint or changing Site access/security, and what separate authorization/staging evidence would be required. **Do not** implement or enable an export endpoint during this assessment.
>
> Return the evidence inventory and the safest available recovery next step. Keep production intact.

## After a private export exists

Keep the SQL file in private storage. The code-only review branch provides `site-source/source/tools/verify_d1_export.py` to verify an authorized native SQL file by isolated SQLite restoration, schema checks, referential integrity and independent table-count comparison. Run the tool only in a private environment; do not attach private records to GitHub or this public repository.

**Recovery is not complete** until a real production export is privately preserved and restored successfully into an isolated database, with evidence that all 23 live application tables and their row counts are represented.

Current issue: https://github.com/jabelburns/clarityforus-site/issues/4
