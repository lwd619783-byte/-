import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { contracts } from './fixtures.mjs';
import { account, asset, transaction, cashFlow, position, dcaPlan, execution, candidate, bundle, commitRequest, operator, approval, money, legacy, evidence, reason, context, now } from './asset-fixtures.mjs';

test('prepare dispatches every candidate payload through its formal V1 schema, including duplicates', t => {
  const { imports, ledger } = context(t);
  const plan = imports.prepare(bundle([candidate({ ...transaction(), unexpected: true })]));
  assert.equal(plan.items[0].decision, 'blocked');
  assert(plan.items[0].warnings.includes('CONTRACT_INVALID'));
  reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(plan), operator));
  assert.deepEqual(ledger.transactions(), []);
});
test('unresolved and conflicting Entity remain needs_resolution with no entity auto-create', t => {
  const { imports, entities } = context(t);
  const absent = imports.prepare(bundle([candidate(asset({ assetId: 'unresolved', instrumentId: 'unknown' }), 'asset')]));
  assert.equal(absent.items[0].decision, 'needs_resolution');
  const a = entities.create({ entityType: 'instrument', canonicalName: 'Ambiguous Fixture', aliases: [], status: 'active' });
  entities.create({ entityType: 'instrument', canonicalName: 'Ambiguous Fixture', aliases: [], status: 'active' });
  const before = entities.list();
  const conflict = imports.prepare(bundle([candidate(asset({ assetId: 'conflict', instrumentId: a.entityId }), 'asset')]));
  assert.equal(conflict.items[0].decision, 'needs_resolution');
  assert(conflict.items[0].warnings.includes('ENTITY_CONFLICTED'));
  assert.deepEqual(entities.list(), before);
});
test('A-002 expressible reconciliation: amount mismatch and missing approval cannot write', t => {
  const { imports, ledger } = context(t);
  const bad = imports.prepare(bundle([candidate(transaction({ grossAmount: money(999) }))]));
  assert.equal(bad.items[0].decision, 'warn'); assert.equal(bad.status, 'needs_review');
  reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(bad), operator));
  const good = imports.prepare(bundle());
  const noApproval = commitRequest(good); delete noApproval.userApprovalRef;
  reason('CONTRACT_INVALID', () => imports.commit(noApproval, operator));
  reason('APPROVAL_REQUIRED', () => imports.commit(commitRequest(good, { userApprovalRef: ' ' }), operator));
  assert.deepEqual(ledger.transactions(), []);
  // Account-total evidence has no field in frozen AssetImportBundle. Preserve
  // that gap rather than accepting an undocumented second business shape.
  reason('CONTRACT_INVALID', () => imports.prepare(bundle([candidate()], { accountTotal: money(999) })));
});
test('declared external contribution excludes transfer and compares currency/amount, retaining delta', t => {
  const { imports } = context(t);
  const plan = imports.prepare(bundle([candidate(cashFlow(), 'cash_flow')], { declaredExternalContribution: money(101) }));
  assert.equal(plan.status, 'needs_review'); assert.equal(plan.items[0].decision, 'warn');
  assert.deepEqual(plan.items[0].reconciliationDelta, money(-1));
  const currency = imports.prepare(bundle([candidate(cashFlow(), 'cash_flow')], { declaredExternalContribution: money(100, 'USD') }));
  assert.equal(currency.status, 'needs_review');
});
test('new screenshot financial candidates cannot bypass the unresolved account-total contract boundary', t => {
  const { imports, ledger } = context(t);
  const screenshot = { refType: 'screenshot', refId: 'synthetic-screenshot', quality: 'verified' };
  const plan = imports.prepare(bundle([candidate(transaction({ source: 'confirmed_screenshot', sourceEvidenceRef: screenshot }))], { sourceType: 'chatgpt_screenshot_parse', sourceEvidenceRefs: ['synthetic-screenshot'] }));
  assert.equal(plan.items[0].decision, 'warn'); assert(plan.items[0].warnings.includes('ACCOUNT_TOTAL_CONTRACT_GAP'));
  reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(plan), operator));
  assert.deepEqual(ledger.transactions(), []);
});
test('plan is deterministic across repeated prepare, object key order and candidate input order; prepare is not official mutation', t => {
  const { imports, ledger, audit } = context(t);
  const candidates = [candidate(transaction(), 'transaction', { candidateId: 't' }), candidate(cashFlow(), 'cash_flow', { candidateId: 'c' })];
  const first = imports.prepare(bundle(candidates));
  assert.deepEqual(imports.prepare(bundle([...candidates].reverse())), first);
  const reversedKeys = Object.fromEntries(Object.entries(bundle(candidates)).reverse());
  assert.deepEqual(imports.prepare(reversedKeys), first);
  assert.equal(first.planDigest.length, 64);
  assert.deepEqual(ledger.transactions(), []); assert.deepEqual(ledger.cashFlows(), []);
  assert.equal(audit.listByRequest('fixture-import-commit').length, 0);
});
test('multi-record account -> asset -> transaction -> position atomic commit and exact retry', t => {
  const { imports, ledger, audit } = context(t, false);
  const plan = imports.prepare(bundle([
    candidate(position(), 'position_snapshot', { candidateId: 'p' }), candidate(transaction(), 'transaction', { candidateId: 't' }),
    candidate(asset(), 'asset', { candidateId: 'a' }), candidate(account(), 'account', { candidateId: 'c' }),
  ]));
  assert.equal(plan.status, 'ready');
  const request = commitRequest(plan), result = imports.commit(request, operator);
  assert.equal(result.recordIds.length, 4);
  assert.deepEqual(imports.commit(request, operator), result);
  assert.equal(ledger.transactions().length, 1); assert.equal(ledger.positions().length, 1);
  assert.equal(ledger.accounts().length, 1); assert.equal(ledger.assets().length, 1);
  assert.equal(audit.listByRequest(request.idempotencyKey).length, 1);
  assert.equal(imports.getPlan(plan.planId).status, 'committed');
});
test('A-003: duplicate fingerprint/evidence skips; changed content with same fingerprint blocks', t => {
  const { imports, ledger } = context(t);
  const first = imports.prepare(bundle([candidate(transaction(), 'transaction', { fingerprint: 'synthetic-screenshot-row', sourceEvidenceRefs: ['synthetic-screenshot'] })]));
  imports.commit(commitRequest(first), operator);
  const repeat = imports.prepare(bundle([candidate(transaction({ transactionId: 'different-id' }), 'transaction', { fingerprint: 'synthetic-screenshot-row' })], { importId: 'repeat-import' }));
  assert.equal(repeat.items[0].decision, 'skip_duplicate');
  assert.equal(imports.commit(commitRequest(repeat, { idempotencyKey: 'repeat-key' }), operator).recordIds.length, 0);
  const conflict = imports.prepare(bundle([candidate(transaction({ transactionId: 'conflict-id', tradeDate: '2026-08-15' }), 'transaction', { fingerprint: 'synthetic-screenshot-row' })], { importId: 'conflict-import' }));
  assert.equal(conflict.items[0].decision, 'blocked');
  const byEvidence = imports.prepare(bundle([candidate(transaction({ transactionId: 'evidence-repeat' }), 'transaction', { sourceEvidenceRefs: ['synthetic-screenshot'] })], { importId: 'evidence-import' }));
  assert.equal(byEvidence.items[0].decision, 'skip_duplicate'); assert.equal(ledger.transactions().length, 1);
});
test('one source containing different records preserves both; ambiguous same-day same-amount without evidence warns', t => {
  const { imports, ledger } = context(t);
  const plan = imports.prepare(bundle([
    candidate(transaction(), 'transaction', { candidateId: 'one' }), candidate(transaction({ transactionId: 'second', tradeDate: '2026-08-15' }), 'transaction', { candidateId: 'two' }),
  ], { sourceEvidenceRefs: ['synthetic-shared-document'] }));
  assert.equal(plan.status, 'ready'); imports.commit(commitRequest(plan), operator);
  assert.equal(ledger.transactions().length, 2);
  const ambiguous = imports.prepare(bundle([candidate(transaction({ transactionId: 'third' }))], { importId: 'ambiguous-import' }));
  assert.equal(ambiguous.items[0].decision, 'warn');
});
test('planId/digest/key/approval are all checked; stale ledger or Entity changes reject', t => {
  const { imports, service, ledger, entities } = context(t);
  const plan = imports.prepare(bundle());
  reason('RECORD_NOT_FOUND', () => imports.commit(commitRequest(plan, { planId: 'missing' }), operator));
  reason('IMPORT_PLAN_STALE', () => imports.commit(commitRequest(plan, { planDigest: 'changed' }), operator));
  reason('APPROVAL_REQUIRED', () => imports.commit(commitRequest(plan, { idempotencyKey: ' ' }), operator));
  entities.create({ entityType: 'instrument', canonicalName: 'New Fixture', aliases: [], status: 'active' });
  reason('IMPORT_PLAN_STALE', () => imports.commit(commitRequest(plan), operator));
  const refresh = imports.prepare(bundle());
  service.createCashFlows([cashFlow()], approval('new-ledger-state'));
  reason('IMPORT_PLAN_STALE', () => imports.commit(commitRequest(refresh), operator));
  assert.deepEqual(ledger.transactions(), []);
});
test('changed bundle produces changed digest; idempotency key cannot be rebound to another plan', t => {
  const { imports } = context(t);
  const first = imports.prepare(bundle()); imports.commit(commitRequest(first), operator);
  const second = imports.prepare(bundle([candidate(transaction({ transactionId: 'second', tradeDate: '2026-08-15' }))], { importId: 'second-import' }));
  assert.notEqual(first.planDigest, second.planDigest);
  reason('IDEMPOTENCY_CONFLICT', () => imports.commit(commitRequest(second), operator));
});
test('Audit failure during import rolls back every mutation and allows safe retry', t => {
  const store = context(t, false);
  const plan = store.imports.prepare(bundle([candidate(account(), 'account', { candidateId: 'a' }), candidate(asset(), 'asset', { candidateId: 'b' }), candidate(transaction(), 'transaction', { candidateId: 'c' })]));
  const broken = { ...store.database, transaction: work => store.database.transaction(r => work({ ...r, audit: { ...r.audit, append: () => r.audit.append({ invalid: true }) } })) };
  const imports = new AssetImportService(broken, contracts, now);
  reason('CONTRACT_INVALID', () => imports.commit(commitRequest(plan), operator));
  assert.deepEqual(store.ledger.accounts(), []); assert.deepEqual(store.ledger.assets(), []); assert.deepEqual(store.ledger.transactions(), []);
  assert.equal(store.ledger.operation('fixture-import-commit'), undefined); assert.equal(store.ledger.fingerprint('import:fixture-import'), undefined);
  store.imports.commit(commitRequest(plan), operator); assert.equal(store.ledger.transactions().length, 1);
});
test('later repository failure rolls back earlier ledger records, Audit, receipt and fingerprints', t => {
  const store = context(t, false);
  const plan = store.imports.prepare(bundle([candidate(account(), 'account', { candidateId: 'a' }), candidate(asset(), 'asset', { candidateId: 'b' }), candidate(transaction(), 'transaction', { candidateId: 'c' })]));
  const broken = { ...store.database, transaction: work => store.database.transaction(r => work({ ...r, ledger: { ...r.ledger, appendTransaction: (v, k) => { r.ledger.appendTransaction(v, k); throw new Error('Synthetic late storage failure'); } } })) };
  const imports = new AssetImportService(broken, contracts, now);
  reason('TRANSACTION_ROLLED_BACK', () => imports.commit(commitRequest(plan), operator));
  assert.deepEqual(store.ledger.accounts(), []); assert.deepEqual(store.ledger.assets(), []); assert.deepEqual(store.ledger.transactions(), []);
  assert.equal(store.audit.listByRequest('fixture-import-commit').length, 0);
  assert.equal(store.ledger.operation('fixture-import-commit'), undefined); assert.equal(store.ledger.fingerprint('import:fixture-import'), undefined);
});
test('warning candidates and mismatching snapshots cannot be forced through import approval', t => {
  const { imports, ledger } = context(t);
  for (const b of [bundle([candidate(transaction(), 'transaction', { warnings: ['synthetic unresolved source'] })]), bundle([candidate(transaction({ reconciliationStatus: 'candidate' }))]), bundle([candidate(position({ quantity: 999 }), 'position_snapshot')])]) {
    const plan = imports.prepare(b); assert.notEqual(plan.status, 'ready');
    reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(plan), operator));
  }
  assert.deepEqual(ledger.transactions(), []); assert.deepEqual(ledger.positions(), []);
});
test('internal transfer import commits only a balanced pair, not an external contribution', t => {
  const { imports, service, ledger } = context(t);
  service.createAccount(account({ accountId: 'second' }), approval('second'));
  const values = [candidate(cashFlow({ cashFlowId: 'out', type: 'internal_transfer', pairedTransferId: 'pair', amount: money(-100) }), 'cash_flow', { candidateId: 'out' }), candidate(cashFlow({ cashFlowId: 'in', type: 'internal_transfer', pairedTransferId: 'pair', accountId: 'second', amount: money(100) }), 'cash_flow', { candidateId: 'in' })];
  assert.equal(imports.prepare(bundle([values[0]])).status, 'needs_review');
  const plan = imports.prepare(bundle(values, { declaredExternalContribution: money(0) }));
  assert.equal(plan.status, 'ready'); imports.commit(commitRequest(plan), operator);
  assert.equal(ledger.cashFlows().length, 2); assert.deepEqual(service.externalContributions(), []);
});
test('A-001 supported baseline: legacy prepare/read has no official effects, confirmed commit retains provenance', t => {
  const { imports, ledger, audit } = context(t);
  const b = bundle([candidate(transaction({ source: 'legacy_import', sourceEvidenceRef: evidence }))], { sourceType: 'file_import' });
  const plan = imports.prepareLegacy(legacy(), b);
  assert.equal(plan.status, 'ready'); assert.deepEqual(ledger.transactions(), []);
  assert.deepEqual(imports.getPlan(plan.planId), plan);
  const request = commitRequest(plan); imports.commit(request, operator);
  assert.equal(ledger.transactions()[0].source, 'legacy_import');
  assert.equal(audit.listByRequest(request.idempotencyKey)[0].event.operation, 'legacy_asset_import.commit');
  assert.equal(ledger.importPlan(plan.planId).legacy.baselineDate, '2026-08-14');
});
test('legacy baseline/count/provenance invariants reject; earlier data cannot be inferred or mislabelled', t => {
  const { imports, ledger } = context(t);
  const b = bundle([candidate(transaction({ source: 'legacy_import', sourceEvidenceRef: evidence }))], { sourceType: 'file_import' });
  reason('LEDGER_INVALID', () => imports.prepareLegacy(legacy({ baselineDate: '2026-08-13' }), b));
  reason('LEDGER_INVALID', () => imports.prepareLegacy(legacy({ candidateCounts: { ...legacy().candidateCounts, transactions: 2 } }), b));
  const earlier = bundle([candidate(transaction({ source: 'legacy_import', tradeDate: '2026-08-13' }))], { sourceType: 'file_import' });
  const unknown = imports.prepareLegacy(legacy({ sourceRefs: [] }), earlier);
  assert.equal(unknown.items[0].decision, 'warn');
  const verified = imports.prepareLegacy(legacy(), earlier);
  assert.equal(verified.items[0].decision, 'blocked'); assert(verified.items[0].warnings.includes('CONTRACT_GAP'));
  reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(verified), operator));
  assert.deepEqual(ledger.transactions(), []);
});

