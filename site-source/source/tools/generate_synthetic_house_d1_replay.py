#!/usr/bin/env python3
"""Produce LOCAL-ONLY D1 SQL that replays production House bulk inserts.

No network access, external credentials or live records. Extracts the exact
three parameterized JSON1 INSERTs from app/api/ingest/house-votes/route.ts,
binds 435 entirely fictitious records and emits first-pass and replay SQL.
Never use generated SQL with a remote database or a real D1 binding.
"""
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app/api/ingest/house-votes/route.ts"
EXPECTED_BINDINGS = {
    "entities": "voterEntityRows",
    "external_ids": "voterIdentifiers",
    "member_votes": "memberVoteRows",
}
VOTE_ID = "vote:house:synthetic:119:2:1"
SOURCE_ID = "source:house:synthetic:2026:1"
BILL_ID = "bill:synthetic:119:hr:1"


def quote_sql(value):
    return "'" + value.replace("'", "''") + "'"


def extract_statements():
    source = SOURCE.read_text(encoding="utf-8")
    expressions = re.findall(r"await db\.run\(sql`(INSERT INTO .*?)`\);", source, re.S)
    if len(expressions) != 3:
        raise ValueError("House route must contain exactly 3 production JSON1 bulk INSERTs")
    result = {}
    for expression in expressions:
        match = re.search(r"INSERT INTO (entities|external_ids|member_votes)\b", expression)
        if not match:
            raise ValueError("Unexpected bulk insert target")
        target = match.group(1)
        variable = EXPECTED_BINDINGS[target]
        placeholder = "${JSON.stringify(" + variable + ")}"
        if expression.count("${") != 1 or expression.count(placeholder) != 1:
            raise ValueError("House bulk INSERT changed: no longer a single JSON bind for " + target)
        result[target] = (expression, placeholder)
    if set(result) != set(EXPECTED_BINDINGS):
        raise ValueError("All three expected bulk targets are required")
    return result


def records():
    now = "2026-10-27T00:00:00.000Z"
    entities = []
    identities = []
    positions = []
    for index in range(435):
        bio = f"Z{index:06d}"
        entity_id = f"person:bioguide:{bio}"
        display = f"Fictional House Member {index:03d}"
        entities.append({
            "id": entity_id, "entityType": "politician", "canonicalName": display,
            "normalizedName": display.lower(), "jurisdictionLevel": "federal",
            "stateCode": "KS", "description": "Fictional fixture; not an actual legislator",
            "status": "recorded_member", "updatedAt": now,
        })
        identities.append({
            "entityId": entity_id, "sourceSystem": "house_clerk",
            "externalId": bio,
            "officialUrl": f"https://example.org/fictional-members/{bio}",
            "isPrimary": True, "verifiedAt": now,
        })
        positions.append({
            "id": f"{VOTE_ID}:{bio}", "voteEntityId": VOTE_ID,
            "personEntityId": entity_id, "position": "Yea", "sourceId": SOURCE_ID,
        })
    return entities, identities, positions


def expand(statements, entries):
    sql = []
    for name in EXPECTED_BINDINGS:
        template, placeholder = statements[name]
        payload = json.dumps(entries[name], separators=(",", ":"), ensure_ascii=True)
        if len(payload) >= 400_000:
            raise ValueError("Fixture exceeded conservative JSON size envelope")
        sql.append(template.replace(placeholder, quote_sql(payload)) + ";")
    return "\n".join(sql)


def make_files(first_path, replay_path):
    statements = extract_statements()
    entities, identities, positions = records()
    initial = """-- GENERATED CI fixture. D1 --local ONLY. Never use with production.
INSERT INTO sources (id,source_system,record_type,publisher,title,url)
VALUES ('source:house:synthetic:2026:1','synthetic','house_roll_call',
        'CI fixture','Fictional House Roll 1','https://example.org/fictional-vote/1');
INSERT INTO entities (id,entity_type,canonical_name,normalized_name)
VALUES ('bill:synthetic:119:hr:1','bill','Fictional HR1','fictional hr1');
INSERT INTO bills (entity_id,congress,bill_type,bill_number,title,official_url,source_id)
VALUES ('bill:synthetic:119:hr:1',119,'hr',1,'Fictional HR1',
        'https://example.org/fictional-bills/1','source:house:synthetic:2026:1');
INSERT INTO entities (id,entity_type,canonical_name,normalized_name)
VALUES ('vote:house:synthetic:119:2:1','vote','Fictional House Roll 1',
        'fictional house roll 1');
INSERT INTO votes (entity_id,congress,chamber,session,roll_number,vote_date,
                   bill_entity_id,official_url,source_id)
VALUES ('vote:house:synthetic:119:2:1',119,'House','2',1,'2026-10-27',
        'bill:synthetic:119:hr:1','https://example.org/fictional-vote/1',
        'source:house:synthetic:2026:1');
INSERT INTO relationships (id,from_entity_id,to_entity_id,relationship_type,source_id)
VALUES ('relation:house:synthetic:1','vote:house:synthetic:119:2:1',
        'bill:synthetic:119:hr:1','concerns','source:house:synthetic:2026:1');
INSERT INTO backfill_jobs (id,dataset,scope,status,cursor)
VALUES ('backfill:house-votes:synthetic','house-votes','synthetic','running',
        '{"year":2026,"beforeRoll":100}');
"""
    first = {"entities": entities, "external_ids": identities, "member_votes": positions}
    first_path.write_text(initial + "\n" + expand(statements, first) + "\n", encoding="utf-8")

    # Source-vote corrections must be reflected; existing nonempty member names
    # must never be replaced by a stale rerun display name.
    entities[0]["canonicalName"] = "Wrong stale display name"
    identities[0]["officialUrl"] = "https://example.org/fictional-members/Z000000-corrected"
    positions[0]["position"] = "Nay"
    replay = {
        "entities": entities, "external_ids": identities, "member_votes": positions
    }
    replay_path.write_text(
        "-- CI idempotent replay and synthetic failed-cursor test. D1 --local ONLY.\n"
        + expand(statements, replay)
        + """\nUPDATE backfill_jobs
SET status = 'failed', last_error = 'Synthetic simulated batch failure'
WHERE id = 'backfill:house-votes:synthetic';
""",
        encoding="utf-8",
    )


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_synthetic_house_d1_replay.py FIRST.sql REPLAY.sql")
    first = Path(sys.argv[1])
    replay = Path(sys.argv[2])
    if first.resolve() == replay.resolve():
        raise SystemExit("First-pass and replay fixture paths must differ")
    make_files(first, replay)
    print("PASS: generated 435 fictional House vote positions from production JSON1 SQL")


if __name__ == "__main__":
    main()
