import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { digest } from '../../.local-core-build/domain/asset-invariants.js';
import { contracts } from './fixtures.mjs';
import { historicalContext } from './import-alignment-fixtures.mjs';
import { account, asset, transaction, cashFlow, position, execution, dcaPlan, approval, candidate, commitRequest, operator, reason, now } from './asset-fixtures.mjs';

test('A-001 historical evidenced pre-baseline prepare/commit is atomic, idempotent and retains audited provenance', t => {
  const s = historicalContext(t), p = s.imports.prepareHistorical(s.metadata, s.b);
  assert.equal(p.status, 'ready'); assert.deepEqual(s.ledger.transactions(), []);
  const request = s.approve(p), result = s.imports.commitHistorical(request, operator);
  assert.deepEqual(s.imports.commitHistorical(request, operator), result);
  assert.equal(s.ledger.transactions().length, 1); assert.equal(s.audit.listByRequest(request.idempotencyKey).length, 1);
  const receipt = s.ledger.operation(request.idempotencyKey);
  assert.equal(receipt.operation, 'historical_asset_import.commit');
  assert.deepEqual(receipt.importProvenance, { importId: s.b.importId, planId: p.planId, planDigest: p.planDigest, historical: { ...s.metadata, status: 'committed', userApprovalRef: request.userApprovalRef } });
  assert.equal(s.audit.get(receipt.auditEventId).event.operation, 'historical_asset_import.commit');
  assert.deepEqual(s.audit.get(receipt.auditEventId).event.entity, { entityType: 'workflow', entityId: s.b.importId });
  assert.equal(s.imports.getPlan(p.planId).status, 'committed');
  assert.deepEqual(s.ledger.importPlan(p.planId).evidence[0].verification, s.source.verification);
});

for (const date of ['2026-08-14', '2026-08-15']) test(`historical rejects boundary ${date} even with supporting evidence`, t => {
  const s = historicalContext(t); s.b.candidates[0].payload.tradeDate = date;
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  const p = s.imports.prepareHistorical(s.metadata, s.b);
  assert.equal(p.status, 'blocked'); reason('IMPORT_NOT_READY', () => s.imports.commitHistorical(s.approve(p), operator));
  assert.deepEqual(s.ledger.transactions(), []);
});
test('historical rejects mixed historical and baseline-day facts', t => {
  const s = historicalContext(t); s.b.candidates.push(candidate(transaction({ transactionId: 'later', source: 'legacy_import' }), 'transaction', { candidateId: 'later', sourceEvidenceRefs: [s.source.refId] }));
  s.metadata.candidateCounts.transactions++; s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  assert.equal(s.imports.prepareHistorical(s.metadata, s.b).status, 'blocked'); assert.deepEqual(s.ledger.transactions(), []);
});

