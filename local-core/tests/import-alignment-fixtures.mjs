import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { digest } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts } from './fixtures.mjs';
import { context, now, transaction, candidate, bundle, legacy, position, money, approval, commitRequest, operator } from './asset-fixtures.mjs';

// Source-owner assertions are separate from bundle input; mutating a candidate
// never changes this evidence. All content and attestations are synthetic.
export function trustFixture() {
  const sources = new Map(), approvals = new Map();
  const trust = { resolveEvidence: id => sources.get(id), resolveApproval: id => approvals.get(id) };
  function attest(refId, assertions, overrides = {}) {
    const content = JSON.stringify(assertions);
    const source = { refId, refType: 'document', content, assertions: structuredClone(assertions),
      verification: { status: 'verified', version: 'synthetic-verification-1', contentDigest: digest(content), assertionsDigest: digest(assertions) }, ...overrides };
    sources.set(refId, source); return source;
  }
  function approve(plan, operation = 'historical_asset_import.commit', overrides = {}) {
    const request = commitRequest(plan, overrides);
    approvals.set(request.userApprovalRef, { userApprovalRef: request.userApprovalRef, operation, planId: plan.planId, planDigest: plan.planDigest, ...operator });
    return request;
  }
  return { sources, approvals, trust, attest, approve };
}
export function historicalContext(t) {
  const store = context(t), trust = trustFixture();
  const imports = new AssetImportService(store.database, contracts, now, trust.trust);
  const metadata = { ...structuredClone(legacy()), schemaVersion: 'historical-asset-import.v1' };
  const c = candidate(transaction({ tradeDate: '2026-08-13', source: 'legacy_import', sourceEvidenceRef: metadata.sourceRefs[0] }), 'transaction', { sourceEvidenceRefs: [metadata.sourceRefs[0].refId] });
  const b = bundle([c], { sourceType: 'file_import' });
  const source = trust.attest(metadata.sourceRefs[0].refId, { candidates: [c], accountSnapshots: [] });
  return { ...store, ...trust, imports, metadata, b, source };
}
export function accountContext(t, amounts = [100], observed = amounts[0]) {
  const store = context(t), trust = trustFixture();
  store.service.createTransaction(transaction(), approval('quantity-evidence'));
  const imports = new AssetImportService(store.database, contracts, now, trust.trust);
  const p = position({ marketValue: money(amounts[0]), source: 'confirmed_screenshot' });
  const c = candidate(p, 'position_snapshot', { sourceEvidenceRefs: ['snapshot-evidence'] });
  const observation = { accountId: p.accountId, snapshotDate: p.snapshotDate, scope: 'full_account_snapshot', totalMarketValue: money(observed), sourceEvidenceRefs: ['snapshot-evidence'] };
  const b = bundle([c], { sourceType: 'chatgpt_screenshot_parse', sourceEvidenceRefs: ['snapshot-evidence'], accountValueObservations: [observation] });
  const source = trust.attest('snapshot-evidence', { candidates: [c], accountSnapshots: [{ observation, positions: [p], complete: true }] }, { refType: 'screenshot' });
  return { ...store, ...trust, imports, b, source, observation };
}
