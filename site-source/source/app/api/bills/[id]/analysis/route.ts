import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  analyses,
  analysisFindings,
  bills,
  entities,
  sourceRecords,
  sources,
} from "@/db/schema";
import {
  generateBillAnalysis,
  hasBillAnalysisProvider,
} from "@/lib/bill-analysis";
import { ANALYSIS_QUESTIONS, apiError } from "@/lib/civic-data";
import { authorizeIngestRequest, isSameOriginMutation } from "@/lib/site-admin";
import { compareAnalysisVersion, normalizeBillTextVersions, preferredTextVersion } from "@/lib/bill-text-versions.mts";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

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

function parseSnapshot(rawJson: string) {
  try {
    return objectValue(JSON.parse(rawJson));
  } catch {
    return {};
  }
}

function stripOfficialText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function selectTextVersion(bundle: JsonRecord) {
  const inventory = normalizeBillTextVersions(bundle.textVersions, {
    reportedCount: objectValue(objectValue(bundle.bill).textVersions).count,
    endpointErrors: bundle.endpointErrors,
  });
  if (inventory.partial) return null; // Fail closed: a missing page may contain a newer version.
  const choice = preferredTextVersion(inventory);
  const format = choice?.formats.find((item) => item.preferred);
  return choice && format ? {
    key: choice.key,
    date: choice.date,
    versionType: choice.label,
    formatType: format.type,
    url: format.url,
  } : null;
}

async function shortDigest(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function retrieveOfficialText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html, application/xml;q=0.9, text/plain;q=0.8",
      "user-agent": "Clarity-for-US/1.0 civic research",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`The official bill text returned HTTP ${response.status}.`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 10_000_000) {
    throw new Error("The selected official bill text is too large to analyze safely.");
  }
  const normalized = stripOfficialText(await response.text());
  if (normalized.length < 100) {
    throw new Error("The selected official bill text did not contain readable text.");
  }
  const maximumCharacters = 220_000;
  return {
    text: normalized.slice(0, maximumCharacters),
    truncated: normalized.length > maximumCharacters,
    originalCharacters: normalized.length,
  };
}

function sourcePacket(
  bill: typeof bills.$inferSelect,
  entity: typeof entities.$inferSelect,
  bundle: JsonRecord,
  billSourceId: string,
  textSourceId: string,
  officialText: string,
  truncated: boolean,
) {
  const sponsors = arrayValue(objectValue(bundle.bill).sponsors).map((person) => ({
    bioguideId: stringValue(person.bioguideId),
    fullName: stringValue(person.fullName),
    party: stringValue(person.party),
    state: stringValue(person.state),
  }));
  const cosponsors = arrayValue(bundle.cosponsors).map((person) => ({
    bioguideId: stringValue(person.bioguideId),
    fullName: stringValue(person.fullName),
    party: stringValue(person.party),
    state: stringValue(person.state),
    sponsorshipDate: stringValue(person.sponsorshipDate),
  }));
  const metadata = {
    sourceId: billSourceId,
    record: {
      title: entity.canonicalName,
      congress: bill.congress,
      billType: bill.billType,
      billNumber: bill.billNumber,
      policyArea: bill.policyArea,
      introducedDate: bill.introducedDate,
      latestAction: bill.latestAction,
      latestActionDate: bill.latestActionDate,
      officialUrl: bill.officialUrl,
    },
    sponsors,
    cosponsors,
    actions: arrayValue(bundle.actions).slice(0, 60),
    officialSummaries: arrayValue(bundle.summaries).slice(0, 10),
    amendments: arrayValue(bundle.amendments).slice(0, 60),
    committees: arrayValue(bundle.committees).slice(0, 50),
    endpointErrors: Array.isArray(bundle.endpointErrors)
      ? bundle.endpointErrors
      : [],
  };
  return [
    `SOURCE ${billSourceId} — Congress.gov metadata and legislative history:`,
    JSON.stringify(metadata),
    `SOURCE ${textSourceId} — official bill text${truncated ? " (truncated at the disclosed analysis limit)" : ""}:`,
    officialText,
  ].join("\n\n");
}

