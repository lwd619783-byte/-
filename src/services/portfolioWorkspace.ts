import { validateProjection, type PortfolioProjection } from '../../shared/portfolio.mjs';
import { createThesisWorkspace, type ThesisWorkspaceDataset } from './thesisWorkspace';
import { createExpressionWorkspace } from './expressionWorkspace';
import type { StorageLike } from './watchlistRepository';
import type { PortfolioResearchOwners } from './portfolio';

export async function fetchPortfolio(asOf:string):Promise<PortfolioProjection> {
  if(!['localhost','127.0.0.1'].includes(window.location.hostname)) throw Error('PORTFOLIO_NOT_CONNECTED');
  const r=await fetch(`/__local/portfolio?asOf=${encodeURIComponent(asOf)}`,{headers:{'X-Portfolio-Read':'1'},cache:'no-store',redirect:'error',credentials:'omit'});
  if(!r.ok) {
    const payload:unknown=await r.json().catch(()=>null);
    const code=payload && typeof payload==='object' && 'error' in payload?payload.error:null;
    throw Error(typeof code==='string' && ['PORTFOLIO_NOT_CONNECTED','PORTFOLIO_LOCAL_READ_BLOCKED','PORTFOLIO_READ_DENIED','PORTFOLIO_ASOF_INVALID'].includes(code)?code:'PORTFOLIO_READ_BLOCKED');
  }
  const p=validateProjection(await r.json());
  if(p.scope!=='real' || p.asOf!==asOf) throw Error('PORTFOLIO_SCOPE_OR_ASOF_MISMATCH');return p;
}
export async function createPortfolioResearch(dataset:ThesisWorkspaceDataset,storage:StorageLike|null) {
  const thesis=await createThesisWorkspace(dataset,storage),expression=createExpressionWorkspace(thesis,dataset.stocks,storage);
  const owners:PortfolioResearchOwners={scope:'real',expressions(){const loaded=expression.repository.load();if(loaded.error)throw Error(loaded.error);return {data:loaded.data,owners:expression.owners};}};
  return {owners,evidence:thesis.evidence};
}
