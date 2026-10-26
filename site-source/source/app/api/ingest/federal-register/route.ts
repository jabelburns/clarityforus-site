import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  entities,
  executiveOrders,
  externalIds,
  ingestRuns,
  relationships,
  sourceRecords,
  sources,
} from "@/db/schema";
import { apiError, normalizeName, slugify } from "@/lib/civic-data";
import { fetchExecutiveOrders } from "@/lib/federal-register";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
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
    const runId = `federal-register:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({
      id: runId,
      sourceSystem: "federal_register",
      status: "running",
    });

    try {
      const result = await fetchExecutiveOrders({ perPage: 50 });
      let written = 0;

      // A failed import can stop after the generic entity is written but
      // before its executive-order row. Remove only those incomplete shells.
      const persistedOrders = await db
        .select({ entityId: executiveOrders.entityId })
        .from(executiveOrders);
      if (persistedOrders.length) {
        await db
          .delete(entities)
          .where(
            and(
              eq(entities.entityType, "executive_order"),
              notInArray(
                entities.id,
                persistedOrders.map((order) => order.entityId),
              ),
            ),
          );
      }

      // The API returns newest first. Writing oldest first makes generic
      // `updated_at DESC` searches show the newest official record first.
      for (const document of [...result.documents].reverse()) {
        // Federal Register document numbers are stable even when richer fields
        // arrive later; use them as the canonical database key.
        const entityId = `executive-order:${document.documentNumber}`;
        const sourceId = `federal-register:${document.documentNumber}`;
        const sourceRecordId = `${sourceId}:raw`;
        const displayNumber = document.executiveOrderNumber
          ? `Executive Order ${document.executiveOrderNumber}`
          : "Executive order";
        const canonicalName = `${displayNumber}: ${document.title}`;
        const now = new Date().toISOString();

        await db
          .insert(sources)
          .values({
            id: sourceId,
            sourceSystem: "federal_register",
            recordType: "executive_order",
            publisher: "Office of the Federal Register",
            title: canonicalName,
            url: document.htmlUrl,
            documentDate: document.publicationDate,
            retrievedAt: now,
            coverageNote:
              "Official Federal Register metadata. Implementation and court effects require separate source records.",
          })
          .onConflictDoUpdate({
            target: sources.id,
            set: {
              title: canonicalName,
              url: document.htmlUrl,
              documentDate: document.publicationDate,
              retrievedAt: now,
            },
          });

        await db
          .insert(entities)
          .values({
            id: entityId,
            entityType: "executive_order",
            canonicalName,
            normalizedName: normalizeName(canonicalName),
            description: document.abstract ?? document.title,
            status: "published",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: entities.id,
            set: {
              canonicalName,
              normalizedName: normalizeName(canonicalName),
              description: document.abstract ?? document.title,
              status: "published",
              updatedAt: now,
            },
          });

        let presidentEntityId: string | null = null;
        if (document.president) {
          presidentEntityId = `person:president:${slugify(document.president)}`;
          await db
            .insert(entities)
            .values({
              id: presidentEntityId,
              entityType: "politician",
              canonicalName: document.president,
              normalizedName: normalizeName(document.president),
              description: "President named in Federal Register metadata.",
            })
            .onConflictDoUpdate({
              target: entities.id,
              set: {
                canonicalName: document.president,
                normalizedName: normalizeName(document.president),
                updatedAt: now,
              },
            });
        }

        await db
          .insert(executiveOrders)
          .values({
            entityId,
            documentNumber: document.documentNumber,
            executiveOrderNumber: document.executiveOrderNumber,
            signingDate: document.signingDate,
            publicationDate: document.publicationDate,
            presidentEntityId,
            citation: document.citation,
            status: "published",
            officialUrl: document.htmlUrl,
            sourceId,
          })
          .onConflictDoUpdate({
            target: executiveOrders.entityId,
            set: {
              executiveOrderNumber: document.executiveOrderNumber,
              signingDate: document.signingDate,
              publicationDate: document.publicationDate,
              presidentEntityId,
              citation: document.citation,
              officialUrl: document.htmlUrl,
              sourceId,
            },
          });

        await db
          .insert(externalIds)
          .values({
            entityId,
            sourceSystem: "federal_register",
            externalId: document.documentNumber,
            officialUrl: document.htmlUrl,
            isPrimary: true,
            verifiedAt: now,
          })
          .onConflictDoUpdate({
            target: [externalIds.sourceSystem, externalIds.externalId],
            set: { entityId, officialUrl: document.htmlUrl, verifiedAt: now },
          });

        await db
          .insert(sourceRecords)
          .values({
            id: sourceRecordId,
            sourceId,
            entityId,
            externalId: document.documentNumber,
            rawJson: JSON.stringify(document.raw),
            fetchedAt: now,
            transformedAt: now,
          })
          .onConflictDoUpdate({
            target: sourceRecords.id,
            set: {
              entityId,
              rawJson: JSON.stringify(document.raw),
              fetchedAt: now,
              transformedAt: now,
            },
          });

        if (presidentEntityId) {
          const relationshipId = `${presidentEntityId}:issued:${entityId}`;
          await db
            .insert(relationships)
            .values({
              id: relationshipId,
              fromEntityId: presidentEntityId,
              toEntityId: entityId,
              relationshipType: "issued",
              description: `${document.president} issued ${displayNumber}.`,
              startDate: document.signingDate ?? document.publicationDate,
              confidence: 1,
              evidenceClass: "source_fact",
              sourceId,
            })
            .onConflictDoUpdate({
              target: relationships.id,
              set: {
                description: `${document.president} issued ${displayNumber}.`,
                startDate: document.signingDate ?? document.publicationDate,
                sourceId,
              },
            });
        }
        written += 1;
      }

      await db
        .update(ingestRuns)
        .set({
          finishedAt: new Date().toISOString(),
          status: "succeeded",
          recordsSeen: result.documents.length,
          recordsWritten: written,
        })
        .where(eq(ingestRuns.id, runId));

      return Response.json({
        ok: true,
        runId,
        recordsSeen: result.documents.length,
        recordsWritten: written,
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
