import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCampaignQuery, summarizeCampaignRows, CAMPAIGN_LIMITATIONS } from '../lib/campaign-finance.mts';

const url = (params) => new URL(`https://site.example/api/analytics/campaign?${params}`);

test('defaults to current even cycle and matches its exact two-year transaction window', () => {
  assert.deepEqual(parseCampaignQuery(url('candidate=candidate:fec:H0A000001'), 2026), {
    candidateId: 'candidate:fec:H0A000001', cycle: 2026,
    startDate: '2025-01-01', endDate: '2026-12-31',
  });
  assert.equal(parseCampaignQuery(url('candidate=candidate:fec:H0A000001'), 2027).cycle, 2028);
});

test('explicit supported older cycle uses separate election-period dates', () => {
  const a = parseCampaignQuery(url('candidate=candidate:fec:H0A000001&cycle=2024'));
  assert.equal(a.startDate, '2023-01-01');
  assert.equal(a.endDate, '2024-12-31');
});

test('bad, fractional, odd and injected cycle values fail closed', () => {
  for (const cycle of ['2025','2026.5','2026abc','1900','0','2102','<script>']) {
    assert.throws(() => parseCampaignQuery(url(`candidate=candidate:fec:H0A000001&cycle=${encodeURIComponent(cycle)}`)), /Cycle/);
  }
});

test('candidate identifier input validation blocks SQL and path injection', () => {
  for (const candidate of ['',"abc' OR 1=1",'https://evil.example','contributor%2Fprivate']) {
    assert.throws(() => parseCampaignQuery(url(`candidate=${encodeURIComponent(candidate)}`)), /candidate record ID/);
  }
});

test('itemized receipts and outside support/oppose never collapse into single totals', () => {
  assert.deepEqual(summarizeCampaignRows([
    {transactionType:'itemized_receipt',position:'not_applicable',records:2,netCents:13000},
    {transactionType:'independent_expenditure',position:'support',records:1,netCents:25000},
    {transactionType:'independent_expenditure',position:'oppose',records:2,netCents:43000},
    {transactionType:'independent_expenditure',position:'unreported',records:1,netCents:500},
  ]), [
    {category:'itemized_receipt',records:2,netCents:13000},
    {category:'outside_support',records:1,netCents:25000},
    {category:'outside_oppose',records:2,netCents:43000},
    {category:'outside_unreported',records:1,netCents:500},
  ]);
});

test('conflicting support/oppose disclosures are clearly separated', () => {
  assert.deepEqual(summarizeCampaignRows([{transactionType:'independent_expenditure',position:'conflicting',records:1,netCents:1000}]),[
    {category:'outside_conflicting',records:1,netCents:1000},
  ]);
});

test('amendments and refunds may be negative; counts remain nonnegative', () => {
  assert.deepEqual(summarizeCampaignRows([{transactionType:'itemized_receipt',position:'not_applicable',records:2,netCents:-1750}]),[
    {category:'itemized_receipt',records:2,netCents:-1750},
  ]);
  assert.throws(() => summarizeCampaignRows([{transactionType:'itemized_receipt',position:'not_applicable',records:-1,netCents:0}]), /Invalid record count/);
});

test('unsafe integer, invalid totals and unknown transaction types are rejected', () => {
  assert.throws(() => summarizeCampaignRows([{transactionType:'independent_expenditure',position:'oppose',records:1,netCents:'1e24'}]),/Invalid financial sum/);
  assert.throws(() => summarizeCampaignRows([{transactionType:'untracked_transfer',position:'',records:1,netCents:2}]),/Unknown transaction/);
  assert.throws(() => summarizeCampaignRows([{transactionType:'itemized_receipt',position:'',records:1,netCents:NaN}]),/Invalid financial sum/);
});

test('empty money state is not falsely labeled as zero campaign funding', () => {
  assert.deepEqual(summarizeCampaignRows([]), []);
  assert.ok(CAMPAIGN_LIMITATIONS.some((line) => line.includes('not official total')));
  assert.ok(CAMPAIGN_LIMITATIONS.some((line) => line.includes('No individual contributor names')));
});
