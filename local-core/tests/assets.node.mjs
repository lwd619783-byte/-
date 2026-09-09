import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AssetService } from '../../.local-core-build/domain/asset-service.js';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { amountsEqual, amountSum, readAssetState, validateExecution } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts, tempDirectory } from './fixtures.mjs';
import { account, asset, transaction, cashFlow, position, dcaPlan, execution, money, approval, reason, context, now, candidate, bundle, commitRequest, operator } from './asset-fixtures.mjs';

test('A-008: every frozen account/asset enum persists, including future non-securities', t => {
  const { service, ledger } = context(t, false);
  const defs = JSON.parse(readFileSync('contracts/v1/research-asset-os.contracts.v1.schema.json')).$defs;
  for (const type of defs.Account.properties.accountType.enum) service.createAccount(account({ accountId: type, accountType: type }), approval(`account-${type}`));
  for (const type of defs.Asset.properties.assetType.enum) service.createAsset(asset({ assetId: type, assetType: type }), approval(`asset-${type}`));
  assert.equal(ledger.accounts().length, 8); assert.equal(ledger.assets().length, 10);
  assert.equal(ledger.createAccount, undefined); assert.equal(ledger.db, undefined);
});
test('Account/Asset schema required fields, enum, unique tags and stable identity are enforced', t => {
  const { service, ledger } = context(t);
  for (const value of [account({ accountType: 'invented' }), Object.fromEntries(Object.entries(account()).filter(([k]) => k !== 'name'))]) reason('CONTRACT_INVALID', () => service.createAccount(value, approval()));
  reason('CONTRACT_INVALID', () => service.createAsset(asset({ tags: ['same', 'same'] }), approval()));
  reason('LEDGER_INVALID', () => service.createAccount(account({ name: 'overwrite' }), approval()));
  assert.equal(ledger.accounts()[0].name, account().name);
});
test('A-007: gold ETF, gold equity ETF, tags, ordering and provider identifiers stay separate', t => {
  const { service, entities, ledger } = context(t, false);
  const entry = entities.create({ entityType: 'instrument', canonicalName: 'Synthetic Gold ETF', aliases: [], status: 'active', providerIdentifiers: { fixture: 'raw-provider-classification-unchanged' } });
  const gold = asset({ assetId: 'gold-etf', assetType: 'etf', instrumentId: entry.entityId, userOverrides: { note: 'synthetic classification' } });
  const equities = asset({ assetId: 'gold-equities-etf', assetType: 'etf', primaryCategory: '行业网格', tags: ['黄金', '资源'], displayOrder: 1 });
  service.createAsset(gold, approval('gold')); service.createAsset(equities, approval('equities'));
  assert.deepEqual(ledger.assets(), [equities, gold]);
  assert.deepEqual(entities.get(entry.entityId).providerIdentifiers, entry.providerIdentifiers);
});
test('invalid, inactive and conflicting instrument identity fails closed', t => {
  const { service, entities } = context(t);
  reason('ENTITY_NOT_FOUND', () => service.createAsset(asset({ assetId: 'missing', instrumentId: 'no-entity' }), approval()));
  const e = entities.create({ entityType: 'instrument', canonicalName: 'Collision', aliases: [], status: 'candidate' });
  reason('ENTITY_NEEDS_CONFIRMATION', () => service.createAsset(asset({ assetId: 'candidate', instrumentId: e.entityId }), approval()));
  const active = entities.create({ entityType: 'instrument', canonicalName: 'Collision', aliases: [], status: 'active' });
  entities.create({ entityType: 'instrument', canonicalName: 'Collision', aliases: [], status: 'active' });
  reason('ENTITY_CONFLICTED', () => service.createAsset(asset({ assetId: 'conflict', instrumentId: active.entityId }), approval()));
});
test('buy/sell use nonnegative absolute values; quantities and monetary reconciliation are exact', t => {
  const { service, ledger } = context(t);
  service.createTransaction(transaction(), approval('buy'));
  service.createTransaction(transaction({ transactionId: 'sell', side: 'sell', netAmount: money(99) }), approval('sell'));
  assert(ledger.transactions().every(v => v.quantity === 10 && v.grossAmount.amount === 100));
  assert(amountsEqual([0.1, 0.2], [0.3])); assert.equal(amountSum([0.1, 0.2]), 0.3);
  assert(amountsEqual([1e-7, 2e-7], [3e-7]));
});
for (const field of ['quantity', 'price', 'grossAmount', 'fees', 'netAmount']) test(`negative Transaction ${field} rejects without write`, t => {
  const { service, ledger } = context(t);
  reason('LEDGER_INVALID', () => service.createTransaction(transaction({ [field]: field === 'quantity' ? -1 : money(-1) }), approval()));
  assert.deepEqual(ledger.transactions(), []);
});
test('A-006: missing actual values, candidate/warning/proposal/future transactions cannot enter ledger', t => {
  const { service, ledger } = context(t);
  for (const reconciliationStatus of ['candidate', 'warning', 'unreconciled']) reason('LEDGER_INVALID', () => service.createTransaction(transaction({ reconciliationStatus }), approval()));
  reason('CONTRACT_INVALID', () => service.createTransaction(transaction({ schemaVersion: 'allocation-proposal.v1' }), approval()));
  reason('LEDGER_INVALID', () => service.createTransaction(transaction({ tradeDate: '2099-01-01' }), approval()));
  const absent = transaction(); delete absent.quantity; delete absent.grossAmount; delete absent.netAmount;
  reason('CONTRACT_INVALID', () => service.createTransaction(absent, approval()));
  assert.deepEqual(ledger.transactions(), []);
});
test('manual confirmed operation retains approval and audit; exact retry works and key reuse fails', t => {
  const { service, ledger, audit } = context(t);
  const result = service.createTransaction(transaction(), approval());
  assert.deepEqual(service.createTransaction(transaction(), approval()), result);
  assert.equal(ledger.transactions().length, 1);
  const receipt = ledger.operation(approval().idempotencyKey);
  assert.equal(receipt.confirmation.userApprovalRef, approval().userApprovalRef);
  assert.equal(audit.get(receipt.auditEventId).event.scope, approval().userApprovalRef);
  reason('IDEMPOTENCY_CONFLICT', () => service.createTransaction(transaction({ quantity: 20 }), approval()));
  reason('APPROVAL_REQUIRED', () => service.createTransaction(transaction(), { ...approval(), userApprovalRef: ' ' }));
});
test('multi-table transaction and audit rollback, including caught nested audit failure', t => {
  const store = context(t);
  const broken = { ...store.database, transaction: work => store.database.transaction(r => work({ ...r, audit: { ...r.audit, append: () => r.audit.append({ invalid: true }) } })) };
  const service = new AssetService(broken, contracts, now);
  reason('CONTRACT_INVALID', () => service.createTransaction(transaction(), approval()));
  assert.deepEqual(store.ledger.transactions(), []); assert.equal(store.ledger.operation(approval().idempotencyKey), undefined);
  assert.equal(store.audit.listByRequest(approval().idempotencyKey).length, 0);
  reason('CONTRACT_INVALID', () => store.database.transaction(r => {
    store.service.createTransaction(transaction(), approval());
    try { r.audit.append({ invalid: true }); } catch { /* must still poison transaction */ }
  }));
  assert.deepEqual(store.ledger.transactions(), []);
});
test('repository writes require an audited receipt, expire, and expose no raw DB', t => {
  const store = context(t); let saved;
  reason('APPROVAL_REQUIRED', () => store.database.transaction(r => r.ledger.appendTransaction(transaction(), 'unapproved')));
  store.database.transaction(r => { saved = r.ledger; assert.equal(r.ledger.db, undefined); assert.equal(r.ledger.execute, undefined); });
  reason('TRANSACTION_ROLLED_BACK', () => saved.accounts());
  assert.deepEqual(store.ledger.transactions(), []);
  store.service.createTransaction(transaction(), approval('bound-payload'));
  reason('APPROVAL_REQUIRED', () => store.database.transaction(r => r.ledger.appendTransaction(transaction({ transactionId: 'changed-id' }), 'bound-payload')));
  reason('APPROVAL_REQUIRED', () => store.database.transaction(r => r.ledger.appendTransaction(transaction({ quantity: 11 }), 'bound-payload')));
  reason('APPROVAL_REQUIRED', () => store.database.transaction(r => r.ledger.appendCashFlow(cashFlow({ cashFlowId: 'fixture-transaction' }), 'bound-payload')));
});
test('CashFlow direction: contribution/dividend/salary positive, withdrawal/fee/premium negative', t => {
  const { service, ledger } = context(t);
  for (const [type, sign] of [['external_contribution', 1], ['dividend', 1], ['salary', 1], ['interest', 1], ['external_withdrawal', -1], ['fee', -1], ['insurance_premium', -1]]) {
    service.createCashFlows([cashFlow({ cashFlowId: type, type, amount: money(sign * 10) })], approval(type));
    reason('LEDGER_INVALID', () => service.createCashFlows([cashFlow({ cashFlowId: `bad-${type}`, type, amount: money(-sign) })], approval(`bad-${type}`)));
  }
  assert.equal(ledger.cashFlows().length, 7);
});
test('A-004: internal transfer is two atomic paired cash flows, fee separate, no external contribution', t => {
  const { service, ledger } = context(t);
  service.createAccount(account({ accountId: 'second', accountType: 'bank' }), approval('second'));
  const out = cashFlow({ cashFlowId: 'out', type: 'internal_transfer', pairedTransferId: 'pair', amount: money(-100) });
  const incoming = cashFlow({ cashFlowId: 'in', accountId: 'second', type: 'internal_transfer', pairedTransferId: 'pair', amount: money(100) });
  service.createCashFlows([out, incoming, cashFlow({ cashFlowId: 'fee', type: 'fee', amount: money(-1) })], approval('transfer'));
  assert.deepEqual(service.externalContributions(), []);
  assert.equal(amountSum(ledger.cashFlows().filter(v => v.type === 'internal_transfer').map(v => v.amount.amount)), 0);
  service.createCashFlows([cashFlow()], approval('external'));
  assert.deepEqual(service.externalContributions(), [money(100)]);
});
for (const problem of ['missing', 'currency', 'amount', 'same-account', 'third-leg']) test(`broken transfer ${problem} fails atomically`, t => {
  const { service, ledger } = context(t);
  service.createAccount(account({ accountId: 'second' }), approval('second'));
  const values = [cashFlow({ cashFlowId: 'out', type: 'internal_transfer', pairedTransferId: 'pair', amount: money(-100) }), cashFlow({ cashFlowId: 'in', accountId: 'second', type: 'internal_transfer', pairedTransferId: 'pair', amount: money(100) })];
  if (problem === 'missing') values.pop();
  if (problem === 'currency') values[1].amount.currency = 'USD';
  if (problem === 'amount') values[1].amount.amount = 99;
  if (problem === 'same-account') values[1].accountId = 'fixture-account';
  if (problem === 'third-leg') values.push({ ...values[1], cashFlowId: 'third' });
  reason('RECONCILIATION_REQUIRED', () => service.createCashFlows(values, approval()));
  assert.deepEqual(ledger.cashFlows(), []);
});
test('Position long-only, read and reconciliation warning preserve transaction history', t => {
  const { service, ledger } = context(t);
  reason('LEDGER_INVALID', () => service.createPosition(position({ quantity: -1 }), approval()));
  const missing = service.createPosition(position(), approval('missing-quantity'));
  assert.deepEqual(missing.warnings, ['POSITION_LEDGER_QUANTITY_UNAVAILABLE']);
  service.createTransaction(transaction(), approval('buy'));
  assert.deepEqual(service.reconcilePosition('fixture-position'), []);
  const before = ledger.transactions();
  const mismatch = service.createPosition(position({ snapshotId: 'mismatch', quantity: 11 }), approval('mismatch'));
  assert.deepEqual(mismatch.warnings, ['POSITION_LEDGER_MISMATCH']);
  assert.deepEqual(ledger.transactions(), before);
});
test('DCA binding, negative values, constraint time and original history are enforced', t => {
  const { service, ledger } = context(t);
  const unbound = dcaPlan(); delete unbound.assetId;
  reason('LEDGER_INVALID', () => service.saveDcaPlan(unbound, 0, approval()));
  service.saveDcaPlan({ ...unbound, primaryCategory: '纯黄金' }, 0, approval('category'));
  reason('LEDGER_INVALID', () => service.saveDcaPlan(dcaPlan({ planId: 'bad', plannedAmount: money(-1) }), 0, approval()));
  reason('CONTRACT_INVALID', () => service.saveDcaPlan(dcaPlan({ constraints: [{ constraintType: 'limit' }] }), 1, approval()));
  assert.equal(ledger.dcaRevisions().length, 1);
});
test('A-005 supported path: future revision pins dated execution, preserves old cycle and pending cash separation', t => {
  const store = context(t), { service, ledger } = store;
  service.saveDcaPlan(dcaPlan(), 0, approval('dca'));
  service.createTransaction(transaction(), approval('trade'));
  service.commitDcaExecution(execution(), approval('cycle-one'));
  const old = ledger.dcaExecutions();
  const revised = dcaPlan({ activeFrom: '2026-09-08', constraints: [{ constraintType: 'purchase_limit', value: 200, effectiveFrom: '2026-09-08' }] });
  service.saveDcaPlan(revised, 1, approval('revision'));
  const later = new AssetService(store.database, contracts, () => '2026-09-09T12:00:00Z');
  later.createTransaction(transaction({ transactionId: 'later-trade', tradeDate: '2026-09-09', quantity: 20, grossAmount: money(200), fees: money(0), netAmount: money(200) }), approval('later-trade'));
  later.commitDcaExecution(execution({ executionId: 'later-cycle', period: 'Synthetic cycle two', executedAmount: money(200), pendingAmount: money(99), rolloverFromExecutionId: 'fixture-execution', transactionIds: ['later-trade'] }), approval('later-cycle'));
  assert.deepEqual(ledger.dcaExecutions().find(v => v.execution.executionId === 'fixture-execution'), old[0]);
  assert.equal(ledger.dcaExecutions().find(v => v.execution.executionId === 'later-cycle').planRevision, 2);
  assert.deepEqual(service.externalContributions(), []); assert.deepEqual(ledger.cashFlows(), []);
  reason('LEDGER_INVALID', () => service.saveDcaPlan(dcaPlan({ activeFrom: '2026-08-20' }), 2, approval('backdate')));
});
test('DCA undated execution after revision requires explicit dates', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('dca'));
  service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [] }), 1, approval('revision'));
  const undated = execution({ status: 'completed', executedAmount: money(200), pendingAmount: money(0), transactionIds: [] });
  reason('RECONCILIATION_REQUIRED', () => service.commitDcaExecution(undated, approval('execution')));
  assert.deepEqual(ledger.dcaExecutions(), []);
});
test('revision retains unchanged historical constraints but rejects retroactive constraint edits', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('initial'));
  reason('LEDGER_INVALID', () => service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [{ ...dcaPlan().constraints[0], value: 999 }] }), 1, approval('retroactive')));
  service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08' }), 1, approval('unchanged-constraint'));
  assert.deepEqual(ledger.dcaRevisions()[0].plan, dcaPlan());
  assert.deepEqual(ledger.dcaRevisions()[1].plan.constraints, dcaPlan().constraints);
});
test('cashflow and DCA plan writes also reject missing approval before an official mutation', t => {
  const { service, ledger } = context(t);
  const missing = { ...approval(), userApprovalRef: '' };
  reason('APPROVAL_REQUIRED', () => service.createCashFlows([cashFlow()], missing));
  reason('APPROVAL_REQUIRED', () => service.saveDcaPlan(dcaPlan(), 0, missing));
  assert.deepEqual(ledger.cashFlows(), []); assert.deepEqual(ledger.dcaRevisions(), []);
});
test('DCA unconfirmed/nonactual completion rejects; confirmed actual subscription can complete without creating a Transaction', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('dca'));
  const actual = execution({ status: 'completed', executedAmount: money(200), pendingAmount: money(0), transactionIds: [], periodStart: '2026-08-14', periodEnd: '2026-08-20' });
  reason('APPROVAL_REQUIRED', () => service.commitDcaExecution(actual, { ...approval(), userApprovalRef: '' }));
  reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, executedAmount: money(0) }, approval()));
  reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, status: 'planned' }, approval()));
  for (const key of ['plannedAmount', 'executedAmount', 'pendingAmount']) reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, [key]: money(-1) }, approval()));
  service.commitDcaExecution(actual, approval('confirmed-actual'));
  assert.equal(ledger.dcaExecutions()[0].execution.status, 'completed');
  assert.deepEqual(ledger.transactions(), []); assert.deepEqual(ledger.cashFlows(), []);
});

