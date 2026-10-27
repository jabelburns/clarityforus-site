import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  bills,
  entities,
  externalIds,
  ingestRuns,
  relationships,
  sourceRecords,
  sources,
} from "@/db/schema";
import { apiError, normalizeName } from "@/lib/civic-data";
import {
  congressBillLabel,
  fetchRecentCongressBills,
  type CongressBillBundle,
  type CongressPerson,
} from "@/lib/congress-gov";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function personName(person: CongressPerson) {
  const assembled = [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
  return assembled || person.fullName;
}

function personDescription(person: CongressPerson) {
  const location = [
    person.party,
    person.state,
    person.district ? `District ${person.district}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return location
    ? `Congress.gov member record · ${location}.`
    : "Congress.gov member record.";
}

function billDescription(bundle: CongressBillBundle) {
  return [
    `${congressBillLabel(bundle.billType, bundle.billNumber)} in the ${bundle.congress}th Congress.`,
    bundle.policyArea ? `Policy area: ${bundle.policyArea}.` : null,
    bundle.latestActionText
      ? `Latest action: ${bundle.latestActionText}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function amendmentOfficialUrl(record: JsonRecord) {
  const congress = textValue(record.congress);
  const type = textValue(record.type)?.toLowerCase();
  const number = textValue(record.number);
  const path =
    type === "hamdt"
      ? "house-amendment"
      : type === "samdt"
        ? "senate-amendment"
        : "amendment";
  return congress && number
    ? `https://www.congress.gov/amendment/${congress}th-congress/${path}/${number}`
    : null;
}

async function writeBill(bundle: CongressBillBundle, now: string) {
  const db = getDb();
  const billEntityId = `bill:${bundle.congress}:${bundle.billType}:${bundle.billNumber}`;
  const sourceId = `congress-gov:bill:${bundle.congress}:${bundle.billType}:${bundle.billNumber}`;
  const displayNumber = congressBillLabel(bundle.billType, bundle.billNumber);
  const currentStatus =
    textValue(bundle.actions[0]?.type) ??
    (bundle.latestActionText ? "Latest action recorded" : "Introduced");

  await db
    .insert(sources)
    .values({
      id: sourceId,
      sourceSystem: "congress_gov",
      recordType: "bill_bundle",
      publisher: "Library of Congress",
      title: `${displayNumber}: ${bundle.title}`,
      url: bundle.officialUrl,
      documentDate: bundle.latestActionDate ?? bundle.introducedDate,
      retrievedAt: now,
      coverageNote:
        "Congress.gov bill metadata with available sponsors, cosponsors, actions, summaries, official text-version links, amendments, and committee referrals. Endpoint gaps are retained with the source snapshot.",
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        title: `${displayNumber}: ${bundle.title}`,
        url: bundle.officialUrl,
        documentDate: bundle.latestActionDate ?? bundle.introducedDate,
        retrievedAt: now,
      },
    });

  await db
    .insert(entities)
    .values({
      id: billEntityId,
      entityType: "bill",
      canonicalName: `${displayNumber}: ${bundle.title}`,
      normalizedName: normalizeName(`${displayNumber} ${bundle.title}`),
      jurisdictionLevel: "federal",
      description: billDescription(bundle),
      status: "source_backed",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: entities.id,
      set: {
        canonicalName: `${displayNumber}: ${bundle.title}`,
        normalizedName: normalizeName(`${displayNumber} ${bundle.title}`),
        description: billDescription(bundle),
        status: "source_backed",
        updatedAt: now,
      },
    });

  await db
    .insert(bills)
    .values({
      entityId: billEntityId,
      congress: bundle.congress,
      billType: bundle.billType,
      billNumber: bundle.billNumber,
      title: bundle.title,
      policyArea: bundle.policyArea,
      introducedDate: bundle.introducedDate,
      currentStatus,
      latestAction: bundle.latestActionText,
      latestActionDate: bundle.latestActionDate,
      officialUrl: bundle.officialUrl,
      sourceId,
    })
    .onConflictDoUpdate({
      target: bills.entityId,
      set: {
        title: bundle.title,
        policyArea: bundle.policyArea,
        introducedDate: bundle.introducedDate,
        currentStatus,
        latestAction: bundle.latestActionText,
        latestActionDate: bundle.latestActionDate,
        officialUrl: bundle.officialUrl,
        sourceId,
      },
    });

  await db
    .insert(externalIds)
    .values({
      entityId: billEntityId,
      sourceSystem: "congress_gov",
      externalId: `${bundle.congress}:${bundle.billType}:${bundle.billNumber}`,
      officialUrl: bundle.officialUrl,
      isPrimary: true,
      verifiedAt: now,
    })
    .onConflictDoUpdate({
      target: [externalIds.sourceSystem, externalIds.externalId],
      set: {
        entityId: billEntityId,
        officialUrl: bundle.officialUrl,
        isPrimary: true,
        verifiedAt: now,
      },
    });

  await db
    .insert(sourceRecords)
    .values({
      id: `${sourceId}:bundle`,
      sourceId,
      entityId: billEntityId,
      externalId: `${bundle.congress}:${bundle.billType}:${bundle.billNumber}`,
      rawJson: JSON.stringify({
        kind: "congress_bill_bundle",
        listRecord: bundle.listRecord,
        bill: bundle.bill,
        actions: bundle.actions,
        summaries: bundle.summaries,
        textVersions: bundle.textVersions,
        amendments: bundle.amendments,
        committees: bundle.committees,
        cosponsors: bundle.cosponsors.map((person) => person.raw),
        endpointErrors: bundle.endpointErrors,
      }),
      fetchedAt: now,
      transformedAt: now,
    })
    .onConflictDoUpdate({
      target: sourceRecords.id,
      set: {
        rawJson: sql`excluded.raw_json`,
        fetchedAt: now,
        transformedAt: now,
      },
    });

  const sponsorRows = [
    ...bundle.sponsors.map((person) => ({ person, type: "sponsor" as const })),
    ...bundle.cosponsors.map((person) => ({ person, type: "cosponsor" as const })),
  ];
  // Four bounded JSON1 writes per chunk replace four writes per sponsor.
  // Preserve official Bioguide identities and source-backed graph edges.
  const sponsorsPerChunk = 200;
  for (let index = 0; index < sponsorRows.length; index += sponsorsPerChunk) {
    const chunk = sponsorRows.slice(index, index + sponsorsPerChunk);
    const personRows = chunk.map(({ person }) => {
      const name = personName(person);
      return {
        id: "person:bioguide:" + person.bioguideId,
        entityType: "politician",
        canonicalName: name,
        normalizedName: normalizeName(name),
        jurisdictionLevel: "federal",
        stateCode: person.state,
        district: person.district,
        description: personDescription(person),
        status: "active",
        updatedAt: now,
      };
    });
    const idRows = chunk.map(({ person }) => ({
      entityId: "person:bioguide:" + person.bioguideId,
      sourceSystem: "congress_gov",
      externalId: person.bioguideId,
      officialUrl: "https://www.congress.gov/member/" + person.bioguideId,
      isPrimary: false,
      verifiedAt: now,
    }));
    const sponsorLinks = chunk.map(({ person, type }) => {
      const personId = "person:bioguide:" + person.bioguideId;
      return {
        id: billEntityId + ":" + type + ":" + personId,
        billEntityId,
        personEntityId: personId,
        sponsorType: type,
        joinedDate: type === "sponsor" ? bundle.introducedDate : person.joinedDate,
        withdrawnDate: person.withdrawnDate,
        sourceId,
      };
    });
    const edges = chunk.map(({ person, type }) => {
      const personId = "person:bioguide:" + person.bioguideId;
      const relationshipType = type === "sponsor" ? "sponsored" : "cosponsored";
      return {
        id: personId + ":" + type + ":" + billEntityId,
        fromEntityId: personId,
        toEntityId: billEntityId,
        relationshipType,
        description: personName(person) + " " + relationshipType + " " + displayNumber + ".",
        startDate: type === "sponsor" ? bundle.introducedDate : person.joinedDate,
        endDate: person.withdrawnDate,
        confidence: 1,
        evidenceClass: "source_fact",
        sourceId,
      };
    });

    // WHERE true resolves SQLite parser ambiguity before UPSERT. Never
    // overwrite an established member's name with a stale bill snapshot.
    await db.run(sql`INSERT INTO entities (
      id, entity_type, canonical_name, normalized_name, jurisdiction_level,
      state_code, district, description, status, updated_at
    )
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.entityType'),
      json_extract(value, '$.canonicalName'),
      json_extract(value, '$.normalizedName'),
      json_extract(value, '$.jurisdictionLevel'),
      json_extract(value, '$.stateCode'),
      json_extract(value, '$.district'),
      json_extract(value, '$.description'),
      json_extract(value, '$.status'),
      json_extract(value, '$.updatedAt')
    FROM json_each(${JSON.stringify(personRows)}) WHERE true
    ON CONFLICT(id) DO UPDATE SET
      state_code = coalesce(excluded.state_code, entities.state_code),
      district = coalesce(excluded.district, entities.district),
      updated_at = excluded.updated_at`);

    await db.run(sql`INSERT INTO external_ids (
      entity_id, source_system, external_id, official_url,
      is_primary, verified_at
    )
    SELECT
      json_extract(value, '$.entityId'),
      json_extract(value, '$.sourceSystem'),
      json_extract(value, '$.externalId'),
      json_extract(value, '$.officialUrl'),
      json_extract(value, '$.isPrimary'),
      json_extract(value, '$.verifiedAt')
    FROM json_each(${JSON.stringify(idRows)}) WHERE true
    ON CONFLICT(source_system, external_id) DO UPDATE SET
      entity_id = excluded.entity_id,
      verified_at = excluded.verified_at`);

    await db.run(sql`INSERT INTO bill_sponsors (
      id, bill_entity_id, person_entity_id, sponsor_type, joined_date,
      withdrawn_date, source_id
    )
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.billEntityId'),
      json_extract(value, '$.personEntityId'),
      json_extract(value, '$.sponsorType'),
      json_extract(value, '$.joinedDate'),
      json_extract(value, '$.withdrawnDate'),
      json_extract(value, '$.sourceId')
    FROM json_each(${JSON.stringify(sponsorLinks)}) WHERE true
    ON CONFLICT(id) DO UPDATE SET
      joined_date = excluded.joined_date,
      withdrawn_date = excluded.withdrawn_date,
      source_id = excluded.source_id`);

    await db.run(sql`INSERT INTO relationships (
      id, from_entity_id, to_entity_id, relationship_type, description,
      start_date, end_date, confidence, evidence_class, source_id
    )
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.fromEntityId'),
      json_extract(value, '$.toEntityId'),
      json_extract(value, '$.relationshipType'),
      json_extract(value, '$.description'),
      json_extract(value, '$.startDate'),
      json_extract(value, '$.endDate'),
      json_extract(value, '$.confidence'),
      json_extract(value, '$.evidenceClass'),
      json_extract(value, '$.sourceId')
    FROM json_each(${JSON.stringify(edges)}) WHERE true
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      source_id = excluded.source_id`);
  }

  const amendmentRows = bundle.amendments.flatMap((record) => {
    const congress = textValue(record.congress);
    const type = textValue(record.type)?.toLowerCase();
    const number = textValue(record.number);
    if (!congress || !type || !number) return [];
    const entityId = `amendment:${congress}:${type}:${number}`;
    const label = `${type.toUpperCase()} ${number}`;
    const latestAction = objectValue(record.latestAction);
    return [
      {
        record,
        entityId,
        label,
        officialUrl: amendmentOfficialUrl(record),
        description:
          textValue(record.description) ??
          textValue(latestAction.text) ??
          `Amendment linked to ${displayNumber}.`,
      },
    ];
  });
  for (const row of amendmentRows) {
    await db
      .insert(entities)
      .values({
        id: row.entityId,
        entityType: "amendment",
        canonicalName: row.label,
        normalizedName: normalizeName(row.label),
        jurisdictionLevel: "federal",
        description: row.description,
        status: "recorded",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: { description: row.description, updatedAt: now },
      });
    await db
      .insert(relationships)
      .values({
        id: `${row.entityId}:amends:${billEntityId}`,
        fromEntityId: row.entityId,
        toEntityId: billEntityId,
        relationshipType: "amends",
        description: `${row.label} is an amendment to ${displayNumber}.`,
        confidence: 1,
        evidenceClass: "source_fact",
        sourceId,
      })
      .onConflictDoUpdate({
        target: relationships.id,
        set: { description: `${row.label} is an amendment to ${displayNumber}.`, sourceId },
      });
    if (row.officialUrl) {
      await db
        .insert(externalIds)
        .values({
          entityId: row.entityId,
          sourceSystem: "congress_gov",
          externalId: row.entityId.replace("amendment:", ""),
          officialUrl: row.officialUrl,
          isPrimary: true,
          verifiedAt: now,
        })
        .onConflictDoUpdate({
          target: [externalIds.sourceSystem, externalIds.externalId],
          set: { entityId: row.entityId, officialUrl: row.officialUrl, verifiedAt: now },
        });
    }
  }

  const committeeRows = bundle.committees.flatMap((record) => {
    const systemCode = textValue(record.systemCode);
    const name = textValue(record.name);
    if (!systemCode || !name) return [];
    const chamber = textValue(record.chamber) ?? "Congress";
    return [
      {
        entityId: `committee:congress:${chamber.toLowerCase()}:${systemCode}`,
        systemCode,
        chamber,
        name,
        type: textValue(record.type),
        url: textValue(record.url),
      },
    ];
  });
  for (const row of committeeRows) {
    await db
      .insert(entities)
      .values({
        id: row.entityId,
        entityType: "committee",
        canonicalName: row.name,
        normalizedName: normalizeName(row.name),
        jurisdictionLevel: "federal",
        description: [row.chamber, row.type].filter(Boolean).join(" · "),
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          canonicalName: row.name,
          normalizedName: normalizeName(row.name),
          description: [row.chamber, row.type].filter(Boolean).join(" · "),
          updatedAt: now,
        },
      });
    await db
      .insert(relationships)
      .values({
        id: `${billEntityId}:referred-to:${row.entityId}`,
        fromEntityId: billEntityId,
        toEntityId: row.entityId,
        relationshipType: "referred_to",
        description: `${displayNumber} was referred to ${row.name}.`,
        confidence: 1,
        evidenceClass: "source_fact",
        sourceId,
      })
      .onConflictDoUpdate({
        target: relationships.id,
        set: {
          description: `${displayNumber} was referred to ${row.name}.`,
          sourceId,
        },
      });
  }

  return {
    entityId: billEntityId,
    sponsors: sponsorRows.length,
    amendments: amendmentRows.length,
    committees: committeeRows.length,
    endpointErrors: bundle.endpointErrors,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "Cross-origin writes are not allowed." },
      { status: 403 },
    );
  }

  try {
    const authorization = await authorizeIngestRequest(request);
    if (!authorization.ok) {
      return Response.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }
    if (!env.CONGRESS_API_KEY) {
      return Response.json(
        { error: "The Congress.gov API key is not configured." },
        { status: 503 },
      );
    }

    const requestUrl = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(requestUrl.searchParams.get("limit") ?? 10) || 10, 1),
      1,
    );
    const congress = Math.max(1, Math.trunc(Number(requestUrl.searchParams.get("congress"))) || 119);
    const offset = Math.max(0, Math.trunc(Number(requestUrl.searchParams.get("offset"))) || 0);
    const db = getDb();
    const runId = `congress-gov-bills:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "congress_gov_bills",
      status: "running",
    });

    try {
      const bundles = await fetchRecentCongressBills(env.CONGRESS_API_KEY, limit, { congress, offset });
      const now = new Date().toISOString();
      const results = [];
      for (const bundle of bundles) results.push(await writeBill(bundle, now));

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: bundles.length,
          recordsWritten: results.length,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        recordsSeen: bundles.length,
        recordsWritten: results.length,
        congress,
        offset,
        nextOffset: bundles.length < limit ? null : offset + bundles.length,
        sponsorsLinked: results.reduce((sum, row) => sum + row.sponsors, 0),
        amendmentsLinked: results.reduce((sum, row) => sum + row.amendments, 0),
        committeesLinked: results.reduce((sum, row) => sum + row.committees, 0),
        partialEndpointErrors: results.flatMap((row) => row.endpointErrors),
      });
    } catch (error) {
      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "failed",
          errorText: apiError(error),
        })
        .where(eq(ingestRuns.id, runId));
      throw error;
    }
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
