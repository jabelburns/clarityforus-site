/** Read-only official bill text-version metadata. Does NOT imply that bill text bytes have been archived. */
type UnknownRecord = Record<string, unknown>;
type TextFormat = { type: string; url: string; preferred: boolean };
export type TextVersion = {
  key: string;
  label: string;
  date: string | null;
  formats: TextFormat[];
};
export type VersionInventory = {
  versions: TextVersion[];
  reportedCount: number | null;
  importedCount: number;
  partial: boolean;
  warnings: string[];
};
const officialHosts = new Set(['congress.gov', 'www.congress.gov', 'govinfo.gov', 'www.govinfo.gov', 'api.govinfo.gov']);
function objectValue(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}
function arr(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)) : [];
}
function str(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().slice(0, 180) || null : null;
}
export function safeOfficialTextUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !officialHosts.has(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port || url.hash) return null;
    return url.toString();
  } catch { return null; }
}
function priority(type: string): number {
  const value = type.toLowerCase();
  if (value === 'formatted text' || value === 'text') return 0;
  if (value === 'formatted xml' || value === 'xml') return 1;
  if (value === 'pdf') return 2;
  return 5;
}
function dateValue(raw: unknown): string | null {
  const value = str(raw);
  return value && /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value) ? value : null;
}
export function normalizeBillTextVersions(
  rawVersions: unknown,
  options: { reportedCount?: unknown; endpointErrors?: unknown } = {},
): VersionInventory {
  const map = new Map<string, { label: string; date: string | null; formats: Map<string, { type: string; url: string }> }>();
  let invalidLinks = 0;
  for (const raw of arr(rawVersions).slice(0, 300)) {
    const label = str(raw.type) ?? 'Unspecified official version';
    const date = dateValue(raw.date);
    const key = `${label.toLowerCase().replace(/\s+/g, '-')}:${date ?? 'undated'}`;
    let current = map.get(key);
    if (!current) {
      current = { label, date, formats: new Map() };
      map.set(key, current);
    }
    for (const format of arr(raw.formats)) {
      const url = safeOfficialTextUrl(format.url);
      if (!url) { invalidLinks++; continue; }
      const type = str(format.type) ?? 'Official file';
      current.formats.set(url, { type, url });
    }
  }
  const versions = Array.from(map, ([key, item]) => {
    const formats = [...item.formats.values()].sort((a,b) => priority(a.type) - priority(b.type) || a.url.localeCompare(b.url));
    return { key, label: item.label, date: item.date,
      formats: formats.map((f,i) => ({...f, preferred: i === 0 && priority(f.type) <= 1})) };
  }).sort((a,b) => (b.date ?? '').localeCompare(a.date ?? '') || a.key.localeCompare(b.key));
  const reported = options.reportedCount;
  const reportedCount = typeof reported === 'number' && Number.isSafeInteger(reported) && reported >= 0 ? reported :
    typeof reported === 'string' && /^\d{1,8}$/.test(reported) ? Number(reported) : null;
  const errors = Array.isArray(options.endpointErrors) ? options.endpointErrors.filter(v => typeof v === 'string' && /^text:/.test(v)) : [];
  const partial = errors.length > 0 || (reportedCount !== null && reportedCount > versions.length) ||
    (Array.isArray(rawVersions) && rawVersions.length > 300);
  const warnings: string[] = [];
  if (errors.length) warnings.push('Congress.gov text-version endpoint failed or returned partial data.');
  if (reportedCount !== null && reportedCount > versions.length) warnings.push('Only a subset of the source-reported versions is currently imported.');
  if (invalidLinks) warnings.push(`${invalidLinks} unsafe or unsupported text URL(s) were omitted.`);
  if (Array.isArray(rawVersions) && rawVersions.length > 300) warnings.push('Text-version list was truncated at a safety limit.');
  return { versions, reportedCount, importedCount: versions.length, partial, warnings };
}
export function preferredTextVersion(inventory: VersionInventory) {
  if (inventory.partial) return null;
  const latest = inventory.versions[0];
  // Do not silently analyze an older bill merely because the newest version is PDF-only.
  if (!latest || (inventory.versions.length > 1 && latest.date === inventory.versions[1].date)) return null;
  return latest.formats.some(f => f.preferred) ? latest : null;
}
export function compareAnalysisVersion(inventory: VersionInventory, reference: unknown) {
  const key = str(objectValue(reference).key);
  if (inventory.partial || !key || !inventory.versions.length) return 'unverified' as const;
  const latest = inventory.versions[0];
  if (inventory.versions.length > 1 && latest.date === inventory.versions[1].date) return 'unverified' as const;
  return latest.key === key ? 'same_version_reference' as const : 'newer_version_available' as const;
}
