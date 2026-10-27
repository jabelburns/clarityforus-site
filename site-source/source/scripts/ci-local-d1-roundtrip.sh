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
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --json --file tools/d1_readonly_23_counts.sql > "$work/local-counts.json"
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
