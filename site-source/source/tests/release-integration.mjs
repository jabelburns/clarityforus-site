import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('existing refresh steps and new Senate steps survive secure scheduler merge',()=>{
  const code=read('app/api/ingest/scheduled/route.ts');
  const required=['house-members','house-votes','senate-votes','backfill-senate-votes','backfill-house-votes','backfill-fec','backfill-congress','backfill-outside-spending','backfill-court','outside-spending','executive-orders'];
  for(const step of required)assert.ok(code.includes(`"${step}"`),`lost scheduled step ${step}`);
  assert.ok(code.indexOf('authorizeScheduledBearer(')>0);
  assert.ok(code.indexOf('authorizeScheduledBearer(')<code.indexOf('step.handler(internalRequest)'));
});

test('new secure scheduler credentials are documented only as empty placeholders',()=>{
  const env=read('.env.example');
  for(const key of ['INGEST_TOKEN','SCHEDULED_INGEST_TOKEN','CLARITY_OWNER_USER_ID'])assert.match(env,new RegExp(`^${key}=$`,'m'));
  assert.match(read('cloudflare-env.d.ts'), /SCHEDULED_INGEST_TOKEN\?: string/);
});

test('local security fixes preserve read-only public analytics and graph API',()=>{
  assert.match(read('app/api/analytics/campaign/route.ts'),/export async function GET/);
  assert.match(read('app/api/graph/neighborhood/route.ts'),/export async function GET/);
  assert.match(read('app/api/status/route.ts'),/isOwner \? \{ latestIngest/);
  assert.match(read('lib/site-admin.ts'),/env.CLARITY_OWNER_USER_ID !== userId/);
});
