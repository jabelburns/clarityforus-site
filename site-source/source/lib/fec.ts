const FEC_API_ROOT = "https://api.open.fec.gov/v1";

type JsonRecord = Record<string, unknown>;

export type FecCommitteeBundle = {
  committee: JsonRecord;
  receipts: JsonRecord[];
  receiptError: string | null;
};

export type FecCandidateBundle = {
  candidate: JsonRecord;
  candidateId: string;
  cycle: number;
  committees: FecCommitteeBundle[];
  committeeError: string | null;
};

export type FecIndependentExpenditureBundle = {
  expenditure: JsonRecord;
  committee: JsonRecord | null;
  committeeError: string | null;
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

async function fetchFecJson(
  apiKey: string,
  path: string,
  parameters: Record<string, string | number | boolean> = {},
) {
  const url = new URL(`${FEC_API_ROOT}${path}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.append(key, String(value));
  }
  const response = await fetch(url, {
    headers: { accept: "application/json", "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`OpenFEC returned HTTP ${response.status} for ${path}.`);
  }
  return objectValue(await response.json());
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

async function candidateCommittees(
  apiKey: string,
  candidateId: string,
  cycle: number,
) {
  try {
    const payload = await fetchFecJson(
      apiKey,
      `/candidate/${encodeURIComponent(candidateId)}/committees/`,
      { cycle, per_page: 20, sort: "name" },
    );
    const committees = arrayValue(payload.results);
    const preferred = committees
      .filter((committee) => {
        const designation = stringValue(committee.designation);
        return designation === "P" || designation === "A";
      })
      .concat(committees)
      .filter(
        (committee, index, rows) =>
          rows.findIndex(
            (candidate) =>
              stringValue(candidate.committee_id) ===
              stringValue(committee.committee_id),
          ) === index,
      )
      .slice(0, 2);

    const hydrated = await mapWithConcurrency(preferred, 2, async (committee) => {
      const committeeId = stringValue(committee.committee_id);
      if (!committeeId) {
        return { committee, receipts: [], receiptError: null };
      }
      try {
        const receipts = await fetchFecJson(apiKey, "/schedules/schedule_a/", {
          committee_id: committeeId,
          two_year_transaction_period: cycle,
          is_individual: true,
          sort: "-contribution_receipt_amount",
          per_page: 10,
        });
        return {
          committee,
          receipts: arrayValue(receipts.results),
          receiptError: null,
        };
      } catch (error) {
        return {
          committee,
          receipts: [],
          receiptError:
            error instanceof Error ? error.message : "OpenFEC receipt request failed.",
        };
      }
    });

    return { committees: hydrated, error: null as string | null };
  } catch (error) {
    return {
      committees: [] as FecCommitteeBundle[],
      error:
        error instanceof Error ? error.message : "OpenFEC committee request failed.",
    };
  }
}

async function fetchCandidateTotals(
  apiKey: string,
  cycle: number,
  limit: number,
  office?: "P",
  page = 1,
) {
  const payload = await fetchFecJson(apiKey, "/candidates/totals/", {
    cycle,
    election_full: false,
    has_raised_funds: true,
    is_active_candidate: true,
    sort: "-receipts",
    sort_hide_null: true,
    per_page: limit,
    page,
    ...(office ? { office } : {}),
  });
  const records = arrayValue(payload.results);
  return { records, nextPage: fecNextPage(payload, page, limit, records.length) };
}

// Use the upstream page count, never the number left after merging streams.
// A short presidential feed must not terminate the current-cycle feed.
export function fecNextPage(payload: JsonRecord, page: number, perPage: number, count: number) {
  if (!Array.isArray(payload.results)) throw new Error("OpenFEC returned an invalid results page.");
  const pagination = objectValue(payload.pagination);
  const pages = Number(pagination.pages);
  if (Number.isInteger(pages) && pages >= 0) return page < pages ? page + 1 : null;
  // Older responses may omit pagination. An empty/short raw page is terminal;
  // filtering or enrichment must never influence this decision.
  return count < perPage ? null : page + 1;
}

export function currentFecCycle(date = new Date()) {
  const year = date.getUTCFullYear();
  return year % 2 === 0 ? year : year + 1;
}

export function nextPresidentialCycle(cycle: number) {
  const remainder = cycle % 4;
  return remainder === 0 ? cycle : cycle + (4 - remainder);
}

export function fecCandidateDisplayName(record: JsonRecord) {
  const first = stringValue(record.candidate_first_name);
  const middle = stringValue(record.candidate_middle_name);
  const last = stringValue(record.candidate_last_name);
  const suffix = stringValue(record.candidate_suffix);
  const assembled = [first, middle, last, suffix].filter(Boolean).join(" ");
  if (assembled) return assembled;

  const reported = stringValue(record.name) ?? "Unnamed candidate";
  const [reportedLast, reportedFirst] = reported.split(",", 2).map((part) => part.trim());
  return reportedFirst ? `${reportedFirst} ${reportedLast}` : reported;
}

export function fecNumber(record: JsonRecord, key: string) {
  return numberValue(record[key]);
}

export function fecString(record: JsonRecord, key: string) {
  return stringValue(record[key]);
}

export function fecCommitteeCategory(value: unknown) {
  const type = stringValue(value);
  if (type === "O") return "Super PAC (independent expenditure-only)";
  if (type === "V" || type === "W") return "Hybrid PAC";
  if (type === "U") return "Single-candidate independent expenditure committee";
  if (type === "N" || type === "Q") return "PAC";
  if (type === "X" || type === "Y" || type === "Z") return "Party committee";
  if (type === "H" || type === "S" || type === "P") return "Candidate committee";
  if (type === "I") return "Independent spender";
  return type ? `FEC committee type ${type}` : "Political committee or outside spender";
}

export function sanitizedFecIndependentExpenditure(record: JsonRecord) {
  return allowedFields(record, [
    "sub_id",
    "committee_id",
    "committee_name",
    "candidate_id",
    "candidate_name",
    "candidate_office",
    "candidate_office_state",
    "candidate_office_district",
    "support_oppose_indicator",
    "expenditure_amount",
    "expenditure_date",
    "dissemination_date",
    "payee_name",
    "expenditure_description",
    "memo_text",
    "amendment_indicator",
    "file_number",
    "report_type",
    "line_number_label",
    "election_type",
    "image_number",
  ]);
}

export async function fetchFecIndependentExpenditures(
  apiKey: string,
  cycle: number,
  limit: number,
  page = 1,
  options: { itemOffset?: number; batchSize?: number; maxDate?: string } = {},
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const today = new Date();
  const maxDate = `${String(today.getUTCMonth() + 1).padStart(2, "0")}/${String(today.getUTCDate()).padStart(2, "0")}/${today.getUTCFullYear()}`;
  const payload = await fetchFecJson(apiKey, "/schedules/schedule_e/", {
    cycle,
    is_notice: false,
    max_date: options.maxDate ?? maxDate,
    sort: "-expenditure_date",
    per_page: safeLimit,
    page: Math.max(1, Math.trunc(page)),
  });
  const pageRecords = arrayValue(payload.results);
  const itemOffset = Math.max(0, Math.trunc(options.itemOffset ?? 0));
  const expenditures = pageRecords.slice(itemOffset, itemOffset + (options.batchSize ?? safeLimit));
  const upstreamNextPage = fecNextPage(payload, page, safeLimit, pageRecords.length);
  const hasMoreItems = itemOffset + expenditures.length < pageRecords.length;
  const committeeIds = [
    ...new Set(
      expenditures
        .map((record) => stringValue(record.committee_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const committeeById = new Map<
    string,
    { committee: JsonRecord | null; error: string | null }
  >();

  await mapWithConcurrency(committeeIds, 4, async (committeeId) => {
    try {
      const committeePayload = await fetchFecJson(
        apiKey,
        `/committee/${encodeURIComponent(committeeId)}/`,
        { cycle, per_page: 1 },
      );
      committeeById.set(committeeId, {
        committee: arrayValue(committeePayload.results)[0] ?? null,
        error: null,
      });
    } catch (error) {
      committeeById.set(committeeId, {
        committee: null,
        error:
          error instanceof Error
            ? error.message
            : "OpenFEC committee request failed.",
      });
    }
  });

  const bundles = expenditures.map((expenditure): FecIndependentExpenditureBundle => {
    const committeeId = stringValue(expenditure.committee_id);
    const committee = committeeId ? committeeById.get(committeeId) : null;
    return {
      expenditure,
      committee: committee?.committee ?? null,
      committeeError: committee?.error ?? null,
    };
  });
  return {
    bundles,
    nextPage: hasMoreItems ? page : upstreamNextPage,
    nextItemOffset: hasMoreItems ? itemOffset + expenditures.length : 0,
    maxDate: options.maxDate ?? maxDate,
  };
}

export function sanitizedFecReceipt(record: JsonRecord) {
  const allowed = [
    "sub_id",
    "committee_id",
    "candidate_id",
    "contributor_id",
    "contributor_name",
    "contributor_city",
    "contributor_state",
    "contributor_employer",
    "contributor_occupation",
    "contribution_receipt_amount",
    "contribution_receipt_date",
    "line_number_label",
    "memo_text",
    "entity_type",
    "amendment_indicator",
    "file_number",
    "load_date",
  ];
  return Object.fromEntries(
    allowed.flatMap((key) =>
      record[key] === undefined ? [] : [[key, record[key]]],
    ),
  );
}

function allowedFields(record: JsonRecord, fields: string[]) {
  return Object.fromEntries(
    fields.flatMap((key) =>
      record[key] === undefined ? [] : [[key, record[key]]],
    ),
  );
}

export function sanitizedFecCandidate(record: JsonRecord) {
  return allowedFields(record, [
    "candidate_id",
    "candidate_first_name",
    "candidate_middle_name",
    "candidate_last_name",
    "candidate_prefix",
    "candidate_suffix",
    "name",
    "office",
    "office_full",
    "state",
    "state_full",
    "district",
    "party",
    "party_full",
    "candidate_status",
    "candidate_inactive",
    "incumbent_challenge",
    "incumbent_challenge_full",
    "cycle",
    "cycles",
    "election_year",
    "election_years",
    "is_election",
    "has_raised_funds",
    "federal_funds_flag",
    "first_file_date",
    "last_file_date",
    "coverage_start_date",
    "coverage_end_date",
    "receipts",
    "disbursements",
    "cash_on_hand_end_period",
    "debts_owed_by_committee",
    "individual_itemized_contributions",
    "other_political_committee_contributions",
    "transfers_from_other_authorized_committee",
    "load_date",
  ]);
}

export function sanitizedFecCommittee(record: JsonRecord) {
  return allowedFields(record, [
    "committee_id",
    "name",
    "committee_type",
    "committee_type_full",
    "designation",
    "designation_full",
    "organization_type",
    "organization_type_full",
    "party",
    "party_full",
    "candidate_ids",
    "cycles",
    "filing_frequency",
    "treasurer_name",
    "first_file_date",
    "last_file_date",
    "state",
    "city",
  ]);
}

export async function fetchFecCandidateBundles(
  apiKey: string,
  cycle: number,
  limit: number,
  page = 1,
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const regularLimit = Math.max(1, Math.ceil(safeLimit * 0.7));
  const presidentialCycle = nextPresidentialCycle(cycle);
  const presidentialLimit = presidentialCycle === cycle ? 0 : safeLimit - regularLimit;

  const [regular, presidential] = await Promise.all([
    fetchCandidateTotals(apiKey, cycle, regularLimit, undefined, page),
    presidentialLimit
      ? fetchCandidateTotals(apiKey, presidentialCycle, presidentialLimit, "P", page)
      : Promise.resolve({ records: [], nextPage: null }),
  ]);

  const candidates = [...regular.records, ...presidential.records]
    .filter((candidate) => Boolean(stringValue(candidate.candidate_id)))
    .filter(
      (candidate, index, rows) =>
        rows.findIndex(
          (row) =>
            stringValue(row.candidate_id) === stringValue(candidate.candidate_id) &&
            numberValue(row.cycle) === numberValue(candidate.cycle),
        ) === index,
    )
    .slice(0, safeLimit);

  const bundles = await mapWithConcurrency(candidates, 2, async (candidate) => {
    const candidateId = stringValue(candidate.candidate_id);
    if (!candidateId) throw new Error("OpenFEC returned a candidate without an ID.");
    const candidateCycle = numberValue(candidate.cycle) ?? cycle;
    const committees = await candidateCommittees(
      apiKey,
      candidateId,
      candidateCycle,
    );
    return {
      candidate,
      candidateId,
      cycle: candidateCycle,
      committees: committees.committees,
      committeeError: committees.error,
    } satisfies FecCandidateBundle;
  });
  return { bundles, nextPage: regular.nextPage ?? presidential.nextPage };
}
