// US Senate roll-call normalizer. Pure module: no DB, credentials, or XML parser.
// The fetch adapter supplies the fast-xml-parser output. Official Senate LIS
// identifiers and official Bioguide identifiers must never be guessed from names.

type XmlObject = Record<string, unknown>;
const obj = (v: unknown): XmlObject => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as XmlObject : {};
const arr = (v: unknown): unknown[] => v == null ? [] : Array.isArray(v) ? v : [v];
const str = (v: unknown): string => typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : typeof obj(v)['#text'] === 'string' ? String(obj(v)['#text']).trim() : '';
const num = (v: unknown): number => { const x = Number(str(v)); return Number.isSafeInteger(x) && x >= 0 ? x : 0; };
const months: Record<string, string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};

export function dateFromSenate(value: unknown): string {
  const text = str(value);
  const match = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (!match || !months[match[1].slice(0,3).toLowerCase()]) throw new Error('Invalid official Senate vote date.');
  return `${match[3]}-${months[match[1].slice(0,3).toLowerCase()]}-${match[2].padStart(2, '0')}`;
}

export const senateUrls = (congress: number, session: number, roll: number) => {
  if (!Number.isInteger(congress) || congress < 101 || congress > 140 || ![1,2].includes(session)) throw new Error('Invalid Senate Congress/session.');
  if (!Number.isInteger(roll) || roll < 1 || roll > 2500) throw new Error('Invalid Senate roll number.');
  const folder = `vote${congress}${session}`;
  const detail = `/legislative/LIS/roll_call_votes/${folder}/vote_${congress}_${session}_${String(roll).padStart(5,'0')}`;
  return {xml: `https://www.senate.gov${detail}.xml`, html: `https://www.senate.gov${detail}.htm`};
};

export type SenateMemberPosition = {
  lisMemberId: string;
  displayName: string;
  partyCode: string | null;
  stateCode: string;
  position: 'Yea' | 'Nay' | 'Present' | 'Not Voting';
};
export type SenateMeasure = {type: string;number: string; displayNumber: string; officialUrl: string};
export type SenateRollCall = {
  congress: number; session: number; year: number; rollNumber: number;
  voteDate: string; question: string; description: string; result: string;
  measure: SenateMeasure | null; memberVotes: SenateMemberPosition[];
  detailUrl: string; xmlUrl: string; raw: XmlObject;
};
export type SenateRosterEntry = {bioguideId: string; memberFull: string; stateCode: string; partyCode: string};

const measurePaths: Record<string, [string,string,string]> = {
  HR:['hr','H.R.','house-bill'], S:['s','S.','senate-bill'],
  HRES:['hres','H.Res.','house-resolution'], SRES:['sres','S.Res.','senate-resolution'],
  HJRES:['hjres','H.J.Res.','house-joint-resolution'], SJRES:['sjres','S.J.Res.','senate-joint-resolution'],
  HCONRES:['hconres','H.Con.Res.','house-concurrent-resolution'],
  SCONRES:['sconres','S.Con.Res.','senate-concurrent-resolution'],
};
export function parseSenateMeasure(document: unknown, congress: number): SenateMeasure | null {
  const v = obj(document);
  const token = str(v.document_type).toUpperCase().replace(/[^A-Z]/g,'');
  const number = str(v.document_number);
  const def = measurePaths[token];
  if (!def || !/^\d{1,6}$/.test(number)) return null; // Nomination and amendment votes are not bills.
  return {type:def[0],number:String(Number(number)),displayNumber:`${def[1]} ${Number(number)}`,
    officialUrl:`https://www.congress.gov/bill/${congress}th-congress/${def[2]}/${Number(number)}`};
}

