import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AssetService } from '../../.local-core-build/domain/asset-service.js';
import { amountsEqual, amountSum } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts } from './fixtures.mjs';
import { account, asset, transaction, cashFlow, position, dcaPlan, execution, money, approval, reason, context, now } from './asset-fixtures.mjs';

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
test('DCA undated execution after revision explicitly rejects contract gap', t => {
  const { service, ledger } = context(t);
  service.saveDcaPlan(dcaPlan(), 0, approval('dca'));
  service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [] }), 1, approval('revision'));
  const undated = execution({ status: 'completed', executedAmount: money(200), pendingAmount: money(0), transactionIds: [] });
  reason('CONTRACT_GAP', () => service.commitDcaExecution(undated, approval('execution')));
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
  const actual = execution({ status: 'completed', executedAmount: money(200), pendingAmount: money(0), transactionIds: [] });
  reason('APPROVAL_REQUIRED', () => service.commitDcaExecution(actual, { ...approval(), userApprovalRef: '' }));
  reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, executedAmount: money(0) }, approval()));
  reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, status: 'planned' }, approval()));
  for (const key of ['plannedAmount', 'executedAmount', 'pendingAmount']) reason('LEDGER_INVALID', () => service.commitDcaExecution({ ...actual, [key]: money(-1) }, approval()));
  service.commitDcaExecution(actual, approval('confirmed-actual'));
  assert.equal(ledger.dcaExecutions()[0].execution.status, 'completed');
  assert.deepEqual(ledger.transactions(), []); assert.deepEqual(ledger.cashFlows(), []);
});
