import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { entities, entityAliases, externalIds } from "@/db/schema";
import {
  apiError,
  databaseEntityType,
  normalizeName,
  publicEntityType,
} from "@/lib/civic-data";

export const dynamic = "force-dynamic";

const kindLabels: Record<string, string> = {
  politician: "Public official",
  candidate: "Candidate",
  contribution: "Contribution",
  independent_expenditure: "Independent expenditure",
  election: "Election",
  committee: "Political committee",
  contributor: "Contributor",
  bill: "Bill or law",
  vote: "Recorded vote",
  executive_order: "Executive order",
  court_case: "Court case",
  organization: "Organization",
  amendment: "Bill amendment",
  office: "Public office",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeName(url.searchParams.get("q") ?? "");
  const type = databaseEntityType(url.searchParams.get("type"));
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1),
    50,
  );

  try {
    const db = getDb();
    const [aliasMatches, identifierMatches] = query
      ? await Promise.all([
          db
            .select({ entityId: entityAliases.entityId })
            .from(entityAliases)
            .where(like(entityAliases.normalizedAlias, `%${query}%`))
            .limit(100),
          db
            .select({ entityId: externalIds.entityId })
            .from(externalIds)
            .where(like(externalIds.externalId, `%${query.replaceAll(" ", "")}%`))
            .limit(100),
        ])
      : [[], []];
    const matchedIds = [
      ...new Set([
        ...aliasMatches.map((row) => row.entityId),
        ...identifierMatches.map((row) => row.entityId),
      ]),
    ];
    const textCondition = query
      ? or(
          like(entities.normalizedName, `%${query}%`),
          like(entities.description, `%${query}%`),
          ...(matchedIds.length ? [inArray(entities.id, matchedIds)] : []),
        )
      : undefined;
    const typeCondition = type ? eq(entities.entityType, type) : undefined;
    const where =
      textCondition && typeCondition
        ? and(textCondition, typeCondition)
        : textCondition ?? typeCondition;

    const rows = await db
      .select()
      .from(entities)
      .where(where)
      .orderBy(desc(entities.updatedAt), entities.canonicalName)
      .limit(limit);

    const ids = rows.map((row) => row.id);
    const identifiers = ids.length
      ? await db
          .select()
          .from(externalIds)
          .where(inArray(externalIds.entityId, ids))
      : [];
    const primaryId = new Map(
      identifiers
        .filter((identifier) => identifier.isPrimary)
        .map((identifier) => [identifier.entityId, identifier]),
    );

    return Response.json({
      query,
      records: rows.map((row) => {
        const external = primaryId.get(row.id);
        return {
          id: row.id,
          type: publicEntityType(row.entityType),
          kind: kindLabels[row.entityType] ?? row.entityType,
          title: row.canonicalName,
          subtitle: row.description,
          status: row.status,
          jurisdictionLevel: row.jurisdictionLevel,
          stateCode: row.stateCode,
          district: row.district,
          sourceSystem: external?.sourceSystem ?? null,
          externalId: external?.externalId ?? null,
          officialUrl: external?.officialUrl ?? null,
          updatedAt: row.updatedAt,
        };
      }),
      count: rows.length,
    });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
