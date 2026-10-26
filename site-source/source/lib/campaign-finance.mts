/**
 * Display-only Federal Election Commission activity already imported by Clarity.
 * These are bounded/sampled transaction records, NOT a candidate's total raised
 * or spent, and never include contributors' names, addresses or employers.
 */

export type CampaignGroup = {
  category: 'itemized_receipt' | 'outside_support' | 'outside_oppose' | 'outside_unreported' | 'outside_conflicting';
  records: number;
  netCents: number;
};

export type CampaignRow = {
  transactionType: string | null;
  position: string | null;
  records: unknown;
  netCents: unknown;
};

export const CAMPAIGN_CATEGORIES: CampaignGroup['category'][] = [
  'itemized_receipt',
  'outside_support',
  'outside_oppose',
  'outside_unreported',
  'outside_conflicting',
];

function checkedInteger(value: unknown, label: string, negative = false): number {
  if (value == null || value === '') throw new Error(`Missing ${label}.`);
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || (!negative && numeric < 0)) {
    throw new Error(`Invalid ${label}; unsafe data is not a publishable financial total.`);
  }
  return numeric;
}

export function parseCampaignQuery(url: URL, currentYear = new Date().getUTCFullYear()) {
  const raw = url.searchParams.get('candidate') ?? '';
  if (!/^[A-Za-z0-9:_-]{3,160}$/.test(raw)) {
    throw new Error('A valid candidate record ID is required.');
  }
  const defaultCycle = currentYear % 2 === 0 ? currentYear : currentYear + 1;
  const cycleText = url.searchParams.get('cycle') ?? String(defaultCycle);
  if (!/^\d{4}$/.test(cycleText)) throw new Error('Cycle must be an even four-digit year.');
  const cycle = Number(cycleText);
  if (cycle < 1976 || cycle > 2100 || cycle % 2 !== 0) throw new Error('Cycle must be a supported even year.');
  return {
    candidateId: raw,
    cycle,
    startDate: `${cycle - 1}-01-01`,
    endDate: `${cycle}-12-31`,
  };
}

export function summarizeCampaignRows(rows: CampaignRow[]): CampaignGroup[] {
  const sums = new Map<CampaignGroup['category'], CampaignGroup>();
  for (const row of rows) {
    const position = row.position ?? 'unreported';
    let category: CampaignGroup['category'];
    if (row.transactionType === 'itemized_receipt') {
      category = 'itemized_receipt';
    } else if (row.transactionType === 'independent_expenditure') {
      if (position === 'support') category = 'outside_support';
      else if (position === 'oppose') category = 'outside_oppose';
      else if (position === 'conflicting') category = 'outside_conflicting';
      else category = 'outside_unreported';
    } else {
      throw new Error('Unknown transaction classification in published campaign analytics.');
    }
    const records = checkedInteger(row.records, 'record count');
    const netCents = checkedInteger(row.netCents, 'financial sum', true);
    const previous = sums.get(category);
    const newRecords = (previous?.records ?? 0) + records;
    const newCents = (previous?.netCents ?? 0) + netCents;
    if (!Number.isSafeInteger(newRecords) || !Number.isSafeInteger(newCents)) {
      throw new Error('Unsafe grouped financial sum.');
    }
    sums.set(category, { category, records: newRecords, netCents: newCents });
  }
  return CAMPAIGN_CATEGORIES.filter((c) => sums.has(c)).map((c) => sums.get(c)!);
}

export const CAMPAIGN_LIMITATIONS = [
  'These amounts reflect only transaction records Clarity has imported, which may be incomplete or deliberately sampled. They are not official total fundraising, spending or cash-on-hand figures.',
  'The reporting window uses transaction dates in the displayed two-year period, not a validated FEC election-cycle assignment for every record.',
  'Itemized receipts and outside expenditures are separate channels. Outside spending is not a contribution to, or evidence of coordination with, a candidate. Do not add the categories together.',
  'Support and opposition are taken only from documented Schedule E relationships. Missing or conflicting positions are disclosed separately.',
  'Negative amounts may represent refunds or corrections. Amended filings can change reported figures.',
  'No individual contributor names, addresses, employers or personal records are returned by this summary.',
  'A recorded financial relationship does not establish influence, improper conduct or motive.',
] as const;
