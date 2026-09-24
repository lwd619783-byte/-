import { z } from 'zod';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { methodology, sumAmounts, validateProjection, type PortfolioProjection } from '../../shared/portfolio.mjs';
import { researchExposure, linkAt, type PortfolioResearchOwners, type ResearchLink } from './portfolio';

const id=z.string().trim().min(1).max(2048), instant=z.string().datetime({offset:true});
export const targetSchema=z.object({ targetId:id,revisionId:id,supersedes:id.nullable(),createdAt:instant,asOf:instant,
  scope:z.object({currency:z.string().regex(/^[A-Z]{3}$/),snapshotDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),accountId:id.nullable(),dimension:z.enum(['accountId','assetId','primaryCategory','strategyBucket'])}).strict(),
  allocations:z.array(z.object({value:id,basisPoints:z.number().int().min(0).max(10000)}).strict()).min(1),
  approval:z.object({actor:z.literal('user'),userApprovalRef:id,note:id}).strict(),rationale:id,
}).strict();
export type TargetAllocation=z.infer<typeof targetSchema>;
export const reviewSchema=z.object({reviewId:id,taskId:z.string().min(1),taskBytes:z.string().min(1),createdAt:instant,status:z.enum(['needs_review','reviewed','dismissed']),actor:z.literal('user'),userApprovalRef:id,note:id}).strict();
export type RebalanceReview=z.infer<typeof reviewSchema>;
export function targetIdentity(scope:TargetAllocation['scope']) { return canonicalJson(scope); }
export function validateTarget(t:TargetAllocation) {
  targetSchema.parse(t);
  if(t.targetId!==targetIdentity(t.scope) || Date.parse(t.asOf)>Date.parse(t.createdAt)) throw Error('TARGET_IDENTITY_OR_TIME');
  if(new Set(t.allocations.map(a=>a.value)).size!==t.allocations.length) throw Error('TARGET_DUPLICATE');
  if(t.allocations.reduce((sum,a)=>sum+a.basisPoints,0)!==10000) throw Error('TARGET_TOTAL_MUST_EQUAL_10000');
}
export function targetPositions(p:PortfolioProjection,t:TargetAllocation) {
  return p.positions.filter(row=>row.currency===t.scope.currency && row.snapshotDate===t.scope.snapshotDate && (!t.scope.accountId || row.accountId===t.scope.accountId));
}
export function validateTargetAuthority(p:PortfolioProjection,t:TargetAllocation) {
  validateProjection(p); validateTarget(t);
  const rows=targetPositions(p,t);
  if(!rows.length || p.status==='conflicted' || Date.parse(t.asOf)<Date.parse(p.asOf)) throw Error('TARGET_PROJECTION_UNAVAILABLE');
  const values=new Set(rows.map(row=>row[t.scope.dimension]));
  if(t.allocations.some(a=>!values.has(a.value)) || [...values].some(v=>v===null || !t.allocations.some(a=>a.value===v))) throw Error('TARGET_DIMENSION_UNRESOLVED_OR_INCOMPLETE');
}
export function rebalance(p:PortfolioProjection,t:TargetAllocation,links:ResearchLink[],owners:PortfolioResearchOwners) {
  validateProjection(p); validateTarget(t);
  const rows=targetPositions(p,t), blockers=[...p.blockers];
  if(Date.parse(t.createdAt)>Date.parse(p.asOf)) blockers.push('TARGET_NOT_AVAILABLE_ASOF');
  if(!rows.length) blockers.push('CURRENT_EXPOSURE_UNAVAILABLE');
  // V1 has snapshot value/quantity, not an admitted executable price or trade-unit owner.
  blockers.push('PRICE_OWNER_UNAVAILABLE','TRADE_UNIT_UNAVAILABLE');
  rows.forEach(row=>blockers.push(...row.blockers));
  const research=rows.map(position=>({positionId:position.positionId,...researchExposure(position,linkAt(links,position.positionId,p.asOf),owners,p.asOf)}));
  research.forEach(r=>blockers.push(...r.blockers));
  const total=rows.length?sumAmounts(rows.map(row=>row.marketValue)):null;
  if(total===0) blockers.push('ZERO_DENOMINATOR');
  const values=[...new Set([...rows.map(row=>row[t.scope.dimension]),...t.allocations.map(a=>a.value)])];
  const comparisons=values.map(value=>{
    const allocation=t.allocations.find(a=>a.value===value), members=rows.filter(row=>row[t.scope.dimension]===value);
    if(!allocation) blockers.push('TARGET_CATEGORY_MISSING');
    const current=members.length?sumAmounts(members.map(row=>row.marketValue)):null;
    const currentShare=current!==null && total!==null && total>0?current/total:null;
    const targetShare=allocation?allocation.basisPoints/10000:null;
    return {value,current,currentShare,targetShare,target:total!==null && targetShare!==null?total*targetShare:null,delta:currentShare!==null && targetShare!==null?targetShare-currentShare:null};
  });
  const lineage=rows.map(row=>({positionId:row.positionId,snapshotId:row.snapshotId,lineage:row.lineage}));
  const context=research.map(r=>({positionId:r.positionId,status:r.status,blockers:r.blockers,expressionRevision:r.trace?.revisionId??null,thesisRevision:r.trace?.thesisRef?.revisionId??null,thesisStatement:r.trace?.gate.thesis?.statement??null,sensitivity:r.trace?.gate.revision.sensitivity??null,relationships:r.relationships}));
  const task={schemaVersion:'rebalance-task.v1' as const,methodology,asOf:p.asOf,scope:t.scope,targetRevisionId:t.revisionId,comparisons,lineage,research:context,status:'blocked' as const,blockers:[...new Set(blockers)].sort(),rationale:t.rationale,execution:'not_admitted' as const};
  // A later read of identical inputs is the same task. Freeze the query cutoff in
  // review bytes, but do not discard reviews just because the clock advanced.
  const {asOf: _queryCutoff, ...identity}=task;
  return {taskId:canonicalJson(identity),...task};
}
export type RebalanceTask=ReturnType<typeof rebalance>;
