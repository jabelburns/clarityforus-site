"""Synthetic-only audit of historical metadata inventory and staging count comparison."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

SOURCE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SOURCE_ROOT.parents[1]
BASELINE = REPO_ROOT / "docs" / "PRODUCTION_D1_READONLY_INVENTORY_2026-10-27.json"
SCRIPT = SOURCE_ROOT / "tools" / "compare_rebuild_counts.py"

def invoke(*args):
    res = subprocess.run([sys.executable, str(SCRIPT), *[str(x) for x in args]],
                         capture_output=True, text=True, check=False)
    return res.returncode, json.loads(res.stdout or res.stderr)

code, baseline_result = invoke()
assert code == 0 and baseline_result["status"] == "HISTORICAL_BASELINE_VALIDATED"
assert baseline_result["reported_total_rows"] == 35082
assert baseline_result["baseline_table_count"] == 23
assert baseline_result["count_methods"] == {"count_sql": 13, "complete_pagination": 10}
assert baseline_result["point_in_time_snapshot"] is False
assert baseline_result["release_parity_proven"] is False

with TemporaryDirectory(prefix="rebuild-counts-ci-") as temp:
    work = Path(temp)
    report = json.loads(BASELINE.read_text())
    candidates = {table: detail["rows"] for table, detail in report["tables"].items()}
    candidate_path = work / "candidate.json"

    # Even identical row counts are never proof of parity.
    candidate_path.write_text(json.dumps({"tables": candidates}))
    code, comparison = invoke("--candidate-counts", candidate_path)
    assert code == 0 and comparison["changed_table_count"] == 0
    assert comparison["release_parity_proven"] is False
    assert comparison["status"] == "COUNTS_COMPARED_NOT_PARITY"

    candidates["entities"] = 0
    candidate_path.write_text(json.dumps({"tables": candidates}))
    code, comparison = invoke("--candidate-counts", candidate_path)
    assert code == 0 and comparison["changed_table_count"] == 1
    row = next(x for x in comparison["comparison"] if x["table"] == "entities")
    assert row["delta_from_historical_observation"] == -3266

    candidates.pop("analyses")
    candidate_path.write_text(json.dumps({"tables": candidates}))
    code, message = invoke("--candidate-counts", candidate_path)
    assert code == 2 and message["status"] == "INVALID_INPUT"

    report["point_in_time_snapshot"] = True
    fake_baseline = work / "fake-baseline.json"
    fake_baseline.write_text(json.dumps(report))
    code, message = invoke("--baseline", fake_baseline)
    assert code == 2 and message["status"] == "INVALID_INPUT"

print("PASS: validated 23-table historical count provenance, honest parity flags, differences and malformed-baseline rejection")