async function billRecord(entityId: string) {
  const db = getDb();
  return db
    .select({ entity: entities, bill: bills })
    .from(bills)
    .innerJoin(entities, eq(entities.id, bills.entityId))
    .where(eq(bills.entityId, entityId))
    .limit(1);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const entityId = decodeURIComponent(id);
    const db = getDb();
    const [bill] = await billRecord(entityId);

    if (!bill) {
      return Response.json({ error: "Bill not found." }, { status: 404 });
    }

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.subjectEntityId, entityId),
          eq(analyses.analysisType, "bill_explanation"),
        ),
      )
      .orderBy(desc(analyses.analysisVersion))
      .limit(1);
    const findings = analysis
      ? await db
          .select()
          .from(analysisFindings)
          .where(eq(analysisFindings.analysisId, analysis.id))
          .orderBy(analysisFindings.sequence)
      : [];

    const [billSnapshot, textReference] = analysis
      ? await Promise.all([
          bill.bill.sourceId
            ? db.select().from(sourceRecords)
                .where(eq(sourceRecords.id, `${bill.bill.sourceId}:bundle`)).limit(1)
            : Promise.resolve([]),
          db.select().from(sourceRecords)
            .where(eq(sourceRecords.id, `${analysis.id}:text-reference`)).limit(1),
        ])
      : [[], []];
    const bundle = billSnapshot[0] ? parseSnapshot(billSnapshot[0].rawJson) : {};
    const inventory = normalizeBillTextVersions(bundle.textVersions, {
      reportedCount: objectValue(objectValue(bundle.bill).textVersions).count,
      endpointErrors: bundle.endpointErrors,
    });
    const reference = textReference[0] ? parseSnapshot(textReference[0].rawJson) : null;
    const textVersionCheck = analysis
      ? compareAnalysisVersion(inventory, reference)
      : "not_generated";

    return Response.json({
      bill,
      status: analysis?.status ?? "not_generated",
      textVersionCheck,
      textVersionCoverage: { imported: inventory.importedCount,
        reported: inventory.reportedCount, partial: inventory.partial, warnings: inventory.warnings },
      aiConfigured: hasBillAnalysisProvider(env),
      standard: {
        questions: ANALYSIS_QUESTIONS,
        findingClasses: ["statutory_text", "outside_evidence", "inference"],
        rule: "Every material claim must cite a source; inference must be labeled.",
      },
      analysis: analysis ? { ...analysis, findings } : null,
    });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    if (!hasBillAnalysisProvider(env)) {
      return Response.json(
        { error: "No AI analysis provider is configured." },
        { status: 503 },
      );
    }

    const { id } = await params;
    const entityId = decodeURIComponent(id);
    const db = getDb();
    const [record] = await billRecord(entityId);
    if (!record) {
      return Response.json({ error: "Bill not found." }, { status: 404 });
    }
    if (!record.bill.sourceId) {
      return Response.json(
        { error: "This bill does not yet have a Congress.gov source bundle." },
        { status: 409 },
      );
    }

    const billSnapshots = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.entityId, entityId))
      .orderBy(desc(sourceRecords.fetchedAt));
    const congressSnapshot = billSnapshots
      .map((snapshot) => ({ snapshot, parsed: parseSnapshot(snapshot.rawJson) }))
      .find((item) => item.parsed.kind === "congress_bill_bundle");
    if (!congressSnapshot) {
      return Response.json(
        { error: "Refresh Congress.gov records before generating this analysis." },
        { status: 409 },
      );
    }

    const textVersion = selectTextVersion(congressSnapshot.parsed);
    if (!textVersion) {
      return Response.json(
        { error: "Congress.gov did not provide a supported official text link." },
        { status: 409 },
      );
    }

    const retrievedText = await retrieveOfficialText(textVersion.url);
    const now = new Date().toISOString();
    const textSourceId = `congress-gov:text:${await shortDigest(textVersion.url)}`;
    await db
      .insert(sources)
      .values({
        id: textSourceId,
        sourceSystem: "congress_gov",
        recordType: "bill_text",
        publisher: "Library of Congress",
        title: `${record.entity.canonicalName} — ${textVersion.versionType ?? textVersion.formatType}`,
        url: textVersion.url,
        documentDate: textVersion.date,
        retrievedAt: now,
        coverageNote: retrievedText.truncated
          ? `Official text snapshot truncated to ${retrievedText.text.length.toLocaleString()} characters for bounded AI analysis; original normalized length was ${retrievedText.originalCharacters.toLocaleString()} characters.`
          : "Official bill text snapshot used for source-grounded AI analysis.",
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          title: `${record.entity.canonicalName} — ${textVersion.versionType ?? textVersion.formatType}`,
          url: textVersion.url,
          documentDate: textVersion.date,
          retrievedAt: now,
          coverageNote: retrievedText.truncated
            ? `Official text snapshot truncated to ${retrievedText.text.length.toLocaleString()} characters for bounded AI analysis; original normalized length was ${retrievedText.originalCharacters.toLocaleString()} characters.`
            : "Official bill text snapshot used for source-grounded AI analysis.",
        },
      });

    await db
      .insert(sourceRecords)
      .values({
        id: `${textSourceId}:snapshot`,
        sourceId: textSourceId,
        entityId,
        externalId: textVersion.url,
        rawJson: JSON.stringify({
          kind: "congress_bill_text",
          versionType: textVersion.versionType,
          formatType: textVersion.formatType,
          date: textVersion.date,
          url: textVersion.url,
          text: retrievedText.text,
          truncated: retrievedText.truncated,
          originalCharacters: retrievedText.originalCharacters,
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

    const allowedSourceIds = [record.bill.sourceId, textSourceId];
    const packet = sourcePacket(
      record.bill,
      record.entity,
      congressSnapshot.parsed,
      record.bill.sourceId,
      textSourceId,
      retrievedText.text,
      retrievedText.truncated,
    );
    const generated = await generateBillAnalysis(env, packet, allowedSourceIds);
    const [latest] = await db
      .select({ version: analyses.analysisVersion })
      .from(analyses)
      .where(
        and(
          eq(analyses.subjectEntityId, entityId),
          eq(analyses.analysisType, "bill_explanation"),
        ),
      )
      .orderBy(desc(analyses.analysisVersion))
      .limit(1);
    const analysisVersion = (latest?.version ?? 0) + 1;
    const analysisId = `analysis:bill:${await shortDigest(`${entityId}:${analysisVersion}:${now}`)}`;

    await db.insert(analyses).values({
      id: analysisId,
      subjectEntityId: entityId,
      analysisType: "bill_explanation",
      analysisVersion,
      status: "completed",
      modelName: `${generated.provider}:${generated.model}`,
      generatedAt: now,
      sourceSnapshotAt: now,
      methodologyVersion: "clarity-bill-analysis-v1",
      summary: generated.summary,
      limitations: generated.limitations,
    });
    await db.insert(analysisFindings).values(
      generated.findings.map((finding, sequence) => ({
        id: `${analysisId}:${finding.promptKey}`,
        analysisId,
        promptKey: finding.promptKey,
        findingClass: finding.findingClass,
        findingText: finding.findingText,
        confidence: finding.confidence,
        sequence,
        sourceId: finding.sourceId,
      })),
    );

    // Save the exact official text *version reference* used at generation time.
    // This lets the public UI identify a subsequently published version without
    // falsely claiming that fetched URLs imply byte-for-byte text preservation.
    await db.insert(sourceRecords).values({
      id: `${analysisId}:text-reference`,
      sourceId: textSourceId,
      entityId,
      externalId: `${analysisId}:${textVersion.key}`,
      rawJson: JSON.stringify({
        kind: "analysis_bill_text_reference",
        key: textVersion.key,
        url: textVersion.url,
        date: textVersion.date,
        versionType: textVersion.versionType,
        truncated: retrievedText.truncated,
      }),
      fetchedAt: now,
      transformedAt: now,
    });

    return Response.json(
      {
        ok: true,
        analysis: {
          id: analysisId,
          version: analysisVersion,
          provider: generated.provider,
          model: generated.model,
          generatedAt: now,
          summary: generated.summary,
          limitations: generated.limitations,
          findings: generated.findings,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 500 });
  }
}
