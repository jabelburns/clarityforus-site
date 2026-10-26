import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bills,
  entities,
  externalIds,
  ingestRuns,
  memberVotes,
  relationships,
  sourceRecords,
  sources,
  votes,
} from "@/db/schema";
import { apiError, normalizeName } from "@/lib/civic-data";
import { fetchRecentHouseRollCalls } from "@/lib/house-clerk";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

function sessionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "session";
}

function voteDescription(
  legislationNumber: string | null,
  description: string | null,
  result: string | null,
) {
  const subject = [legislationNumber, description].filter(Boolean).join(" — ");
  const outcome = result ? `Result: ${result}.` : null;
  return [subject || "Recorded House vote.", outcome].filter(Boolean).join(" ");
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

    const url = new URL(request.url);
    const requestedYear = Number(url.searchParams.get("year"));
    const requestedLimit = Number(url.searchParams.get("limit"));
    const requestedBeforeRoll = Number(url.searchParams.get("beforeRoll"));
    const year =
      Number.isInteger(requestedYear) && requestedYear >= 2000
        ? requestedYear
        : new Date().getUTCFullYear();
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 2)
        : 2;

    const db = getDb();
    const runId = `house-clerk-votes:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "house_clerk_votes",
      status: "running",
    });

    try {
      const beforeRoll = Number.isInteger(requestedBeforeRoll) && requestedBeforeRoll > 1
        ? requestedBeforeRoll
        : undefined;
      const result = await fetchRecentHouseRollCalls({ year, limit, beforeRoll });
      let positionsWritten = 0;

      // Oldest first keeps generic updated-time sorting aligned with recency.
      for (const rollCall of [...result.rollCalls].reverse()) {
        const now = new Date().toISOString();
        const sourceId = `house-clerk:vote:${rollCall.year}:${rollCall.rollNumber}`;
        const voteEntityId = `vote:house:${rollCall.congress}:${sessionKey(
          rollCall.session,
        )}:${rollCall.rollNumber}`;
        const voteTitle = `House Roll Call ${rollCall.rollNumber}: ${
          rollCall.question ?? "Recorded vote"
        }`;

        await db
          .insert(sources)
          .values({
            id: sourceId,
            sourceSystem: "house_clerk",
            recordType: "house_roll_call",
            publisher: "Office of the Clerk, U.S. House of Representatives",
            title: voteTitle,
            url: rollCall.detailUrl,
            documentDate: rollCall.voteDate,
            retrievedAt: now,
            coverageNote:
              "Official House roll-call metadata and individual recorded positions. Vote context may require the linked measure text and floor proceedings.",
          })
          .onConflictDoUpdate({
            target: sources.id,
            set: {
              title: voteTitle,
              url: rollCall.detailUrl,
              documentDate: rollCall.voteDate,
              retrievedAt: now,
            },
          });

        let billEntityId: string | null = null;
        if (rollCall.measure) {
          const measure = rollCall.measure;
          billEntityId = `bill:${rollCall.congress}:${measure.type}:${measure.number}`;
          const billTitle = rollCall.description
            ? `${measure.displayNumber}: ${rollCall.description}`
            : measure.displayNumber;

          await db
            .insert(entities)
            .values({
              id: billEntityId,
              entityType: "bill",
              canonicalName: billTitle,
              normalizedName: normalizeName(billTitle),
              jurisdictionLevel: "federal",
              description: `Measure named in House Roll Call ${rollCall.rollNumber}. Full text and action history await the Congress.gov connector.`,
              status: "source_partial",
              updatedAt: now,
            })
            .onConflictDoNothing();

          await db
            .insert(bills)
            .values({
              entityId: billEntityId,
              congress: rollCall.congress,
              billType: measure.type,
              billNumber: measure.number,
              title: billTitle,
              currentStatus: `House roll call: ${rollCall.result ?? "recorded"}`,
              latestAction: rollCall.question,
              latestActionDate: rollCall.voteDate,
              officialUrl: measure.officialUrl,
              sourceId,
            })
            .onConflictDoNothing();

          await db
            .insert(externalIds)
            .values({
              entityId: billEntityId,
              sourceSystem: "congress_gov",
              externalId: `${rollCall.congress}:${measure.type}:${measure.number}`,
              officialUrl: measure.officialUrl,
              isPrimary: true,
              verifiedAt: now,
            })
            .onConflictDoUpdate({
              target: [externalIds.sourceSystem, externalIds.externalId],
              set: {
                entityId: billEntityId,
                officialUrl: measure.officialUrl,
                verifiedAt: now,
              },
            });
        }

        await db
          .insert(entities)
          .values({
            id: voteEntityId,
            entityType: "vote",
            canonicalName: voteTitle,
            normalizedName: normalizeName(voteTitle),
            jurisdictionLevel: "federal",
            description: voteDescription(
              rollCall.legislationNumber,
              rollCall.description,
              rollCall.result,
            ),
            status: "recorded",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: entities.id,
            set: {
              canonicalName: voteTitle,
              normalizedName: normalizeName(voteTitle),
              description: voteDescription(
                rollCall.legislationNumber,
                rollCall.description,
                rollCall.result,
              ),
              updatedAt: now,
            },
          });

        await db
          .insert(votes)
          .values({
            entityId: voteEntityId,
            congress: rollCall.congress,
            chamber: "House",
            session: rollCall.session,
            rollNumber: rollCall.rollNumber,
            voteDate: rollCall.voteDate,
            question: rollCall.question,
            description: rollCall.description,
            result: rollCall.result,
            billEntityId,
            officialUrl: rollCall.detailUrl,
            sourceId,
          })
          .onConflictDoUpdate({
            target: votes.entityId,
            set: {
              voteDate: rollCall.voteDate,
              question: rollCall.question,
              description: rollCall.description,
              result: rollCall.result,
              billEntityId,
              officialUrl: rollCall.detailUrl,
              sourceId,
            },
          });

        await db
          .insert(externalIds)
          .values({
            entityId: voteEntityId,
            sourceSystem: "house_clerk",
            externalId: `${rollCall.year}-${rollCall.rollNumber}`,
            officialUrl: rollCall.detailUrl,
            isPrimary: true,
            verifiedAt: now,
          })
          .onConflictDoUpdate({
            target: [externalIds.sourceSystem, externalIds.externalId],
            set: {
              entityId: voteEntityId,
              officialUrl: rollCall.detailUrl,
              verifiedAt: now,
            },
          });

        await db
          .insert(sourceRecords)
          .values({
            id: `${sourceId}:raw`,
            sourceId,
            entityId: voteEntityId,
            externalId: `${rollCall.year}-${rollCall.rollNumber}`,
            rawJson: JSON.stringify(rollCall.raw),
            fetchedAt: now,
            transformedAt: now,
          })
          .onConflictDoUpdate({
            target: sourceRecords.id,
            set: {
              rawJson: JSON.stringify(rollCall.raw),
              fetchedAt: now,
              transformedAt: now,
            },
          });

        const voterEntityRows = rollCall.memberVotes.map((memberVote) => ({
          id: `person:bioguide:${memberVote.bioguideId}`,
          entityType: "politician",
          canonicalName: memberVote.displayName,
          normalizedName: normalizeName(memberVote.displayName),
          jurisdictionLevel: "federal",
          stateCode: memberVote.stateCode,
          description: `House member named in official roll-call data${
            memberVote.partyCode ? ` · party code ${memberVote.partyCode}` : ""
          }.`,
          status: "recorded_member",
          updatedAt: now,
        }));
        // A complete House roll includes roughly 435 members. Per-row/chunk
        // writes exceed Cloudflare Workers Free's per-invocation D1 query cap.
        // Bind the entire JSON array once; SQLite JSON1 expands it into rows.
        // The fixed SQL below never interpolates untrusted field contents.
        if (voterEntityRows.length) {
          await db.run(sql`INSERT INTO entities (
            id, entity_type, canonical_name, normalized_name,
            jurisdiction_level, state_code, description, status, updated_at
          ) SELECT
            json_extract(entry.value, '$.id'),
            json_extract(entry.value, '$.entityType'),
            json_extract(entry.value, '$.canonicalName'),
            json_extract(entry.value, '$.normalizedName'),
            json_extract(entry.value, '$.jurisdictionLevel'),
            json_extract(entry.value, '$.stateCode'),
            json_extract(entry.value, '$.description'),
            json_extract(entry.value, '$.status'),
            json_extract(entry.value, '$.updatedAt')
          FROM json_each(${JSON.stringify(voterEntityRows)}) AS entry
          WHERE 1 ON CONFLICT (id) DO NOTHING`);
        }

        const voterIdentifiers = rollCall.memberVotes.map((memberVote) => ({
          entityId: `person:bioguide:${memberVote.bioguideId}`,
          sourceSystem: "house_clerk",
          externalId: memberVote.bioguideId,
          officialUrl: `https://clerk.house.gov/members/${memberVote.bioguideId}`,
          isPrimary: true,
          verifiedAt: now,
        }));
        if (voterIdentifiers.length) {
          await db.run(sql`INSERT INTO external_ids (
            entity_id, source_system, external_id,
            official_url, is_primary, verified_at
          ) SELECT
            json_extract(entry.value, '$.entityId'),
            json_extract(entry.value, '$.sourceSystem'),
            json_extract(entry.value, '$.externalId'),
            json_extract(entry.value, '$.officialUrl'),
            CASE WHEN json_extract(entry.value, '$.isPrimary') = 1 THEN 1 ELSE 0 END,
            json_extract(entry.value, '$.verifiedAt')
          FROM json_each(${JSON.stringify(voterIdentifiers)}) AS entry
          WHERE 1 ON CONFLICT (source_system, external_id) DO UPDATE SET
            entity_id = excluded.entity_id,
            official_url = excluded.official_url,
            verified_at = excluded.verified_at`);
        }

        const memberVoteRows = rollCall.memberVotes.map((memberVote) => ({
          id: `${voteEntityId}:${memberVote.bioguideId}`,
          voteEntityId,
          personEntityId: `person:bioguide:${memberVote.bioguideId}`,
          position: memberVote.position,
          sourceId,
        }));
        if (memberVoteRows.length) {
          await db.run(sql`INSERT INTO member_votes (
            id, vote_entity_id, person_entity_id, position, source_id
          ) SELECT
            json_extract(entry.value, '$.id'),
            json_extract(entry.value, '$.voteEntityId'),
            json_extract(entry.value, '$.personEntityId'),
            json_extract(entry.value, '$.position'),
            json_extract(entry.value, '$.sourceId')
          FROM json_each(${JSON.stringify(memberVoteRows)}) AS entry
          WHERE 1 ON CONFLICT (id) DO UPDATE SET
            position = excluded.position,
            source_id = excluded.source_id`);
        }
        positionsWritten += memberVoteRows.length;

        if (billEntityId) {
          const relationshipId = `${voteEntityId}:concerns:${billEntityId}`;
          await db
            .insert(relationships)
            .values({
              id: relationshipId,
              fromEntityId: voteEntityId,
              toEntityId: billEntityId,
              relationshipType: "concerns",
              description: `House Roll Call ${rollCall.rollNumber} concerns ${rollCall.measure?.displayNumber}.`,
              startDate: rollCall.voteDate,
              confidence: 1,
              evidenceClass: "source_fact",
              sourceId,
            })
            .onConflictDoUpdate({
              target: relationships.id,
              set: {
                description: `House Roll Call ${rollCall.rollNumber} concerns ${rollCall.measure?.displayNumber}.`,
                startDate: rollCall.voteDate,
                sourceId,
              },
            });
        }
      }

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: result.rollCalls.length,
          recordsWritten: result.rollCalls.length,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        year: result.year,
        rollCallsWritten: result.rollCalls.length,
        memberPositionsWritten: positionsWritten,
        rollNumbers: result.rollNumbers,
        nextBeforeRoll: result.rollNumbers.length
          ? Math.min(...result.rollNumbers)
          : null,
        source: {
          name: "Office of the Clerk, U.S. House of Representatives",
          url: result.listingUrl,
          retrievedAt: result.retrievedAt,
        },
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
