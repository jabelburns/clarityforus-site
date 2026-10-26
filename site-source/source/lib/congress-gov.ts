const CONGRESS_API_ROOT = "https://api.congress.gov/v3";

type JsonRecord = Record<string, unknown>;

export type CongressPerson = {
  bioguideId: string;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  party: string | null;
  state: string | null;
  district: string | null;
  joinedDate: string | null;
  withdrawnDate: string | null;
  isOriginalCosponsor: boolean | null;
  raw: JsonRecord;
};

export type CongressBillBundle = {
  listRecord: JsonRecord;
  bill: JsonRecord;
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  originChamber: string | null;
  introducedDate: string | null;
  policyArea: string | null;
  latestActionText: string | null;
  latestActionDate: string | null;
  officialUrl: string;
  sponsors: CongressPerson[];
  cosponsors: CongressPerson[];
  actions: JsonRecord[];
  summaries: JsonRecord[];
  textVersions: JsonRecord[];
  amendments: JsonRecord[];
  committees: JsonRecord[];
  endpointErrors: string[];
};

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function arrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function stringValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function endpointArray(payload: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const rows = arrayValue(payload[key]);
    if (rows.length || Array.isArray(payload[key])) return rows;
  }
  return [];
}

function billPath(congress: number, billType: string, billNumber: string) {
  return `/bill/${congress}/${encodeURIComponent(billType.toLowerCase())}/${encodeURIComponent(billNumber)}`;
}

const billTypePaths: Record<string, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
  hres: "house-resolution",
  sres: "senate-resolution",
};

export function congressBillLabel(type: string, number: string) {
  const labels: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  return `${labels[type.toLowerCase()] ?? type.toUpperCase()} ${number}`;
}

export function congressBillUrl(
  congress: number,
  billType: string,
  billNumber: string,
) {
  const path = billTypePaths[billType.toLowerCase()] ?? "bill";
  return `https://www.congress.gov/bill/${congress}th-congress/${path}/${encodeURIComponent(billNumber)}`;
}

export function currentCongressNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  return Math.floor((year - 1789) / 2) + 1;
}

async function fetchCongressJson(
  apiKey: string,
  path: string,
  parameters: Record<string, string | number> = {},
) {
  const url = new URL(`${CONGRESS_API_ROOT}${path}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(
      `Congress.gov returned HTTP ${response.status} for ${path}.`,
    );
  }
  return objectValue(await response.json());
}

function personRecord(raw: JsonRecord, cosponsor: boolean): CongressPerson | null {
  const bioguideId = stringValue(raw.bioguideId ?? raw.bioguidId);
  if (!bioguideId) return null;
  const firstName = stringValue(raw.firstName);
  const middleName = stringValue(raw.middleName);
  const lastName = stringValue(raw.lastName);
  const fullName =
    stringValue(raw.fullName) ??
    [firstName, middleName, lastName].filter(Boolean).join(" ") ??
    bioguideId;
  return {
    bioguideId,
    fullName: fullName || bioguideId,
    firstName,
    middleName,
    lastName,
    party: stringValue(raw.party),
    state: stringValue(raw.state),
    district: stringValue(raw.district),
    joinedDate: cosponsor
      ? stringValue(raw.sponsorshipDate)
      : null,
    withdrawnDate: stringValue(raw.sponsorshipWithdrawnDate),
    isOriginalCosponsor:
      typeof raw.isOriginalCosponsor === "boolean"
        ? raw.isOriginalCosponsor
        : null,
    raw,
  };
}

async function optionalEndpoint(
  apiKey: string,
  path: string,
  label: string,
  limit: number,
) {
  try {
    return {
      label,
      payload: await fetchCongressJson(apiKey, path, { limit }),
      error: null as string | null,
    };
  } catch (error) {
    return {
      label,
      payload: {} as JsonRecord,
      error: error instanceof Error ? error.message : `${label} request failed.`,
    };
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await callback(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

async function hydrateBill(apiKey: string, listRecord: JsonRecord) {
  const congress = numberValue(listRecord.congress);
  const billType = stringValue(listRecord.type)?.toLowerCase();
  const billNumber = stringValue(listRecord.number);
  if (!congress || !billType || !billNumber) {
    throw new Error("Congress.gov returned a bill without its core identifier.");
  }

  const path = billPath(congress, billType, billNumber);
  const detailPayload = await fetchCongressJson(apiKey, path);
  const bill = objectValue(detailPayload.bill);
  const endpoints = await Promise.all([
    optionalEndpoint(apiKey, `${path}/actions`, "actions", 60),
    optionalEndpoint(apiKey, `${path}/cosponsors`, "cosponsors", 100),
    optionalEndpoint(apiKey, `${path}/summaries`, "summaries", 10),
    optionalEndpoint(apiKey, `${path}/text`, "text", 250),
    optionalEndpoint(apiKey, `${path}/amendments`, "amendments", 60),
    optionalEndpoint(apiKey, `${path}/committees`, "committees", 50),
  ]);
  const byLabel = new Map(endpoints.map((endpoint) => [endpoint.label, endpoint]));
  const latestAction = objectValue(bill.latestAction ?? listRecord.latestAction);
  const title =
    stringValue(bill.title ?? listRecord.title) ??
    congressBillLabel(billType, billNumber);

  const sponsors = arrayValue(bill.sponsors)
    .map((person) => personRecord(person, false))
    .filter((person): person is CongressPerson => person !== null);
  const cosponsors = endpointArray(
    byLabel.get("cosponsors")?.payload ?? {},
    ["cosponsors", "members"],
  )
    .map((person) => personRecord(person, true))
    .filter((person): person is CongressPerson => person !== null);

  return {
    listRecord,
    bill,
    congress,
    billType,
    billNumber,
    title,
    originChamber: stringValue(bill.originChamber ?? listRecord.originChamber),
    introducedDate: stringValue(bill.introducedDate),
    policyArea: stringValue(objectValue(bill.policyArea).name),
    latestActionText: stringValue(latestAction.text),
    latestActionDate: stringValue(latestAction.actionDate),
    officialUrl:
      stringValue(bill.legislationUrl) ??
      congressBillUrl(congress, billType, billNumber),
    sponsors,
    cosponsors,
    actions: endpointArray(byLabel.get("actions")?.payload ?? {}, ["actions"]),
    summaries: endpointArray(byLabel.get("summaries")?.payload ?? {}, [
      "summaries",
    ]),
    textVersions: endpointArray(byLabel.get("text")?.payload ?? {}, [
      "textVersions",
      "texts",
    ]),
    amendments: endpointArray(byLabel.get("amendments")?.payload ?? {}, [
      "amendments",
    ]),
    committees: endpointArray(byLabel.get("committees")?.payload ?? {}, [
      "committees",
    ]),
    endpointErrors: endpoints.flatMap((endpoint) =>
      endpoint.error ? [`${endpoint.label}: ${endpoint.error}`] : [],
    ),
  } satisfies CongressBillBundle;
}

export async function fetchRecentCongressBills(
  apiKey: string,
  limit: number,
  options: { congress?: number; offset?: number } = {},
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const congress = options.congress ?? currentCongressNumber();
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const payload = await fetchCongressJson(apiKey, `/bill/${congress}`, {
    limit: safeLimit,
    offset,
    sort: "updateDate+desc",
  });
  const records = endpointArray(payload, ["bills"]).slice(0, safeLimit);
  if (!Array.isArray(payload.bills)) throw new Error("Congress.gov returned an invalid bill page.");
  return mapWithConcurrency(records, 2, (record) => hydrateBill(apiKey, record));
}
