#!/usr/bin/env python3
"""Offline structural and row-count review of a *trusted* Cloudflare D1 SQL export.

This utility never talks to production. It restores an input SQL dump into a
throwaway local SQLite database, checks the known application tables, verifies
integrity and referential constraints, and reports counts/hashes, not row data.

A passing result without a complete independent production count baseline is
NOT proof of a complete point-in-time production backup.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "drizzle").glob("*.sql"))


def user_tables(connection):
    return sorted(row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
    ))


def expected_schema():
    with sqlite3.connect(":memory:") as db:
        for migration in MIGRATIONS:
            db.executescript(migration.read_text(encoding="utf-8"))
        tables = user_tables(db)
        indexes = sorted(row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='index' "
            "AND name NOT LIKE 'sqlite_%'"
        ))
        return tables, indexes


def audit(sql_file, expected_count_file=None):
    expected_tables, expected_indexes = expected_schema()
    if len(expected_tables) != 23:
        raise RuntimeError(f"Source migrations define {len(expected_tables)} tables, expected 23")
    if sql_file.stat().st_size == 0:
        raise ValueError("Export is empty")
    raw_hash = hashlib.sha256()
    with sql_file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            raw_hash.update(chunk)

    with TemporaryDirectory(prefix="clarity-d1-isolated-") as temp:
        db = sqlite3.connect(str(Path(temp) / "restored.sqlite3"))
        try:
            db.enable_load_extension(False)
            sql = sql_file.read_text(encoding="utf-8-sig")
            # The operator must provide a trusted Cloudflare SQL export.
            # Disallow attaching an arbitrary external database from dump SQL.
            db.set_authorizer(lambda action, arg1, arg2, database, trigger:
                              sqlite3.SQLITE_DENY if action in
                              (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH)
                              else sqlite3.SQLITE_OK)
            db.executescript(sql)
            db.set_authorizer(None)
            db.execute("PRAGMA foreign_keys=ON")
            actual_tables = user_tables(db)
            missing = sorted(set(expected_tables) - set(actual_tables))
            indexes = {row[0] for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            )}
            missing_indexes = sorted(set(expected_indexes) - indexes)
            counts = {
                table: db.execute('SELECT COUNT(*) FROM "' + table + '"').fetchone()[0]
                for table in expected_tables if table in actual_tables
            }
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            foreign_key_violations = len(db.execute("PRAGMA foreign_key_check").fetchall())
        finally:
            db.close()

    baseline = None
    baseline_complete = False
    count_mismatches = {}
    if expected_count_file:
        document = json.loads(expected_count_file.read_text(encoding="utf-8"))
        baseline = document.get("tables")
        if not isinstance(baseline, dict):
            raise ValueError('Baseline JSON must contain a "tables" object')
        baseline_complete = set(expected_tables) == set(baseline)
        count_mismatches = {
            name: {"expected": baseline.get(name), "actual": counts.get(name)}
            for name in expected_tables if name in baseline and (
                type(baseline[name]) is not int or counts.get(name) != baseline[name]
            )
        }
    data_present = counts.get("entities", 0) > 0 and counts.get("relationships", 0) > 0
    restored = (
        not missing and not missing_indexes and integrity == "ok"
        and foreign_key_violations == 0 and data_present
    )
    counts_match = baseline_complete and not count_mismatches
    return {
        "archive_sha256": raw_hash.hexdigest(),
        "archive_bytes": sql_file.stat().st_size,
        "source_migrations": [p.name for p in MIGRATIONS],
        "expected_application_tables": len(expected_tables),
        "missing_tables": missing,
        "missing_indexes": missing_indexes,
        "additional_tables": sorted(set(actual_tables) - set(expected_tables)),
        "table_counts": counts,
        "integrity_check": integrity,
        "foreign_key_violations": foreign_key_violations,
        "data_present": data_present,
        "independent_count_baseline_complete": baseline_complete,
        "baseline_count_mismatches": count_mismatches,
        "isolated_restore_passed": restored,
        "counts_match_independent_baseline": bool(counts_match),
        "status": ("RESTORE_AND_COUNTS_MATCHED" if restored and counts_match
                   else "RESTORE_ONLY_BASELINE_UNVERIFIED" if restored and not expected_count_file
                   else "BASELINE_MISMATCH" if restored
                   else "RESTORE_FAILED"),
        "warning": (
            "Counts matching alone does not prove an atomic snapshot. Verify "
            "that the export came from the authorized native D1 export operation. "
            "Keep the SQL dump and row data private; never commit them to GitHub."
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sql_export", type=Path, help="Privately saved native D1 SQL export")
    parser.add_argument("--expected-counts", type=Path, default=None,
                        help='Private independent JSON baseline: {"tables": {name: integer}}')
    parser.add_argument("--report", type=Path, default=None,
                        help="Optional local metadata-only JSON report path")
    args = parser.parse_args()
    try:
        result = audit(args.sql_export, args.expected_counts)
        encoded = json.dumps(result, indent=2, sort_keys=True)
        if args.report:
            args.report.write_text(encoded + "\n", encoding="utf-8")
        print(encoded)
        return 0 if (result["isolated_restore_passed"] and
                     (args.expected_counts is None or result["counts_match_independent_baseline"])) else 2
    except (OSError, sqlite3.Error, ValueError, RuntimeError) as exc:
        print(json.dumps({"status": "RESTORE_FAILED",
                          "error_type": type(exc).__name__,
                          "message": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
