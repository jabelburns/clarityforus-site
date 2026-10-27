#!/usr/bin/env python3
"""Offline rebuild count comparison; never connects to Cloudflare or any Site.

Reads a provenance-qualified, historical production *metadata* baseline and an
optional separately collected staging count JSON. No rows or secrets accepted.
Equal counts are NOT equivalent data, proof of restored state, or release approval.
"""
import argparse
import json
from pathlib import Path
import re
import sys

SOURCE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SOURCE_ROOT.parents[1]
BASELINE = REPO_ROOT / "docs" / "PRODUCTION_D1_READONLY_INVENTORY_2026-10-27.json"
OPERATIONS_ONLY = {
    "analyses", "analysis_findings", "backfill_jobs", "ingest_runs", "site_settings"
}
REVIEW_IDENTITY = {
    "relationships", "entity_aliases", "external_ids", "source_records",
    "bill_sponsors", "case_challenges"
}


def schema_names():
    files = sorted((SOURCE_ROOT / "drizzle").glob("*.sql"))
    if len(files) != 2:
        raise ValueError("Expected exactly two source migration SQL files")
    names = set()
    for file in files:
        names.update(re.findall(r'CREATE TABLE [`"]([a-z_][a-z_0-9]*)[`"]', file.read_text()))
    return names


def validate_baseline(report):
    required = {"tables", "reported_total_rows", "point_in_time_snapshot"}
    if not required.issubset(report):
        raise ValueError("Metadata baseline is missing required fields")
    names = schema_names()
    observed = set(report["tables"])
    if len(names) != 23 or names != observed:
        raise ValueError("Historical baseline does not match source 23-table schema")
    methods = {"count_sql": 0, "complete_pagination": 0}
    total = 0
    for name, item in report["tables"].items():
        if type(item.get("rows")) is not int or item["rows"] < 0:
            raise ValueError("Invalid nonnegative count for " + name)
        if item.get("method") not in methods:
            raise ValueError("Unknown count method for " + name)
        methods[item["method"]] += 1
        total += item["rows"]
    if total != report["reported_total_rows"]:
        raise ValueError("Total does not match individual table counts")
    if report["point_in_time_snapshot"] is not False:
        raise ValueError("Reported inspection cannot be called a point-in-time snapshot")
    if methods != {"count_sql": 13, "complete_pagination": 10}:
        raise ValueError("Inspection method provenance changed")
    return names, methods


def compare(report, candidate):
    """Compare counts only, never label count equality as completeness."""
    provided = candidate.get("tables")
    if not isinstance(provided, dict) or set(provided) != set(report["tables"]):
        raise ValueError("Candidate counts must contain exactly all 23 application tables")
    if any(type(value) is not int or value < 0 for value in provided.values()):
        raise ValueError("Candidate counts must be nonnegative integers")
    changes = []
    for name in sorted(provided):
        original = report["tables"][name]["rows"]
        current = provided[name]
        if name in OPERATIONS_ONLY:
            category = "recreate_or_discard_operational_state"
        elif name in REVIEW_IDENTITY:
            category = "manual_evidence_and_identity_review"
        else:
            category = "reingest_official_sources_and_verify"
        changes.append({
            "table": name,
            "original_rows": original,
            "candidate_rows": current,
            "delta_from_historical_observation": current - original,
            "validation_category": category
        })
    return changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, default=BASELINE)
    parser.add_argument("--candidate-counts", type=Path, default=None,
                        help='Local metadata-only JSON with {"tables": {"entities": 0, ...}}')
    args = parser.parse_args()
    try:
        report = json.loads(args.baseline.read_text(encoding="utf-8"))
        names, methods = validate_baseline(report)
        result = {
            "status": "HISTORICAL_BASELINE_VALIDATED",
            "baseline_table_count": len(names),
            "reported_total_rows": report["reported_total_rows"],
            "count_methods": methods,
            "point_in_time_snapshot": False,
            "release_parity_proven": False,
            "warning": (
                "The baseline is a time-bounded owner-reported inspection, not a "
                "snapshot or database dump. Count equality never proves row identity, "
                "source provenance, history or a correct production restore."
            )
        }
        if args.candidate_counts:
            candidate = json.loads(args.candidate_counts.read_text(encoding="utf-8"))
            rows = compare(report, candidate)
            result["status"] = "COUNTS_COMPARED_NOT_PARITY"
            result["changed_table_count"] = sum(x["delta_from_historical_observation"] != 0 for x in rows)
            result["comparison"] = rows
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "INVALID_INPUT", "error": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
