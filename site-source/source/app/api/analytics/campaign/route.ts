import { and, count, eq, gte, inArray, lte, max, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { entities, moneyTransactions, sources } from '@/db/schema';
import { apiError } from '@/lib/civic-data';
import { CAMPAIGN_LIMITATIONS, parseCampaignQuery, summarizeCampaignRows } from '@/lib/campaign-finance.mts';

export const dynamic = 'force-dynamic';

/**
 * Read-only, single-candidate imported-FEC summary. No contributor details.
 * Never interpret sampled Clarity receipts as total money raised.
 */
export async function GET(request: Request) {
  let args: ReturnType<typeof parseCampaignQuery>;
  try {
    args = parseCampaignQuery(new URL(request.url));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }

  try {
    const db = getDb();
    const candidate = await db.select({
      id: entities.id,
      name: entities.canonicalName,
      entityType: entities.entityType,
    }).from(entities).where(eq(entities.id, args.candidateId)).limit(1);
    if (!candidate.length || !['candidate', 'politician'].includes(candidate[0].entityType)) {
      return Response.json({ error: 'Candidate/public-official record not found.' }, { status: 404 });
    }

    // Correlated aggregate (rather than a many-to-many JOIN) avoids counting
    // an independent expenditure more than once. Conflicting Schedule E
    // support/opposition relationships are explicitly labeled, not guessed.
    const position = sql<string>`case when ${moneyTransactions.transactionType} = 'independent_expenditure'
      then coalesce((select case
        when count(distinct rel.relationship_type) > 1 then 'conflicting'
        else max(case rel.relationship_type
          when 'independent_support' then 'support'
          when 'independent_opposition' then 'oppose'
          else 'unreported' end)
        end
        from relationships rel
        where rel.from_entity_id = ${moneyTransactions.id}
          and rel.to_entity_id = ${args.candidateId}
          and rel.relationship_type in ('independent_support','independent_opposition','independent_spending_reference')),
        'unreported')
      else 'not_applicable' end`;
    const conditions = and(
      eq(moneyTransactions.candidateEntityId, args.candidateId),
      gte(moneyTransactions.transactionDate, args.startDate),
      lte(moneyTransactions.transactionDate, args.endDate),
      inArray(moneyTransactions.transactionType, ['itemized_receipt', 'independent_expenditure']),
    );

    const [rows, evidence] = await Promise.all([
      db.select({
        transactionType: moneyTransactions.transactionType,
        position,
        records: count(),
        netCents: sql<number>`coalesce(sum(${moneyTransactions.amountCents}), 0)`,
      }).from(moneyTransactions).where(conditions)
        .groupBy(moneyTransactions.transactionType, position),
      db.select({
        url: sources.url,
        sourceTitle: sources.title,
        sourceSystem: sources.sourceSystem,
        lastRetrieved: max(sources.retrievedAt),
      }).from(moneyTransactions)
        .innerJoin(sources, eq(moneyTransactions.sourceId, sources.id))
        .where(conditions)
        .groupBy(sources.id)
        .limit(12),
    ]);

    return Response.json({
      candidate: { id: candidate[0].id, name: candidate[0].name },
      period: { labeledCycle: args.cycle, from: args.startDate, through: args.endDate, basis: 'transaction_date' },
      groups: summarizeCampaignRows(rows),
      sourceLinks: evidence.filter((source) => {
        try { const url = new URL(source.url); return url.protocol === 'https:' && (url.hostname === 'fec.gov' || url.hostname.endsWith('.fec.gov')); }
        catch { return false; }
      }),
      methodology: 'imported-fec-transaction-sample-v1',
      limitations: CAMPAIGN_LIMITATIONS,
    }, { headers: { 'cache-control': 'public, max-age=120, stale-while-revalidate=300' } });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 503 });
  }
}
