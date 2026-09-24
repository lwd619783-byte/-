import { z } from 'zod';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateProjection, type PortfolioProjection } from '../../shared/portfolio.mjs';
import { PersistedBaseGuard } from './persistedBaseGuard';
import type { StorageLike } from './watchlistRepository';
import { researchLinkSchema, validateLink, researchExposure, validatePortfolioScope, type ResearchLink, type PortfolioResearchOwners } from './portfolio';
import { targetSchema, reviewSchema, validateTarget, validateTargetAuthority, rebalance, type TargetAllocation, type RebalanceReview, type RebalanceTask } from './portfolioPlanning';

export const PORTFOLIO_STORAGE_KEY='investment-research-dashboard.portfolio-planning.v1';
const dataSchema=z.object({schemaVersion:z.literal('portfolio-planning.v1'),scope:z.enum(['real','synthetic']),links:z.array(researchLinkSchema),targets:z.array(targetSchema),reviews:z.array(reviewSchema)}).strict();
export type PortfolioData=z.infer<typeof dataSchema>;
const empty=(scope:PortfolioData['scope']):PortfolioData=>({schemaVersion:'portfolio-planning.v1',scope,links:[],targets:[],reviews:[]});
function require(ok:unknown,code:string):asserts ok { if(!ok) throw Error(code); }
export function validatePortfolioData(raw:unknown,scope:PortfolioData['scope']):asserts raw is PortfolioData {
  const d=dataSchema.parse(raw); require(d.scope===scope,'PORTFOLIO_SCOPE_MISMATCH');
  const ids=new Set<string>(), approvals=new Set<string>();
  for(const rows of [d.links,d.targets]) {
    const heads=new Map<string,typeof rows[number]>();
    for(const row of rows) {
      if('linkId' in row) validateLink(row); else validateTarget(row);
      const id='linkId' in row?row.linkId:row.targetId,prior=heads.get(id);
      require(!ids.has(row.revisionId) && !approvals.has(row.approval.userApprovalRef),'PORTFOLIO_DUPLICATE_REVISION_OR_APPROVAL');
      ids.add(row.revisionId); approvals.add(row.approval.userApprovalRef);
      require(row.supersedes===(prior?.revisionId??null),'PORTFOLIO_REVISION_FORK');
      if(prior) require(Date.parse(row.createdAt)>Date.parse(prior.createdAt) && Date.parse(row.asOf)>=Date.parse(prior.asOf),'PORTFOLIO_HISTORY_TIME');
      heads.set(id,row);
    }
  }
  let reviewTime=-Infinity;
  for(const r of d.reviews) {
    require(!ids.has(r.reviewId) && !approvals.has(r.userApprovalRef),'PORTFOLIO_DUPLICATE_REVIEW');
    const task=JSON.parse(r.taskBytes) as RebalanceTask;
    require(canonicalJson(task)===r.taskBytes && task.taskId===r.taskId && task.schemaVersion==='rebalance-task.v1' && task.status==='blocked' && task.execution==='not_admitted' && task.methodology==='portfolio-exposure.v1','PORTFOLIO_REVIEW_TASK_INVALID');
    const {taskId,asOf: _queryCutoff,...body}=task; require(taskId===canonicalJson(body),'PORTFOLIO_REVIEW_TASK_DRIFT');
    require(d.targets.some(t=>t.revisionId===task.targetRevisionId) && Date.parse(task.asOf)<=Date.parse(r.createdAt) && Date.parse(r.createdAt)>=reviewTime,'PORTFOLIO_REVIEW_TIME_OR_TARGET');
    reviewTime=Date.parse(r.createdAt);ids.add(r.reviewId);approvals.add(r.userApprovalRef);
  }
}
type Addition={kind:'link';value:ResearchLink}|{kind:'target';value:TargetAllocation}|{kind:'review';value:RebalanceReview};
export type PortfolioPreview=Addition & {projectionBytes:string;researchToken:string|null;blockers:string[]};

