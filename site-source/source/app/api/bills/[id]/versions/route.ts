import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { bills, sourceRecords } from '@/db/schema';
import { apiError } from '@/lib/civic-data';
import { normalizeBillTextVersions } from '@/lib/bill-text-versions.mts';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const entityId = decodeURIComponent(id);
    const db = getDb();
    const [bill] = await db.select().from(bills).where(eq(bills.entityId, entityId)).limit(1);
    if (!bill) return Response.json({ error: 'Bill not found.' }, { status: 404 });
    const snapshots = await db.select().from(sourceRecords)
      .where(eq(sourceRecords.entityId, entityId))
      .orderBy(desc(sourceRecords.fetchedAt));
    const bundle = snapshots.map(row => {
      try { return { row, payload: JSON.parse(row.rawJson) }; } catch { return null; }
    }).find(item => item?.payload?.kind === 'congress_bill_bundle');
    if (!bundle) return Response.json({ billId: entityId, status: 'not_imported', versions: [], coverage: {
      importedCount: 0, reportedCount: null, partial: true, warnings: ['No Congress.gov text-version snapshot has been imported.'],
    } }, { headers: { 'Cache-Control': 'no-store' } });
    const payload = bundle.payload;
    const inventory = normalizeBillTextVersions(payload.textVersions, {
      reportedCount: payload.bill?.textVersions?.count,
      endpointErrors: payload.endpointErrors,
    });
    return Response.json({ billId: entityId, status: inventory.partial ? 'partial' : 'snapshot',
      publisher: 'Congress.gov', metadataRetrievedAt: bundle.row.fetchedAt,
      officialBillUrl: bill.officialUrl, versions: inventory.versions,
      coverage: { reportedCount: inventory.reportedCount, importedCount: inventory.importedCount,
        partial: inventory.partial, warnings: inventory.warnings },
      note: 'Version links and labels are official metadata; Clarity has not necessarily archived every bill-text file.'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch(error) { return Response.json({error: apiError(error)}, {status:500}); }
}