for (const problem of ['missing', 'pending', 'quality-only', 'wrong-content-digest', 'wrong-assertions-digest', 'unrelated-candidate', 'changed-payload', 'unlinked', 'rejected']) test(`historical evidence fail closed: ${problem}`, t => {
  const s = historicalContext(t);
  if (problem === 'missing' || problem === 'quality-only') s.sources.clear();
  if (problem === 'pending') s.source.verification.status = 'pending';
  if (problem === 'rejected') s.source.verification.status = 'rejected';
  if (problem === 'wrong-content-digest') s.source.content += ' changed';
  if (problem === 'wrong-assertions-digest') s.source.assertions.candidates = [];
  if (problem === 'unrelated-candidate') { s.source.assertions.candidates[0].candidateId = 'unrelated'; s.source.verification.assertionsDigest = digest(s.source.assertions); s.source.content = JSON.stringify(s.source.assertions); s.source.verification.contentDigest = digest(s.source.content); }
  if (problem === 'changed-payload') s.b.candidates[0].payload.quantity = 20;
  if (problem === 'unlinked') { s.b.candidates[0].sourceEvidenceRefs = []; delete s.b.candidates[0].payload.sourceEvidenceRef; s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] }); }
  const p = s.imports.prepareHistorical(s.metadata, s.b);
  assert.equal(p.status, problem === 'pending' ? 'needs_review' : 'blocked');
  reason('IMPORT_NOT_READY', () => s.imports.commitHistorical(s.approve(p), operator));
  assert.deepEqual(s.ledger.transactions(), []); assert.deepEqual(s.audit.listByRequest('fixture-import-commit'), []);
});
for (const problem of ['counts', 'import-id', 'approval-at-prepare', 'empty-source-refs', 'wrong-metadata-version']) test(`historical metadata rejects ${problem}`, t => {
  const s = historicalContext(t);
  if (problem === 'counts') s.metadata.candidateCounts.transactions++;
  if (problem === 'import-id') s.metadata.importId = 'other';
  if (problem === 'approval-at-prepare') s.metadata.userApprovalRef = 'premature';
  if (problem === 'empty-source-refs') s.metadata.sourceRefs = [];
  if (problem === 'wrong-metadata-version') s.metadata.schemaVersion = 'legacy-asset-import.v1';
  reason(['empty-source-refs', 'wrong-metadata-version'].includes(problem) ? 'CONTRACT_INVALID' : 'LEDGER_INVALID', () => s.imports.prepareHistorical(s.metadata, s.b));
});
test('quality candidate cannot gain approval merely by resolving an otherwise verified source', t => {
  const s = historicalContext(t); s.metadata.sourceRefs[0].quality = 'candidate';
  assert.equal(s.imports.prepareHistorical(s.metadata, s.b).status, 'needs_review');
});
test('verified sidecar digests cannot make unrelated source content support historical facts', t => {
  const s = historicalContext(t); s.source.content = 'Unrelated archive text'; s.source.verification.contentDigest = digest(s.source.content);
  const p = s.imports.prepareHistorical(s.metadata, s.b); assert.equal(p.status, 'blocked');
  reason('IMPORT_NOT_READY', () => s.imports.commitHistorical(s.approve(p), operator));
});

for (const change of ['replacement', 'content', 'verification-status', 'verification-version', 'assertions']) test(`historical evidence ${change} after prepare makes commit stale`, t => {
  const s = historicalContext(t), p = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(p);
  if (change === 'replacement') s.sources.clear();
  if (change === 'content') { s.source.content += ' new'; s.source.verification.contentDigest = digest(s.source.content); }
  if (change === 'verification-status') s.source.verification.status = 'pending';
  if (change === 'verification-version') s.source.verification.version = 'second-review';
  if (change === 'assertions') { s.source.assertions.candidates = []; s.source.verification.assertionsDigest = digest(s.source.assertions); }
  reason('IMPORT_PLAN_STALE', () => s.imports.commitHistorical(request, operator));
  assert.deepEqual(s.ledger.transactions(), []); assert.deepEqual(s.audit.listByRequest(request.idempotencyKey), []);
});
for (const change of ['metadata', 'candidate', 'candidate-deletion', 'plan-output', 'operation']) test(`historical stored ${change} mutation cannot reuse digest`, t => {
  const s = historicalContext(t), p = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(p);
  const modified = structuredClone(s.ledger.importPlan(p.planId));
  if (change === 'metadata') modified.historical.sourceType = 'chatgpt_library_document';
  if (change === 'candidate') modified.bundle.candidates[0].payload.tradeDate = '2026-08-12';
  if (change === 'candidate-deletion') modified.bundle.candidates = [];
  if (change === 'plan-output') modified.plan.items[0].summary = 'Changed output';
  if (change === 'operation') modified.operation = 'asset_import.commit';
  const db = { ...s.database, transaction: work => s.database.transaction(r => work({ ...r, ledger: { ...r.ledger, importPlan: () => modified } })) };
  const imports = new AssetImportService(db, contracts, now, s.trust);
  assert.throws(() => imports.commitHistorical(request, operator));
  assert.deepEqual(s.ledger.transactions(), []); assert.deepEqual(s.audit.listByRequest(request.idempotencyKey), []);
});
test('new metadata prepare supersedes old plan and requires a new bound approval', t => {
  const s = historicalContext(t), old = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(old);
  const updated = s.imports.prepareHistorical({ ...s.metadata, sourceType: 'chatgpt_library_document' }, s.b);
  assert.notEqual(updated.planDigest, old.planDigest);
  reason('IMPORT_PLAN_STALE', () => s.imports.commitHistorical(request, operator));
  reason('APPROVAL_REQUIRED', () => s.imports.commitHistorical(commitRequest(updated), operator));
  s.imports.commitHistorical(s.approve(updated), operator);
});
test('reverting superseded metadata creates a fresh immutable plan and approval binding', t => {
  const s = historicalContext(t), original = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(original);
  s.imports.prepareHistorical({ ...s.metadata, sourceType: 'chatgpt_library_document' }, s.b);
  const restored = s.imports.prepareHistorical(s.metadata, s.b);
  assert.notEqual(restored.planId, original.planId); assert.deepEqual(s.imports.prepareHistorical(s.metadata, s.b), restored);
  reason('IMPORT_PLAN_STALE', () => s.imports.commitHistorical(request, operator));
  reason('APPROVAL_REQUIRED', () => s.imports.commitHistorical(commitRequest(restored), operator));
  s.imports.commitHistorical(s.approve(restored), operator);
});
for (const problem of ['ordinary-commit', 'historical-commit-ordinary-plan', 'unresolved-approval', 'approval-operation', 'approval-plan', 'approval-digest', 'approval-actor', 'approval-client', 'approval-ref']) test(`historical operation/approval binding rejects ${problem}`, t => {
  const s = historicalContext(t), p = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(p);
  if (problem === 'ordinary-commit') reason('IMPORT_PLAN_STALE', () => s.imports.commit(request, operator));
  else if (problem === 'historical-commit-ordinary-plan') { const ordinary = s.imports.prepare({ ...s.b, importId: 'ordinary' }); reason('IMPORT_PLAN_STALE', () => s.imports.commitHistorical(commitRequest(ordinary), operator)); }
  else {
    if (problem === 'unresolved-approval') s.approvals.clear();
    else s.approvals.get(request.userApprovalRef)[{ 'approval-operation': 'operation', 'approval-plan': 'planId', 'approval-digest': 'planDigest', 'approval-actor': 'actor', 'approval-client': 'client', 'approval-ref': 'userApprovalRef' }[problem]] = 'different';
    reason('APPROVAL_REQUIRED', () => s.imports.commitHistorical(request, operator));
  }
  assert.deepEqual(s.ledger.transactions(), []); assert.deepEqual(s.audit.listByRequest(request.idempotencyKey), []);
});

