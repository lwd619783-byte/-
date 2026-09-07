import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetService } from '../../.local-core-build/domain/asset-service.js';
import { readAssetState, validateExecution } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts } from './fixtures.mjs';
import { context, dcaPlan, execution, transaction, money, approval, reason } from './asset-fixtures.mjs';

function temporal(t, first = {}) {
  const s = context(t);
  s.service.saveDcaPlan(dcaPlan(first), 0, approval('old-plan'));
  s.service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [] }), 1, approval('new-plan'));
  s.service = new AssetService(s.database, contracts, () => '2026-09-20T12:00:00Z');
  return s;
}
function unlinked(overrides = {}) { return execution({ transactionIds: [], periodStart: '2026-08-14', periodEnd: '2026-08-20', ...overrides }); }
for (const [dates, expected] of [[['2026-08-14'], 1], [['2026-08-14', '2026-09-07'], 1], [['2026-09-08'], 2], [['2026-09-08', '2026-09-09'], 2]]) test(`A-005 linked dates ${dates.join(',')} select revision ${expected}`, t => {
  const s = temporal(t, { activeTo: '2026-09-15' });
  const ids = dates.map((date, i) => { const id = `trade-${i}`; s.service.createTransaction(transaction({ transactionId: id, tradeDate: date }), approval(id)); return id; });
  s.service.commitDcaExecution(execution({ transactionIds: ids, executedAmount: money(137) }), approval('execution'));
  assert.equal(s.ledger.dcaExecutions()[0].planRevision, expected);
  assert.equal(s.ledger.dcaExecutions()[0].execution.executedAmount.amount, 137);
});
test('all linked dates must lie in the explicit period, while untraded period portions do not choose revision', t => {
  const s = temporal(t); s.service.createTransaction(transaction({ tradeDate: '2026-09-08' }), approval('trade'));
  s.service.commitDcaExecution(execution({ periodStart: '2026-08-01', periodEnd: '2026-09-15', period: 'arbitrary' }), approval('execution'));
  assert.equal(s.ledger.dcaExecutions()[0].planRevision, 2);
});
for (const problem of ['cross-revision', 'unknown', 'unknown-with-valid', 'explicit-period-conflict']) test(`DCA linked ${problem} fails without fallback`, t => {
  const s = temporal(t); s.service.createTransaction(transaction(), approval('old-trade'));
  s.service.createTransaction(transaction({ transactionId: 'new', tradeDate: '2026-09-08' }), approval('new-trade'));
  const e = execution({ periodStart: '2026-08-14', periodEnd: '2026-09-09' });
  if (problem === 'cross-revision') e.transactionIds.push('new');
  if (problem === 'unknown') e.transactionIds = ['unknown'];
  if (problem === 'unknown-with-valid') e.transactionIds.push('unknown');
  if (problem === 'explicit-period-conflict') { e.transactionIds.push('new'); e.periodEnd = '2026-09-07'; }
  reason(problem.startsWith('unknown') ? 'RECORD_NOT_FOUND' : 'RECONCILIATION_REQUIRED', () => s.service.commitDcaExecution(e, approval('execution')));
  assert.deepEqual(s.ledger.dcaExecutions(), []); assert.deepEqual(s.audit.listByRequest('execution'), []);
});
for (const tradeDate of [undefined, '', '2026-02-30', 'not-a-date']) test(`DCA rejects unusable linked tradeDate ${tradeDate}`, t => {
  const s = temporal(t), state = readAssetState(s.ledger); state.transactions.push(transaction({ tradeDate }));
  reason('RECONCILIATION_REQUIRED', () => validateExecution(execution({ periodStart: '2026-08-14', periodEnd: '2026-08-20' }), state));
});
for (const [start, end, revision] of [['2026-08-14', '2026-09-07', 1], ['2026-09-08', '2026-09-08', 2], ['2026-09-08', '2026-09-15', 2]]) test(`unlinked inclusive period ${start}/${end} selects ${revision}`, t => {
  const s = temporal(t); const e = unlinked({ periodStart: start, periodEnd: end });
  s.service.commitDcaExecution(e, approval('execution'));
  assert.deepEqual(s.ledger.dcaExecutions()[0], { execution: e, planRevision: revision });
});
for (const problem of ['missing', 'empty-ids', 'one-sided', 'reverse', 'cross-boundary', 'gap', 'pre-baseline']) test(`unlinked temporal ${problem} fails closed`, t => {
  const s = temporal(t, problem === 'gap' ? { activeTo: '2026-08-20' } : {}), e = unlinked();
  if (problem === 'missing' || problem === 'empty-ids') { delete e.periodStart; delete e.periodEnd; if (problem === 'missing') delete e.transactionIds; }
  if (problem === 'one-sided') delete e.periodEnd;
  if (problem === 'reverse') e.periodStart = '2026-08-21';
  if (problem === 'cross-boundary') e.periodEnd = '2026-09-08';
  if (problem === 'gap') { e.periodStart = '2026-08-20'; e.periodEnd = '2026-08-21'; }
  if (problem === 'pre-baseline') e.periodStart = '2026-08-13';
  assert.throws(() => s.service.commitDcaExecution(e, approval('execution')));
  assert.deepEqual(s.ledger.dcaExecutions(), []);
});
test('activeTo is inclusive and the following day is a gap until next activeFrom', t => {
  const s = temporal(t, { activeTo: '2026-08-20' });
  s.service.commitDcaExecution(unlinked({ periodStart: '2026-08-20', periodEnd: '2026-08-20' }), approval('inclusive'));
  reason('RECONCILIATION_REQUIRED', () => s.service.commitDcaExecution(unlinked({ executionId: 'gap', periodStart: '2026-08-21', periodEnd: '2026-08-21' }), approval('gap')));
});
for (const problem of ['same-activeFrom', 'reverse-order', 'same-revision', 'missing-revision', 'invalid-activeTo', 'invalid-date']) test(`ambiguous revision history ${problem} fails closed`, t => {
  const s = temporal(t), state = readAssetState(s.ledger);
  if (problem === 'same-activeFrom') state.revisions[1].plan.activeFrom = state.revisions[0].plan.activeFrom;
  if (problem === 'reverse-order') state.revisions[1].plan.activeFrom = '2026-08-01';
  if (problem === 'same-revision') state.revisions[1].revision = 1;
  if (problem === 'missing-revision') state.revisions[1].revision = 3;
  if (problem === 'invalid-activeTo') state.revisions[0].plan.activeTo = '2026-08-01';
  if (problem === 'invalid-date') state.revisions[0].plan.activeFrom = '2026-02-30';
  reason('RECONCILIATION_REQUIRED', () => validateExecution(unlinked(), state));
});
for (const period of ['2026-W36', '第36周', '9月第一周', 'Synthetic cycle', '2026-09-08']) test(`display-only period never parsed: ${period}`, t => {
  const s = context(t); s.service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const old = execution({ period, transactionIds: [] }); contracts.validate('dca-execution.v1', old);
  reason('RECONCILIATION_REQUIRED', () => s.service.commitDcaExecution(old, approval('undated')));
  const dated = { ...old, periodStart: '2026-08-14', periodEnd: '2026-08-20' };
  s.service.commitDcaExecution(dated, approval('dated')); assert.equal(s.ledger.dcaExecutions()[0].planRevision, 1);
});
test('revision cannot invalidate a previously committed unlinked explicit interval', t => {
  const s = context(t); s.service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  s.service.commitDcaExecution(unlinked({ periodEnd: '2026-09-10', status: 'planned', executedAmount: money(0) }), approval('planned'));
  reason('LEDGER_INVALID', () => s.service.saveDcaPlan(dcaPlan({ activeFrom: '2026-09-08', constraints: [] }), 1, approval('revision')));
  assert.equal(s.ledger.dcaRevisions().length, 1);
});