for (const kind of ['transaction', 'cashflow', 'manual-position', 'calculated-position']) test(`CB-1: direct ${kind} before baseline rejects without official effects`, t => {
  const { service, ledger, audit } = context(t);
  const c = approval('pre-baseline');
  reason('CONTRACT_GAP', () => {
    if (kind === 'transaction') return service.createTransaction(transaction({ tradeDate: '2026-08-13' }), c);
    if (kind === 'cashflow') return service.createCashFlows([cashFlow({ date: '2026-08-13' })], c);
    return service.createPosition(position({ snapshotDate: '2026-08-13', source: kind === 'manual-position' ? 'manual' : 'calculated' }), c);
  });
  assert.deepEqual(ledger.transactions(), []); assert.deepEqual(ledger.cashFlows(), []); assert.deepEqual(ledger.positions(), []);
  assert.equal(ledger.operation(c.idempotencyKey), undefined); assert.deepEqual(audit.listByRequest(c.idempotencyKey), []);
});
test('baseline-day direct facts remain legal, including manual and calculated positions', t => {
  const { service, ledger } = context(t);
  service.createTransaction(transaction(), approval('baseline-trade'));
  service.createCashFlows([cashFlow()], approval('baseline-flow'));
  for (const source of ['manual', 'calculated']) service.createPosition(position({ snapshotId: source, source }), approval(source));
  assert.equal(ledger.transactions()[0].tradeDate, '2026-08-14');
  assert.equal(ledger.cashFlows()[0].date, '2026-08-14');
  assert(ledger.positions().every(v => v.snapshotDate === '2026-08-14'));
});
test('one pre-baseline cash flow prevents the entire mixed-date batch from committing', t => {
  const { service, ledger, audit } = context(t);
  reason('CONTRACT_GAP', () => service.createCashFlows([cashFlow(), cashFlow({ cashFlowId: 'early', date: '2026-08-13' })], approval()));
  assert.deepEqual(ledger.cashFlows(), []); assert.deepEqual(audit.listByRequest(approval().idempotencyKey), []);
});
for (const source of ['confirmed_screenshot', 'legacy_import']) test(`direct Position ${source} requires import workflow`, t => {
  const { service, ledger } = context(t);
  reason('LEDGER_INVALID', () => service.createPosition(position({ source }), approval()));
  assert.deepEqual(ledger.positions(), []); assert.equal(ledger.operation(approval().idempotencyKey), undefined);
});
for (const source of ['confirmed_screenshot', 'legacy_import', 'provider_import']) test(`direct Transaction ${source} remains prohibited`, t => {
  const { service, ledger } = context(t);
  reason('LEDGER_INVALID', () => service.createTransaction(transaction({ source }), approval()));
  assert.deepEqual(ledger.transactions(), []);
});
for (const shape of ['quantity-only', 'gross-only', 'quantity-gross', 'with-net']) test(`DCA accepts ${shape} links without inventing an executedAmount equation`, t => {
  const { service, ledger, audit } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const trade = transaction();
  if (shape !== 'with-net') delete trade.netAmount;
  if (shape === 'quantity-only') for (const key of ['price', 'grossAmount', 'fees']) delete trade[key];
  if (shape === 'gross-only') for (const key of ['quantity', 'price', 'fees']) delete trade[key];
  service.createTransaction(trade, approval('trade'));
  const actual = execution({ executedAmount: money(137), pendingAmount: money(0), status: 'completed' });
  const receipt = service.commitDcaExecution(actual, approval('actual'));
  assert.deepEqual(service.commitDcaExecution(actual, approval('actual')), receipt);
  assert.equal(ledger.dcaExecutions()[0].execution.executedAmount.amount, 137);
  assert.deepEqual(ledger.transactions()[0], trade);
  assert.equal(audit.listByRequest('actual').length, 1);
});
for (const problem of ['asset', 'category', 'direction', 'revision', 'missing-link', 'duplicate-link']) test(`DCA still rejects wrong ${problem}`, t => {
  const { service, ledger } = context(t);
  const plan = dcaPlan();
  const trade = transaction();
  const actual = execution();
  if (problem === 'asset') { service.createAsset(asset({ assetId: 'other' }), approval('other')); trade.assetId = 'other'; }
  if (problem === 'category') { delete plan.assetId; plan.primaryCategory = 'Unmatched synthetic category'; }
  if (problem === 'direction') { trade.side = 'sell'; trade.netAmount = money(99); }
  if (problem === 'revision') plan.activeFrom = '2026-08-15';
  if (problem === 'missing-link') actual.transactionIds = ['missing'];
  if (problem === 'duplicate-link') actual.transactionIds.push(actual.transactionIds[0]);
  service.saveDcaPlan(plan, 0, approval('plan')); service.createTransaction(trade, approval('trade'));
  const code = problem === 'missing-link' ? 'RECORD_NOT_FOUND' : problem === 'duplicate-link' ? 'LEDGER_INVALID' : 'RECONCILIATION_REQUIRED';
  reason(code, () => service.commitDcaExecution(actual, approval('actual')));
  assert.deepEqual(ledger.dcaExecutions(), []);
});
test('a transaction cannot be reused by a second DCA execution', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan')); service.createTransaction(transaction(), approval('trade'));
  service.commitDcaExecution(execution(), approval('first'));
  reason('LEDGER_INVALID', () => service.commitDcaExecution(execution({ executionId: 'second', period: 'Other cycle' }), approval('second')));
  assert.equal(ledger.dcaExecutions().length, 1);
});
test('DCA cannot use an existing pre-baseline transaction to evade the historical boundary', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const state = readAssetState(ledger);
  state.transactions.push(transaction({ tradeDate: '2026-08-13' })); // synthetic old-state fixture; never written to DB
  reason('CONTRACT_GAP', () => validateExecution(execution(), state));
});
test('DCA links across revisions still reject and date-looking period cannot bypass CB-3', t => {
  const store = context(t), { service, ledger } = store;
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  service.createTransaction(transaction(), approval('old-trade'));
  service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [] }), 1, approval('revision'));
  const later = new AssetService(store.database, contracts, () => '2026-09-09T12:00:00Z');
  later.createTransaction(transaction({ transactionId: 'new-trade', tradeDate: '2026-09-09' }), approval('new-trade'));
  reason('RECONCILIATION_REQUIRED', () => later.commitDcaExecution(execution({ transactionIds: ['fixture-transaction', 'new-trade'] }), approval('cross-revision')));
  reason('RECONCILIATION_REQUIRED', () => later.commitDcaExecution(execution({ transactionIds: [], period: '2026-09-09' }), approval('undated')));
  assert.deepEqual(ledger.dcaExecutions(), []);
});

