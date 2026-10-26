import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { bills, entities, externalIds, ingestRuns, memberVotes, relationships, sourceRecords, sources, votes } from '@/db/schema';
import { apiError, normalizeName } from '@/lib/civic-data';
import { fetchRecentSenateRollCalls } from '@/lib/senate-lis';
import { resolveSenateIdentity } from '@/lib/senate-votes-core.mts';
import { authorizeIngestRequest, isSameOriginMutation } from '@/lib/site-admin';

export const dynamic='force-dynamic';
const chunks = <T,>(values:T[],size:number):T[][] => Array.from({length:Math.ceil(values.length/size)},(_,i)=>values.slice(i*size,(i+1)*size));
const publisher='Secretary of the Senate, Legislative Information System';

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({error:'Cross-origin writes are not allowed.'},{status:403});
  let runId:string|null=null;
  try {
    const auth=await authorizeIngestRequest(request);
    if (!auth.ok) return Response.json({error:auth.error},{status:auth.status});
    const params=new URL(request.url).searchParams;
    const congress=Number(params.get('congress')??119),session=Number(params.get('session')??2),limit=Number(params.get('limit')??1);
    const beforeRaw=params.get('beforeRoll');
    const beforeRoll=beforeRaw===null?undefined:Number(beforeRaw);
    if (congress!==119 || ![1,2].includes(session) || !Number.isInteger(limit) || limit<1 || limit>1 ||
        (beforeRoll!==undefined && (!Number.isInteger(beforeRoll) || beforeRoll<1))) {
      return Response.json({error:'Invalid 119th Congress Senate roll-call batch parameters.'},{status:400});
    }
    const db=getDb(), now=new Date().toISOString();
    runId=`senate-lis-votes:${crypto.randomUUID()}`;
    await db.insert(ingestRuns).values({id:runId,sourceSystem:'senate_lis_votes',status:'running'});
    // Fetch and fully validate the official documents BEFORE database mutation.
    const data=await fetchRecentSenateRollCalls({congress,session,limit,beforeRoll});
    const existingLIS = await db.select({entityId:externalIds.entityId,externalId:externalIds.externalId})
      .from(externalIds).where(eq(externalIds.sourceSystem,'senate_lis'));
    const idMap=new Map(existingLIS.map(row=>[row.externalId,row.entityId]));
    let positionsWritten=0,provisionalPositions=0;
    for (const roll of [...data.rollCalls].reverse()) {
      const sourceId=`senate:lis:vote:${congress}:${session}:${roll.rollNumber}`;
      const voteEntityId=`vote:senate:${congress}:${session}:${roll.rollNumber}`;
      const title=`Senate Roll Call ${roll.rollNumber}: ${roll.question}`;
      await db.insert(sources).values({id:sourceId,sourceSystem:'senate_lis',recordType:'senate_roll_call',publisher,
        title,url:roll.detailUrl,documentDate:roll.voteDate,retrievedAt:now,
        coverageNote:'Official Senate vote question, result and individual positions. Cloture, amendments and nominations are not bill-passage votes.'})
        .onConflictDoUpdate({target:sources.id,set:{title,url:roll.detailUrl,documentDate:roll.voteDate,retrievedAt:now}});
      let billEntityId:string|null=null;
      if (roll.measure) {
        const measure=roll.measure;
        billEntityId=`bill:${congress}:${measure.type}:${measure.number}`;
        await db.insert(entities).values({id:billEntityId,entityType:'bill',canonicalName:measure.displayNumber,
          normalizedName:normalizeName(measure.displayNumber),jurisdictionLevel:'federal',
          description:`Measure referenced in Senate Roll Call ${roll.rollNumber}. Full legislative text and status come from Congress.gov.`,
          status:'source_partial',updatedAt:now}).onConflictDoNothing();
        await db.insert(bills).values({entityId:billEntityId,congress,billType:measure.type,billNumber:measure.number,
          title:measure.displayNumber,officialUrl:measure.officialUrl,sourceId})
          .onConflictDoNothing();
        await db.insert(externalIds).values({entityId:billEntityId,sourceSystem:'congress_gov',
          externalId:`${congress}:${measure.type}:${measure.number}`,officialUrl:measure.officialUrl,
          isPrimary:true,verifiedAt:now}).onConflictDoNothing();
      }
      const description=`${roll.description}. Recorded question: ${roll.question}. Result: ${roll.result}.`;
      await db.insert(entities).values({id:voteEntityId,entityType:'vote',canonicalName:title,
        normalizedName:normalizeName(title),jurisdictionLevel:'federal',description,status:'recorded',updatedAt:now})
        .onConflictDoUpdate({target:entities.id,set:{canonicalName:title,normalizedName:normalizeName(title),description,updatedAt:now}});
      await db.insert(votes).values({entityId:voteEntityId,congress,chamber:'Senate',session:String(session),
        rollNumber:roll.rollNumber,voteDate:roll.voteDate,question:roll.question,description:roll.description,
        result:roll.result,billEntityId,officialUrl:roll.detailUrl,sourceId})
        .onConflictDoUpdate({target:votes.entityId,set:{voteDate:roll.voteDate,question:roll.question,
          description:roll.description,result:roll.result,billEntityId,officialUrl:roll.detailUrl,sourceId}});
      await db.insert(externalIds).values({entityId:voteEntityId,sourceSystem:'senate_lis_vote',
        externalId:`${congress}:${session}:${roll.rollNumber}`,officialUrl:roll.detailUrl,isPrimary:true,verifiedAt:now})
        .onConflictDoNothing();
      await db.insert(sourceRecords).values({id:`${sourceId}:raw`,sourceId,entityId:voteEntityId,
        externalId:`${congress}:${session}:${roll.rollNumber}`,rawJson:JSON.stringify(roll.raw),fetchedAt:now,transformedAt:now})
        .onConflictDoUpdate({target:sourceRecords.id,set:{rawJson:JSON.stringify(roll.raw),fetchedAt:now,transformedAt:now}});

      const linked=roll.memberVotes.map(member=>{
        const match=resolveSenateIdentity(member,data.roster);
        // An established Senate LIS key cannot silently change identities.
        const personEntityId=idMap.get(member.lisMemberId)??match.entityId;
        idMap.set(member.lisMemberId,personEntityId);
        if (personEntityId.startsWith('person:senate-lis:')) provisionalPositions++;
        return {member,personEntityId};
      });
      for (const batch of chunks(linked,10)) {
        await db.insert(entities).values(batch.map(({member,personEntityId})=>({
          id:personEntityId,entityType:'politician',canonicalName:member.displayName,
          normalizedName:normalizeName(member.displayName),jurisdictionLevel:'federal',stateCode:member.stateCode,
          description:personEntityId.startsWith('person:senate-lis:')
            ? 'Provisional Senate LIS identifier; awaiting unambiguous historical person-ID resolution.'
            : 'Senate member identified by matching the official Senate roster Bioguide ID.',
          status:personEntityId.startsWith('person:senate-lis:')?'identity_provisional':'recorded_member',updatedAt:now,
        }))).onConflictDoNothing();
        await db.insert(externalIds).values(batch.map(({member,personEntityId})=>({entityId:personEntityId,
          sourceSystem:'senate_lis',externalId:member.lisMemberId,
          officialUrl:roll.detailUrl,isPrimary:false,verifiedAt:now})))
          .onConflictDoNothing();
      }
      for (const batch of chunks(linked,18)) {
        await db.insert(memberVotes).values(batch.map(({member,personEntityId})=>({
          id:`${voteEntityId}:${member.lisMemberId}`,voteEntityId,personEntityId,position:member.position,sourceId,
        }))).onConflictDoUpdate({target:memberVotes.id,set:{position:sql`excluded.position`,sourceId}});
      }
      positionsWritten+=linked.length;
      if (billEntityId) {
        const relationshipId=`${voteEntityId}:concerns:${billEntityId}`;
        await db.insert(relationships).values({id:relationshipId,fromEntityId:voteEntityId,toEntityId:billEntityId,
          relationshipType:'concerns',description:`Official Senate roll call concerns ${roll.measure?.displayNumber}; the question is ${roll.question}.`,
          startDate:roll.voteDate,confidence:1,evidenceClass:'source_fact',sourceId})
          .onConflictDoUpdate({target:relationships.id,set:{description:`Senate roll-call question: ${roll.question}.`,startDate:roll.voteDate,sourceId}});
      }
    }
    await db.update(ingestRuns).set({finishedAt:new Date().toISOString(),status:'succeeded',
      recordsSeen:data.rollCalls.length,recordsWritten:data.rollCalls.length}).where(eq(ingestRuns.id,runId));
    return Response.json({ok:true,runId,congress,session,rollCallsWritten:data.rollCalls.length,
      memberPositionsWritten:positionsWritten,provisionalMemberPositions:provisionalPositions,
      rollNumbers:data.rollNumbers,nextBeforeRoll:data.nextBeforeRoll,source:{name:publisher,url:data.listingUrl,retrievedAt:data.retrievedAt}});
  } catch (error) {
    const message=apiError(error);
    if (runId) {
      try { await getDb().update(ingestRuns).set({finishedAt:new Date().toISOString(),status:'failed',errorText:message.slice(0,2000)}).where(eq(ingestRuns.id,runId)); }
      catch { /* Preserve first failure cause. */ }
    }
    return Response.json({ok:false,error:message},{status:500});
  }
}
