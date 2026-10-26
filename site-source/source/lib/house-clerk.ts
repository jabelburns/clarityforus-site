import { XMLParser } from "fast-xml-parser";

const HOUSE_MEMBER_FEED_URL =
  "https://clerk.house.gov/xml/lists/MemberData.xml";
const HOUSE_VOTES_PAGE_URL = "https://clerk.house.gov/Votes/MemberVotes";

type XmlRecord = Record<string, unknown>;

export type HouseMember = {
  bioguideId: string;
  officialName: string;
  listName: string | null;
  formalName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  partyCode: string | null;
  partyName: string | null;
  caucusCode: string | null;
  stateCode: string;
  stateName: string | null;
  district: string;
  districtLabel: string;
  swornDate: string | null;
  electedDate: string | null;
  phone: string | null;
  hometown: string | null;
  raw: XmlRecord;
};

export type HouseRecordedVote = {
  bioguideId: string;
  displayName: string;
  partyCode: string | null;
  stateCode: string | null;
  position: string;
};

export type HouseMeasure = {
  type: string;
  number: string;
  displayNumber: string;
  officialUrl: string;
};

export type HouseRollCall = {
  congress: number;
  session: string;
  year: number;
  rollNumber: number;
  chamber: string;
  voteDate: string;
  question: string | null;
  voteType: string | null;
  result: string | null;
  description: string | null;
  legislationNumber: string | null;
  amendmentAuthor: string | null;
  measure: HouseMeasure | null;
  memberVotes: HouseRecordedVote[];
  detailUrl: string;
  xmlUrl: string;
  raw: XmlRecord;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function asRecord(value: unknown): XmlRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function textValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  const record = asRecord(value);
  return "#text" in record ? textValue(record["#text"]) : null;
}

function attribute(record: XmlRecord, name: string) {
  return textValue(record[`@_${name}`]);
}

function partyName(code: string | null) {
  const parties: Record<string, string> = {
    D: "Democratic",
    R: "Republican",
    I: "Independent",
  };
  return code ? parties[code.toUpperCase()] ?? code : null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const match = value.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-,\s]+(\d{4})$/);
  if (match) {
    const month = months[match[2].slice(0, 3).toLowerCase()];
    if (month) return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? null
    : parsed.toISOString().slice(0, 10);
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    headers: {
      accept,
      "user-agent": "Clarity-for-US/0.2 official-civic-record-index",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`House Clerk returned HTTP ${response.status} for ${url}.`);
  }
  return response.text();
}

export async function fetchCurrentHouseMembers() {
  const xml = await fetchText(
    HOUSE_MEMBER_FEED_URL,
    "application/xml,text/xml;q=0.9,*/*;q=0.8",
  );
  const parsed = asRecord(xmlParser.parse(xml));
  const root = asRecord(parsed.MemberData ?? parsed.memberData);
  const titleInfo = asRecord(root["title-info"]);
  const memberContainer = asRecord(root.members);
  const rawMembers = asArray(memberContainer.member).map(asRecord);
  const congress = Number(textValue(titleInfo["congress-num"])) || null;
  const session = textValue(titleInfo.session);
  const publishDate = normalizeDate(attribute(root, "publish-date"));

  const members = rawMembers
    .map((raw): HouseMember | null => {
      const info = asRecord(raw["member-info"]);
      const state = asRecord(info.state);
      const bioguideId = textValue(info.bioguideID);
      const officialName =
        textValue(info["official-name"]) ?? textValue(info.namelist);
      const stateDistrict = textValue(raw.statedistrict) ?? "";
      const stateCode =
        attribute(state, "postal-code") ?? stateDistrict.slice(0, 2);
      if (!bioguideId || !officialName || !stateCode) return null;

      const rawDistrict = stateDistrict.slice(2);
      const districtNumber = Number.parseInt(rawDistrict, 10);
      const stateDistrictLabel = textValue(state.district);
      const district =
        rawDistrict === "00" || stateDistrictLabel === "At Large"
          ? "AL"
          : Number.isFinite(districtNumber)
            ? String(districtNumber)
            : stateDistrictLabel ?? rawDistrict;
      const districtLabel =
        stateDistrictLabel ??
        (district === "AL" ? "At Large" : `District ${district}`);
      const partyCode = textValue(info.party)?.toUpperCase() ?? null;
      const sworn = asRecord(info["sworn-date"]);

      return {
        bioguideId,
        officialName,
        listName: textValue(info.namelist),
        formalName: textValue(info["formal-name"]),
        firstName: textValue(info.firstname),
        middleName: textValue(info.middlename),
        lastName: textValue(info.lastname),
        suffix: textValue(info.suffix),
        partyCode,
        partyName: partyName(partyCode),
        caucusCode: textValue(info.caucus),
        stateCode: stateCode.toUpperCase(),
        stateName: textValue(state["state-fullname"]),
        district,
        districtLabel,
        swornDate: normalizeDate(
          attribute(sworn, "date") ?? textValue(info["sworn-date"]),
        ),
        electedDate: normalizeDate(textValue(info["elected-date"])),
        phone: textValue(info.phone),
        hometown: textValue(state.town),
        raw,
      };
    })
    .filter((member): member is HouseMember => member !== null);

  if (!members.length) {
    throw new Error("The House Clerk member feed contained no usable members.");
  }

  return {
    congress,
    session,
    publishDate,
    members,
    source: {
      name: "Office of the Clerk, U.S. House of Representatives",
      url: HOUSE_MEMBER_FEED_URL,
      retrievedAt: new Date().toISOString(),
    },
  };
}

