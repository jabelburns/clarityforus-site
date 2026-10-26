import { XMLParser } from 'fast-xml-parser';
import { normalizeSenateMenu, normalizeSenateRoster, normalizeSenateVote, senateUrls, type SenateRollCall, type SenateRosterEntry } from './senate-votes-core.mts';

const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,trimValues:true});
const accept = 'application/xml,text/xml;q=0.9,*/*;q=0.8';
async function officialXml(url:string) {
  if (!url.startsWith('https://www.senate.gov/')) throw new Error('Senate XML request must use the official host.');
  const response = await fetch(url,{headers:{accept,'user-agent':'Clarity-for-US/0.3 public-record-research'},signal:AbortSignal.timeout(18000)});
  if (!response.ok) throw new Error(`Senate.gov returned HTTP ${response.status} for official XML.`);
  const xml = await response.text();
  if (xml.length > 2_000_000 || !/^\s*<\?xml|^\s*<(?:vote_summary|roll_call_vote|contact_information)/.test(xml)) throw new Error('Unexpected Senate XML response.');
  return parser.parse(xml) as unknown;
}

export async function fetchRecentSenateRollCalls(options:{congress?:number;session?:number;limit?:number;beforeRoll?:number}={}):Promise<{
  rollCalls:SenateRollCall[]; rollNumbers:number[]; nextBeforeRoll:number|null;
  congress:number;session:number; listingUrl:string; retrievedAt:string; roster:SenateRosterEntry[];
}> {
  const congress = options.congress ?? 119;
  const session = options.session ?? 2;
  if (congress!==119 || ![1,2].includes(session)) throw new Error('This release supports only the 119th Congress sessions 1 and 2.');
  if (options.beforeRoll!==undefined && (!Number.isInteger(options.beforeRoll) || options.beforeRoll<1)) throw new Error('Invalid Senate beforeRoll.');
  const limit = options.limit ?? 1;
  if (!Number.isInteger(limit) || limit<1 || limit>1) throw new Error('Senate import batch must contain exactly 1 roll.');
  const listingUrl = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  const menu = normalizeSenateMenu(await officialXml(listingUrl),{congress,session},options.beforeRoll);
  const rollNumbers = menu.slice(0,limit);
  // The live roster is authoritative only for exact active members. Historical
  // votes may legitimately contain members not currently on that roster.
  const roster = normalizeSenateRoster(await officialXml('https://www.senate.gov/general/contact_information/senators_cfm.xml'));
  if (roster.length<50) throw new Error('Senate roster incomplete; refuse potentially bad identity resolution.');
  const rollCalls: SenateRollCall[] = [];
  for (const roll of rollNumbers) {
    const urls = senateUrls(congress,session,roll);
    const normalized = normalizeSenateVote(await officialXml(urls.xml),{congress,session,roll});
    rollCalls.push(normalized);
  }
  // Keep the roster separate and safely linked by official identifiers in the ingest route.
  return {rollCalls,rollNumbers,nextBeforeRoll:rollNumbers.length?Math.min(...rollNumbers):null,
    congress,session,listingUrl,retrievedAt:new Date().toISOString(),roster};
}
