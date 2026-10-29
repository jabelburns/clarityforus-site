-- READ-ONLY exact count inventory for 23 known Clarity application tables.
-- Source: 0000_amused_stature.sql + 0001_flippant_thunderbolt.sql.
-- One SQL statement using VALUES + scalar counts, not a 23-way UNION ALL.
-- It does not return row contents or change any data. It is NOT a backup.
-- If any table is missing, the query fails instead of hiding schema drift.
WITH table_names(table_name) AS (
  VALUES
    ('analyses'),
    ('analysis_findings'),
    ('backfill_jobs'),
    ('bill_sponsors'),
    ('bills'),
    ('candidacies'),
    ('case_challenges'),
    ('committees'),
    ('court_cases'),
    ('elections'),
    ('entities'),
    ('entity_aliases'),
    ('executive_orders'),
    ('external_ids'),
    ('ingest_runs'),
    ('member_votes'),
    ('money_transactions'),
    ('offices'),
    ('relationships'),
    ('site_settings'),
    ('source_records'),
    ('sources'),
    ('votes')
)
SELECT table_names.table_name,
  CASE table_names.table_name
    WHEN 'analyses' THEN (SELECT COUNT(*) FROM "analyses")
    WHEN 'analysis_findings' THEN (SELECT COUNT(*) FROM "analysis_findings")
    WHEN 'backfill_jobs' THEN (SELECT COUNT(*) FROM "backfill_jobs")
    WHEN 'bill_sponsors' THEN (SELECT COUNT(*) FROM "bill_sponsors")
    WHEN 'bills' THEN (SELECT COUNT(*) FROM "bills")
    WHEN 'candidacies' THEN (SELECT COUNT(*) FROM "candidacies")
    WHEN 'case_challenges' THEN (SELECT COUNT(*) FROM "case_challenges")
    WHEN 'committees' THEN (SELECT COUNT(*) FROM "committees")
    WHEN 'court_cases' THEN (SELECT COUNT(*) FROM "court_cases")
    WHEN 'elections' THEN (SELECT COUNT(*) FROM "elections")
    WHEN 'entities' THEN (SELECT COUNT(*) FROM "entities")
    WHEN 'entity_aliases' THEN (SELECT COUNT(*) FROM "entity_aliases")
    WHEN 'executive_orders' THEN (SELECT COUNT(*) FROM "executive_orders")
    WHEN 'external_ids' THEN (SELECT COUNT(*) FROM "external_ids")
    WHEN 'ingest_runs' THEN (SELECT COUNT(*) FROM "ingest_runs")
    WHEN 'member_votes' THEN (SELECT COUNT(*) FROM "member_votes")
    WHEN 'money_transactions' THEN (SELECT COUNT(*) FROM "money_transactions")
    WHEN 'offices' THEN (SELECT COUNT(*) FROM "offices")
    WHEN 'relationships' THEN (SELECT COUNT(*) FROM "relationships")
    WHEN 'site_settings' THEN (SELECT COUNT(*) FROM "site_settings")
    WHEN 'source_records' THEN (SELECT COUNT(*) FROM "source_records")
    WHEN 'sources' THEN (SELECT COUNT(*) FROM "sources")
    WHEN 'votes' THEN (SELECT COUNT(*) FROM "votes")
  END AS row_count
FROM table_names
ORDER BY table_names.table_name;
