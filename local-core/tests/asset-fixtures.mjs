import assert from 'node:assert/strict';
import { AssetService } from '../../.local-core-build/domain/asset-service.js';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { contracts, memoryStore } from './fixtures.mjs';

export const now = () => '2026-09-07T12:00:00Z';
export const money = (amount = 100, currency = 'CNY') => ({ amount, currency });
export const approval = (key = 'fixture-operation') => ({ userApprovalRef: 'fixture-approval', idempotencyKey: key, actor: 'fixture-user', client: 'fixture-cli' });
export const account = (overrides = {}) => ({ schemaVersion: 'account.v1', accountId: 'fixture-account', accountType: 'fund', name: 'Synthetic Long-term Account', baseCurrency: 'CNY', status: 'active', ...overrides });
export const asset = (overrides = {}) => ({ schemaVersion: 'asset.v1', assetId: 'fixture-asset', assetType: 'physical_gold', name: 'Synthetic Gold', primaryCategory: '纯黄金', tags: ['防御', '通胀'], displayOrder: 2, ...overrides });
export const transaction = (overrides = {}) => ({ schemaVersion: 'transaction.v1', transactionId: 'fixture-transaction', accountId: 'fixture-account', assetId: 'fixture-asset', tradeDate: '2026-08-14', side: 'buy', quantity: 10, price: money(10), grossAmount: money(100), fees: money(1), netAmount: money(101), source: 'manual', reconciliationStatus: 'confirmed', ...overrides });
export const cashFlow = (overrides = {}) => ({ schemaVersion: 'cash-flow.v1', cashFlowId: 'fixture-cashflow', accountId: 'fixture-account', date: '2026-08-14', type: 'external_contribution', amount: money(), ...overrides });
export const position = (overrides = {}) => ({ schemaVersion: 'position-snapshot.v1', snapshotId: 'fixture-position', snapshotDate: '2026-08-14', accountId: 'fixture-account', assetId: 'fixture-asset', quantity: 10, marketValue: money(), source: 'manual', ...overrides });
export const dcaPlan = (overrides = {}) => ({ schemaVersion: 'dca-plan.v1', planId: 'fixture-dca', name: 'Synthetic Weekly Plan', assetId: 'fixture-asset', frequency: 'weekly', plannedAmount: money(200), status: 'active', activeFrom: '2026-08-14', constraints: [{ constraintType: 'purchase_limit', value: 100, effectiveFrom: '2026-08-14', source: 'synthetic-rule' }], ...overrides });
export const execution = (overrides = {}) => ({ schemaVersion: 'dca-execution.v1', executionId: 'fixture-execution', planId: 'fixture-dca', period: 'Synthetic cycle one', plannedAmount: money(200), executedAmount: money(101), pendingAmount: money(99), status: 'partial', transactionIds: ['fixture-transaction'], ...overrides });
export const candidate = (payload = transaction(), type = 'transaction', overrides = {}) => ({ candidateId: 'fixture-candidate', candidateType: type, confidence: 1, payload, ...overrides });
export const bundle = (candidates = [candidate()], overrides = {}) => ({ schemaVersion: 'asset-import-bundle.v1', importId: 'fixture-import', asOf: now(), sourceType: 'manual_entry', candidates, ...overrides });
export const commitRequest = (plan, overrides = {}) => ({ schemaVersion: 'asset-import-commit-request.v1', planId: plan.planId, planDigest: plan.planDigest, idempotencyKey: 'fixture-import-commit', userApprovalRef: 'fixture-import-approval', ...overrides });
export const operator = { actor: 'fixture-user', client: 'fixture-cli' };
export const evidence = { refType: 'document', refId: 'fixture-legacy-document', quality: 'verified' };
export const legacy = (overrides = {}) => ({ schemaVersion: 'legacy-asset-import.v1', importId: 'fixture-import', sourceType: 'manual_archive', baselineDate: '2026-08-14', status: 'prepared', candidateCounts: { accounts: 0, assets: 0, transactions: 1, cashFlows: 0, positions: 0, dcaExecutions: 0 }, sourceRefs: [evidence], ...overrides });
export function reason(code, work) { assert.throws(work, e => e?.name === 'LocalCoreError' && (e.reasonCode ?? e.code) === code); }
export function context(t, seeded = true) {
  const store = memoryStore(t);
  const service = new AssetService(store.database, contracts, now);
  const imports = new AssetImportService(store.database, contracts, now);
  if (seeded) { service.createAccount(account(), approval('seed-account')); service.createAsset(asset(), approval('seed-asset')); }
  return { ...store, service, imports };
}
