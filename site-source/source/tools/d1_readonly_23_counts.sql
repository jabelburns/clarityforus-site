-- READ-ONLY application table-count inventory for Clarity D1.
-- Generated from the TWO source v28 migrations; checks all 23 known app tables.
-- One SQL statement; never writes, triggers ingestion or reads row content.
-- This is NOT a backup. Failure may indicate missing tables / migration drift.
SELECT 'analyses' AS table_name, COUNT(*) AS row_count FROM "analyses"
UNION ALL SELECT 'analysis_findings' AS table_name, COUNT(*) AS row_count FROM "analysis_findings"
UNION ALL SELECT 'backfill_jobs' AS table_name, COUNT(*) AS row_count FROM "backfill_jobs"
UNION ALL SELECT 'bill_sponsors' AS table_name, COUNT(*) AS row_count FROM "bill_sponsors"
UNION ALL SELECT 'bills' AS table_name, COUNT(*) AS row_count FROM "bills"
UNION ALL SELECT 'candidacies' AS table_name, COUNT(*) AS row_count FROM "candidacies"
UNION ALL SELECT 'case_challenges' AS table_name, COUNT(*) AS row_count FROM "case_challenges"
UNION ALL SELECT 'committees' AS table_name, COUNT(*) AS row_count FROM "committees"
UNION ALL SELECT 'court_cases' AS table_name, COUNT(*) AS row_count FROM "court_cases"
UNION ALL SELECT 'elections' AS table_name, COUNT(*) AS row_count FROM "elections"
UNION ALL SELECT 'entities' AS table_name, COUNT(*) AS row_count FROM "entities"
UNION ALL SELECT 'entity_aliases' AS table_name, COUNT(*) AS row_count FROM "entity_aliases"
UNION ALL SELECT 'executive_orders' AS table_name, COUNT(*) AS row_count FROM "executive_orders"
UNION ALL SELECT 'external_ids' AS table_name, COUNT(*) AS row_count FROM "external_ids"
UNION ALL SELECT 'ingest_runs' AS table_name, COUNT(*) AS row_count FROM "ingest_runs"
UNION ALL SELECT 'member_votes' AS table_name, COUNT(*) AS row_count FROM "member_votes"
UNION ALL SELECT 'money_transactions' AS table_name, COUNT(*) AS row_count FROM "money_transactions"
UNION ALL SELECT 'offices' AS table_name, COUNT(*) AS row_count FROM "offices"
UNION ALL SELECT 'relationships' AS table_name, COUNT(*) AS row_count FROM "relationships"
UNION ALL SELECT 'site_settings' AS table_name, COUNT(*) AS row_count FROM "site_settings"
UNION ALL SELECT 'source_records' AS table_name, COUNT(*) AS row_count FROM "source_records"
UNION ALL SELECT 'sources' AS table_name, COUNT(*) AS row_count FROM "sources"
UNION ALL SELECT 'votes' AS table_name, COUNT(*) AS row_count FROM "votes" 
ORDER BY table_name;