for (const stage of ['audit', 'operation', 'transaction', 'fingerprint']) test(`historical failure at ${stage} rolls back ledger, committed metadata and Audit`, t => {
  const s = historicalContext(t), p = s.imports.prepareHistorical(s.metadata, s.b), request = s.approve(p);
  const db = { ...s.database, transaction: work => s.database.transaction(r => {
    const rr = { ...r, ledger: { ...r.ledger }, audit: { ...r.audit } };
    const target = stage === 'audit' ? rr.audit : rr.ledger;
    const name = { audit: 'append', operation: 'appendOperation', transaction: 'appendTransaction', fingerprint: 'appendFingerprint' }[stage], old = target[name];
    target[name] = (...args) => { old(...args); throw new Error('Synthetic write failure'); };
    return work(rr);
  }) };
  const imports = new AssetImportService(db, contracts, now, s.trust);
  reason('TRANSACTION_ROLLED_BACK', () => imports.commitHistorical(request, operator));
  assert.deepEqual(s.ledger.transactions(), []); assert.equal(s.ledger.operation(request.idempotencyKey), undefined);
  assert.equal(s.ledger.fingerprint('import:fixture-import'), undefined); assert.deepEqual(s.audit.listByRequest(request.idempotencyKey), []);
  s.imports.commitHistorical(request, operator); assert.equal(s.ledger.transactions().length, 1);
});
test('historical Account/Asset alone cannot bypass the dated fact boundary', t => {
  const s = historicalContext(t);
  s.b.candidates = [candidate(account(), 'account'), candidate(asset(), 'asset', { candidateId: 'asset' })];
  s.b.sourceEvidenceRefs = [s.source.refId]; s.metadata.candidateCounts = { accounts: 1, assets: 1, transactions: 0, cashFlows: 0, positions: 0, dcaExecutions: 0 };
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  assert.equal(s.imports.prepareHistorical(s.metadata, s.b).status, 'blocked');
});
test('historical Account/Asset candidates are admitted as evidenced dependencies of dated facts', t => {
  const s = historicalContext(t); const a = account({ accountId: 'new-account' }), assetValue = asset({ assetId: 'new-asset' });
  Object.assign(s.b.candidates[0].payload, { accountId: a.accountId, assetId: assetValue.assetId });
  s.b.candidates.push(candidate(a, 'account', { candidateId: 'account' }), candidate(assetValue, 'asset', { candidateId: 'asset' }));
  s.b.sourceEvidenceRefs = [s.source.refId]; Object.assign(s.metadata.candidateCounts, { accounts: 1, assets: 1 });
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  const p = s.imports.prepareHistorical(s.metadata, s.b); assert.equal(p.status, 'ready'); s.imports.commitHistorical(s.approve(p), operator);
  assert.equal(s.ledger.transactions()[0].accountId, a.accountId); assert.equal(s.ledger.accounts().length, 2); assert.equal(s.ledger.assets().length, 2);
});
test('historical imports all dated fact types into the existing ledger with canonical V1 payloads', t => {
  const s = historicalContext(t); s.service.saveDcaPlan(dcaPlan({ activeFrom: '2026-08-01', constraints: [] }), 0, approval('plan'));
  s.b.sourceEvidenceRefs = [s.source.refId];
  s.b.candidates.push(candidate(cashFlow({ date: '2026-08-13', sourceEvidenceRef: s.metadata.sourceRefs[0] }), 'cash_flow', { candidateId: 'cash' }), candidate(position({ snapshotDate: '2026-08-13', source: 'legacy_import' }), 'position_snapshot', { candidateId: 'position' }), candidate(execution({ periodStart: '2026-08-01', periodEnd: '2026-08-13' }), 'dca_execution', { candidateId: 'execution' }));
  Object.assign(s.metadata.candidateCounts, { cashFlows: 1, positions: 1, dcaExecutions: 1 });
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  const p = s.imports.prepareHistorical(s.metadata, s.b); assert.equal(p.status, 'ready'); s.imports.commitHistorical(s.approve(p), operator);
  assert.equal(s.ledger.positions()[0].source, 'legacy_import'); assert.equal(s.ledger.cashFlows().length, 1);
  assert.equal(s.ledger.dcaExecutions()[0].execution.periodEnd, '2026-08-13');
});
for (const end of ['2026-08-13', '2026-08-14']) test(`historical unlinked DCA explicit end ${end}`, t => {
  const s = historicalContext(t); s.service.saveDcaPlan(dcaPlan({ activeFrom: '2026-08-01', constraints: [] }), 0, approval('plan'));
  s.b.sourceEvidenceRefs = [s.source.refId]; s.b.candidates = [candidate(execution({ transactionIds: [], periodStart: '2026-08-01', periodEnd: end }), 'dca_execution')];
  Object.assign(s.metadata.candidateCounts, { transactions: 0, dcaExecutions: 1 });
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [] });
  const p = s.imports.prepareHistorical(s.metadata, s.b); assert.equal(p.status, end === '2026-08-13' ? 'ready' : 'blocked');
  if (p.status === 'ready') s.imports.commitHistorical(s.approve(p), operator);
});
test('historical workflow also consumes the same AccountValue reconciliation without another ledger', t => {
  const s = historicalContext(t), p = position({ snapshotDate: '2026-08-13', source: 'legacy_import' });
  const observation = { accountId: p.accountId, snapshotDate: p.snapshotDate, scope: 'full_account_snapshot', totalMarketValue: p.marketValue, sourceEvidenceRefs: [s.source.refId] };
  s.b.candidates.push(candidate(p, 'position_snapshot', { candidateId: 'position' })); s.b.sourceEvidenceRefs = [s.source.refId];
  s.b.accountValueObservations = [observation]; s.metadata.candidateCounts.positions = 1;
  s.attest(s.source.refId, { candidates: s.b.candidates, accountSnapshots: [{ observation, positions: [p], complete: true }] });
  const plan = s.imports.prepareHistorical(s.metadata, s.b); assert.equal(plan.status, 'ready');
  assert.equal(plan.accountValueReconciliations[0].status, 'pass'); s.imports.commitHistorical(s.approve(plan), operator);
  assert.equal(s.ledger.positions().length, 1); assert.deepEqual(s.ledger.cashFlows(), []);
});