export function normalizeSenateVote(parsed: unknown, expected: {congress:number; session:number; roll:number}): SenateRollCall {
  const root = obj(obj(parsed).roll_call_vote);
  const congress = num(root.congress), session = num(root.session), rollNumber = num(root.vote_number), year = num(root.congress_year);
  if (congress !== expected.congress || session !== expected.session || rollNumber !== expected.roll) throw new Error('Senate vote metadata does not match requested official document.');
  if (year !== 1787 + 2 * congress + session - 1) throw new Error('Senate vote year and session conflict.');
  const voteDate = dateFromSenate(root.vote_date);
  if (!voteDate.startsWith(String(year))) throw new Error('Senate vote date does not match the session year.');
  const rawMembers = arr(obj(root.members).member).map(obj);
  if (!rawMembers.length) throw new Error('Senate vote returned no recorded member positions.');
  const memberVotes: SenateMemberPosition[] = rawMembers.map(m => {
    const lisMemberId = str(m.lis_member_id).toUpperCase();
    const position = str(m.vote_cast);
    const stateCode = str(m.state).toUpperCase();
    if (!/^[A-Z][0-9]{2,8}$/.test(lisMemberId) || !/^[A-Z]{2}$/.test(stateCode) ||
      !['Yea','Nay','Present','Not Voting'].includes(position) || !str(m.member_full)) {
      throw new Error('Malformed official Senate member vote.');
    }
    return {lisMemberId, displayName:str(m.member_full), partyCode:str(m.party).toUpperCase() || null,
      stateCode, position:position as SenateMemberPosition['position']};
  });
  if (new Set(memberVotes.map(m=>m.lisMemberId)).size !== memberVotes.length) throw new Error('Duplicate Senate LIS member ID in roll call.');
  const counts = obj(root.count);
  const published = {Yea:num(counts.yeas), Nay:num(counts.nays), Present:num(counts.present), 'Not Voting':num(counts.absent)};
  for (const [position, count] of Object.entries(published)) {
    const actual = memberVotes.filter(m=>m.position===position).length;
    if (actual!==count) throw new Error(`Senate published ${position} tally does not match member votes.`);
  }
  const urls = senateUrls(congress,session,rollNumber);
  return {congress,session,year,rollNumber,voteDate,question:str(root.question)||str(root.vote_question_text)||'Recorded vote',
    description:str(root.vote_title)||str(root.vote_document_text)||'Senate roll-call vote',
    result:str(root.vote_result)||str(root.vote_result_text)||'Recorded',
    measure:parseSenateMeasure(root.document,congress),memberVotes,detailUrl:urls.html,xmlUrl:urls.xml,raw:root};
}

export function normalizeSenateMenu(parsed: unknown, expected: {congress:number;session:number}, beforeRoll?: number): number[] {
  const root=obj(obj(parsed).vote_summary);
  if (num(root.congress)!==expected.congress || num(root.session)!==expected.session) throw new Error('Senate vote listing Congress/session mismatch.');
  const list=arr(obj(root.votes).vote).map(v=>num(obj(v).vote_number));
  if (!list.length || list.some(n=>n<1 || n>2500) || new Set(list).size!==list.length) throw new Error('Empty, invalid or duplicated Senate roll-list entry.');
  return list.filter(n=>beforeRoll===undefined || n<beforeRoll).sort((a,b)=>b-a);
}

export function normalizeSenateRoster(parsed: unknown): SenateRosterEntry[] {
  const list=arr(obj(obj(parsed).contact_information).member).map(obj);
  return list.map(m=>({bioguideId:str(m.bioguide_id).toUpperCase(),memberFull:str(m.member_full),
    stateCode:str(m.state).toUpperCase(),partyCode:str(m.party).toUpperCase()}))
    .filter(m=>/^[A-Z][0-9]{6}$/.test(m.bioguideId) && /^[A-Z]{2}$/.test(m.stateCode) && m.memberFull);
}

// Identity resolution is conservative: two separate official Senate sources must
// agree on the *exact* member label + state + party, with a unique Bioguide ID.
// Historical/nonmatching/ambiguous names stay in a distinct Senate LIS identity,
// never merged with an unrelated congressional profile by fuzzy name matching.
export function resolveSenateIdentity(member: SenateMemberPosition, roster: SenateRosterEntry[]):
  {entityId:string;bioguideId:string|null;matched:boolean} {
  const candidates=roster.filter(r=>r.memberFull===member.displayName && r.stateCode===member.stateCode && r.partyCode===(member.partyCode??''));
  if (candidates.length===1 && roster.filter(r=>r.bioguideId===candidates[0].bioguideId).length===1) {
    return {entityId:`person:bioguide:${candidates[0].bioguideId}`,bioguideId:candidates[0].bioguideId,matched:true};
  }
  return {entityId:`person:senate-lis:${member.lisMemberId}`,bioguideId:null,matched:false};
}
