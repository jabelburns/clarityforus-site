/** Bounded, evidence-backed neighborhood renderer. Does not infer causal relationships. */
export const GRAPH_MAX_DEPTH = 2;
export const GRAPH_MAX_EDGES = 36;
export const GRAPH_MAX_FRONTIER = 16;
export const GRAPH_QUERY_LIMIT = 150;

export function parseGraphRequest(searchParams: URLSearchParams) {
  const rawCenter = searchParams.get('center') || '';
  if (/[\x00-\x1f\x7f]/.test(rawCenter)) throw new Error('Invalid center record ID.');
  const center = rawCenter.trim();
  if (!center || center.length > 160) throw new Error('Invalid center record ID.');
  const depth = Number(searchParams.get('depth') || 2);
  if (!Number.isInteger(depth) || depth < 1 || depth > GRAPH_MAX_DEPTH) throw new Error('Depth must be 1 or 2.');
  return {center, depth};
}

export function evidenceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {return null;}
}

export type GraphRelationship = {
 id: string; fromEntityId: string; toEntityId: string; relationshipType: string;
 evidenceClass: string; sourceId: string; description?: string | null;
 amountCents?: number | null; currency?: string | null;
 startDate?: string | null; endDate?: string | null; confidence?: number | null;
};
export type GraphSource = { id: string; title: string; publisher: string; url: string; retrievedAt?: string | null };
export type GraphNode = {id: string; canonicalName: string; entityType: string; status?: string | null};

const sensitiveHops = new Set(['contributor']);

/** Paths are a deterministic breadth-first tree of source-backed, *observed* relations. */
export function buildGraphPaths({center, depth, layers, nodes, sources, queryTruncated = false}: {
 center: string; depth: number; layers: GraphRelationship[][]; nodes: GraphNode[]; sources: GraphSource[]; queryTruncated?: boolean;
}) {
 const entityIndex = new Map(nodes.map(n => [n.id, n]));
 const sourceIndex = new Map(sources.filter(s => evidenceUrl(s.url)).map(s => [s.id, s]));
 if (!entityIndex.has(center)) throw new Error('Unknown graph center.');
 const visited = new Set([center]);
 let frontier = [center];
 const paths: Array<{node: GraphNode; hops: Array<{
  relationshipId: string; fromEntityId: string; toEntityId: string; direction: string;
  type: string; evidenceClass: string; description: string | null; amountCents: number | null;
  currency: string | null; startDate: string | null; endDate: string | null;
  source: {id: string; title: string; publisher: string; url: string; retrievedAt: string | null}
 }>}> = [];
 const seenEdges = new Set<string>();
 const pathsById = new Map([[center, [] as (typeof paths)[number]['hops']]]);
 let truncated = Boolean(queryTruncated);
 const reachedDepth = Math.min(depth, layers.length);
 for (let level = 0; level < reachedDepth; level++) {
  const current = new Set(frontier);
  const next: string[] = [];
  const sorted = (layers[level] || []).slice().sort((a,b)=>a.id.localeCompare(b.id));
  for (const relation of sorted) {
   if (seenEdges.has(relation.id)) continue;
   seenEdges.add(relation.id);
   const fromCurrent = current.has(relation.fromEntityId);
   const toCurrent = current.has(relation.toEntityId);
   if (!fromCurrent && !toCurrent) continue;
   const otherId = fromCurrent ? relation.toEntityId : relation.fromEntityId;
   const parentId = fromCurrent ? relation.fromEntityId : relation.toEntityId;
   const node = entityIndex.get(otherId);
   const source = sourceIndex.get(relation.sourceId);
   if (!node || !source || !relation.evidenceClass || !relation.relationshipType ||
       !pathsById.has(parentId) || otherId === center || visited.has(otherId)) continue;
   // Individual contributor identities are intentionally not propagated into public multi-hop graphs.
   if (sensitiveHops.has(node.entityType)) continue;
   if (paths.length >= GRAPH_MAX_EDGES || next.length >= GRAPH_MAX_FRONTIER) {truncated = true; continue;}
   const hop = {
    relationshipId: relation.id, fromEntityId: relation.fromEntityId, toEntityId: relation.toEntityId,
    direction: fromCurrent ? 'outgoing' : 'incoming', type: relation.relationshipType,
    evidenceClass: relation.evidenceClass, description: relation.description || null,
    amountCents: Number.isSafeInteger(relation.amountCents) ? relation.amountCents! : null,
    currency: relation.currency || null, startDate: relation.startDate || null, endDate: relation.endDate || null,
    source: {id: source.id, title: source.title, publisher: source.publisher,
      url: evidenceUrl(source.url)!, retrievedAt: source.retrievedAt || null}
   };
   const hops = [...pathsById.get(parentId)!, hop];
   paths.push({node,hops});
   pathsById.set(otherId,hops);
   visited.add(otherId);
   next.push(otherId);
  }
  frontier = next;
  if (!frontier.length) break;
 }
 return {
  center: entityIndex.get(center), requestedDepth: depth, paths,
  truncated, displayedNodes: paths.length + 1,
  disclaimer: 'These paths show documented database relationships, not proof of motive, influence, wrongdoing or causation. Potential or inferred links are labeled by their evidence class. This is a bounded sample, not a complete network.'
 };
}
