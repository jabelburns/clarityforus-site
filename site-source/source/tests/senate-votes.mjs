import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  dateFromSenate,normalizeSenateMenu,normalizeSenateRoster,normalizeSenateVote,
  parseSenateMeasure,resolveSenateIdentity,senateUrls
} from '../lib/senate-votes-core.mts';
import {advanceCursor} from '../lib/ingest-progress.ts';

const members=[
  {member_full:'Alsobrooks (D-MD)',last_name:'Alsobrooks',first_name:'Angela',state:'MD',party:'D',lis_member_id:'S428',vote_cast:'Yea'},
  {member_full:'Banks (R-IN)',last_name:'Banks',first_name:'Jim',state:'IN',party:'R',lis_member_id:'S429',vote_cast:'Nay'},
  {member_full:'Baldwin (D-WI)',last_name:'Baldwin',first_name:'Tammy',state:'WI',party:'D',lis_member_id:'S354',vote_cast:'Not Voting'},
];
function makeVote({vote=119,question='On Cloture on the Motion to Proceed',document={document_type:'S.Res.',document_number:'526'},list=members}={}) {
 return {roll_call_vote:{congress:'119',session:'2',congress_year:'2026',vote_number:String(vote),vote_date:'May 13, 2026, 12:28 PM',
  question,vote_title:'Motion to Invoke Cloture on the Motion to Proceed to S. Res. 526',vote_result:'Cloture on the Motion to Proceed Agreed to',
  document,count:{yeas:String(list.filter(x=>x.vote_cast==='Yea').length),nays:String(list.filter(x=>x.vote_cast==='Nay').length),absent:String(list.filter(x=>x.vote_cast==='Not Voting').length),present:''},
  members:{member:list}}};
}
const roster=normalizeSenateRoster({contact_information:{member:[
 {bioguide_id:'A000382',member_full:'Alsobrooks (D-MD)',party:'D',state:'MD'},
 {bioguide_id:'B001299',member_full:'Banks (R-IN)',party:'R',state:'IN'},
 {bioguide_id:'B001230',member_full:'Baldwin (D-WI)',party:'D',state:'WI'}
]}});