function parseMeasure(legislationNumber: string | null, congress: number) {
  if (!legislationNumber) return null;
  const normalized = legislationNumber
    .toUpperCase()
    .replaceAll(".", "")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(
    /^(H CON RES|S CON RES|H J RES|S J RES|H RES|S RES|H R|H AMDT|S AMDT|S)\s+(\d+)$/,
  );
  if (!match) return null;

  const definitions: Record<
    string,
    { type: string; display: string; path: string }
  > = {
    "H R": { type: "hr", display: "H.R.", path: "house-bill" },
    S: { type: "s", display: "S.", path: "senate-bill" },
    "H RES": { type: "hres", display: "H.Res.", path: "house-resolution" },
    "S RES": { type: "sres", display: "S.Res.", path: "senate-resolution" },
    "H J RES": {
      type: "hjres",
      display: "H.J.Res.",
      path: "house-joint-resolution",
    },
    "S J RES": {
      type: "sjres",
      display: "S.J.Res.",
      path: "senate-joint-resolution",
    },
    "H CON RES": {
      type: "hconres",
      display: "H.Con.Res.",
      path: "house-concurrent-resolution",
    },
    "S CON RES": {
      type: "sconres",
      display: "S.Con.Res.",
      path: "senate-concurrent-resolution",
    },
    "H AMDT": {
      type: "hamdt",
      display: "H.Amdt.",
      path: "house-amendment",
    },
    "S AMDT": {
      type: "samdt",
      display: "S.Amdt.",
      path: "senate-amendment",
    },
  };
  const definition = definitions[match[1]];
  if (!definition) return null;
  const number = match[2];
  const family = definition.type.endsWith("amdt") ? "amendment" : "bill";

  return {
    type: definition.type,
    number,
    displayNumber: `${definition.display} ${number}`,
    officialUrl: `https://www.congress.gov/${family}/${congress}th-congress/${definition.path}/${number}`,
  } satisfies HouseMeasure;
}

export async function fetchHouseRollCall(year: number, rollNumber: number) {
  const paddedRoll = String(rollNumber).padStart(3, "0");
  const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${paddedRoll}.xml`;
  const detailUrl = `https://clerk.house.gov/Votes/${year}${paddedRoll}`;
  const xml = await fetchText(
    xmlUrl,
    "application/xml,text/xml;q=0.9,*/*;q=0.8",
  );
  const parsed = asRecord(xmlParser.parse(xml));
  const root = asRecord(parsed["rollcall-vote"]);
  const metadata = asRecord(root["vote-metadata"]);
  const voteData = asRecord(root["vote-data"]);
  const congress = Number(textValue(metadata.congress));
  const parsedRoll = Number(textValue(metadata["rollcall-num"]));
  const session = textValue(metadata.session) ?? "";
  const voteDate = normalizeDate(textValue(metadata["action-date"]));
  if (!congress || !parsedRoll || !voteDate) {
    throw new Error(`House roll call ${year}-${paddedRoll} lacks required metadata.`);
  }

  const memberVotes = asArray(voteData["recorded-vote"])
    .map(asRecord)
    .map((record): HouseRecordedVote | null => {
      const legislator = asRecord(record.legislator);
      const bioguideId = attribute(legislator, "name-id");
      const displayName =
        textValue(legislator) ?? attribute(legislator, "unaccented-name");
      const position = textValue(record.vote);
      if (!bioguideId || !displayName || !position) return null;
      return {
        bioguideId,
        displayName,
        partyCode: attribute(legislator, "party"),
        stateCode: attribute(legislator, "state"),
        position,
      };
    })
    .filter((vote): vote is HouseRecordedVote => vote !== null);
  if (!memberVotes.length) {
    throw new Error(`House roll call ${year}-${paddedRoll} has no member votes.`);
  }

  const legislationNumber = textValue(metadata["legis-num"]);
  return {
    congress,
    session,
    year,
    rollNumber: parsedRoll,
    chamber:
      textValue(metadata.chamber) ?? "U.S. House of Representatives",
    voteDate,
    question: textValue(metadata["vote-question"]),
    voteType: textValue(metadata["vote-type"]),
    result: textValue(metadata["vote-result"]),
    description: textValue(metadata["vote-desc"]),
    legislationNumber,
    amendmentAuthor: textValue(metadata["amendment-author"]),
    measure: parseMeasure(legislationNumber, congress),
    memberVotes,
    detailUrl,
    xmlUrl,
    raw: root,
  } satisfies HouseRollCall;
}

