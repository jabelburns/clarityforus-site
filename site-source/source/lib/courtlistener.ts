const COURTLISTENER_API_ROOT = "https://www.courtlistener.com/api/rest/v4";
const COURTLISTENER_WEB_ROOT = "https://www.courtlistener.com";

type JsonRecord = Record<string, unknown>;

export type CourtListenerCaseHit = {
  docketId: string;
  caseName: string;
  docketNumber: string;
  courtId: string | null;
  courtName: string;
  filedDate: string | null;
  terminatedDate: string | null;
  caseStatus: string | null;
  natureOfSuit: string | null;
  opinionStatus: string | null;
  officialUrl: string;
  snippet: string | null;
  raw: JsonRecord;
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
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function stripMarkup(value: unknown, limit = 1_500) {
  const text = stringValue(value);
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function firstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return null;
}

function firstArray(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = arrayValue(record[key]);
    if (value.length) return value;
  }
  return [];
}

function courtListenerUrl(value: unknown, docketId: string) {
  const path = stringValue(value);
  if (!path) return `${COURTLISTENER_WEB_ROOT}/docket/${encodeURIComponent(docketId)}/`;
  try {
    const url = new URL(path, COURTLISTENER_WEB_ROOT);
    return url.protocol === "https:"
      ? url.toString()
      : `${COURTLISTENER_WEB_ROOT}/docket/${encodeURIComponent(docketId)}/`;
  } catch {
    return `${COURTLISTENER_WEB_ROOT}/docket/${encodeURIComponent(docketId)}/`;
  }
}

function sanitizedDocument(record: JsonRecord) {
  return {
    id: record.id ?? null,
    documentNumber: record.document_number ?? record.documentNumber ?? null,
    description:
      stripMarkup(record.description ?? record.short_description, 500) ?? null,
    dateFiled:
      stringValue(record.date_filed ?? record.dateFiled) ?? null,
    documentType:
      stringValue(record.document_type ?? record.documentType) ?? null,
    available:
      typeof record.is_available === "boolean"
        ? record.is_available
        : typeof record.isAvailable === "boolean"
          ? record.isAvailable
          : null,
    snippet: stripMarkup(record.snippet),
  };
}

function sanitizedSearchHit(record: JsonRecord) {
  const documents = firstArray(record, [
    "recap_documents",
    "recapDocuments",
    "documents",
  ]);
  return {
    docketId: record.docket_id ?? record.docketId ?? record.id ?? null,
    caseName:
      record.caseNameFull ??
      record.caseName ??
      record.case_name_full ??
      record.case_name ??
      null,
    docketNumber: record.docketNumber ?? record.docket_number ?? null,
    courtId: record.court_id ?? record.courtId ?? null,
    court: record.court ?? record.court_citation_string ?? null,
    dateFiled: record.dateFiled ?? record.date_filed ?? null,
    dateTerminated: record.dateTerminated ?? record.date_terminated ?? null,
    caseStatus: record.caseStatus ?? record.case_status ?? null,
    natureOfSuit:
      record.suitNature ?? record.natureOfSuit ?? record.nature_of_suit ?? null,
    cause: stripMarkup(record.cause, 500),
    status: record.status ?? null,
    absoluteUrl: record.absolute_url ?? record.absoluteUrl ?? null,
    snippet: stripMarkup(record.snippet),
    documents: documents.slice(0, 3).map(sanitizedDocument),
    moreDocuments:
      typeof record.more_docs === "boolean"
        ? record.more_docs
        : typeof record.moreDocs === "boolean"
          ? record.moreDocs
          : null,
  };
}

export function quoteCourtListenerQuery(value: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const bounded = normalized.slice(0, 240);
  return `"${bounded.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function parseCourtListenerCaseHit(
  record: JsonRecord,
): CourtListenerCaseHit | null {
  const docketId = firstString(record, ["docket_id", "docketId", "id"]);
  const caseName = firstString(record, [
    "caseNameFull",
    "caseName",
    "case_name_full",
    "case_name",
  ]);
  const docketNumber = firstString(record, ["docketNumber", "docket_number"]);
  const courtId = firstString(record, ["court_id", "courtId"]);
  const courtName =
    firstString(record, ["court", "court_citation_string"]) ??
    courtId ??
    "Federal court";
  if (!docketId || !caseName || !docketNumber) return null;

  const documents = firstArray(record, [
    "recap_documents",
    "recapDocuments",
    "documents",
  ]);
  const documentSnippet = documents
    .map((document) => stripMarkup(document.snippet))
    .find(Boolean);
  const terminatedDate = firstString(record, [
    "dateTerminated",
    "date_terminated",
  ]);
  const reportedStatus = firstString(record, ["caseStatus", "case_status"]);

  return {
    docketId,
    caseName,
    docketNumber,
    courtId,
    courtName,
    filedDate: firstString(record, ["dateFiled", "date_filed"]),
    terminatedDate,
    caseStatus:
      reportedStatus ?? (terminatedDate ? "terminated" : "open_or_unknown"),
    natureOfSuit: firstString(record, [
      "suitNature",
      "natureOfSuit",
      "nature_of_suit",
    ]),
    opinionStatus: firstString(record, ["opinionStatus", "opinion_status"]),
    officialUrl: courtListenerUrl(
      record.absolute_url ?? record.absoluteUrl,
      docketId,
    ),
    snippet: stripMarkup(record.snippet) ?? documentSnippet ?? null,
    raw: sanitizedSearchHit(record),
  };
}

export async function searchCourtListenerCases(
  apiKey: string,
  query: string,
  limit: number,
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5);
  const url = new URL(`${COURTLISTENER_API_ROOT}/search/`);
  url.searchParams.set("type", "r");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(safeLimit));
  url.searchParams.set("order_by", "score desc");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Token ${apiKey}`,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("CourtListener rejected the configured API token.");
    }
    if (response.status === 429) {
      throw new Error("CourtListener rate limit reached; try again later.");
    }
    throw new Error(`CourtListener returned HTTP ${response.status}.`);
  }

  const payload = objectValue(await response.json());
  return arrayValue(payload.results)
    .map(parseCourtListenerCaseHit)
    .filter((hit): hit is CourtListenerCaseHit => hit !== null)
    .slice(0, safeLimit);
}
