"""Offline regression of the exact House roll-call bulk SQL against v28 migrations.

Uses synthetic IDs and SQLite JSON1; no network, credentials, or production data.
"""
from pathlib import Path
import json
import re
import sqlite3

root = Path(__file__).resolve().parents[1]
route = (root / 'app/api/ingest/house-votes/route.ts').read_text()
expressions = re.findall(r'await db\.run\(sql`(INSERT INTO .*?)`\);', route, re.S)
assert len(expressions) == 3, f'Expected exactly three bound JSON bulk operations, saw {len(expressions)}'
statements = {}
for expr in expressions:
    match = re.search(r'INSERT INTO (entities|external_ids|member_votes)\b', expr)
    assert match, 'SQL target not recognized'
    target = match.group(1)
    assert re.findall(r'\$\{JSON\.stringify\((\w+)\)\}', expr) == [{
        'entities':'voterEntityRows', 'external_ids':'voterIdentifiers', 'member_votes':'memberVoteRows'
    }[target]], f'{target} must bind JSON exactly once'
    assert expr.count('${') == 1, 'Unexpected additional dynamic SQL expression'
    statements[target] = re.sub(r'\$\{JSON\.stringify\(\w+\)\}', '?', expr)
assert len(statements) == 3

con = sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
for migration in sorted((root/'drizzle').glob('*.sql')):
    con.executescript(migration.read_text().replace('--> statement-breakpoint',''))
con.execute("INSERT INTO sources(id,source_system,record_type,publisher,title,url) VALUES('source:house','house_clerk','roll_call','House Clerk','Synthetic roll','https://clerk.house.gov/')")
con.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) VALUES('vote:house:test','vote','Synthetic vote','synthetic vote')")
con.execute("INSERT INTO votes(entity_id,congress,chamber,session,roll_number,vote_date,official_url,source_id) VALUES('vote:house:test',119,'House','2',1,'2026-10-17','https://clerk.house.gov/Votes/2026001','source:house')")
now='2026-10-17T12:00:00.000Z'
rows=[{'id':f'person:bioguide:Z{i:06d}','entityType':'politician','canonicalName':f'Synthetic Member {i}',
       'normalizedName':f'synthetic member {i}','jurisdictionLevel':'federal','stateCode':'KS',
       'description':'Synthetic test only','status':'recorded_member','updatedAt':now} for i in range(435)]
ids=[{'entityId':r['id'],'sourceSystem':'house_clerk','externalId':f'Z{i:06d}',
      'officialUrl':f'https://clerk.house.gov/members/Z{i:06d}','isPrimary':True,'verifiedAt':now}
     for i,r in enumerate(rows)]
votes=[{'id':f'vote:house:test:Z{i:06d}','voteEntityId':'vote:house:test',
        'personEntityId':r['id'],'position':'Yea','sourceId':'source:house'} for i,r in enumerate(rows)]
assert len(json.dumps(rows)) < 400_000  # one JSON bind, not one bind per column per row
for target,data in [('entities',rows),('external_ids',ids),('member_votes',votes)]:
    con.execute(statements[target],(json.dumps(data),))
con.commit()
for target,expected in [('entities',436),('external_ids',435),('member_votes',435)]:
    assert con.execute(f'SELECT COUNT(*) FROM {target}').fetchone()[0] == expected, target
assert con.execute("SELECT is_primary FROM external_ids LIMIT 1").fetchone()[0]==1
assert con.execute("SELECT COUNT(*) FROM member_votes WHERE position='Yea'").fetchone()[0]==435
# Check repeat import and amended positions do not create duplicates or clobber the original member profile.
rows[0]['canonicalName']='Changed stale display name'
ids[0]['officialUrl']='https://clerk.house.gov/members/Z000000-updated'
votes[0]['position']='Nay'
for target,data in [('entities',rows),('external_ids',ids),('member_votes',votes)]:
    con.execute(statements[target],(json.dumps(data),))
con.commit()
assert con.execute("SELECT COUNT(*) FROM member_votes").fetchone()[0] == 435
assert con.execute("SELECT position FROM member_votes WHERE person_entity_id='person:bioguide:Z000000'").fetchone()[0]=='Nay'
assert con.execute("SELECT canonical_name FROM entities WHERE id='person:bioguide:Z000000'").fetchone()[0]=='Synthetic Member 0'
assert con.execute("SELECT official_url FROM external_ids WHERE external_id='Z000000'").fetchone()[0].endswith('-updated')
assert con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
assert con.execute('PRAGMA foreign_key_check').fetchall() == []
# Prior v33 code used chunks of 8,12,15, >100 statements across these three stages. New code uses 3.
prior_queries = -(-435//8) + -(-435//12) + -(-435//15)
assert prior_queries == 121, prior_queries
print(f'PASS: 435 member roll bulk import uses 3 writes instead of {prior_queries}; idempotent replay; corrected vote; preserved member; foreign keys clean')
