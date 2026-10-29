#!/usr/bin/env python3
"""Create a LOCAL-ONLY Worker fixture from the real House JSON1 bulk SQL.

Do not inline the 435-member JSON array into SQL; use one bound D1 value per
statement in a local Worker, exactly as the route does. No private data,
credentials, external fetches, or remote/cloud databases.
"""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HOUSE_ROUTE = ROOT / "app/api/ingest/house-votes/route.ts"
EXPECTED = {
    "entities": "voterEntityRows",
    "external_ids": "voterIdentifiers",
    "member_votes": "memberVoteRows",
}
VOTE_ID = "vote:house:synthetic:119:2:1"
SOURCE_ID = "source:house:synthetic:2026:1"


def production_bulk_statements():
    route = HOUSE_ROUTE.read_text(encoding="utf-8")
    tick = chr(96)
    exprs = re.findall(r"await db\.run\(sql" + tick + r"(INSERT INTO.*?)" + tick + r"\);", route, re.S)
    if len(exprs) != 3:
        raise ValueError("Expected exactly three House bulk SQL statements")
    bound = {}
    for expr in exprs:
        match = re.search(r"INSERT INTO (entities|external_ids|member_votes)\b", expr)
        if not match:
            raise ValueError("Unrecognized bulk SQL target")
        target = match.group(1)
        token = chr(36) + "{JSON.stringify(" + EXPECTED[target] + ")}"
        if expr.count(chr(36) + "{") != 1 or expr.count(token) != 1:
            raise ValueError("House SQL must have exactly one bound JSON array")
        bound[target] = expr.replace(token, "?")
    if set(bound) != set(EXPECTED):
        raise ValueError("Missing expected House bulk statement")
    return bound


def fixture_rows():
    now = "2026-10-27T00:00:00.000Z"
    entities, ids, positions = [], [], []
    for index in range(435):
        code = f"Z{index:06d}"
        person = f"person:bioguide:{code}"
        name = f"Fictional House Member {index:03d}"
        entities.append({
            "id": person, "entityType": "politician", "canonicalName": name,
            "normalizedName": name.lower(), "jurisdictionLevel": "federal",
            "stateCode": "KS", "description": "Fictional test record",
            "status": "recorded_member", "updatedAt": now,
        })
        ids.append({
            "entityId": person, "sourceSystem": "house_clerk", "externalId": code,
            "officialUrl": f"https://example.org/fictional-member/{code}",
            "isPrimary": True, "verifiedAt": now,
        })
        positions.append({
            "id": VOTE_ID + ":" + code, "voteEntityId": VOTE_ID,
            "personEntityId": person, "position": "Yea", "sourceId": SOURCE_ID,
        })
    return {"entities": entities, "external_ids": ids, "member_votes": positions}


BASE_SQL = """-- Fictional CI fixture; never use against remote D1.
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


def generate(base, worker):
    sql = production_bulk_statements()
    data = fixture_rows()
    base.write_text(BASE_SQL, encoding="utf-8")
    code = """// GENERATED LOCAL CI WORKER; never deploy.
const statements = """ + json.dumps(sql, separators=(",", ":")) + """;
const fixtures = """ + json.dumps(data, separators=(",", ":")) + """;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const step = url.searchParams.get("step");
    if (request.method !== "POST" || url.pathname !== "/__ci__/house" ||
        !["initial", "replay"].includes(step)) {
      return Response.json({ error: "Unknown CI action" }, { status: 404 });
    }
    if (!env.DB) return Response.json({ error: "Missing local DB" }, { status: 503 });
    try {
      for (const target of ["entities", "external_ids", "member_votes"]) {
        const rows = [...fixtures[target]];
        if (step === "replay") {
          rows[0] = { ...rows[0] };
          if (target === "entities") rows[0].canonicalName = "Wrong stale name";
          if (target === "external_ids") rows[0].officialUrl =
            "https://example.org/fictional-member/Z000000-corrected";
          if (target === "member_votes") rows[0].position = "Nay";
        }
        await env.DB.prepare(statements[target]).bind(JSON.stringify(rows)).run();
      }
      if (step === "replay") {
        await env.DB.prepare(
          "UPDATE backfill_jobs SET status='failed', last_error='Simulated failure' " +
          "WHERE id='backfill:house-votes:synthetic'"
        ).run();
      }
      return Response.json({ ok: true, step, bulkQueries: 3, positions: 435 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }
};
"""
    worker.write_text(code, encoding="utf-8")
    print("PASS: generated local bound-parameter Worker fixture for 435 fictional positions")


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_synthetic_house_d1_replay.py BASE.sql WORKER.mjs")
    base, worker = Path(sys.argv[1]), Path(sys.argv[2])
    if base.resolve() == worker.resolve():
        raise ValueError("Output files must be distinct")
    generate(base, worker)


if __name__ == "__main__":
    main()
