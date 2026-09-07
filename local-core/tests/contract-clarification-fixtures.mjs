// Entirely synthetic contract fixtures; no ledger service or persistence setup.
export const money = (amount = 20, currency = 'CNY') => ({ amount, currency });
export const evidence = { refType: 'document', refId: 'synthetic-archive', quality: 'verified' };
export const candidateCounts = { accounts: 0, assets: 0, transactions: 1, cashFlows: 0, positions: 0, dcaExecutions: 0 };
export const legacyV1Fixtures = [
  { schemaVersion: 'account.v1', accountId: 'synthetic-account', accountType: 'fund', name: 'Synthetic Account', baseCurrency: 'CNY', status: 'active' },
  { schemaVersion: 'asset.v1', assetId: 'synthetic-asset', assetType: 'fund', name: 'Synthetic Asset', primaryCategory: 'synthetic-category', tags: [], displayOrder: 0 },
  { schemaVersion: 'transaction.v1', transactionId: 'synthetic-transaction', accountId: 'synthetic-account', assetId: 'synthetic-asset', tradeDate: '2026-08-14', side: 'subscribe', grossAmount: money(), source: 'legacy_import', sourceEvidenceRef: evidence, reconciliationStatus: 'confirmed' },
  { schemaVersion: 'cash-flow.v1', cashFlowId: 'synthetic-cash-flow', accountId: 'synthetic-account', date: '2026-08-14', type: 'external_contribution', amount: money(), sourceEvidenceRef: evidence },
  { schemaVersion: 'position-snapshot.v1', snapshotId: 'synthetic-snapshot', snapshotDate: '2026-08-14', accountId: 'synthetic-account', assetId: 'synthetic-asset', quantity: 2, marketValue: money(), source: 'legacy_import' },
  { schemaVersion: 'dca-plan.v1', planId: 'synthetic-plan', name: 'Synthetic Plan', assetId: 'synthetic-asset', frequency: 'custom', status: 'active', activeFrom: '2026-08-14', constraints: [{ constraintType: 'synthetic-constraint', effectiveFrom: '2026-08-14', effectiveTo: '2026-09-01', value: 20 }] },
  { schemaVersion: 'dca-execution.v1', executionId: 'synthetic-execution', planId: 'synthetic-plan', period: 'Synthetic cycle', plannedAmount: money(), executedAmount: money(13), pendingAmount: money(7), status: 'partial' },
  { schemaVersion: 'legacy-asset-import.v1', importId: 'synthetic-import', sourceType: 'manual_archive', baselineDate: '2026-08-14', status: 'prepared', candidateCounts },
  { schemaVersion: 'asset-import-bundle.v1', importId: 'synthetic-import', asOf: '2026-09-01T00:00:00Z', sourceType: 'file_import', candidates: [{ candidateId: 'synthetic-candidate', candidateType: 'transaction', confidence: 1, payload: {} }] },
  { schemaVersion: 'asset-import-plan.v1', planId: 'synthetic-import-plan', importId: 'synthetic-import', planDigest: 'synthetic-digest', status: 'ready', items: [{ candidateId: 'synthetic-candidate', decision: 'pass', summary: 'Synthetic preview' }] },
  { schemaVersion: 'asset-import-commit-request.v1', planId: 'synthetic-import-plan', planDigest: 'synthetic-digest', idempotencyKey: 'synthetic-key', userApprovalRef: 'synthetic-approval' },
];
export const oldFixture = (version) => structuredClone(legacyV1Fixtures.find((fixture) => fixture.schemaVersion === version));
export const historicalFixture = (overrides = {}) => ({ schemaVersion: 'historical-asset-import.v1', importId: 'synthetic-import', sourceType: 'manual_archive', sourceRefs: [structuredClone(evidence)], baselineDate: '2026-08-14', status: 'prepared', candidateCounts: { ...candidateCounts }, ...overrides });
export const observationFixture = (overrides = {}) => ({ accountId: 'synthetic-account', snapshotDate: '2026-08-14', scope: 'full_account_snapshot', totalMarketValue: money(), sourceEvidenceRefs: ['synthetic-screenshot'], ...overrides });
export const reconciliationFixture = (overrides = {}) => ({ accountId: 'synthetic-account', snapshotDate: '2026-08-14', observedTotal: money(), candidatePositionTotal: money(), reconciliationDelta: money(0), status: 'pass', ...overrides });
