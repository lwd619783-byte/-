import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateDecisionSnapshot, type DecisionSnapshot } from '../../shared/decision-snapshot.mjs';
import { createThesisWorkspace, type ThesisWorkspaceDataset } from './thesisWorkspace';
import { createExpressionWorkspace, type ExpressionWorkspaceRuntime } from './expressionWorkspace';
import { buildDecisionSnapshot, decisionDigest } from './decisionSnapshot';
import { fetchPortfolio } from './portfolioWorkspace';
import type { PortfolioProjection } from '../../shared/portfolio.mjs';
import type { StorageLike } from './watchlistRepository';

type Status = { generation: number; status: string; endpoint: string; expiresAt: number };
export type DecisionPreview = { snapshot: DecisionSnapshot; digest: string; expectedGeneration: number };
export interface DecisionPublisher { prepare(secret: string): Promise<DecisionPreview>; publish(preview: DecisionPreview, secret: string, confirmed: boolean): Promise<void>; revoke(secret: string): Promise<void>; }
export async function domainRequest(action: string, secret: string, data?: unknown) {
  const response = await fetch(`/api/os-domain/${action}`, { method: data === undefined ? 'GET' : 'POST', cache: 'no-store', redirect: 'error', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Bridge-Owner-Secret': secret }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  if (!response.ok) throw Error('DOMAIN_REQUEST_REJECTED');
  return response.json();
}
function ownerToken(runtime: ExpressionWorkspaceRuntime) {
  const loads = [runtime.thesisRuntime.claimRepository.load(), runtime.thesisRuntime.repository.load(), runtime.repository.load()];
  if (loads.some(r => r.error)) throw Error('DECISION_OWNER_UNAVAILABLE');
  return canonicalJson(loads.map(r => r.data));
}
export function createDecisionPublisher(runtime: ExpressionWorkspaceRuntime, readPortfolio: (asOf: string) => Promise<PortfolioProjection> = fetchPortfolio, request = domainRequest, now = () => new Date()): DecisionPublisher {
  const previews = new WeakMap<DecisionPreview, { bytes: string; owners: string }>();
  async function portfolio(asOf: string) {
    try { return { projection: await readPortfolio(asOf), blocker: 'PORTFOLIO_NOT_CONNECTED' }; }
    catch (error) { const code = error instanceof Error ? error.message : ''; return { projection: null, blocker: ['PORTFOLIO_NOT_CONNECTED', 'PORTFOLIO_LOCAL_READ_BLOCKED', 'PORTFOLIO_READ_DENIED'].includes(code) ? code : 'PORTFOLIO_READ_BLOCKED' }; }
  }
  return {
    async prepare(secret) {
      const at = now(), token = ownerToken(runtime), p = await portfolio(at.toISOString());
      const snapshot = await buildDecisionSnapshot(runtime, p.projection, at, p.blocker);
      if (ownerToken(runtime) !== token) throw Error('DECISION_OWNER_CHANGED');
      const status = await request('status', secret) as Status;
      if (!Number.isSafeInteger(status.generation) || status.generation < 0) throw Error('DOMAIN_STATUS_INVALID');
      const preview = { snapshot, digest: await decisionDigest(snapshot), expectedGeneration: status.generation };
      previews.set(preview, { bytes: canonicalJson(preview), owners: token }); return preview;
    },
    async publish(preview, secret, confirmed) {
      const bound = previews.get(preview);
      if (!confirmed || !bound || bound.bytes !== canonicalJson(preview) || bound.owners !== ownerToken(runtime)) throw Error('DECISION_PREVIEW_CHANGED_OR_UNCONFIRMED');
      validateDecisionSnapshot(preview.snapshot);
      const p = await portfolio(preview.snapshot.asOf), fresh = await buildDecisionSnapshot(runtime, p.projection, new Date(preview.snapshot.asOf), p.blocker);
      fresh.snapshotId = preview.snapshot.snapshotId;
      if (canonicalJson(fresh) !== canonicalJson(preview.snapshot) || bound.owners !== ownerToken(runtime)) throw Error('DECISION_AUTHORITY_CHANGED');
      await request('publish', secret, { ...preview, consent: 'publish-current-decision-state' }); previews.delete(preview);
    },
    async revoke(secret) {
      const status = await request('status', secret) as Status;
      await request('revoke', secret, { expectedGeneration: status.generation });
    },
  };
}
export async function browserDecisionPublisher(dataset: ThesisWorkspaceDataset, storage: StorageLike | null) {
  const thesis = await createThesisWorkspace(dataset, storage);
  return createDecisionPublisher(createExpressionWorkspace(thesis, dataset.stocks, storage));
}