// MA-03 uses a fixed operator clock and disposable on-disk SQLite, never a
// user database. Date-only facts may be recorded through the current UTC day.
function futureFactContext(t) {
  let store;
  t.after(() => store?.database.close());
  const filename = path.join(tempDirectory(t), 'future-facts.sqlite');
  store = openLocalDatabase({ filename, purpose: 'test', mode: 'initialize' }, contracts);
  const service = new AssetService(store.database, contracts, now);
  const imports = new AssetImportService(store.database, contracts, now);
  service.createAccount(account(), approval('seed-account'));
  service.createAsset(asset(), approval('seed-asset'));
  service.saveDcaPlan(dcaPlan(), 0, approval('seed-plan'));
  service.createTransaction(transaction(), approval('seed-transaction'));
  return { ...store, service, imports };
}
const futureDate = '2026-09-08'; // Fixed clock is 2026-09-07T12:00:00Z.
function futureExecution(status, overrides = {}) {
  return execution({ status, transactionIds: [], periodStart: futureDate, periodEnd: '2026-09-14',
    executedAmount: money(status === 'completed' || status === 'partial' ? 137 : 0),
    pendingAmount: money(status === 'completed' ? 0 : 63), ...overrides });
}
function assertNoFactMutation(store, key, work) {
  const before = readAssetState(store.ledger);
  work();
  assert.deepEqual(readAssetState(store.ledger), before);
  assert.equal(store.ledger.operation(key), undefined);
  assert.deepEqual(store.audit.listByRequest(key), []);
}
const futureRecords = [
  ['transaction', transaction({ transactionId: 'future-transaction', tradeDate: futureDate })],
  ['cash_flow', cashFlow({ date: futureDate })],
  ['position_snapshot', position({ snapshotDate: futureDate })],
];
for (const [type, value] of futureRecords) test(`MA-03: manual future ${type} is rejected without fact, receipt or audit`, t => {
  const s = futureFactContext(t), key = `future-${type}`;
  const write = type === 'transaction' ? () => s.service.createTransaction(value, approval(key))
    : type === 'cash_flow' ? () => s.service.createCashFlows([value], approval(key))
      : () => s.service.createPosition(value, approval(key));
  assertNoFactMutation(s, key, () => reason('LEDGER_INVALID', write));
});
test('MA-03: a future CashFlow rejects the whole otherwise valid batch', t => {
  const s = futureFactContext(t), key = 'future-cashflow-batch';
  assertNoFactMutation(s, key, () => reason('LEDGER_INVALID', () => s.service.createCashFlows([
    cashFlow({ cashFlowId: 'current-flow', date: '2026-09-07' }), cashFlow({ date: futureDate }),
  ], approval(key))));
});
for (const status of ['completed', 'partial']) test(`MA-03: fully future ${status} DCA is rejected without fact, receipt or audit`, t => {
  const s = futureFactContext(t), key = `future-${status}`;
  assertNoFactMutation(s, key, () => reason('LEDGER_INVALID', () => s.service.commitDcaExecution(futureExecution(status), approval(key))));
});
for (const [type, value] of [...futureRecords, ...['completed', 'partial'].map(status => ['dca_execution', futureExecution(status)])]) {
  test(`MA-03: import future ${type}/${value.status ?? 'fact'} cannot prepare ready or commit`, t => {
    const s = futureFactContext(t), key = 'future-import';
    assertNoFactMutation(s, key, () => {
      const plan = s.imports.prepare(bundle([candidate(value, type)]));
      assert.equal(plan.status, 'blocked');
      assert.deepEqual(plan.items[0].warnings, ['LEDGER_INVALID']);
      reason('IMPORT_NOT_READY', () => s.imports.commit(commitRequest(plan, { idempotencyKey: key }), operator));
    });
  });
}
test('MA-03: DCA actual imports bind to bundle observation date even when before the operator clock', t => {
  const s = futureFactContext(t), key = 'future-at-observation';
  assertNoFactMutation(s, key, () => {
    const value = futureExecution('partial', { periodStart: '2026-09-06', periodEnd: '2026-09-07' });
    const plan = s.imports.prepare(bundle([candidate(value, 'dca_execution')], { asOf: '2026-09-05T12:00:00Z' }));
    assert.equal(plan.status, 'blocked');
    assert.deepEqual(plan.items[0].warnings, ['LEDGER_INVALID']);
    reason('IMPORT_NOT_READY', () => s.imports.commit(commitRequest(plan, { idempotencyKey: key }), operator));
  });
});
test('MA-03: current-date Transaction, CashFlow and PositionSnapshot remain valid', t => {
  const s = futureFactContext(t), today = '2026-09-07';
  s.service.createTransaction(transaction({ transactionId: 'current-trade', tradeDate: today, settleDate: futureDate }), approval('current-trade'));
  s.service.createCashFlows([cashFlow({ date: today })], approval('current-flow'));
  s.service.createPosition(position({ snapshotDate: today, quantity: 20 }), approval('current-position'));
  assert.equal(s.ledger.transactions().length, 2);
  assert.equal(s.ledger.cashFlows().length, 1);
  assert.equal(s.ledger.positions().length, 1);
});
test('MA-03: future DCA plan and later revision retain legal plan semantics', t => {
  const s = futureFactContext(t), planId = 'future-plan';
  const plan = dcaPlan({ planId, activeFrom: futureDate, constraints: [{ constraintType: 'purchase_limit', value: 50, effectiveFrom: futureDate }] });
  s.service.saveDcaPlan(plan, 0, approval('future-plan'));
  s.service.saveDcaPlan({ ...plan, activeFrom: '2026-09-15', constraints: [] }, 1, approval('future-revision'));
  assert.deepEqual(s.ledger.dcaRevisions().filter(v => v.plan.planId === planId).map(v => v.revision), [1, 2]);
  assert.deepEqual(s.ledger.dcaExecutions(), []);
});
for (const status of ['planned', 'deferred', 'cancelled']) test(`MA-03: future ${status} DCA with no fill remains valid for manual and import writes`, t => {
  const s = futureFactContext(t);
  s.service.commitDcaExecution(futureExecution(status), approval('future-no-fill'));
  const value = futureExecution(status, { executionId: 'import-no-fill', period: 'Synthetic later cycle', periodStart: '2026-09-15', periodEnd: '2026-09-21' });
  const plan = s.imports.prepare(bundle([candidate(value, 'dca_execution')]));
  assert.equal(plan.status, 'ready');
  s.imports.commit(commitRequest(plan), operator);
  assert.equal(s.ledger.dcaExecutions().length, 2);
  assert.deepEqual(s.ledger.cashFlows(), []);
});
for (const status of ['completed', 'partial']) test(`MA-03: ${status} DCA uses actual linked tradeDate even when period extends into the future`, t => {
  const s = futureFactContext(t);
  const value = futureExecution(status, { transactionIds: ['fixture-transaction'], periodStart: '2026-08-14' });
  s.service.commitDcaExecution(value, approval('current-linked-fill'));
  assert.equal(s.ledger.dcaExecutions()[0].execution.executedAmount.amount, 137);
  assert.equal(s.ledger.dcaExecutions()[0].planRevision, 1);
});
