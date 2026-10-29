"""Synthetic, offline staging D1 target guard tests. No Cloudflare access."""
import json
from pathlib import Path
import runpy
import subprocess
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools/prepare_isolated_d1_target.py"
scope = runpy.run_path(str(TOOL))
validate = scope["validate_target"]
make_config = scope["make_staging_config"]

VALID = {
    "purpose": "clarity-independent-rebuild-staging",
    "account_id": "d" * 32,
    "database_id": "7e934a7e-e3c7-4f3a-90b2-7a07acf7e9bd",
    "database_name": "clarity-rebuild-staging",
    "worker_name": "clarity-rebuild-worker-staging",
    "owner_verified_new_database": True,
}
target = validate(VALID)
configuration = make_config(target)
assert configuration["workers_dev"] is False
assert configuration["name"] == VALID["worker_name"]
assert configuration["d1_databases"] == [{
    "binding": "DB",
    "database_name": VALID["database_name"],
    "database_id": VALID["database_id"],
}]
assert "routes" not in configuration and "triggers" not in configuration
assert "vars" not in configuration and "secrets" not in configuration

for changed in [
    {"owner_verified_new_database": False},
    {"database_id": "00000000-0000-4000-8000-000000000000"},
    {"database_id": ""},
    {"database_name": "clarity-production-staging"},
    {"database_name": "clarity-for-us"},
    {"worker_name": "clarity-for-us"},
    {"worker_name": "clarity-rebuild-worker-live-staging"},
    {"purpose": "production"},
    {"account_id": ""},
    {"unexpected_field": "do not accept secrets or hidden params"},
]:
    candidate = {**VALID, **changed}
    try:
        validate(candidate)
        raise AssertionError("Accepted prohibited staging manifest: " + str(changed))
    except ValueError:
        pass

with TemporaryDirectory(prefix="clarity-config-prep-") as temp:
    work = Path(temp)
    manifest = work / "target.json"
    output = work / "wrangler.staging-review.json"
    manifest.write_text(json.dumps(VALID), encoding="utf-8")
    def command():
        return subprocess.run(
            [sys.executable, str(TOOL), "--target", str(manifest), "--output", str(output)],
            capture_output=True, text=True, check=False
        )
    first = command()
    assert first.returncode == 0, first.stderr
    metadata = json.loads(first.stdout)
    assert metadata["status"] == "CONFIG_ONLY_NOT_PROVISIONED"
    assert metadata["network_calls"] == metadata["d1_writes"] == metadata["deployments"] == 0
    assert "NOT_ESTABLISHED" in metadata["proof_of_actual_database_separation"]
    assert json.loads(output.read_text()) == configuration
    second = command()
    assert second.returncode == 2  # no overwrite
    assert json.loads(second.stderr)["status"] == "REFUSED"
    # Invalid manifest cannot produce config.
    manifest.write_text(json.dumps({**VALID, "owner_verified_new_database": False}))
    new_out = work / "another.staging-review.json"
    refused = subprocess.run(
        [sys.executable, str(TOOL), "--target", str(manifest), "--output", str(new_out)],
        capture_output=True, text=True, check=False
    )
    assert refused.returncode == 2 and not new_out.exists()
print("PASS: isolated D1 staging plan config only, strict target guards and no network/deploy")
