import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAnalysis, BILL_ANALYSIS_KEYS } from '../lib/bill-analysis.ts';
import { countSeries, moneySeries, sourceSeries, ANALYTICS_LIMITATIONS } from '../lib/analytics-summary.ts';

const provider = { name: 'fixture', model: 'fixture-model', url: 'https://example.test', apiKey: 'not-used' };
const evidence = ['congress-gov:bill:119:hr:1', 'congress-gov:text:sha'];
const response = () => ({
  summary: 'This measure establishes a synthetic test program.',
  limitations: 'This test contains no fiscal study or lobbying evidence.',
  findings: BILL_ANALYSIS_KEYS.map((promptKey) => ({
    promptKey, findingClass: 'statutory_text', findingText: `Grounded finding for ${promptKey}.`, sourceId: evidence[1], confidence: .6,
  })),
});

test('six source-grounded findings are accepted with their original citations', () => {
  const actual = validateAnalysis(response(), provider, evidence);
  assert.equal(actual.findings.length, 6);
  assert.deepEqual(actual.findings.map((finding) => finding.sourceId), Array(6).fill(evidence[1]));
});

test('unknown source ID is rejected rather than silently replaced', () => {
  const result = response();
  result.findings[1].sourceId = 'not-a-source';
  assert.throws(() => validateAnalysis(result, provider, evidence), /unknown source/);
});

test('duplicate findings do not pass', () => {
  const result = response();
  result.findings[1].promptKey = result.findings[0].promptKey;
  assert.throws(() => validateAnalysis(result, provider, evidence), /exactly one finding/);
});

test('omitted findings do not pass', () => {
  const result = response();
  result.findings.pop();
  assert.throws(() => validateAnalysis(result, provider, evidence), /exactly one finding/);
});

test('outside-evidence claims are blocked when the packet lacks independent sources', () => {
  const result = response();
  result.findings[2].findingClass = 'outside_evidence';
  assert.throws(() => validateAnalysis(result, provider, evidence), /outside evidence/);
});

test('count analytics sort valid nonnegative counts and label unidentified groups', () => {
  assert.deepEqual(countSeries([{key:'candidate', records:'5'},{key:null,records:-1},{key:'politician',records:'10'}]), [
    {key:'politician',records:10},{key:'candidate',records:5},{key:'unclassified',records:0},
  ]);
});

test('financial analytics preserve signed refunds and reject unsafe integer sums', () => {
  assert.deepEqual(moneySeries([{key:'refund',records:2,netCents:-1250}]), [{key:'refund',records:2,netCents:-1250}]);
  assert.throws(() => moneySeries([{key:'test',records:1,netCents:'9e40'}]), /safe integer/);
  assert.ok(ANALYTICS_LIMITATIONS.some((x) => x.includes('Different categories')));
});

test('source analytics retain retrieval timestamp and do not estimate agency coverage', () => {
  assert.deepEqual(sourceSeries([{key:'fec',records:2,lastFetchedAt:'2026-10-15T00:00:00Z'}]), [
    {key:'fec',records:2,lastFetchedAt:'2026-10-15T00:00:00Z'},
  ]);
  assert.ok(ANALYTICS_LIMITATIONS.some((x) => x.includes('not the total')));
});
