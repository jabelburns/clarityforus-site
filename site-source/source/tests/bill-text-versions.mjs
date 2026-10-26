import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBillTextVersions, preferredTextVersion, safeOfficialTextUrl, compareAnalysisVersion } from '../lib/bill-text-versions.mts';
const official=(code,date='2026-09-01')=>({type:code,date,formats:[
 {type:'PDF',url:'https://www.congress.gov/119/bills/hr7008/BILLS-119hr7008.pdf'},
 {type:'Formatted Text',url:`https://www.congress.gov/119/bills/hr7008/BILLS-119hr7008${code==='Introduced in House'?'ih':'eh'}.htm`},
 {type:'Formatted XML',url:`https://www.congress.gov/119/bills/hr7008/BILLS-119hr7008${code==='Introduced in House'?'ih':'eh'}.xml`},
]});
test('published text counts versions rather than format URLs',()=>{
 const result=normalizeBillTextVersions([official('Introduced in House'),official('Engrossed in House','2026-09-30')],{reportedCount:2});
 assert.equal(result.importedCount,2);
 assert.equal(result.versions.flatMap(v=>v.formats).length,6);
 assert.equal(result.versions[0].label,'Engrossed in House');
 assert.equal(result.versions[0].formats[0].type,'Formatted Text');
 assert.equal(result.versions[0].formats[0].preferred,true);
 assert.equal(preferredTextVersion(result)?.key,'engrossed-in-house:2026-09-30');
 assert.equal(result.partial,false);
});
test('same version/page duplicates collapse deterministically without losing separate formats',()=>{
 const version=official('Introduced in House');
 const result=normalizeBillTextVersions([version,{...version,formats:[version.formats[1]]}]);
 assert.equal(result.importedCount,1);assert.equal(result.versions[0].formats.length,3);
});
test('only exact trusted official HTTPS hosts with no credentials, ports or fragments are allowed',()=>{
 assert.equal(safeOfficialTextUrl('https://www.congress.gov/119/bills/hr7.xml'),'https://www.congress.gov/119/bills/hr7.xml');
 assert.equal(safeOfficialTextUrl('https://www.govinfo.gov/content/pkg/BILLS-119hr7ih/xml/BILLS-119hr7ih.xml')!==null,true);
 for (const x of ['http://www.congress.gov/x','https://evil.com/x','https://www.congress.gov.evil.com/x','https://example.govinfo.gov/x','https://user@www.congress.gov/x','https://www.congress.gov:444/x','https://www.congress.gov/x#fragment','javascript:alert(1)']){
   assert.equal(safeOfficialTextUrl(x),null,x);
 }
});
test('malicious or unsupported formats are excluded and warning is visible',()=>{
 const result=normalizeBillTextVersions([{type:'Introduced in Senate',date:'2026-05-04',formats:[{type:'PDF',url:'http://www.congress.gov/unsafe'},{type:'XML',url:'https://example.com/phishing'}]}]);
 assert.equal(result.versions.length,1); assert.equal(result.versions[0].formats.length,0);
 assert.match(result.warnings[0],/2 unsafe/);assert.equal(preferredTextVersion(result),null);
});
test('missing upstream pages are reported as partial, never as complete',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House')],{reportedCount:5});
 assert.equal(r.partial,true);assert.match(r.warnings.join(' '),/subset/);
});
test('upstream HTTP failure remains a warning even with empty list',()=>{
 const r=normalizeBillTextVersions([],{endpointErrors:['text: Congress.gov returned 503'],reportedCount:0});
 assert.equal(r.partial,true);assert.equal(r.versions.length,0);
});
test('other endpoint errors do not incorrectly corrupt text coverage',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House')],{endpointErrors:['cosponsors: HTTP 503'],reportedCount:1});
 assert.equal(r.partial,false);
});
test('analysis version reference status is explicit and does not imply text-byte verification',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House')],{reportedCount:1});
 assert.equal(compareAnalysisVersion(r,{key:r.versions[0].key}),'same_version_reference');
 assert.equal(compareAnalysisVersion(r,{key:'engrossed-in-house:2026-09-30'}),'newer_version_available');
 assert.equal(compareAnalysisVersion(r,null),'unverified');
});
test('incomplete inventories never assert saved AI uses the latest version',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House')],{reportedCount:3});
 assert.equal(compareAnalysisVersion(r,{key:r.versions[0].key}),'unverified');
});
test('PDF-only source is kept as an official link but not selected as readable HTML for the AI',()=>{
 const r=normalizeBillTextVersions([{type:'Enrolled Bill',date:'2026-09-29',formats:[{type:'PDF',url:'https://www.govinfo.gov/content/pkg/BILLS-x/pdf/BILLS-x.pdf'}]}]);
 assert.equal(r.versions.length,1);assert.equal(preferredTextVersion(r),null);
});
test('invalid or unknown date does not cause a false chronological comparison',()=>{
 const r=normalizeBillTextVersions([{type:'Introduced',date:'not a date',formats:[]},{type:'Passed',date:'2026-06-01T12:00:00Z',formats:[]}]);
 assert.equal(r.versions[0].label,'Passed');assert.equal(r.versions[1].date,null);
});

test('AI does not silently fall back to superseded HTML when latest version is PDF-only',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House','2026-05-01'),{type:'Enrolled Bill',date:'2026-10-01',formats:[{type:'PDF',url:'https://www.govinfo.gov/content/pkg/BILLS-x/pdf/BILLS-x.pdf'}]}]);
 assert.equal(preferredTextVersion(r),null);
 assert.equal(compareAnalysisVersion(r,{key:r.versions[1].key}),'newer_version_available');
});
test('same-date conflicting version order is treated as ambiguous rather than guessed',()=>{
 const r=normalizeBillTextVersions([official('Introduced in House','2026-09-01'),official('Engrossed in House','2026-09-01')]);
 assert.equal(preferredTextVersion(r),null);
 assert.equal(compareAnalysisVersion(r,{key:r.versions[0].key}),'unverified');
});
