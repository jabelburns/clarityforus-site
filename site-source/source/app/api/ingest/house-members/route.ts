import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  entities,
  entityAliases,
  externalIds,
  ingestRuns,
  offices,
  relationships,
  sourceRecords,
  sources,
} from "@/db/schema";
import { apiError, normalizeName } from "@/lib/civic-data";
import { fetchCurrentHouseMembers } from "@/lib/house-clerk";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function officeTitle(districtLabel: string) {
  if (/resident commissioner/i.test(districtLabel)) {
    return "Resident Commissioner to the U.S. House";
  }
  if (/delegate/i.test(districtLabel)) return "Delegate to the U.S. House";
  return "U.S. Representative";
}

function officeName(
  title: string,
  stateName: string | null,
  stateCode: string,
  district: string,
) {
  const place = stateName ?? stateCode;
  if (title !== "U.S. Representative") return `${title} — ${place}`;
  return district === "AL"
    ? `U.S. Representative — ${place} At Large`
    : `U.S. Representative — ${place} District ${district}`;
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

    const db = getDb();
    const runId = `house-clerk-members:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "house_clerk_members",
      status: "running",
    });

    try {
      const result = await fetchCurrentHouseMembers();
      const now = new Date().toISOString();
      const sourceId = `house-clerk:members:${result.congress ?? "current"}`;
      const sourceTitle = result.congress
        ? `Official House member list — ${result.congress}th Congress`
        : "Official current House member list";

      await db
        .insert(sources)
        .values({
          id: sourceId,
          sourceSystem: "house_clerk",
          recordType: "member_roster",
          publisher: "Office of the Clerk, U.S. House of Representatives",
          title: sourceTitle,
          url: result.source.url,
          documentDate: result.publishDate,
          retrievedAt: now,
          coverageNote:
            "Official current House roster. Historic service and prior terms require separate archival records.",
        })
        .onConflictDoUpdate({
          target: sources.id,
          set: {
            title: sourceTitle,
            documentDate: result.publishDate,
            retrievedAt: now,
          },
        });

      const personRows = result.members.map((member) => {
        const title = officeTitle(member.districtLabel);
        const name = officeName(
          title,
          member.stateName,
          member.stateCode,
          member.district,
        );
        return {
          id: `person:bioguide:${member.bioguideId}`,
          entityType: "politician",
          canonicalName: member.officialName,
          normalizedName: normalizeName(member.officialName),
          jurisdictionLevel: "federal",
          stateCode: member.stateCode,
          district: member.district,
          description: `${name}${member.partyName ? ` · ${member.partyName}` : ""}.`,
          status: "active",
          updatedAt: now,
        };
      });
      const officeEntityRows = result.members.map((member) => {
        const title = officeTitle(member.districtLabel);
        const name = officeName(
          title,
          member.stateName,
          member.stateCode,
          member.district,
        );
        return {
          id: `office:us-house:${member.stateCode}:${member.district}`,
          entityType: "office",
          canonicalName: name,
          normalizedName: normalizeName(name),
          jurisdictionLevel: "federal",
          stateCode: member.stateCode,
          district: member.district,
          description: "Current seat in the U.S. House of Representatives.",
          status: "active",
          updatedAt: now,
        };
      });

      for (const rows of chunks([...personRows, ...officeEntityRows], 8)) {
        await db
          .insert(entities)
          .values(rows)
          .onConflictDoUpdate({
            target: entities.id,
            set: {
              canonicalName: sql`excluded.canonical_name`,
              normalizedName: sql`excluded.normalized_name`,
              stateCode: sql`excluded.state_code`,
              district: sql`excluded.district`,
              description: sql`excluded.description`,
              status: sql`excluded.status`,
              updatedAt: now,
            },
          });
      }

      const officeRows = result.members.map((member) => ({
        entityId: `office:us-house:${member.stateCode}:${member.district}`,
        branch: "legislative",
        title: officeTitle(member.districtLabel),
        chamber: "House",
        stateCode: member.stateCode,
        district: member.district,
        termStart: member.swornDate,
        termEnd: null,
        isCurrent: true,
      }));
      for (const rows of chunks(officeRows, 8)) {
        await db
          .insert(offices)
          .values(rows)
          .onConflictDoUpdate({
            target: offices.entityId,
            set: {
              title: sql`excluded.title`,
              stateCode: sql`excluded.state_code`,
              district: sql`excluded.district`,
              termStart: sql`excluded.term_start`,
              isCurrent: true,
            },
          });
      }

      const aliasRows = result.members.flatMap((member) =>
        [
          member.listName
            ? { alias: member.listName, aliasType: "list_name" }
            : null,
          member.formalName
            ? { alias: member.formalName, aliasType: "floor_name" }
            : null,
        ]
          .filter(
            (alias): alias is { alias: string; aliasType: string } =>
              alias !== null && alias.alias !== member.officialName,
          )
          .map((alias) => ({
            entityId: `person:bioguide:${member.bioguideId}`,
            alias: alias.alias,
            normalizedAlias: normalizeName(alias.alias),
            aliasType: alias.aliasType,
          })),
      );
      for (const rows of chunks(aliasRows, 18)) {
        await db.insert(entityAliases).values(rows).onConflictDoNothing();
      }

      const identifierRows = result.members.map((member) => ({
        entityId: `person:bioguide:${member.bioguideId}`,
        sourceSystem: "house_clerk",
        externalId: member.bioguideId,
        officialUrl: `https://clerk.house.gov/members/${member.bioguideId}`,
        isPrimary: true,
        verifiedAt: now,
      }));
      for (const rows of chunks(identifierRows, 12)) {
        await db
          .insert(externalIds)
          .values(rows)
          .onConflictDoUpdate({
            target: [externalIds.sourceSystem, externalIds.externalId],
            set: {
              entityId: sql`excluded.entity_id`,
              officialUrl: sql`excluded.official_url`,
              isPrimary: true,
              verifiedAt: now,
            },
          });
      }

      const sourceRows = result.members.map((member) => ({
        id: `${sourceId}:member:${member.bioguideId}`,
        sourceId,
        entityId: `person:bioguide:${member.bioguideId}`,
        externalId: member.bioguideId,
        rawJson: JSON.stringify(member.raw),
        fetchedAt: now,
        transformedAt: now,
      }));
      for (const rows of chunks(sourceRows, 10)) {
        await db
          .insert(sourceRecords)
          .values(rows)
          .onConflictDoUpdate({
            target: sourceRecords.id,
            set: {
              entityId: sql`excluded.entity_id`,
              rawJson: sql`excluded.raw_json`,
              fetchedAt: now,
              transformedAt: now,
            },
          });
      }

      const relationshipRows = result.members.map((member) => {
        const personId = `person:bioguide:${member.bioguideId}`;
        const officeId = `office:us-house:${member.stateCode}:${member.district}`;
        return {
          id: `${personId}:holds-office:${officeId}`,
          fromEntityId: personId,
          toEntityId: officeId,
          relationshipType: "holds_office",
          description: `${member.officialName} currently holds ${officeName(
            officeTitle(member.districtLabel),
            member.stateName,
            member.stateCode,
            member.district,
          )}.`,
          startDate: member.swornDate,
          endDate: null,
          confidence: 1,
          evidenceClass: "source_fact",
          sourceId,
        };
      });
      // The Clerk feed is a current roster. Replace only relationships owned
      // by this roster source so departures and vacancies do not stay current.
      await db
        .delete(relationships)
        .where(
          and(
            eq(relationships.sourceId, sourceId),
            eq(relationships.relationshipType, "holds_office"),
          ),
        );
      for (const rows of chunks(relationshipRows, 7)) {
        await db
          .insert(relationships)
          .values(rows)
          .onConflictDoUpdate({
            target: relationships.id,
            set: {
              description: sql`excluded.description`,
              startDate: sql`excluded.start_date`,
              endDate: null,
              sourceId,
            },
          });
      }

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: result.members.length,
          recordsWritten: result.members.length,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        congress: result.congress,
        session: result.session,
        publishDate: result.publishDate,
        recordsSeen: result.members.length,
        recordsWritten: result.members.length,
        source: result.source,
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
