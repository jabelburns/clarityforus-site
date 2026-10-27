#!/usr/bin/env python3
"""Prepare (NEVER provision) a separate Clarity staging D1 binding config.

This tool performs no network requests and runs no Wrangler commands.
It requires a new, pre-created owner-controlled Cloudflare D1 database.
Names/UUIDs alone cannot prove isolation from the Sites-managed production DB:
the authorized account owner must independently verify ownership and
the actual target database. Never copy production credentials to this repo.
"""
import argparse
import json
from pathlib import Path
import re
import sys

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
ACCOUNT = re.compile(r"^[0-9a-f]{32}$")
NAME = re.compile(r"^[a-z0-9][a-z0-9-]{5,62}$")
ZERO_ID = "00000000-0000-4000-8000-000000000000"
EXPECTED_PURPOSE = "clarity-independent-rebuild-staging"
CONFIG_NAME = "wrangler.staging-review.json"


def validate_target(raw):
    if not isinstance(raw, dict) or set(raw) != {
        "purpose", "account_id", "database_id", "database_name", "worker_name",
        "owner_verified_new_database"
    }:
        raise ValueError("Exactly six staging-manifest fields are required")
    if raw["purpose"] != EXPECTED_PURPOSE:
        raise ValueError("Target purpose does not authorize an isolated Clarity staging plan")
    if raw["owner_verified_new_database"] is not True:
        raise ValueError("The database owner must verify the separate new D1 ID/account first")
    for key in ("account_id", "database_id", "database_name", "worker_name"):
        if not isinstance(raw[key], str):
            raise ValueError(key + " must be a string")
    account_id = raw["account_id"].lower()
    db_id = raw["database_id"].lower()
    db_name = raw["database_name"].lower()
    worker = raw["worker_name"].lower()
    if not ACCOUNT.fullmatch(account_id):
        raise ValueError("A valid explicit Cloudflare account ID is required")
    if not UUID.fullmatch(db_id) or db_id == ZERO_ID:
        raise ValueError("Refusing missing, invalid or CI-placeholder D1 database ID")
    if not NAME.fullmatch(db_name) or not db_name.startswith("clarity-") or not db_name.endswith("-staging"):
        raise ValueError("Database must use an explicit clarity-...-staging name")
    if not NAME.fullmatch(worker) or not worker.startswith("clarity-") or not worker.endswith("-staging"):
        raise ValueError("Worker must use an explicit clarity-...-staging name")
    if db_name == worker:
        raise ValueError("Worker and database names must differ")
    if any(x in db_name or x in worker for x in ("production", "-prod", "-live", "-sites-")):
        raise ValueError("Name resembles a production or managed Sites resource")
    if raw["database_name"] != db_name or raw["worker_name"] != worker:
        raise ValueError("Names must be lowercase to prevent target ambiguity")
    return {
        "purpose": EXPECTED_PURPOSE,
        "account_id": account_id,
        "database_id": db_id,
        "database_name": db_name,
        "worker_name": worker,
        "owner_verified_new_database": True,
    }


def make_staging_config(target):
    # No secrets, routes, triggers, environment variables, or deployment script.
    # A binding called DB is normal even in a *different* isolated Worker;
    # the newly allocated UUID and verified Cloudflare account are critical.
    return {
        "name": target["worker_name"],
        "account_id": target["account_id"],
        "compatibility_date": "2026-05-22",
        "workers_dev": False,
        "d1_databases": [{
            "binding": "DB",
            "database_name": target["database_name"],
            "database_id": target["database_id"],
        }],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, type=Path,
                        help="Private manifest for NEW owner-verified staging D1")
    parser.add_argument("--output", required=True, type=Path,
                        help="Output staging-only Wrangler JSON; no network/writes to D1")
    args = parser.parse_args()
    try:
        target = validate_target(json.loads(args.target.read_text(encoding="utf-8")))
        if args.output.resolve() == args.target.resolve():
            raise ValueError("Input and output file must be distinct")
        if args.output.exists():
            raise ValueError("Refusing to overwrite any existing config file")
        if any(piece in args.output.name.lower() for piece in ("production", "live", "hosting", "wrangler.json")):
            raise ValueError("Refusing an ambiguous or existing application config file name")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Only a validated staged config is emitted, without credentials.
        args.output.write_text(json.dumps(make_staging_config(target), indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": "CONFIG_ONLY_NOT_PROVISIONED",
            "new_staging_database_name": target["database_name"],
            "worker_name": target["worker_name"],
            "config_output": str(args.output),
            "proof_of_actual_database_separation": "NOT_ESTABLISHED_BY_THIS_TOOL",
            "network_calls": 0,
            "d1_writes": 0,
            "deployments": 0,
            "next_step": (
                "The account owner must independently inspect the new D1 ID and "
                "account in Cloudflare before ANY manually authorized --remote use."
            ),
        }, indent=2))
        return 0
    except (ValueError, OSError, TypeError, json.JSONDecodeError) as e:
        print(json.dumps({"status": "REFUSED", "error": str(e)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
