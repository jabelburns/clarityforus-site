// Real route/Drizzle/SQLite regression tests; upstream HTTP and the D1 transport
// are replaced so no credentials, network access, or production writes occur.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
// Reuse the compiler pinned by the existing Wrangler development dependency.
const { build } = createRequire(realpathSync('node_modules/wrangler/package.json'))('esbuild');

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
for (const name of readdirSync('drizzle').filter((name) => name.endsWith('.sql')).sort()) {
  sqlite.exec(readFileSync(`drizzle/${name}`, 'utf8'));
}
let queries = 0;
let failWrite = false;
const d1 = {
  prepare(sql) {
    let params = [];
    const result = {
      bind(...values) { params = values; return result; },
      async run() {
        check();
        sqlite.prepare(sql).run(...params);
        return { success: true, results: [], meta: {} };
      },
      async all() { check(); return { results: sqlite.prepare(sql).all(...params), success: true, meta: {} }; },
      async raw() { check(); const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return stmt.all(...params); },
    };
    function check() {
      queries++;
      assert.ok(params.length <= 100, `D1 parameter limit exceeded: ${params.length}`);
      assert.ok(queries <= 900, 'Request exceeded conservative D1 query budget');
      if (failWrite && params.includes('committee:congress:house:hsed00')) {
        failWrite = false;
        throw new Error('D1_ERROR: injected committee write failure');
      }
    }
    return result;
  },
};
globalThis.__ingestTestEnv = { DB: d1, INGEST_TOKEN: 'test-only', FEC_API_KEY: 'test-only', CONGRESS_API_KEY: 'test-only' };
const output = await build({
  stdin: {
    contents: `export * from './lib/fec.ts'; export * from './lib/ingest-progress.ts'; export { POST as backfill } from './app/api/ingest/backfill/route.ts'; export { POST as houseVotes } from './app/api/ingest/house-votes/route.ts'; export { POST as congress } from './app/api/ingest/congress/route.ts';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'worker-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const env = globalThis.__ingestTestEnv;' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
let failEnrichment = false;
let cosponsorTotal = 100;
let failCosponsorLaterPage = false;
let unexpectedFetch = false;
const fetched = [];
const json = (value) => Response.json(value);
globalThis.fetch = async (input) => {
  if (unexpectedFetch) throw new Error('Completed jobs must not refetch');
  const url = new URL(String(input));
  fetched.push(url);
  const path = url.pathname;
  if (path.endsWith('/candidates/totals/')) {
    const page = Number(url.searchParams.get('page'));
    const perPage = Number(url.searchParams.get('per_page'));
    const regular = url.searchParams.get('cycle') === '2026';
    return json({ results: regular && page <= 2 ? Array.from({ length: perPage }, (_, i) => ({ candidate_id: `H26KS${(page - 1) * perPage + i}`, name: `PERSON, CANDIDATE ${(page - 1) * perPage + i}`, cycle: 2026, office: 'H', district: '01', state: 'KS', party: 'IND' })) : [], pagination: { pages: regular ? 2 : 0 } });
  }
  if (/\/candidate\/[^/]+\/committees\/$/.test(path)) return json({ results: [] });
  if (path.endsWith('/schedules/schedule_e/')) {
    const page = Number(url.searchParams.get('page'));
    return json({ results: page <= 3 ? Array.from({ length: 50 }, (_, index) => ({ sub_id: String(page * 100 + index), committee_id: 'C0099', committee_name: 'KNOWN SUPER PAC', candidate_id: 'H26KS0', candidate_name: 'PERSON, CANDIDATE 0', expenditure_amount: 100 + index, expenditure_date: '2026-10-10', support_oppose_indicator: 'S' })) : [], pagination: { pages: 3 } });
  }
  if (path.endsWith('/committee/C0099/')) {
    if (failEnrichment) throw new Error('Committee enrichment timeout');
    return json({ results: [{ committee_id: 'C0099', name: 'KNOWN SUPER PAC', committee_type: 'O', state: 'KS' }] });
  }
  if (path === '/v3/bill/119') {
    const offset = Number(url.searchParams.get('offset'));
    assert.equal(url.searchParams.get('limit'), '1');
    return json({ bills: offset > 900 ? [] : [{ congress: 119, type: 'HR', number: '55', title: 'Complete official title' }] });
  }
  if (path === '/v3/bill/119/hr/55') return json({ bill: { title: 'Complete official title', introducedDate: '2026-01-01', sponsors: [] } });
  if (path.endsWith('/cosponsors')) {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    if (failCosponsorLaterPage && offset >= 250) return new Response('temporary upstream error', { status: 503 });
    const count = Math.max(0, Math.min(limit, cosponsorTotal - offset));
    return json({
      cosponsors: Array.from({ length: count }, (_, i) => {
        const member = offset + i;
        return { bioguideId: `T${String(member).padStart(6, '0')}`, firstName: `Member ${member}`, lastName: 'Test', state: 'KS' };
      }),
      pagination: {
        count: cosponsorTotal,
        countIncludingWithdrawnCosponsors: cosponsorTotal,
        next: offset + count < cosponsorTotal ? 'https://api.congress.gov/v3/bill/119/hr/55/cosponsors?offset=' + (offset + count) : null,
      },
    });
  }
  if (path.endsWith('/committees')) return json({ committees: [{ systemCode: 'hsed00', name: 'Education and Workforce Committee', chamber: 'House', type: 'Standing' }] });
  for (const key of ['actions', 'summaries', 'text', 'amendments']) if (path.endsWith(`/${key}`)) return json({ [key]: [] });
  if (url.hostname === 'clerk.house.gov' && path === '/Votes/MemberVotes') return new Response('<a href="/Votes/2026319">319</a><a href="/Votes/2026318">318</a>');
  const roll = path.match(/\/evs\/(\d{4})\/roll(\d+)\.xml/);
  if (roll) {
    const voters = Array.from({ length: 435 }, (_, i) => `<recorded-vote><legislator name-id="B${String(i).padStart(6, '0')}" state="KS" party="I">Person ${i}</legislator><vote>Yea</vote></recorded-vote>`).join('');
    return new Response(`<rollcall-vote><vote-metadata><congress>119</congress><session>2</session><rollcall-num>${Number(roll[2])}</rollcall-num><action-date>14-Oct-2026</action-date><vote-question>On Passage</vote-question><vote-desc>Short floor description</vote-desc><legis-num>H R 55</legis-num></vote-metadata><vote-data>${voters}</vote-data></rollcall-vote>`);
  }
  throw new Error(`Unmocked request: ${url.origin}${path}`);
};
const row = (dataset) => sqlite.prepare('select * from backfill_jobs where dataset = ?').get(dataset);
async function post(handler, query) {
  queries = 0;
  const response = await handler(new Request(`https://clarity.test/api/ingest/${query}`, { method: 'POST', headers: { authorization: 'Bearer test-only', origin: 'https://clarity.test' } }));
  return { response, body: await response.json(), queries };
}
function seedJob(dataset, scope, cursor, status = 'running') {
  sqlite.prepare('insert into backfill_jobs(id,dataset,scope,cursor,status) values(?,?,?,?,?) on conflict(id) do update set cursor=excluded.cursor,status=excluded.status').run(`backfill:${dataset}:${scope}`, dataset, scope, JSON.stringify(cursor), status);
}
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
await test('FEC short presidential stream does not truncate the regular stream', async () => {
  const { bundles, nextPage } = await api.fetchFecCandidateBundles('test', 2026, 10, 1);
  assert.equal(bundles.length, 7);
  assert.equal(nextPage, 2);
  const end = await api.fetchFecCandidateBundles('test', 2026, 10, 2);
  assert.equal(end.nextPage, null);
  assert.throws(() => api.fecNextPage({}, 1, 10, 0), /invalid results/);
});
await test('Legacy false FEC completion reopens once and advances durably', async () => {
  // Two plausible people must never be resolved by picking the first row.
  for (const id of ['ambiguous-one', 'ambiguous-two']) sqlite.prepare('insert into entities(id,entity_type,canonical_name,normalized_name,state_code,district) values(?,?,?,?,?,?)').run(id, 'politician', 'CANDIDATE 0 PERSON', 'candidate 0 person', 'KS', '1');
  seedJob('fec', '2026', { page: 1 }, 'completed');
  let result = await post(api.backfill, 'backfill?dataset=fec');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.cursor.page, 2);
  assert.equal(row('fec').status, 'running');
  result = await post(api.backfill, 'backfill?dataset=fec');
  assert.equal(result.body.status, 'completed');
  assert.equal(sqlite.prepare("select count(*) n from entities where entity_type='candidate'").get().n, 14);
  unexpectedFetch = true;
  result = await post(api.backfill, 'backfill?dataset=fec');
  unexpectedFetch = false;
  assert.equal(result.body.skipped, true);
});
await test('Ambiguous identities stay separate with a stable FEC identifier', async () => {
  assert.equal(sqlite.prepare("select entity_id from external_ids where source_system='fec' and external_id='H26KS0'").get().entity_id, 'candidate:fec:H26KS0');
  assert.equal(sqlite.prepare("select count(*) n from entities where normalized_name='candidate 0 person' and state_code='KS'").get().n, 3);
});
await test('Outside-spending sub-batches keep the original page size and frozen date', async () => {
  seedJob('outside-spending', '2026', { page: 2 });
  const result = await post(api.backfill, 'backfill?dataset=outside-spending');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.batch.independentExpendituresWritten, 10);
  assert.equal(result.body.cursor.page, 2);
  assert.equal(result.body.cursor.itemOffset, 10);
  assert.ok(result.body.cursor.maxDate);
  assert.equal(fetched.filter((url) => url.pathname.endsWith('/schedules/schedule_e/')).at(-1).searchParams.get('per_page'), '50');
});
await test('Enrichment failure holds the cursor and preserves Super PAC classification', async () => {
  const before = row('outside-spending');
  failEnrichment = true;
  const result = await post(api.backfill, 'backfill?dataset=outside-spending');
  failEnrichment = false;
  assert.equal(result.body.status, 'retry');
  assert.equal(result.body.ok, false);
  assert.equal(row('outside-spending').cursor, before.cursor);
  assert.equal(row('outside-spending').batches_completed, before.batches_completed);
  assert.match(row('outside-spending').last_error, /timeout/);
  assert.equal(sqlite.prepare("select committee_type from committees where fec_committee_id='C0099'").get().committee_type, 'O');
  assert.match(sqlite.prepare("select description from entities where id='committee:fec:C0099'").get().description, /Super PAC/);
});
await test('Retry resumes the failed slice with no duplicate transactions or skipped rows', async () => {
  for (let i = 0; i < 4; i++) {
    const result = await post(api.backfill, 'backfill?dataset=outside-spending');
    assert.equal(result.body.ok, true, JSON.stringify(result.body));
  }
  assert.equal(JSON.parse(row('outside-spending').cursor).page, 3);
  assert.equal(JSON.parse(row('outside-spending').cursor).itemOffset, 0);
  assert.equal(sqlite.prepare("select count(*) n from money_transactions where transaction_type='independent_expenditure'").get().n, 50);
});
await test('Database error records its cause and preserves the Congress checkpoint', async () => {
  seedJob('congress', '119', { offset: 20 });
  failWrite = true;
  const result = await post(api.backfill, 'backfill?dataset=congress');
  assert.equal(result.response.status, 500);
  assert.match(result.body.error, /injected committee write failure/);
  assert.equal(row('congress').status, 'failed');
  assert.equal(JSON.parse(row('congress').cursor).offset, 20);
  assert.match(row('congress').last_error, /injected/);
});
await test('Bounded Congress retry handles 100 cosponsors without losing relationships', async () => {
  const result = await post(api.backfill, 'backfill?dataset=congress');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.cursor.offset, 21);
  assert.equal(result.body.batch.sponsorsLinked, 100);
  assert.ok(result.queries <= 50, "Congress backfill must fit the D1 Free query budget; saw " + result.queries);
  console.log("Congress backfill query count (mock D1): " + result.queries);
  assert.equal(sqlite.prepare('select count(*) n from bill_sponsors').get().n, 100);
  assert.equal(sqlite.prepare("select count(*) n from relationships where relationship_type='cosponsored'").get().n, 100);
});
await test('Congress reimport preserves curated member identity and idempotent sponsorships', async () => {
  const curated = 'person:bioguide:T000000';
  sqlite.prepare('update entities set canonical_name = ? where id = ?').run('Reviewed Legislator Name', curated);
  const first = await post(api.congress, 'congress?congress=119&offset=20&limit=1');
  assert.equal(first.body.ok, true, JSON.stringify(first.body));
  assert.ok(first.queries <= 50, 'Congress direct import exceeded 50 D1 queries: ' + first.queries);
  assert.equal(sqlite.prepare('select canonical_name from entities where id = ?').get(curated).canonical_name, 'Reviewed Legislator Name');
  assert.equal(sqlite.prepare('select count(*) n from bill_sponsors').get().n, 100);
  assert.equal(sqlite.prepare("select count(*) n from external_ids where source_system='congress_gov' and entity_id like 'person:bioguide:%'").get().n, 100);
  const repeat = await post(api.congress, 'congress?congress=119&offset=20&limit=1');
  assert.equal(repeat.body.ok, true, JSON.stringify(repeat.body));
  assert.ok(repeat.queries <= 50, 'Congress replay exceeded 50 D1 queries: ' + repeat.queries);
  assert.equal(sqlite.prepare('select count(*) n from bill_sponsors').get().n, 100);
  assert.equal(sqlite.prepare('select canonical_name from entities where id = ?').get(curated).canonical_name, 'Reviewed Legislator Name');
  console.log('Direct Congress import/replay mock D1 queries: ' + first.queries + '/' + repeat.queries);
});
await test('Congress cosponsor pagination ingests beyond first 100 and stays within D1 budget', async () => {
  cosponsorTotal = 300;
  const before = fetched.length;
  const result = await post(api.congress, 'congress?congress=119&offset=25&limit=1');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.sponsorsLinked, 300);
  assert.ok(result.queries <= 50, 'Paginated Congress 300-member import exceeded the D1 Free budget: ' + result.queries);
  const requested = fetched.slice(before).filter((url) => url.pathname.endsWith('/cosponsors'));
  assert.deepEqual(requested.map((url) => Number(url.searchParams.get('offset'))), [0, 250]);
  assert.equal(sqlite.prepare('select count(*) n from bill_sponsors').get().n, 300);
  assert.equal(sqlite.prepare("select count(*) n from relationships where relationship_type='cosponsored'").get().n, 300);
  assert.equal(sqlite.prepare("select count(*) n from external_ids where source_system='congress_gov' and entity_id like 'person:bioguide:%'").get().n, 300);
  assert.equal(sqlite.prepare("select canonical_name from entities where id='person:bioguide:T000000'").get().canonical_name, 'Reviewed Legislator Name');
  console.log('Congress 300-cosponsor paginated import mock D1 queries: ' + result.queries);
  cosponsorTotal = 100;
});
await test('Congress incomplete cosponsor page holds backfill cursor for retry', async () => {
  cosponsorTotal = 300;
  failCosponsorLaterPage = true;
  seedJob('congress', '119', { offset: 55 });
  const before = row('congress');
  const direct = await post(api.congress, 'congress?congress=119&offset=55&limit=1');
  assert.equal(direct.response.status, 500);
  assert.match(direct.body.error, /cosponsors incomplete.*HTTP 503/);
  const result = await post(api.backfill, 'backfill?dataset=congress');
  assert.equal(result.response.status, 500);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error, /cosponsors incomplete.*HTTP 503/);
  assert.equal(row('congress').status, 'failed');
  assert.equal(row('congress').cursor, before.cursor);
  assert.equal(row('congress').batches_completed, before.batches_completed);
  assert.match(row('congress').last_error, /cosponsors/);
  failCosponsorLaterPage = false;
  const resumed = await post(api.backfill, 'backfill?dataset=congress');
  assert.equal(resumed.body.ok, true, JSON.stringify(resumed.body));
  assert.equal(JSON.parse(row('congress').cursor).offset, 56);
  assert.equal(sqlite.prepare('select count(*) n from bill_sponsors').get().n, 300);
  cosponsorTotal = 100;
});
await test('House batches preserve official bill details and all member positions', async () => {
  const result = await post(api.houseVotes, 'house-votes?year=2026&limit=25');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.rollCallsWritten, 2);
  assert.equal(result.body.memberPositionsWritten, 870);
  assert.equal(sqlite.prepare("select title from bills where entity_id='bill:119:hr:55'").get().title, 'Complete official title');
  assert.equal(sqlite.prepare("select status from entities where id='bill:119:hr:55'").get().status, 'source_backed');
  assert.equal(sqlite.prepare('select count(*) n from member_votes').get().n, 870);
  const retry = await post(api.houseVotes, 'house-votes?year=2026&limit=25');
  assert.equal(retry.body.ok, true);
  assert.equal(sqlite.prepare('select count(*) n from member_votes').get().n, 870);
});
await test('Historical House cursor descends contiguously without latest-page discovery', async () => {
  seedJob('house-votes', 'federal', { year: 2026, beforeRoll: 305 });
  const start = fetched.length;
  const result = await post(api.backfill, 'backfill?dataset=house-votes');
  assert.equal(result.body.ok, true, JSON.stringify(result.body));
  assert.deepEqual(result.body.batch.rollNumbers, [304, 303]);
  assert.equal(JSON.parse(row('house-votes').cursor).beforeRoll, 303);
  assert.ok(fetched.slice(start).every((url) => url.pathname !== '/Votes/MemberVotes'));
});
await test('Empty terminal Congress pages complete instead of failing forever', async () => {
  seedJob('congress', '119', { offset: 999 });
  const result = await post(api.backfill, 'backfill?dataset=congress');
  assert.equal(result.body.status, 'completed');
});
await test('Malformed/nonadvancing progress cannot silently complete a backfill', async () => {
  assert.throws(() => api.advanceCursor('fec', { page: 2 }, { ok: true }), /omitted/);
  assert.throws(() => api.advanceCursor('fec', { page: 2 }, { ok: true, nextPage: 2 }), /did not advance/);
  assert.throws(() => api.advanceCursor('congress', { offset: 20 }, { ok: false, nextOffset: null }), /did not succeed/);
  assert.deepEqual(api.advanceCursor('house-votes', { year: 2026, beforeRoll: 3 }, { ok: true, nextBeforeRoll: 1 }).next, { year: 2025 });
});
await test('CourtListener remains explicitly blocked until a real key is configured', async () => {
  const result = await post(api.backfill, 'backfill?dataset=courtlistener');
  assert.equal(result.body.status, 'blocked');
  assert.equal(result.body.needs, 'COURTLISTENER_API_KEY');
});
console.log(`${checks} ingestion regression checks passed.`);
