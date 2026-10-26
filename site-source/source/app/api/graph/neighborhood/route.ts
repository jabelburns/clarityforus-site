import {asc, eq, inArray, or} from 'drizzle-orm';
import {getDb} from '@/db';
import {entities, relationships, sources} from '@/db/schema';
import {apiError} from '@/lib/civic-data';
import {
 buildGraphPaths, evidenceUrl, GRAPH_MAX_FRONTIER, GRAPH_QUERY_LIMIT, parseGraphRequest
} from '@/lib/graph-explorer.mts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
 let params;
 try {params = parseGraphRequest(new URL(request.url).searchParams);}
 catch (error) {return Response.json({error: error instanceof Error ? error.message : 'Bad request'}, {status:400});}
 const {center, depth} = params;
 try {
  const db = getDb();
  const [root] = await db.select({id:entities.id,canonicalName:entities.canonicalName,entityType:entities.entityType,status:entities.status})
   .from(entities).where(eq(entities.id,center)).limit(1);
  if (!root) return Response.json({error:'Record not found'}, {status:404});
  const layers = [];
  let frontier=[center];
  const discovered = new Set([center]);
  const collectedIds = new Set<string>([center]);
  const sourceIds = new Set<string>();
  let queryTruncated = false;
  for(let i=0;i<depth && frontier.length;i++) {
    const rows=await db.select().from(relationships)
      .where(or(inArray(relationships.fromEntityId,frontier),inArray(relationships.toEntityId,frontier)))
      .orderBy(asc(relationships.id)).limit(GRAPH_QUERY_LIMIT+1);
    if(rows.length>GRAPH_QUERY_LIMIT) queryTruncated=true;
    const layer=rows.slice(0,GRAPH_QUERY_LIMIT);
    layers.push(layer);
    const next: string[] = [];
    for(const row of layer) {
      if(row.fromEntityId) collectedIds.add(row.fromEntityId);
      if(row.toEntityId) collectedIds.add(row.toEntityId);
      if(row.sourceId) sourceIds.add(row.sourceId);
      const other=frontier.includes(row.fromEntityId)?row.toEntityId:row.fromEntityId;
      if(!discovered.has(other)) {discovered.add(other);if(next.length<GRAPH_MAX_FRONTIER)next.push(other); else queryTruncated=true;}
    }
    frontier=next;
  }
  // Chunk IN-queries to avoid SQLite's bound-parameter budget and large per-invocation reads.
  const ids=[...collectedIds].slice(0,GRAPH_QUERY_LIMIT*2+1);
  if(collectedIds.size>ids.length) queryTruncated=true;
  const nodeRows: Array<{id:string;canonicalName:string;entityType:string;status:string}> = [];
  for(let i=0;i<ids.length;i+=70) nodeRows.push(...await db.select({id:entities.id,canonicalName:entities.canonicalName,entityType:entities.entityType,status:entities.status})
    .from(entities).where(inArray(entities.id,ids.slice(i,i+70))));
  const sourceList=[...sourceIds].slice(0,GRAPH_QUERY_LIMIT*2+1);
  if(sourceIds.size>sourceList.length)queryTruncated=true;
  const sourceRows: Array<{id:string;title:string;publisher:string;url:string;retrievedAt:string}> = [];
  for(let i=0;i<sourceList.length;i+=70)sourceRows.push(...await db.select({id:sources.id,title:sources.title,publisher:sources.publisher,url:sources.url,retrievedAt:sources.retrievedAt})
    .from(sources).where(inArray(sources.id,sourceList.slice(i,i+70))));
  const result=buildGraphPaths({center,depth,layers,nodes:nodeRows,
     sources:sourceRows.filter(s=>evidenceUrl(s.url)),queryTruncated});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 } catch(error) {return Response.json({error:apiError(error)},{status:500});}
}