async function rollCallExists(year: number, rollNumber: number) {
  const paddedRoll = String(rollNumber).padStart(3, "0");
  const url = `https://clerk.house.gov/evs/${year}/roll${paddedRoll}.xml`;
  let response = await fetch(url, {
    method: "HEAD",
    headers: { "user-agent": "Clarity-for-US/0.2 official-civic-record-index" },
  });
  if (response.status === 405) {
    response = await fetch(url, {
      headers: {
        accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
        range: "bytes=0-128",
        "user-agent": "Clarity-for-US/0.2 official-civic-record-index",
      },
    });
  }
  return response.ok;
}

async function findLatestRollNumber(year: number) {
  let low = 1;
  let high = 1200;
  let latest = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (await rollCallExists(year, middle)) {
      latest = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return latest;
}

export async function discoverRecentHouseRollCalls({
  year = new Date().getUTCFullYear(),
  limit = 10,
  beforeRoll,
}: {
  year?: number;
  limit?: number;
  beforeRoll?: number;
} = {}) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
  if (beforeRoll) {
    return {
      year,
      rollNumbers: Array.from({ length: Math.min(safeLimit, beforeRoll - 1) }, (_, index) => beforeRoll - 1 - index),
      listingUrl: HOUSE_VOTES_PAGE_URL,
    };
  }
  let html = "";
  try {
    html = await fetchText(HOUSE_VOTES_PAGE_URL, "text/html,*/*;q=0.8");
  } catch {
    // A numeric probe below keeps ingestion available if the listing page is
    // temporarily unavailable while individual roll-call files remain online.
  }

  const normalizedHtml = html
    .replaceAll("\\u002F", "/")
    .replaceAll("\\/", "/");
  const discovered = new Set<number>();
  const voteLinkPattern = /\/Votes\/(\d{4})(\d{3})(?=\D|$)/gi;
  for (const match of normalizedHtml.matchAll(voteLinkPattern)) {
    if (Number(match[1]) === year) discovered.add(Number(match[2]));
  }
  if (!discovered.size) {
    const rollPattern = /Roll Call Number:\s*(?:<[^>]+>\s*)*(\d{1,4})/gi;
    for (const match of normalizedHtml.matchAll(rollPattern)) {
      discovered.add(Number(match[1]));
    }
  }

  let rollNumbers = [...discovered]
    .filter((roll) => Number.isFinite(roll) && roll > 0)
    .filter((roll) => !beforeRoll || roll < beforeRoll)
    .sort((left, right) => right - left)
    .slice(0, safeLimit);
  if (!rollNumbers.length) {
    const latest = beforeRoll
      ? Math.min(beforeRoll - 1, await findLatestRollNumber(year))
      : await findLatestRollNumber(year);
    if (!latest) {
      throw new Error(`No House roll calls were found for ${year}.`);
    }
    rollNumbers = Array.from(
      { length: Math.min(safeLimit, latest) },
      (_, index) => latest - index,
    );
  }

  return {
    year,
    rollNumbers,
    listingUrl: HOUSE_VOTES_PAGE_URL,
  };
}

export async function fetchRecentHouseRollCalls(options?: {
  year?: number;
  limit?: number;
  beforeRoll?: number;
}) {
  const discovery = await discoverRecentHouseRollCalls(options);
  const rollCalls = await Promise.all(
    discovery.rollNumbers.map((roll) =>
      fetchHouseRollCall(discovery.year, roll),
    ),
  );
  return {
    ...discovery,
    rollCalls,
    retrievedAt: new Date().toISOString(),
  };
}