for (const period of ['Synthetic historical cycle', '2026-08-14', '2026-09-01']) test(`legacy undated DCA rejects without guessing period: ${period}`, t => {
  const { service, imports, ledger, audit } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  for (const ids of [undefined, []]) {
    const value = execution({ period });
    if (ids === undefined) delete value.transactionIds; else value.transactionIds = ids;
    const metadata = legacy({ candidateCounts: { ...legacy().candidateCounts, transactions: 0, dcaExecutions: 1 } });
    const plan = imports.prepareLegacy(metadata, bundle([candidate(value, 'dca_execution')], { sourceType: 'file_import' }));
    assert.equal(plan.status, 'blocked'); assert(plan.items[0].warnings.includes('CONTRACT_GAP'));
    reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(plan), operator));
  }
  assert.deepEqual(ledger.dcaExecutions(), []); assert.deepEqual(audit.listByRequest('fixture-import-commit'), []);
});
test('legacy dated DCA at baseline remains legal without a netAmount assumption', t => {
  const { service, imports, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const trade = transaction({ source: 'legacy_import', sourceEvidenceRef: evidence }); delete trade.netAmount;
  const value = execution({ executedAmount: money(137) });
  const plan = imports.prepareLegacy(legacy({ candidateCounts: { ...legacy().candidateCounts, dcaExecutions: 1 } }), bundle([
    candidate(value, 'dca_execution', { candidateId: 'execution' }), candidate(trade, 'transaction', { candidateId: 'trade' }),
  ], { sourceType: 'file_import' }));
  assert.equal(plan.status, 'ready'); imports.commit(commitRequest(plan), operator);
  assert.equal(ledger.transactions()[0].tradeDate, '2026-08-14');
  assert.equal(ledger.dcaExecutions()[0].execution.executedAmount.amount, 137);
});
test('legacy DCA cannot turn unresolved transaction IDs into temporal evidence', t => {
  const { service, imports, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const metadata = legacy({ candidateCounts: { ...legacy().candidateCounts, transactions: 0, dcaExecutions: 1 } });
  const plan = imports.prepareLegacy(metadata, bundle([candidate(execution({ transactionIds: ['unknown'] }), 'dca_execution')], { sourceType: 'file_import' }));
  assert.equal(plan.items[0].decision, 'needs_resolution');
  reason('IMPORT_NOT_READY', () => imports.commit(commitRequest(plan), operator));
  assert.deepEqual(ledger.dcaExecutions(), []);
});
