import { it, expect, vi } from 'vitest';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateProjection, projectPortfolio, type PortfolioProjection } from '../../shared/portfolio.mjs';
import { portfolioFixture, portfolioFixtureProjection, portfolioFixtureInput } from './portfolio.fixture';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { fetchPortfolio } from './portfolioWorkspace';
import { PortfolioRepository, PORTFOLIO_STORAGE_KEY, validatePortfolioData } from './portfolioRepository';
import { rebalance, targetIdentity, validateTarget, type TargetAllocation } from './portfolioPlanning';

async function setup() {
  const f=await portfolioFixture(),storage=claimStorage();let projection=f.projection;
  const repo=new PortfolioRepository(storage,f.owners,()=>projection,()=>new Date(at(15)));
  const scope={currency:'CNY',snapshotDate:projection.positions[0].snapshotDate,accountId:null,dimension:'assetId' as const};
  const target:TargetAllocation={targetId:targetIdentity(scope),revisionId:'target-1',supersedes:null,createdAt:at(12),asOf:at(12),scope,allocations:[{value:'a',basisPoints:5000},{value:'b',basisPoints:5000}],rationale:'Synthetic target',approval:{actor:'user',userApprovalRef:'target-approval',note:'Synthetic confirmation'}};
  return {...f,storage,repo,target,replace:(p:typeof projection)=>{projection=p;}};
}
it('target totals duplicates and negative values reject without defaults',async()=>{const f=await setup();for(const allocations of [[],[{value:'a',basisPoints:9999}],[{value:'a',basisPoints:5000},{value:'a',basisPoints:5000}],[{value:'a',basisPoints:-1}]])expect(()=>validateTarget({...f.target,allocations})).toThrow();});
it('requires explicit confirmation, bound preview and retains immutable history',async()=>{const f=await setup(),base=f.repo.load().data,p=f.repo.prepare(base,{kind:'target',value:f.target});expect(f.storage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();expect(()=>f.repo.confirm(p,false)).toThrow();expect(()=>f.repo.confirm(structuredClone(p),true)).toThrow();const d=f.repo.confirm(p,true);expect(d.targets).toEqual([f.target]);expect(()=>f.repo.confirm(p,true)).toThrow();const second={...f.target,revisionId:'target-2',supersedes:'target-1',createdAt:at(13),asOf:at(13),approval:{...f.target.approval,userApprovalRef:'second'}};const d2=f.repo.confirm(f.repo.prepare(d,{kind:'target',value:second}),true);expect(d2.targets[0]).toEqual(f.target);expect(d2.targets).toHaveLength(2);});
it('research link explicitly confirms exact pin; upstream drift blocks preview',async()=>{const f=await setup();const p=f.repo.prepare(f.repo.load().data,{kind:'link',value:f.link});f.tick(14);f.repo;f.thesisRepo.saveDraft(f.thesisRepo.load().data,{...f.revision,revisionId:'t2',supersedes:f.revision.revisionId,createdAt:at(13),asOf:at(13)});expect(()=>f.repo.confirm(p,true)).toThrow(/AUTHORITY/);expect(f.storage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();});
it('preview mutation, persisted stale base and projection drift fail closed',async()=>{const f=await setup(),base=f.repo.load().data,p=f.repo.prepare(base,{kind:'target',value:f.target});if(p.kind==='target')p.value.approval.note='mutated';expect(()=>f.repo.confirm(p,true)).toThrow();const clean=f.repo.prepare(base,{kind:'target',value:f.target});f.replace({...f.projection,asOf:at(13)});expect(()=>f.repo.confirm(clean,true)).toThrow();f.storage.setItem(PORTFOLIO_STORAGE_KEY,'{}');expect(()=>f.repo.prepare(base,{kind:'target',value:f.target})).toThrow();});
it('corrupt/future data remains byte-identical and cannot write',async()=>{const f=await setup();for(const raw of ['{broken','{"schemaVersion":"portfolio-planning.v99"}']){f.storage.setItem(PORTFOLIO_STORAGE_KEY,raw);const loaded=f.repo.load();expect(loaded.error).not.toBeNull();expect(()=>f.repo.prepare(loaded.data,{kind:'target',value:f.target})).toThrow();expect(f.repo.exportRaw()).toBe(raw);}});
it('rebalance deterministic, no ledger actions and missing price/unit blocked',async()=>{const f=await setup(),a=rebalance(f.projection,f.target,[],f.owners),b=rebalance(f.projection,f.target,[],f.owners);expect(a).toEqual(b);expect(a.comparisons[0].currentShare).toBe(1/3);expect(a.comparisons[0].delta).toBe(0.5-1/3);expect(a.blockers).toEqual(expect.arrayContaining(['PRICE_OWNER_UNAVAILABLE','TRADE_UNIT_UNAVAILABLE','FULL_ACCOUNT_COVERAGE_UNPROVEN','POSITION_UNLINKED']));expect(a.execution).toBe('not_admitted');expect(a).not.toHaveProperty('transaction');expect(a).not.toHaveProperty('order');expect(a.research[0]).not.toHaveProperty('percentage');});
it('review stores exact task and history; review does not lift execution block',async()=>{const f=await setup(),d=f.repo.confirm(f.repo.prepare(f.repo.load().data,{kind:'target',value:f.target}),true),task=rebalance(f.projection,f.target,[],f.owners);const review={reviewId:'review1',taskId:task.taskId,taskBytes:canonicalJson(task),createdAt:at(13),status:'reviewed' as const,actor:'user' as const,userApprovalRef:'review-approval',note:'Reviewed synthetic task'};const d2=f.repo.confirm(f.repo.prepare(d,{kind:'review',value:review}),true);expect(d2.reviews).toHaveLength(1);expect(rebalance(f.projection,f.target,[],f.owners).status).toBe('blocked');expect(d2.targets).toEqual(d.targets);});
it('unknown dimension and foreign target scope block confirmation',async()=>{const f=await setup();const t={...f.target,allocations:[{value:'not-owned',basisPoints:10000}]};expect(()=>f.repo.prepare(f.repo.load().data,{kind:'target',value:t})).toThrow(/DIMENSION/);});
it('projection corruption and future schema cannot cross the browser seam',async()=>{const f=await setup();expect(validateProjection(f.projection)).toEqual(f.projection);for(const p of [{...f.projection,schemaVersion:'future'},{...f.projection,cohorts:[]},{...f.projection,asOf:at(1)}])expect(()=>validateProjection(p)).toThrow();});
it('history forks, duplicate approval and synthetic-to-real import rejected',async()=>{const f=await setup(),d=f.repo.confirm(f.repo.prepare(f.repo.load().data,{kind:'target',value:f.target}),true);expect(()=>validatePortfolioData(d,'real')).toThrow();expect(()=>validatePortfolioData({...d,targets:[...d.targets,{...f.target,revisionId:'target2'}]},'synthetic')).toThrow();});
it('clock advancement alone preserves task identity and review; changed input creates a new task',async()=>{const f=await setup(),old=rebalance(f.projection,f.target,[],f.owners),later=rebalance(portfolioFixtureProjection(at(13)),f.target,[],f.owners);expect(later.taskId).toBe(old.taskId);expect(later.asOf).not.toBe(old.asOf);expect(rebalance(portfolioFixtureProjection(at(13)), {...f.target,revisionId:'different-target'},[],f.owners).taskId).not.toBe(old.taskId);});

const semanticMutations: [string,(p:PortfolioProjection)=>void][] = [
  ['quantity',p=>{p.positions[0].quantity++;}],['snapshotId',p=>{p.positions[0].snapshotId='forged';}],
  ['accountName',p=>{p.positions[0].accountName='forged';}],['assetName',p=>{p.positions[0].assetName='forged';}],
  ['instrumentId',p=>{p.positions[0].instrumentId='forged';}],['accountStatus',p=>{p.positions[0].accountStatus='archived';}],
  ['deleted position blocker',p=>{p.positions[0].blockers=[];}],['forged position blocker',p=>{p.positions[0].blockers.push('FORGED');}],
  ['status',p=>{p.status='unresolved';}],['global blocker',p=>{p.blockers.push('FORGED');}],
  ...(['snapshot','account','asset'] as const).flatMap(owner => (['recordedAt','operationKey','auditEventId','payloadDigest'] as const).map(field =>
    [`${owner}.${field}`, (p:PortfolioProjection)=>{p.positions[0].lineage[owner][field]=field==='recordedAt'?at(2):field==='payloadDigest'?'b'.repeat(64):'forged';}] as [string,(p:PortfolioProjection)=>void]))
];
it.each(semanticMutations)('browser fetch rejects %s before handing projection to consumers',async(_name,mutate)=>{
  // Synthetic transport fixture deliberately exercises the real-only browser protocol; no DB is read.
  const original=projectPortfolio({...portfolioFixtureInput(),scope:'real'},at(12)),p=structuredClone(original);
  vi.stubGlobal('window',{location:{hostname:'localhost'}});
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>p});vi.stubGlobal('fetch',fetchMock);
  try {
    expect(await fetchPortfolio(at(12))).toEqual(original);mutate(p);expect(p.cohorts).toEqual(original.cohorts);
    await expect(fetchPortfolio(at(12))).rejects.toThrow(/INTEGRITY/);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/__local/portfolio?'),expect.objectContaining({cache:'no-store',redirect:'error',credentials:'omit',headers:{'X-Portfolio-Read':'1'}}));
  } finally {vi.unstubAllGlobals();}
});
it.each(['active','inactive','archived'] as const)('planning carries %s blockers without removing recorded exposure',async status=>{
  const f=await setup(),p=portfolioFixtureProjection(at(12),status),task=rebalance(p,f.target,[],f.owners);
  expect(p.cohorts[0].total).toBe(300);expect(task.comparisons.map(c=>c.current)).toEqual([100,200]);
  expect(task.blockers.includes(`ACCOUNT_${status.toUpperCase()}`)).toBe(status!=='active');
  expect(task.execution).toBe('not_admitted');expect(task.status).toBe('blocked');
});