test('official Senate XML URLs include correct 119th Congress/session and zero padding',()=>{
 assert.deepEqual(senateUrls(119,2,119),{
  xml:'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1192/vote_119_2_00119.xml',
  html:'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1192/vote_119_2_00119.htm'});
 assert.throws(()=>senateUrls(0,5,-1),/Invalid/);
});
test('official menu filters descending, preserving exact next cursor',()=>{
 const parsed={vote_summary:{congress:'119',session:'2',votes:{vote:[{vote_number:'00256'},{vote_number:'00255'},{vote_number:'00254'},{vote_number:'00253'}]}}};
 assert.deepEqual(normalizeSenateMenu(parsed,{congress:119,session:2},255),[254,253]);
 assert.throws(()=>normalizeSenateMenu(parsed,{congress:119,session:1}),/mismatch/);
 assert.throws(()=>normalizeSenateMenu({vote_summary:{congress:'119',session:'2',votes:{}}},{congress:119,session:2}),/Empty/);
 assert.throws(()=>normalizeSenateMenu({vote_summary:{congress:'119',session:'2',votes:{vote:[{vote_number:'5'},{vote_number:'5'}]}}},{congress:119,session:2}),/duplicated/);
});
test('vote normalizer faithfully preserves Senate voting question and positions',()=>{
 const vote=normalizeSenateVote(makeVote(),{congress:119,session:2,roll:119});
 assert.equal(vote.voteDate,'2026-05-13');
 assert.equal(vote.question,'On Cloture on the Motion to Proceed');
 assert.equal(vote.measure.type,'sres');
 assert.equal(vote.measure.officialUrl,'https://www.congress.gov/bill/119th-congress/senate-resolution/526');
 assert.deepEqual(vote.memberVotes.map(x=>x.position),['Yea','Nay','Not Voting']);
 assert.equal(vote.memberVotes[0].lisMemberId,'S428');
 assert.equal(dateFromSenate('Sep 30, 2026, 10:00 PM'),'2026-09-30');
});
test('nomination vote does not generate a fictitious bill and keeps its question',()=>{
 const vote=normalizeSenateVote(makeVote({question:'On the Nomination',document:{}}),{congress:119,session:2,roll:119});
 assert.equal(vote.measure,null);
 assert.equal(vote.question,'On the Nomination');
});
test('amendment-only record is not treated as a bill; document links use official types',()=>{
 assert.equal(parseSenateMeasure({document_type:'S.Amdt.',document_number:'123'},119),null);
 assert.equal(parseSenateMeasure({document_type:'H.R.',document_number:'9340'},119).type,'hr');
 assert.equal(parseSenateMeasure({document_type:'S.J.Res.',document_number:'197'},119).type,'sjres');
});
test('Senator matching requires exact official roster identity, not fuzzy names',()=>{
 const vote=normalizeSenateVote(makeVote(),{congress:119,session:2,roll:119});
 assert.deepEqual(resolveSenateIdentity(vote.memberVotes[0],roster),{entityId:'person:bioguide:A000382',bioguideId:'A000382',matched:true});
 assert.deepEqual(resolveSenateIdentity({...vote.memberVotes[0],displayName:'A. Alsobrooks (D-MD)'},roster),{
  entityId:'person:senate-lis:S428',bioguideId:null,matched:false});
 assert.equal(resolveSenateIdentity({...vote.memberVotes[0],partyCode:'R'},roster).matched,false);
 assert.equal(resolveSenateIdentity(vote.memberVotes[0],[...roster,roster[0]]).matched,false);
});
test('unknown official members remain provisional and cannot be merged by shared surname',()=>{
 const vote=normalizeSenateVote(makeVote(),{congress:119,session:2,roll:119});
 const unknown={...vote.memberVotes[0],lisMemberId:'S999',displayName:'Alsobrooks (D-XX)',stateCode:'XX'};
 assert.equal(resolveSenateIdentity(unknown,roster).entityId,'person:senate-lis:S999');
});
test('malformed or duplicate official data causes a failure rather than partial record import',()=>{
 assert.throws(()=>normalizeSenateVote(makeVote({list:[...members,members[0]]}),{congress:119,session:2,roll:119}),/Duplicate/);
 const count=makeVote();count.roll_call_vote.count.yeas='99';
 assert.throws(()=>normalizeSenateVote(count,{congress:119,session:2,roll:119}),/tally/);
 assert.throws(()=>normalizeSenateVote(makeVote(),{congress:119,session:2,roll:120}),/does not match/);
 assert.throws(()=>normalizeSenateVote({roll_call_vote:{...makeVote().roll_call_vote,congress_year:'2025'}},{congress:119,session:2,roll:119}),/year/);
});
test('Senate checkpoints descend and move to first session only after second completes',()=>{
 assert.deepEqual(advanceCursor('senate-votes',{congress:119,session:2,beforeRoll:255},{ok:true,nextBeforeRoll:253}).next,
  {congress:119,session:2,beforeRoll:253});
 assert.deepEqual(advanceCursor('senate-votes',{congress:119,session:2,beforeRoll:3},{ok:true,nextBeforeRoll:1}).next,
  {congress:119,session:1});
 assert.equal(advanceCursor('senate-votes',{congress:119,session:1,beforeRoll:3},{ok:true,nextBeforeRoll:1}).completed,true);
 assert.throws(()=>advanceCursor('senate-votes',{congress:119,session:2,beforeRoll:255},{ok:true,nextBeforeRoll:256}),/did not advance/);
 assert.throws(()=>advanceCursor('senate-votes',{congress:119,session:2,beforeRoll:255},{ok:true}),/omitted/);
});

test('full Senate-sized hundred-member vote normalizes without losing any positions',()=>{
 const states=['AK','AL','AR','AZ','CA','CO','CT','DE','FL','GA'];
 const voters=Array.from({length:100},(_,i)=>({member_full:`Test Senator ${i} (I-${states[i%10]})`,party:'I',state:states[i%10],lis_member_id:`S${String(i+500).padStart(3,'0')}`,vote_cast:i<50?'Yea':i<95?'Nay':'Not Voting'}));
 const normalized=normalizeSenateVote(makeVote({list:voters}),{congress:119,session:2,roll:119});
 assert.equal(normalized.memberVotes.length,100);
 assert.equal(normalized.memberVotes.filter(x=>x.position==='Not Voting').length,5);
});
