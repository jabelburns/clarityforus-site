/**
 * Display-only aggregation of the records Clarity has actually ingested.
 * This is NOT an estimate of national completeness or a measure of influence.
 */
export type CountRow = { key: string; records: number };
export type MoneyRow = { key: string; records: number; netCents: number };
export type SourceRow = { key: string; records: number; lastFetchedAt: string | null };

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function countSeries(rows: Array<{ key: string | null; records: unknown }>): CountRow[] {
  return rows.map((row) => ({
    key: row.key || "unclassified",
    records: count(row.records),
  })).sort((a, b) => b.records - a.records || a.key.localeCompare(b.key));
}

export function moneySeries(rows: Array<{ key: string | null; records: unknown; netCents: unknown }>): MoneyRow[] {
  return rows.map((row) => {
    // FEC corrections/refunds may be negative. Do not sum unlike reporting
    // categories together, and never round money through floating point.
    const net = Number(row.netCents);
    if (!Number.isSafeInteger(net)) throw new Error("A financial aggregate exceeds safe integer precision.");
    return { key: row.key || "unclassified", records: count(row.records), netCents: net };
  }).sort((a, b) => b.records - a.records || a.key.localeCompare(b.key));
}

export function sourceSeries(rows: Array<{ key: string | null; records: unknown; lastFetchedAt: string | null }>): SourceRow[] {
  return rows.map((row) => ({
    key: row.key || "unclassified",
    records: count(row.records),
    lastFetchedAt: row.lastFetchedAt || null,
  })).sort((a, b) => b.records - a.records || a.key.localeCompare(b.key));
}

export const ANALYTICS_LIMITATIONS = [
  "Counts describe records imported into Clarity, not the total records published by a government agency.",
  "House and Senate roll-call counts measure recorded vote questions, not enacted bills or legislation passed. Procedural votes and nominations are included.",
  "Source refresh timestamps show Clarity's latest stored retrieval, not the publisher's last update.",
  "Money totals are grouped by transaction type and can include corrections or refunds. Different categories must not be added together as a single funding total.",
  "A documented contribution, vote, or relationship does not establish influence, wrongdoing, or motive.",
] as const;
