import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
 buildGraphPaths, evidenceUrl, parseGraphRequest, GRAPH_MAX_EDGES
} from '../lib/graph-explorer.mts';

const nodes=[
 {id:'person:1',canonicalName:'Official A',entityType:'politician'},
 {id:'committee:1',canonicalName:'Committee B',entityType:'committee'},
 {id:'bill:1',canonicalName:'Bill C',entityType:'bill'},
 {id:'contributor:1',canonicalName:'Individual Contributor',entityType:'contributor'},
 {id:'case:1',canonicalName:'Case D',entityType:'court_case'},
];
const sources=[
 {id:'fec',title:'Committee filing',publisher:'FEC',url:'https://www.fec.gov/data/receipts/',retrievedAt:'2026-10-01'},
 {id:'vote',title:'Roll call',publisher:'U.S. Senate',url:'https://www.senate.gov/legislative/LIS/roll_call_votes/',retrievedAt:'2026-10-02'},
 {id:'bad',title:'Not a legitimate link',publisher:'Unknown',url:'javascript:alert(1)'},
];
const edges=[
 {id:'a',fromEntityId:'committee:1',toEntityId:'person:1',relationshipType:'authorized_committee',evidenceClass:'source_fact',sourceId:'fec'},
 {id:'b',fromEntityId:'person:1',toEntityId:'bill:1',relationshipType:'sponsored',evidenceClass:'source_fact',sourceId:'vote'},
 {id:'c',fromEntityId:'contributor:1',toEntityId:'committee:1',relationshipType:'made_contribution',evidenceClass:'source_fact',sourceId:'fec'},
 {id:'d',fromEntityId:'case:1',toEntityId:'bill:1',relationshipType:'potential_legal_link',evidenceClass:'inferred',sourceId:'vote'},
 ];
const make=(overrides={})=>buildGraphPaths({center:'person:1',depth:2,
  layers:[[edges[0],edges[1]],[edges[2],edges[3]]],nodes,sources,...overrides});

test('rejects missing, oversized, control-character center and oversized depth',()=>{
 for(const query of ['','center=','center=%0Afoo','center=a&depth=3','center=a&depth=0','center=a&depth=1.5']) {
  assert.throws(()=>parseGraphRequest(new URLSearchParams(query)));
 }
 assert.deepEqual(parseGraphRequest(new URLSearchParams('center=person%3A1&depth=2')), {center:'person:1',depth:2});
});
test('only HTTPS evidence URLs without credentials are allowed',()=>{
 assert.equal(evidenceUrl('javascript:alert(1)'),null);
 assert.equal(evidenceUrl('http://www.fec.gov'),null);
 assert.equal(evidenceUrl('https://user:pwd@fec.gov/data'),null);
 assert.equal(evidenceUrl('https://www.fec.gov/data'),'https://www.fec.gov/data');
});
test('no invented graph paths, edge direction is preserved',()=>{
 const result=make();
 assert.deepEqual(result.paths.map(p=>p.node.id),['committee:1','bill:1','case:1']);
 assert.equal(result.paths[0].hops[0].direction,'incoming');
 assert.equal(result.paths[1].hops[0].direction,'outgoing');
 assert.deepEqual(result.paths[2].hops.map(h=>h.relationshipId),['b','d']);
 assert.equal(result.paths[2].hops[1].evidenceClass,'inferred');
});
test('excludes individual contributors from expanding the public multi-hop network',()=>{
 const r=make();
 assert.equal(r.paths.some(p=>p.node.entityType==='contributor'),false);
});
test('rejects edges with invalid, absent, or unsafe evidence sources',()=>{
 const r=make({layers:[[
  {...edges[0],sourceId:'missing'},
  {...edges[1],sourceId:'bad'},
  {...edges[3],sourceId:'vote'},
 ]]});
 assert.deepEqual(r.paths.map(p=>p.node.id),[]);
});
test('does not infer or create links just because an unconnected record exists',()=>{
 const r=make({layers:[[edges[0]],[]]});
 assert.equal(r.paths.some(p=>p.node.id==='bill:1'),false);
});
test('deduplicates cycles and repeated relationship IDs',()=>{
 const r=make({layers:[[edges[0],edges[0],edges[1]], [edges[0],edges[1],edges[3]]]});
 assert.equal(r.paths.filter(p=>p.node.id==='committee:1').length,1);
 assert.equal(r.paths[2].hops.length,2);
});
test('explicitly reports query truncation and bounded sample',()=>{
 const r=make({queryTruncated:true});
 assert.equal(r.truncated,true);
 assert.match(r.disclaimer,/bounded sample/);
});
test('never displays a record without the actual source evidence',()=>{
 const r=make({sources:sources.filter(x=>x.id!=='vote')});
 assert.deepEqual(r.paths.map(x=>x.node.id),['committee:1']);
});
test('rejects unknown root rather than making up a person',()=>{
 assert.throws(()=>make({center:'missing'}),/Unknown graph center/);
});
test('can return a single hop and never manufacture deeper hops',()=>{
 const r=make({depth:1});
 assert.equal(r.paths.every(p=>p.hops.length===1),true);
});
test('bounds output size even when a record has many valid edges',()=>{
 const manyNodes=Array.from({length:100},(_,i)=>({id:`org:${i}`,canonicalName:`Org ${i}`,entityType:'organization'}));
 const manyEdges=manyNodes.map((n,i)=>({id:`edge:${String(i).padStart(3,'0')}`,fromEntityId:'person:1',toEntityId:n.id,relationshipType:'affiliated',evidenceClass:'source_fact',sourceId:'fec'}));
 const r=make({layers:[manyEdges],nodes:[...nodes,...manyNodes]});
 assert.ok(r.paths.length<=GRAPH_MAX_EDGES);
 assert.equal(r.truncated,true);
});