/** The only new persistence owner is research/planning; it cannot mutate the ledger. */
export class PortfolioRepository {
  private guard:PersistedBaseGuard<PortfolioData>;
  private bases=new WeakMap<PortfolioData,string>();
  private previews=new WeakMap<PortfolioPreview,{base:PortfolioData;bytes:string}>();
  constructor(private storage:StorageLike|null,private owners:PortfolioResearchOwners,private projection:()=>PortfolioProjection,private now:()=>Date=()=>new Date()) { this.guard=new PersistedBaseGuard(storage,PORTFOLIO_STORAGE_KEY); }
  load():{data:PortfolioData;error:string|null;raw:string|null} {
    let raw:string|null=null;
    try {
      require(this.storage,'PORTFOLIO_STORAGE_UNAVAILABLE');raw=this.storage.getItem(PORTFOLIO_STORAGE_KEY);
      const d:unknown=raw===null?empty(this.owners.scope):JSON.parse(raw);validatePortfolioData(d,this.owners.scope);
      this.bases.set(d,canonicalJson(d));this.guard.remember(d,raw);return {data:d,error:null,raw};
    } catch { return {data:empty(this.owners.scope),error:'本地研究关联或规划数据不可用，请保留原始数据并检查版本。',raw}; }
  }
  private base(base:PortfolioData) {
    require(this.bases.get(base)===canonicalJson(base),'PORTFOLIO_BASE_UNBOUND_OR_MUTATED');this.guard.assertCurrent(base);validatePortfolioData(base,this.owners.scope);
  }
  private assess(addition:Addition,base:PortfolioData) {
    this.base(base);const p=validateProjection(this.projection());validatePortfolioScope(p,this.owners.scope);
    let researchToken:string|null=null;const blockers:string[]=[];
    if(addition.kind==='link') {
      const row=p.positions.find(row=>row.positionId===addition.value.positionId);require(row,'PORTFOLIO_POSITION_UNAVAILABLE');
      const exposure=researchExposure(row,addition.value,this.owners,addition.value.createdAt);researchToken=exposure.authorityToken;blockers.push(...exposure.blockers);
    } else if(addition.kind==='target') validateTargetAuthority(p,addition.value);
    else {
      const pinned=JSON.parse(addition.value.taskBytes) as RebalanceTask;
      const target=base.targets.find(t=>t.revisionId===pinned.targetRevisionId);require(target,'PORTFOLIO_TARGET_UNAVAILABLE');
      const fresh=rebalance(p,target,base.links,this.owners);
      require(canonicalJson(fresh)===addition.value.taskBytes && fresh.taskId===addition.value.taskId,'PORTFOLIO_TASK_CHANGED');
      require(!base.targets.some(t=>t.supersedes===target.revisionId),'PORTFOLIO_TARGET_SUPERSEDED');
    }
    return {projectionBytes:canonicalJson(p),researchToken,blockers};
  }
  prepare(base:PortfolioData,addition:Addition):PortfolioPreview {
    const next=structuredClone(base);if(addition.kind==='link')next.links.push(addition.value);else if(addition.kind==='target')next.targets.push(addition.value);else next.reviews.push(addition.value);
    validatePortfolioData(next,this.owners.scope);
    require(Date.parse(addition.value.createdAt)<=this.now().getTime(),'PORTFOLIO_FUTURE_WRITE');
    const preview={...structuredClone(addition),...this.assess(addition,base)} as PortfolioPreview;
    this.previews.set(preview,{base,bytes:canonicalJson(preview)});return preview;
  }
  confirm(preview:PortfolioPreview,confirmed:boolean):PortfolioData {
    require(confirmed,'PORTFOLIO_USER_CONFIRMATION_REQUIRED');
    const binding=this.previews.get(preview);require(binding && binding.bytes===canonicalJson(preview),'PORTFOLIO_PREVIEW_UNBOUND_OR_MUTATED');
    const current=this.assess(preview,binding.base);
    require(canonicalJson(current)===canonicalJson({projectionBytes:preview.projectionBytes,researchToken:preview.researchToken,blockers:preview.blockers}) && !current.blockers.length,'PORTFOLIO_AUTHORITY_CHANGED_OR_BLOCKED');
    const next=structuredClone(binding.base);if(preview.kind==='link')next.links.push(preview.value);else if(preview.kind==='target')next.targets.push(preview.value);else next.reviews.push(preview.value);
    validatePortfolioData(next,this.owners.scope);this.guard.write(next,binding.base);this.bases.set(next,canonicalJson(next));this.previews.delete(preview);return next;
  }
  exportRaw() { require(this.storage,'PORTFOLIO_STORAGE_UNAVAILABLE');return this.storage.getItem(PORTFOLIO_STORAGE_KEY)??canonicalJson(empty(this.owners.scope)); }
}
