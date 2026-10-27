#!/usr/bin/env bash
# Strictly offline native-D1 export / restore integration test.
# This script must never run against remote Cloudflare data.
set -euo pipefail

test -f dist/server/wrangler.json
test -f .openai/hosting.json

# Fail closed unless the build is configured with the synthetic, non-secret
# CI placeholder and *only* the intended local DB binding.
python3 - <<'PY'
import json
from pathlib import Path
hosting = json.loads(Path('.openai/hosting.json').read_text())
config = json.loads(Path('dist/server/wrangler.json').read_text())
expected = '00000000-0000-4000-8000-000000000000'
assert hosting == {'d1': 'DB', 'r2': None}, 'Refusing non-CI hosting configuration'
bindings = config.get('d1_databases', [])
assert len(bindings) == 1, 'Expected one disposable local D1 binding'
assert bindings[0].get('binding') == 'DB', 'Unexpected D1 binding'
assert bindings[0].get('database_id') == expected, 'Refusing non-placeholder database ID'
print('Verified disposable local-only D1 config.')
PY

export WRANGLER_SEND_METRICS=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
work="$(mktemp -d -t clarity-d1-local-XXXXXX)"
trap 'rm -rf "$work"' EXIT

# Every Wrangler command explicitly uses --local; credentials are not supplied.
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --yes --file drizzle/0000_amused_stature.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --yes --file drizzle/0001_flippant_thunderbolt.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --yes --file tests/fixtures/ci-local-d1-seed.sql

# Execute the same 23-table read-only inventory SQL that an authorized Site
# session could use to measure a future complete production count baseline.
if ! pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --json --file tools/d1_readonly_23_counts.sql > "$work/local-counts.json"; then
  echo "Local read-only D1 query rejected:" >&2
  cat "$work/local-counts.json" >&2
  exit 1
fi
python3 - "$work/local-counts.json" <<'PY'
import json
from pathlib import Path
import sys
data = json.loads(Path(sys.argv[1]).read_text())
rows = data[0]['results'] if isinstance(data, list) else data['results']
counts = {row['table_name']: row['row_count'] for row in rows}
assert len(rows) == len(counts) == 23, 'Inventory must return exactly 23 table counts'
assert counts['entities'] == 2 and counts['relationships'] == 1, counts
assert counts['sources'] == 1 and counts['backfill_jobs'] == 0, counts
print('PASS: read-only 23-table D1 inventory matches synthetic seed.')
PY

# Create a fully independent, synthetic baseline using known seed cardinalities.
python3 - "$work/baseline.json" <<'PY'
import json
from pathlib import Path
import runpy
import sys
tables, _ = runpy.run_path('tools/verify_d1_export.py')['expected_schema']()
counts = {name: 0 for name in tables}
counts.update({'entities': 2, 'sources': 1, 'relationships': 1})
Path(sys.argv[1]).write_text(json.dumps({'tables': counts}))
PY

# Real Wrangler-generated *local* D1 export; never --remote.
pnpm exec wrangler d1 export DB --local --config dist/server/wrangler.json \
  --output "$work/synthetic-local-export.sql" --skip-confirmation
python3 tools/verify_d1_export.py "$work/synthetic-local-export.sql" \
  --expected-counts "$work/baseline.json" > "$work/report.json"

python3 - "$work/report.json" <<'PY'
import json
from pathlib import Path
import sys
result = json.loads(Path(sys.argv[1]).read_text())
assert result['status'] == 'RESTORE_AND_COUNTS_MATCHED', result
assert result['expected_application_tables'] == 23, result
assert result['foreign_key_violations'] == 0, result
assert result['table_counts']['entities'] == 2, result
assert result['table_counts']['relationships'] == 1, result
print('PASS: local native D1 export restored with 23 expected tables and independent synthetic row counts.')
PY

