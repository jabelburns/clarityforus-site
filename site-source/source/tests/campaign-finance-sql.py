"""Offline SQLite equivalence check for the candidate finance classification SQL.
Pure synthetic records, no external database connection or live provider fetch.
"""
from pathlib import Path
import sqlite3
root=Path(__file__).resolve().parents[1]
con=sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
for name in ['0000_amused_stature.sql', '0001_flippant_thunderbolt.sql']:
    sql=(root/'drizzle'/name).read_text()
    con.executescript(sql.replace('--> statement-breakpoint',''))
con.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) VALUES('candidate:fec:Z001','candidate','Test Candidate','test candidate')")
con.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) VALUES('independent-expenditure:fec:T1','independent_expenditure','Test IE','test ie')")
con.execute("INSERT INTO entities(id,entity_type,canonical_name,normalized_name) VALUES('independent-expenditure:fec:T2','independent_expenditure','Other IE','other ie')")
con.execute("INSERT INTO sources(id,source_system,record_type,publisher,title,url) VALUES('source1','fec','schedule_e','FEC','Synthetic','https://www.fec.gov/data/')")
for tx_id,typ,amt,date in [('independent-expenditure:fec:T1','independent_expenditure',5000,'2026-03-05'),('independent-expenditure:fec:T2','independent_expenditure',1000,'2026-05-05'),('itemized_receipt:test','itemized_receipt',1800,'2025-05-05'),('other:outside','itemized_receipt',900,'2024-12-31')]:
    con.execute('INSERT INTO money_transactions(id,transaction_type,amount_cents,transaction_date,candidate_entity_id,source_id) VALUES(?,?,?,?,?,?)',(tx_id,typ,amt,date,'candidate:fec:Z001','source1'))
for suffix,tx,rel in [('a','independent-expenditure:fec:T1','independent_support'),('b','independent-expenditure:fec:T1','independent_opposition'),('c','independent-expenditure:fec:T2','independent_opposition')]:
    con.execute('INSERT INTO relationships(id,from_entity_id,to_entity_id,relationship_type,source_id) VALUES(?,?,?,?,?)',(suffix,tx,'candidate:fec:Z001',rel,'source1'))
q="""select mt.transaction_type,
  case when mt.transaction_type='independent_expenditure' then
    coalesce((select case when count(distinct rel.relationship_type)>1 then 'conflicting'
    else max(case rel.relationship_type when 'independent_support' then 'support' when 'independent_opposition' then 'oppose' else 'unreported' end) end
    from relationships rel where rel.from_entity_id=mt.id and rel.to_entity_id=? and rel.relationship_type in ('independent_support','independent_opposition','independent_spending_reference')), 'unreported')
  else 'not_applicable' end as position,
  count(*),sum(mt.amount_cents) from money_transactions mt
  where mt.candidate_entity_id=? and mt.transaction_date>=? and mt.transaction_date<=?
  and mt.transaction_type in ('itemized_receipt','independent_expenditure')
  group by mt.transaction_type, position
  order by mt.transaction_type,position
"""
rows=con.execute(q,('candidate:fec:Z001','candidate:fec:Z001','2025-01-01','2026-12-31')).fetchall()
expected=[('independent_expenditure','conflicting',1,5000),('independent_expenditure','oppose',1,1000),('itemized_receipt','not_applicable',1,1800)]
assert rows==expected,(rows,expected)
assert con.execute('pragma integrity_check').fetchone()[0]=='ok'
assert not con.execute('pragma foreign_key_check').fetchall()
print('PASS: synthetic candidate financial categories, conflicting positions and reporting-period boundaries')
