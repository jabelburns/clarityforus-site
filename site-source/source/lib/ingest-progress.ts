export type Dataset = "congress" | "fec" | "house-votes" | "senate-votes" | "outside-spending" | "courtlistener";
export type Cursor = {
  offset?: number;
  page?: number;
  year?: number;
  congress?: number;
  session?: number;
  beforeRoll?: number;
  itemOffset?: number;
  maxDate?: string;
  paginationVersion?: number;
};

function nextNumber(body: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(body, key)) throw new Error(`Batch omitted ${key}; checkpoint retained.`);
  const value = body[key];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Batch returned invalid ${key}; checkpoint retained.`);
  }
  return value;
}

// Only explicit, validated upstream exhaustion can complete a dataset.
export function advanceCursor(dataset: Dataset, cursor: Cursor, body: Record<string, unknown>, year = new Date().getUTCFullYear()) {
  if (body.ok !== true) throw new Error("Batch did not succeed; checkpoint retained.");
  let next: Cursor = cursor;
  let completed = false;
  if (dataset === "congress") {
    const value = nextNumber(body, "nextOffset");
    completed = value === null;
    if (value !== null && value <= (cursor.offset ?? 0)) throw new Error("Congress cursor did not advance.");
    next = { offset: value ?? cursor.offset ?? 0 };
  } else if (dataset === "fec" || dataset === "outside-spending") {
    const value = nextNumber(body, "nextPage");
    completed = value === null;
    if (value !== null && value < (cursor.page ?? 1)) throw new Error("FEC cursor moved backwards.");
    next = { page: value ?? cursor.page ?? 1 };
    if (dataset === "fec") {
      if (value !== null && value <= (cursor.page ?? 1)) throw new Error("FEC candidate cursor did not advance.");
      next.paginationVersion = 2;
    } else {
      next.itemOffset = nextNumber(body, "nextItemOffset") ?? 0;
      next.maxDate = typeof body.maxDate === "string" ? body.maxDate : cursor.maxDate;
      if (value === (cursor.page ?? 1) && next.itemOffset <= (cursor.itemOffset ?? 0)) throw new Error("Outside-spending cursor did not advance.");
    }
  } else if (dataset === "house-votes") {
    const nextRoll = nextNumber(body, "nextBeforeRoll");
    const currentYear = cursor.year ?? year;
    if (nextRoll !== null && nextRoll > 1) {
      if (cursor.beforeRoll && nextRoll >= cursor.beforeRoll) throw new Error("House vote cursor did not advance.");
      next = { year: currentYear, beforeRoll: nextRoll };
    } else if (currentYear > 2021) next = { year: currentYear - 1 };
    else completed = true;
  } else if (dataset === "senate-votes") {
    const nextRoll = nextNumber(body, "nextBeforeRoll");
    const currentCongress = cursor.congress ?? 119;
    const currentSession = cursor.session ?? 2;
    if (currentCongress !== 119 || ![1, 2].includes(currentSession)) throw new Error("Invalid Senate backfill scope.");
    if (nextRoll !== null && nextRoll > 1) {
      if (cursor.beforeRoll && nextRoll >= cursor.beforeRoll) throw new Error("Senate vote cursor did not advance.");
      next = { congress: currentCongress, session: currentSession, beforeRoll: nextRoll };
    } else if (currentSession === 2) next = { congress: currentCongress, session: 1 };
    else { next = { congress: currentCongress, session: 1, beforeRoll: 1 }; completed = true; }
  } else completed = true;
  return { next, completed };
}

export function batchWarnings(body: Record<string, unknown>) {
  return [body.partialErrors, body.partialEndpointErrors].flatMap((items) =>
    Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [],
  );
}
