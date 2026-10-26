import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  bills,
  billSponsors,
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
  for (const row of sponsorRows) {
    const personId = `person:bioguide:${row.person.bioguideId}`;
    const name = personName(row.person);
    await db
      .insert(entities)
      .values({
        id: personId,
        entityType: "politician",
        canonicalName: name,
        normalizedName: normalizeName(name),
        jurisdictionLevel: "federal",
        stateCode: row.person.state,
        district: row.person.district,
        description: personDescription(row.person),
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          stateCode: sql`coalesce(excluded.state_code, ${entities.stateCode})`,
          district: sql`coalesce(excluded.district, ${entities.district})`,
          updatedAt: now,
        },
      });

    await db
      .insert(externalIds)
      .values({
        entityId: personId,
        sourceSystem: "congress_gov",
        externalId: row.person.bioguideId,
        officialUrl: `https://www.congress.gov/member/${row.person.bioguideId}`,
        isPrimary: false,
        verifiedAt: now,
      })
      .onConflictDoUpdate({
        target: [externalIds.sourceSystem, externalIds.externalId],
        set: { entityId: personId, verifiedAt: now },
      });

    await db
      .insert(billSponsors)
      .values({
        id: `${billEntityId}:${row.type}:${personId}`,
        billEntityId,
        personEntityId: personId,
        sponsorType: row.type,
        joinedDate:
          row.type === "sponsor"
            ? bundle.introducedDate
            : row.person.joinedDate,
        withdrawnDate: row.person.withdrawnDate,
        sourceId,
      })
      .onConflictDoUpdate({
        target: billSponsors.id,
        set: {
          joinedDate:
            row.type === "sponsor"
              ? bundle.introducedDate
              : row.person.joinedDate,
          withdrawnDate: row.person.withdrawnDate,
          sourceId,
        },
      });

    await db
      .insert(relationships)
      .values({
        id: `${personId}:${row.type}:${billEntityId}`,
        fromEntityId: personId,
        toEntityId: billEntityId,
        relationshipType:
          row.type === "sponsor" ? "sponsored" : "cosponsored",
        description: `${name} ${row.type === "sponsor" ? "sponsored" : "cosponsored"} ${displayNumber}.`,
        startDate:
          row.type === "sponsor"
            ? bundle.introducedDate
            : row.person.joinedDate,
        endDate: row.person.withdrawnDate,
        confidence: 1,
        evidenceClass: "source_fact",
        sourceId,
      })
      .onConflictDoUpdate({
        target: relationships.id,
        set: {
          description: `${name} ${row.type === "sponsor" ? "sponsored" : "cosponsored"} ${displayNumber}.`,
          startDate:
            row.type === "sponsor"
              ? bundle.introducedDate
              : row.person.joinedDate,
          endDate: row.person.withdrawnDate,
          sourceId,
        },
      });
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
