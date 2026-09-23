/** SYNTHETIC ONLY: no runtime imports; reuses the original F2/Claim/Thesis/Expression services. */
import { projectPortfolio } from '../../shared/portfolio.mjs';
import { expressionFixture } from './expression.fixture';
import { pinExpression, type ResearchLink, type PortfolioResearchOwners } from './portfolio';
import { claimTime as at } from './verifiedClaim.fixture';

export function portfolioFixtureProjection() {
  const receipt = { recordedAt: at(1), operationKey: 'synthetic', auditEventId: 'synthetic', payloadDigest: 'a'.repeat(64) };
  return projectPortfolio({ schemaVersion: 'portfolio-input.v1', scope: 'synthetic', accounts: [{ accountId: 'synthetic-account', name: '合成测试账户', receipt }], assets: ['a','b'].map(assetId => ({ assetId, name: `合成资产 ${assetId}`, assetType: 'fund', primaryCategory: '合成类别', strategyBucket: '合成策略', instrumentId: null, receipt })), snapshots: ['a','b'].map((assetId,i) => ({ snapshotId: assetId, snapshotDate: at(11).slice(0,10), accountId: 'synthetic-account', assetId, quantity: 10, marketValue: (i+1)*100, currency: 'CNY', receipt, warnings: [] })) }, at(12));
}
export async function portfolioFixture() {
  const f = await expressionFixture();
  const draft = f.repo.saveDraft(f.repo.load().data, f.expression);
  const formal = f.repo.confirm(f.repo.prepareConfirmation(draft, f.expression.revisionId), 'Synthetic expression confirmation', true);
  const projection = portfolioFixtureProjection(), p = projection.positions[0];
  const owners: PortfolioResearchOwners = { scope: 'synthetic', expressions() { const loaded = f.repo.load(); if (loaded.error) throw Error(loaded.error); return { data: loaded.data, owners: f.expressionOwners }; } };
  const link: ResearchLink = { linkId:p.positionId, positionId:p.positionId, accountId:p.accountId, assetId:p.assetId, revisionId:'synthetic-link-r1', supersedes:null, createdAt:at(12), asOf:at(12), approval:{ actor:'user', userApprovalRef:'synthetic-link-approval',note:'Synthetic approval' }, expression:pinExpression(formal.revisions[0],formal.confirmations[0]),rationale:'Synthetic user-selected research relationship; no instrument identity inference' };
  return { ...f, projection, owners, link };
}
