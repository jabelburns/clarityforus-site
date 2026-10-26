# Clarity for US — GitHub staging source handoff

Source label: v33.1, built from prior ChatGPT Site export v28 + five offline feature sprints + security hardening + House bulk-import fix.

This archive is SOURCE ONLY. It is not a production D1 export, does not contain credential values, and has not passed a full dependency-installed build or authenticated Sites staging tests.

The platform-specific file `source/.openai/hosting.json` was deliberately excluded from this public-sharing copy because it contains the original Site's internal project identifier. The original Site owns its existing DB binding `DB`. In Sites, retain original hosting configuration and secret values; do NOT replace or reset any of them.

**CRITICAL**: This candidate changes scheduled-ingestion authentication. The active external daily refresh scheduler has not been verified to supply the required SCHEDULED_INGEST_TOKEN. Deploying this candidate as-is could halt ingestion. Review and coordinate the caller before any production deployment.

To Sites: read source files under `source/`; compare to CURRENT Site source, preserve newer changes, evaluate compatibility in staging only, do not publish, modify production D1, secrets or schedule. Full build + existing ingestion tests must pass. Keep production migrations untouched until a backup is available.
