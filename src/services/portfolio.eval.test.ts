import { it,expect } from 'vitest';
import { projectPortfolio } from '../../shared/portfolio.mjs';
import { portfolioFixture } from './portfolio.fixture';
import { researchExposure } from './portfolio';
import { rebalance,targetIdentity,type TargetAllocation } from './portfolioPlanning';
import { claimTime as at } from './verifiedClaim.fixture';

// Independent frozen F3 denominator: capability only, never real Portfolio coverage.
it('F3-P01: same currency denominator reproduces frozen 100/300 and 200/300',async()=>{const f=await portfolioFixture();expect(f.projection.cohorts[0].total).toBe(300);expect(f.projection.cohorts[0].exposures.filter(e=>e.dimension==='assetId').map(e=>e.share)).toEqual([1/3,2/3]);});
it('F3-P02: exact original graph resolves and qualitative relationships have no weight',async()=>{const f=await portfolioFixture(),e=researchExposure(f.projection.positions[0],f.link,f.owners,at(12));expect(e.trace?.claims[0].ref).toEqual(f.ref);for(const r of e.relationships){expect(r).not.toHaveProperty('weight');expect(r).not.toHaveProperty('percentage');}});
it('F3-P03: all new planning preserves blocked execution and untouched projection',async()=>{const f=await portfolioFixture(),bytes=JSON.stringify(f.projection),scope={currency:'CNY',snapshotDate:f.projection.positions[0].snapshotDate,accountId:null,dimension:'assetId' as const};const t:TargetAllocation={targetId:targetIdentity(scope),revisionId:'f3-target',supersedes:null,asOf:at(12),createdAt:at(12),scope,allocations:[{value:'a',basisPoints:2500},{value:'b',basisPoints:7500}],rationale:'Frozen synthetic only',approval:{actor:'user',userApprovalRef:'f3',note:'Explicit fixture confirmation'}};const r=rebalance(f.projection,t,[f.link],f.owners);expect(r.comparisons.map(c=>c.targetShare)).toEqual([0.25,0.75]);expect(r.status).toBe('blocked');expect(JSON.stringify(f.projection)).toBe(bytes);});
it('F3-P04: missing ledger input cannot create zero-valued official holdings',()=>{const p=projectPortfolio({schemaVersion:'portfolio-input.v1',scope:'synthetic',accounts:[],assets:[],snapshots:[]},at(12));expect(p.positions).toEqual([]);expect(p.cohorts).toEqual([]);expect(p.status).toBe('unresolved');});
