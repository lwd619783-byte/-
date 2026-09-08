import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { digest } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts } from './fixtures.mjs';
import { accountContext } from './import-alignment-fixtures.mjs';
import { asset, transaction, position, candidate, money, approval, commitRequest, operator, reason, now } from './asset-fixtures.mjs';

for (const [observed, delta] of [[100, 0], [99, 1], [101, -1]]) test(`A-002 exact account reconciliation delta ${delta}`, t => {
  const s = accountContext(t, [100], observed), p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert.deepEqual(r.candidatePositionTotal, money(100)); assert.deepEqual(r.reconciliationDelta, money(delta));
  assert.equal(r.status, delta === 0 ? 'pass' : 'warn'); assert.equal(p.status, delta === 0 ? 'ready' : 'needs_review');
  if (delta === 0) {
    assert.deepEqual(r.warnings, []); const request = s.approve(p, 'asset_import.commit'); s.imports.commit(request, operator); s.imports.commit(request, operator);
    assert.equal(s.ledger.positions().length, 1); assert.deepEqual(s.ledger.cashFlows(), []); assert.deepEqual(s.service.externalContributions(), []);
    assert.equal(s.audit.listByRequest(request.idempotencyKey).length, 1);
  } else reason('IMPORT_NOT_READY', () => s.imports.commit(s.approve(p, 'asset_import.commit'), operator));
});
for (const problem of ['incomplete', 'missing-cash', 'no-positions', 'unverified', 'unresolved', 'no-manifest', 'unproven-total', 'duplicate-observation', 'conflicting-observation', 'duplicate-asset', 'conflicting-position', 'currency', 'invalid-position', 'unknown-entity']) test(`account value fail closed: ${problem}`, t => {
  const s = accountContext(t);
  if (problem === 'incomplete') s.source.assertions.accountSnapshots[0].complete = false;
  if (problem === 'missing-cash') s.source.assertions.accountSnapshots[0].positions.push(position({ snapshotId: 'cash', assetId: 'cash', quantity: 1, marketValue: money(0), source: 'confirmed_screenshot' }));
  if (problem === 'no-positions') s.b.candidates = [candidate(asset(), 'asset')];
  if (problem === 'unverified') s.source.verification.status = 'pending';
  if (problem === 'unresolved') s.sources.clear();
  if (problem === 'no-manifest') s.source.assertions.accountSnapshots = [];
  if (problem === 'unproven-total') s.source.assertions.accountSnapshots[0].observation.totalMarketValue.amount = 999;
  if (problem === 'duplicate-observation' || problem === 'conflicting-observation') { const o = structuredClone(s.observation); if (problem === 'conflicting-observation') o.totalMarketValue.amount++; s.b.accountValueObservations.push(o); }
  if (problem === 'duplicate-asset' || problem === 'conflicting-position') { const c = structuredClone(s.b.candidates[0]); c.candidateId = 'duplicate'; c.payload.snapshotId = 'duplicate'; if (problem === 'conflicting-position') c.payload.marketValue.amount++; s.b.candidates.push(c); }
  if (problem === 'currency') s.b.candidates[0].payload.marketValue.currency = 'USD';
  if (problem === 'invalid-position') s.b.candidates[0].payload.extra = 'invalid';
  if (problem === 'unknown-entity') s.b.candidates[0].payload.assetId = 'unknown';
  s.source.content = JSON.stringify(s.source.assertions); s.source.verification.contentDigest = digest(s.source.content);
  s.source.verification.assertionsDigest = digest(s.source.assertions);
  const p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert.equal(r.status, 'warn'); assert(r.warnings.length); assert.notEqual(p.status, 'ready');
  assert.equal(r.candidatePositionTotal, undefined); assert.equal(r.reconciliationDelta, undefined);
  reason('IMPORT_NOT_READY', () => s.imports.commit(s.approve(p, 'asset_import.commit'), operator));
  assert.deepEqual(s.ledger.positions(), []); assert.deepEqual(s.ledger.cashFlows(), []);
});
test('no old-ledger fallback and no contribution substitution even with matching previous snapshots', t => {
  const s = accountContext(t); s.service.createPosition(position(), approval('old-snapshot'));
  s.b.candidates = [candidate(asset(), 'asset')]; s.b.declaredExternalContribution = money(100);
  const p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert(r.warnings.includes('NO_SAME_BUNDLE_POSITIONS')); assert.equal(r.candidatePositionTotal, undefined);
  assert(p.warnings.includes('DECLARED_EXTERNAL_CONTRIBUTION_MISMATCH')); assert.deepEqual(s.ledger.cashFlows(), []);
});
test('same-bundle duplicate of an existing valid ledger position can reconcile without another append', t => {
  const s = accountContext(t), p = s.imports.prepare(s.b); s.imports.commit(s.approve(p, 'asset_import.commit'), operator);
  s.b.importId = 'second-import'; const next = s.imports.prepare(s.b);
  assert.equal(next.items[0].decision, 'skip_duplicate'); assert.equal(next.accountValueReconciliations[0].status, 'pass');
  s.imports.commit(s.approve(next, 'asset_import.commit', { idempotencyKey: 'second-import' }), operator);
  assert.equal(s.ledger.positions().length, 1);
});
test('exact decimal sum accepts 0.1 + 0.2 and includes evidenced cash composition', t => {
  const s = accountContext(t, [0.1], 0.3);
  s.service.createAsset(asset({ assetId: 'cash', assetType: 'cash' }), approval('cash-identity'));
  s.service.createTransaction(transaction({ transactionId: 'cash-trade', assetId: 'cash' }), approval('cash-trade'));
  const cash = position({ snapshotId: 'cash', assetId: 'cash', marketValue: money(0.2), source: 'confirmed_screenshot' });
  s.b.candidates.push(candidate(cash, 'position_snapshot', { candidateId: 'cash' }));
  s.source.assertions.accountSnapshots[0].positions.push(cash); s.source.verification.assertionsDigest = digest(s.source.assertions);
  s.source.content = JSON.stringify(s.source.assertions); s.source.verification.contentDigest = digest(s.source.content);
  const p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert.equal(p.status, 'ready'); assert.deepEqual(r.candidatePositionTotal, money(0.3)); assert.deepEqual(r.reconciliationDelta, money(0));
  s.imports.commit(s.approve(p, 'asset_import.commit'), operator); assert.equal(s.ledger.positions().length, 2);
});
test('tiny nonzero decimal mismatch is never hidden by epsilon', t => {
  const s = accountContext(t, [0.30000000000000004], 0.3), p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert.equal(r.status, 'warn'); assert.equal(r.reconciliationDelta.amount, 4e-17);
  reason('IMPORT_NOT_READY', () => s.imports.commit(s.approve(p, 'asset_import.commit'), operator));
});
for (const change of ['observation', 'candidate', 'delete-candidate', 'evidence', 'verification']) test(`account ${change} changed after prepare cannot commit old plan`, t => {
  const s = accountContext(t), p = s.imports.prepare(s.b), request = s.approve(p, 'asset_import.commit');
  if (change === 'evidence') s.source.content += ' changed';
  else if (change === 'verification') s.source.verification.version = 'revised';
  else {
    if (change === 'observation') s.observation.totalMarketValue.amount++;
    if (change === 'candidate') s.b.candidates[0].payload.marketValue.amount++;
    if (change === 'delete-candidate') s.b.candidates = [candidate(asset(), 'asset')];
    const next = s.imports.prepare(s.b); assert.notEqual(next.planDigest, p.planDigest);
  }
  reason('IMPORT_PLAN_STALE', () => s.imports.commit(request, operator)); assert.deepEqual(s.ledger.positions(), []);
});
test('persisted account reconciliation output cannot be replaced while keeping its digest', t => {
  const s = accountContext(t), p = s.imports.prepare(s.b), request = s.approve(p, 'asset_import.commit');
  const modified = structuredClone(s.ledger.importPlan(p.planId)); modified.plan.accountValueReconciliations[0].observedTotal.amount++;
  const db = { ...s.database, transaction: work => s.database.transaction(r => work({ ...r, ledger: { ...r.ledger, importPlan: () => modified } })) };
  reason('IMPORT_PLAN_STALE', () => new AssetImportService(db, contracts, now, s.trust).commit(request, operator));
});
test('valid account-value plan still requires approval bound to this plan and operation', t => {
  const s = accountContext(t), p = s.imports.prepare(s.b);
  reason('APPROVAL_REQUIRED', () => s.imports.commit(commitRequest(p), operator));
  reason('APPROVAL_REQUIRED', () => s.imports.commit(s.approve(p, 'historical_asset_import.commit'), operator));
  assert.deepEqual(s.ledger.positions(), []);
});
test('verified completeness sidecar cannot replace unrelated source content', t => {
  const s = accountContext(t); s.source.content = JSON.stringify({ unrelated: 'document' }); s.source.verification.contentDigest = digest(s.source.content);
  const p = s.imports.prepare(s.b), r = p.accountValueReconciliations[0];
  assert.equal(r.status, 'warn'); assert.equal(r.candidatePositionTotal, undefined);
  reason('IMPORT_NOT_READY', () => s.imports.commit(s.approve(p, 'asset_import.commit'), operator));
});
test('candidate warning always propagates even when amounts and source manifest match', t => {
  const s = accountContext(t); s.b.candidates[0].warnings = ['unresolved-source-warning'];
  const p = s.imports.prepare(s.b); assert.equal(p.status, 'needs_review');
  reason('IMPORT_NOT_READY', () => s.imports.commit(s.approve(p, 'asset_import.commit'), operator));
});