# Exercise the *actual* 435-person House JSON1 bulk SQL on local Wrangler D1.
# No HTTP handler, public API or real production D1 is invoked by this test.
python3 tools/generate_synthetic_house_d1_replay.py \
  "$work/fictional-house-first.sql" "$work/fictional-house-replay.sql"
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --yes --file "$work/fictional-house-first.sql"
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --yes --file "$work/fictional-house-replay.sql"

cat > "$work/house-assertions.sql" <<'SQL'
SELECT
  (SELECT COUNT(*) FROM entities WHERE id LIKE 'person:bioguide:Z%') AS synthetic_members,
  (SELECT COUNT(*) FROM external_ids WHERE source_system = 'house_clerk') AS synthetic_member_ids,
  (SELECT COUNT(*) FROM member_votes WHERE vote_entity_id = 'vote:house:synthetic:119:2:1') AS recorded_positions,
  (SELECT position FROM member_votes WHERE person_entity_id = 'person:bioguide:Z000000') AS corrected_vote,
  (SELECT canonical_name FROM entities WHERE id = 'person:bioguide:Z000000') AS member_name,
  (SELECT official_url FROM external_ids WHERE external_id = 'Z000000' AND source_system = 'house_clerk') AS updated_source_url,
  (SELECT status FROM backfill_jobs WHERE id = 'backfill:house-votes:synthetic') AS failed_status,
  (SELECT cursor FROM backfill_jobs WHERE id = 'backfill:house-votes:synthetic') AS preserved_cursor,
  (SELECT COUNT(*) FROM relationships WHERE id = 'relation:house:synthetic:1') AS evidence_edges;
SQL
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --json --file "$work/house-assertions.sql" > "$work/house-results.json"

python3 - "$work/house-results.json" "$work/full-house-baseline.json" <<'PY'
import json
from pathlib import Path
import runpy
import sys
payload = json.loads(Path(sys.argv[1]).read_text())
result = payload[0]['results'][0] if isinstance(payload, list) else payload['results'][0]
assert result['synthetic_members'] == 435, result
assert result['synthetic_member_ids'] == 435, result
assert result['recorded_positions'] == 435, result
assert result['corrected_vote'] == 'Nay', result
assert result['member_name'] == 'Fictional House Member 000', result
assert result['updated_source_url'].endswith('-corrected'), result
assert result['failed_status'] == 'failed', result
assert json.loads(result['preserved_cursor']) == {'year': 2026, 'beforeRoll': 100}, result
assert result['evidence_edges'] == 1, result
names, _ = runpy.run_path('tools/verify_d1_export.py')['expected_schema']()
counts = {name: 0 for name in names}
counts.update({
  'entities': 439, 'sources': 2, 'relationships': 2, 'bills': 1,
  'votes': 1, 'external_ids': 435, 'member_votes': 435, 'backfill_jobs': 1
})
Path(sys.argv[2]).write_text(json.dumps({'tables': counts}))
print('PASS: 435-person House roll replayed locally without duplicates; corrected vote/source; preserved member identity and failed-job cursor')
PY

# Verify the enlarged synthetic database also survives native local D1 export.
pnpm exec wrangler d1 export DB --local --config dist/server/wrangler.json \
  --output "$work/full-house-local-export.sql" --skip-confirmation
python3 tools/verify_d1_export.py "$work/full-house-local-export.sql" \
  --expected-counts "$work/full-house-baseline.json" > "$work/full-house-restore-report.json"
python3 - "$work/full-house-restore-report.json" <<'PY'
import json
from pathlib import Path
import sys
result = json.loads(Path(sys.argv[1]).read_text())
assert result['status'] == 'RESTORE_AND_COUNTS_MATCHED', result
assert result['table_counts']['member_votes'] == 435, result
assert result['table_counts']['external_ids'] == 435, result
assert result['table_counts']['backfill_jobs'] == 1, result
assert result['foreign_key_violations'] == 0, result
print('PASS: 435-person local D1 replay can be exported, restored and integrity-checked.')
PY
