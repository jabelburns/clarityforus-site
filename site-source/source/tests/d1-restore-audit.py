"""Dependency-free synthetic test for the offline D1 SQL export auditor.

All records are fictional. No network, production bindings or credentials.
"""
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools/verify_d1_export.py"


def make_dump(drop_table=None, include_data=True):
    db = sqlite3.connect(":memory:")
    try:
        db.execute("PRAGMA foreign_keys=ON")
        for sql_path in sorted((ROOT / "drizzle").glob("*.sql")):
            db.executescript(sql_path.read_text())
        if include_data:
            db.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) "
                       "VALUES('person:synthetic:1','politician','Test A','test a')")
            db.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) "
                       "VALUES('person:synthetic:2','politician','Test B','test b')")
            db.execute("INSERT INTO sources(id,source_system,record_type,publisher,title,url) "
                       "VALUES('src:test','synthetic','test','Test','Synthetic','https://example.org')")
            db.execute("INSERT INTO relationships(id,from_entity_id,to_entity_id,relationship_type,source_id) "
                       "VALUES('relation:test','person:synthetic:1','person:synthetic:2','test','src:test')")
            db.commit()
        if drop_table:
            db.execute("PRAGMA foreign_keys=OFF")
            db.execute('DROP TABLE "' + drop_table + '"')
        counts = {
            name: db.execute('SELECT COUNT(*) FROM "' + name + '"').fetchone()[0]
            for (name,) in db.execute("SELECT name FROM sqlite_master "
                                      "WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        }
        return "\n".join(db.iterdump()) + "\n", counts
    finally:
        db.close()


def invoke(path, baseline=None):
    command = [sys.executable, str(TOOL), str(path)]
    if baseline:
        command += ["--expected-counts", str(baseline)]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    try:
        body = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise AssertionError(result.stderr or result.stdout) from None
    return result.returncode, body


with TemporaryDirectory(prefix="d1-audit-test-") as temp:
    base = Path(temp)
    source_sql, counts = make_dump()
    export = base / "sample.sql"
    export.write_text(source_sql)
    code, result = invoke(export)
    assert code == 0, result
    assert result["status"] == "RESTORE_ONLY_BASELINE_UNVERIFIED", result
    assert result["expected_application_tables"] == 23, result
    assert result["data_present"], result

    baseline_file = base / "count-baseline.json"
    baseline_file.write_text(json.dumps({"tables": counts}))
    code, result = invoke(export, baseline_file)
    assert code == 0 and result["counts_match_independent_baseline"], result

    mismatched = dict(counts)
    mismatched["entities"] += 1
    baseline_file.write_text(json.dumps({"tables": mismatched}))
    code, result = invoke(export, baseline_file)
    assert result["baseline_count_mismatches"].get("entities"), result
    assert not result["counts_match_independent_baseline"], result

    schema_only, _ = make_dump(include_data=False)
    export.write_text(schema_only)
    code, result = invoke(export)
    assert code == 2 and not result["data_present"], result

    missing_table, _ = make_dump(drop_table="relationships")
    export.write_text(missing_table)
    code, result = invoke(export)
    assert code == 2 and "relationships" in result["missing_tables"], result

print("PASS: native-style isolated SQL restore, 23-table inventory, baseline mismatch, empty and incomplete export detection")
