import test from 'node:test';
import assert from 'node:assert/strict';
import { V1ContractRegistry, loadContractDocuments } from '../../.local-core-build/contracts/registry.js';
import { entityTypes, entityStatuses } from '../../.local-core-build/domain/types.js';
import { contracts, entityFixture, requestFixture, auditFixture, fixedId, expectCode } from './fixtures.mjs';
import { legacyV1Fixtures, oldFixture, historicalFixture, observationFixture, reconciliationFixture, money } from './contract-clarification-fixtures.mjs';

const versions = ['account.v1', 'asset-import-bundle.v1', 'asset-import-commit-request.v1', 'asset-import-plan.v1', 'asset.v1', 'backup-manifest.v1', 'bridge-audit-event.v1', 'cash-flow.v1', 'contribution-bundle.v1', 'contribution-commit-request.v1', 'contribution-plan.v1', 'conversation-archive-manifest.v1', 'dca-execution.v1', 'dca-plan.v1', 'entity-registry-entry.v1', 'entity-resolution-request.v1', 'entity-resolution-result.v1', 'industry-extension.v1', 'industry-research-module.v1', 'industry-research-profile.v1', 'legacy-asset-import.v1', 'performance-snapshot.v1', 'position-snapshot.v1', 'research-bridge.v1', 'restore-commit-request.v1', 'restore-plan.v1', 'transaction.v1'];
test('all 5 V1 schema roots and all 40 definitions compile; 27 old versions plus one additive version', () => {
  assert.equal(contracts.schemaCount, 5);
  assert.equal(contracts.definitionCount, 40);
  assert.deepEqual(contracts.versions, [...versions, 'historical-asset-import.v1'].sort());
  expectCode('CONTRACT_INVALID', () => contracts.validate('BridgeAuditEvent.v1', auditFixture()));
});
const fixtures = [
  { ...entityFixture(), schemaVersion: 'entity-registry-entry.v1', entityId: fixedId },
  requestFixture(), auditFixture(), auditFixture({ success: false, errorCode: 'FIXTURE_FAILURE' }),
  { schemaVersion: 'entity-resolution-result.v1', requestId: 'fixture', status: 'resolved', resolvedEntityId: fixedId, confidence: 1, candidates: [], allowAutoCreate: false },
  { schemaVersion: 'research-bridge.v1', requestId: 'fixture', status: 'partial', quality: { status: 'missing', warnings: [] }, provenance: [] },
  { schemaVersion: 'restore-commit-request.v1', restorePlanId: 'fixture', backupId: 'fixture', planDigest: 'fixture', preRestoreBackupId: 'fixture', idempotencyKey: 'fixture', userApprovalRef: 'fixture' },
  { schemaVersion: 'asset-import-bundle.v1', importId: 'fixture', asOf: '2026-01-02T03:04:05Z', sourceType: 'manual_entry', candidates: [{ candidateId: 'fixture', candidateType: 'asset', confidence: 0, payload: {} }] },
];
for (const [index, fixture] of fixtures.entries()) {
  test(`schema-only valid fixture ${index + 1}: ${fixture.schemaVersion}`, () => contracts.validate(fixture.schemaVersion, fixture));
  test(`schema-only invalid version rejected ${index + 1}`, () => expectCode('CONTRACT_INVALID', () => contracts.validate(fixture.schemaVersion, { ...fixture, schemaVersion: 'unfrozen.v1' })));
}
test('invalid date-time and unknown external fields fail closed without mutation', () => {
  const invalid = auditFixture({ timestamp: '2026-02-30T03:04:05Z' });
  expectCode('CONTRACT_INVALID', () => contracts.validate('bridge-audit-event.v1', invalid));
  expectCode('CONTRACT_INVALID', () => contracts.validate('bridge-audit-event.v1', auditFixture({ timestamp: 'yesterday' })));
  const input = requestFixture({ providerId: 'fixture-provider', providerIdentifier: 'fixture' });
  const before = structuredClone(input);
  expectCode('CONTRACT_INVALID', () => contracts.validate(input.schemaVersion, input));
  assert.deepEqual(input, before);
  expectCode('CONTRACT_INVALID', () => contracts.validate('entity-resolution-result.v1', { ...fixtures[4], allowAutoCreate: true }));
  const noIdentity = { ...fixtures[4] }; delete noIdentity.resolvedEntityId;
  expectCode('CONTRACT_INVALID', () => contracts.validate(noIdentity.schemaVersion, noIdentity));
});
const corruptions = {
  'missing schema': (d) => { delete d['restore-commit.v1.schema.json']; },
  'unresolved ref in unused definition': (d) => { d['entity-resolution.v1.schema.json'].$defs.Unused = { $ref: 'unknown.schema.json' }; },
  'unknown format': (d) => { d['entity-resolution.v1.schema.json'].$defs.RegistryEntry.properties.canonicalName.format = 'unknown-fixture-format'; },
  'invalid schema type': (d) => { d['entity-resolution.v1.schema.json'].$defs.RegistryEntry.type = 'invalid-type'; },
  'module duplicate': (d) => { d['industry-module-registry.v1.json'].modules[1].moduleId = 'M0'; },
  'module count': (d) => { d['industry-module-registry.v1.json'].modules.pop(); },
  'unknown module': (d) => { d['industry-module-registry.v1.json'].modules[0].moduleId = 'M14'; },
  'empty canonical': (d) => { d['industry-module-registry.v1.json'].modules[0].canonicalNameZh = ' '; },
  'AI deny overlap allow': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.allow.push('trade.execute'); },
  'AI deny overlap confirmed': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.confirmedOnly.push('sql.execute'); },
  'AI wildcard allow': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.allow.push('secret.read'); },
  'AI wildcard confirmed': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.confirmedOnly.push('*'); },
  'AI hard-deny removed': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.deny = []; },
  'case ID duplicate': (d) => { d['contract-test-cases.v1.json'].cases[1].id = 'R-001'; },
  'auto-create enabled': (d) => { d['entity-resolution.v1.schema.json'].$defs.ResolutionResult.properties.allowAutoCreate.const = true; },
  'version alias': (d) => { d['permissions.v1.json'].schemaVersion = 'permission-policy.v1'; },
};
for (const [name, corrupt] of Object.entries(corruptions)) test(`registry rejects ${name}`, () => {
  const docs = loadContractDocuments(); corrupt(docs);
  expectCode('CONTRACT_INVALID', () => new V1ContractRegistry(docs));
});
test('Phase 1B case availability distinguishes executable and future work; no cached PASS', () => {
  assert.equal(contracts.declaredCases.length, 21);
  assert.deepEqual(contracts.declaredCases.filter(v => v.status === 'executable').map(v => v.id), ['A-001', 'A-002', 'A-003', 'A-004', 'A-005', 'A-006', 'A-007', 'A-008']);
  assert.equal(contracts.declaredCases.find(v => v.id === 'P-001').status, 'declared / not-yet-executable');
});
test('entity types and statuses exactly match frozen contract', () => {
  const definitions = loadContractDocuments()['entity-resolution.v1.schema.json'].$defs;
  assert.deepEqual(entityTypes, definitions.RegistryEntry.properties.entityType.enum);
  assert.deepEqual(entityTypes, definitions.ResolutionRequest.properties.expectedEntityTypes.items.enum);
  assert.deepEqual(entityStatuses, definitions.RegistryEntry.properties.status.enum);
});

for (const fixture of legacyV1Fixtures) test(`backward compatibility: ${fixture.schemaVersion} unchanged payload`, () => {
  const before = structuredClone(fixture);
  contracts.validate(fixture.schemaVersion, fixture);
  assert.deepEqual(fixture, before);
});

test('all existing Account/Asset categories and Transaction/Position provenance enums still validate', () => {
  const defs = loadContractDocuments()['research-asset-os.contracts.v1.schema.json'].$defs;
  for (const [name, version, field] of [['Account', 'account.v1', 'accountType'], ['Asset', 'asset.v1', 'assetType'], ['Transaction', 'transaction.v1', 'source'], ['PositionSnapshot', 'position-snapshot.v1', 'source']]) {
    for (const value of defs[name].properties[field].enum) contracts.validate(version, { ...oldFixture(version), [field]: value });
  }
  assert.deepEqual(defs.Transaction.properties.source.enum, ['confirmed_screenshot', 'manual', 'legacy_import', 'provider_import']);
  assert.deepEqual(defs.PositionSnapshot.properties.source.enum, ['confirmed_screenshot', 'manual', 'legacy_import', 'calculated']);
  assert.equal(defs.CashFlow.properties.source, undefined);
  assert.equal(defs.DcaExecution.properties.source, undefined);
});

test('HistoricalAssetImport metadata supports preview, verified ready and approved committed shapes', () => {
  for (const status of ['prepared', 'needs_review', 'ready_to_commit', 'committed', 'cancelled']) {
    const fixture = historicalFixture({ status, ...(status === 'committed' ? { userApprovalRef: 'synthetic-approval' } : {}) });
    contracts.validate(fixture.schemaVersion, fixture);
  }
  const candidate = historicalFixture({ status: 'needs_review', sourceRefs: [{ refType: 'document', refId: 'synthetic-unverified', quality: 'candidate' }], warnings: ['Evidence verification pending'] });
  contracts.validate(candidate.schemaVersion, candidate);
});

const historicalInvalid = {
  'missing sources': (x) => { delete x.sourceRefs; },
  'empty sources': (x) => { x.sourceRefs = []; },
  'wrong baseline': (x) => { x.baselineDate = '2026-08-13'; },
  'missing count': (x) => { delete x.candidateCounts.transactions; },
  'negative count': (x) => { x.candidateCounts.transactions = -1; },
  'parallel ledger payload': (x) => { x.transactions = []; },
  'ready unverified': (x) => { x.status = 'ready_to_commit'; x.sourceRefs[0].quality = 'candidate'; },
  'ready missing quality': (x) => { x.status = 'ready_to_commit'; delete x.sourceRefs[0].quality; },
  'one unverified among verified': (x) => { x.status = 'ready_to_commit'; x.sourceRefs.push({ refType: 'document', refId: 'synthetic-unknown', quality: 'unknown' }); },
  'ready warning': (x) => { x.status = 'ready_to_commit'; x.warnings = ['Unresolved evidence']; },
  'committed without approval': (x) => { x.status = 'committed'; },
  'committed empty approval': (x) => { x.status = 'committed'; x.userApprovalRef = ''; },
};
for (const [name, corrupt] of Object.entries(historicalInvalid)) test(`HistoricalAssetImport rejects ${name}`, () => {
  const fixture = historicalFixture(); corrupt(fixture);
  expectCode('CONTRACT_INVALID', () => contracts.validate(fixture.schemaVersion, fixture));
});

test('AccountValueObservation is structured evidence separate from external contribution', () => {
  const bundle = oldFixture('asset-import-bundle.v1');
  bundle.declaredExternalContribution = money(3);
  bundle.accountValueObservations = [observationFixture()];
  contracts.validate(bundle.schemaVersion, bundle);
  const plan = oldFixture('asset-import-plan.v1');
  plan.accountValueReconciliations = [reconciliationFixture()];
  contracts.validate(plan.schemaVersion, plan);
  plan.status = 'needs_review';
  plan.accountValueReconciliations = [reconciliationFixture({ candidatePositionTotal: money(18), reconciliationDelta: money(-2), status: 'warn', warnings: ['ACCOUNT_VALUE_MISMATCH'] })];
  contracts.validate(plan.schemaVersion, plan);
  plan.accountValueReconciliations = [{ accountId: 'synthetic-account', snapshotDate: '2026-08-14', observedTotal: money(), status: 'warn', warnings: ['INCOMPLETE_POSITION_CANDIDATES'] }];
  contracts.validate(plan.schemaVersion, plan);
});
for (const field of ['accountId', 'snapshotDate', 'scope', 'totalMarketValue', 'sourceEvidenceRefs']) test(`AccountValueObservation rejects missing ${field}`, () => {
  const observation = observationFixture(); delete observation[field];
  const bundle = { ...oldFixture('asset-import-bundle.v1'), accountValueObservations: [observation] };
  expectCode('CONTRACT_INVALID', () => contracts.validate(bundle.schemaVersion, bundle));
});
for (const [name, override] of Object.entries({ 'invalid scope': { scope: 'external_contribution' }, 'invalid date': { snapshotDate: '2026-02-30' }, 'missing currency': { totalMarketValue: { amount: 20 } }, 'empty evidence': { sourceEvidenceRefs: [] }, 'blank evidence ref': { sourceEvidenceRefs: [''] }, 'unknown field': { accountTotal: 20 } })) test(`AccountValueObservation rejects ${name}`, () => {
  const bundle = { ...oldFixture('asset-import-bundle.v1'), accountValueObservations: [observationFixture(override)] };
  expectCode('CONTRACT_INVALID', () => contracts.validate(bundle.schemaVersion, bundle));
});
for (const [name, corrupt] of Object.entries({
  'pass without candidate total': (x) => { delete x.candidatePositionTotal; },
  'pass without delta': (x) => { delete x.reconciliationDelta; },
  'pass nonzero delta': (x) => { x.reconciliationDelta.amount = -1; },
  'pass with warnings': (x) => { x.warnings = ['Mismatch']; },
  'warn without reason': (x) => { x.status = 'warn'; },
})) test(`AccountValueReconciliation rejects ${name}`, () => {
  const reconciliation = reconciliationFixture(); corrupt(reconciliation);
  const plan = { ...oldFixture('asset-import-plan.v1'), accountValueReconciliations: [reconciliation] };
  expectCode('CONTRACT_INVALID', () => contracts.validate(plan.schemaVersion, plan));
});

test('DCA period remains a free display label; explicit equal/ordered dates validate without mutation', () => {
  for (const period of ['2026-W36', '第36周', '9月第一周', 'Synthetic cycle', 'arbitrary label']) {
    for (const dates of [{}, { periodStart: '2026-08-14', periodEnd: '2026-08-14' }, { periodStart: '2026-08-14', periodEnd: '2026-09-01' }]) {
      const fixture = { ...oldFixture('dca-execution.v1'), period, ...dates };
      const before = structuredClone(fixture);
      contracts.validate(fixture.schemaVersion, fixture);
      assert.deepEqual(fixture, before);
    }
  }
});
for (const [name, dates] of Object.entries({
  'start only': { periodStart: '2026-08-14' },
  'end only': { periodEnd: '2026-08-14' },
  'reverse order': { periodStart: '2026-09-01', periodEnd: '2026-08-14' },
  'invalid calendar date': { periodStart: '2026-02-30', periodEnd: '2026-03-01' },
  'date-time in date field': { periodStart: '2026-08-14T00:00:00Z', periodEnd: '2026-09-01' },
})) test(`DCA contract invariant rejects ${name}`, () => {
  const fixture = { ...oldFixture('dca-execution.v1'), ...dates };
  const before = structuredClone(fixture);
  expectCode('CONTRACT_INVALID', () => contracts.validate(fixture.schemaVersion, fixture));
  assert.deepEqual(fixture, before);
});

const clarificationCorruptions = {
  'historical baseline constant': (d) => { d['research-asset-os.contracts.v1.schema.json'].$defs.HistoricalAssetImport.properties.baselineDate.const = '2026-08-13'; },
  'historical baseline invariant': (d) => { d['ledger-invariants.v1.json'].historicalAssetImport.baselineDate = '2026-08-13'; },
  'historical missing prepare': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.allow = d['permissions.v1.json'].roles.AI_RESEARCHER.allow.filter((op) => op !== 'historical_asset_import.prepare'); },
  'historical missing confirmed commit': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.confirmedOnly = d['permissions.v1.json'].roles.AI_RESEARCHER.confirmedOnly.filter((op) => op !== 'historical_asset_import.commit'); },
  'historical commit unconfirmed': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.allow.push('historical_asset_import.commit'); },
  'historical wildcard unconfirmed': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.allow.push('historical_asset_import.*'); },
  'historical deny collision': (d) => { d['permissions.v1.json'].roles.AI_RESEARCHER.deny.push('historical_asset_import.*'); },
  'historical model backfill': (d) => { d['ledger-invariants.v1.json'].historicalAssetImport.allowsModelBackfill = true; },
  'unverified historical evidence': (d) => { d['ledger-invariants.v1.json'].historicalAssetImport.requiresVerifiedEvidence = false; },
  'confirmation audit disabled': (d) => { d['permissions.v1.json'].confirmationPolicy.level2.requiresAuditEvent = false; },
  'new observation scope': (d) => { d['asset-import.v1.schema.json'].$defs.AccountValueObservation.properties.scope.enum.push('partial'); },
  'old snapshot fallback': (d) => { d['ledger-invariants.v1.json'].accountValueReconciliation.positionSource = 'ledger'; },
  'warnings admitted': (d) => { d['ledger-invariants.v1.json'].accountValueReconciliation.warningBlocksCommit = false; },
  'DCA unpaired dates': (d) => { delete d['research-asset-os.contracts.v1.schema.json'].$defs.DcaExecution.dependentRequired; },
  'DCA required new field': (d) => { d['research-asset-os.contracts.v1.schema.json'].$defs.DcaExecution.required.push('periodStart'); },
  'DCA period parsing': (d) => { d['ledger-invariants.v1.json'].dcaTemporalBinding.periodSemantics = 'parse_week'; },
  'DCA latest fallback': (d) => { d['ledger-invariants.v1.json'].dcaTemporalBinding.defaultLatestRevision = true; },
  'DCA amount formula': (d) => { d['ledger-invariants.v1.json'].dcaTemporalBinding.executedAmountTransactionFormula = 'netAmount'; },
  'old version renamed': (d) => { d['research-asset-os.contracts.v1.schema.json'].$defs.Account.properties.schemaVersion.const = 'account-renamed.v1'; },
  'new version duplicates old': (d) => { d['research-asset-os.contracts.v1.schema.json'].$defs.HistoricalAssetImport.properties.schemaVersion.const = 'legacy-asset-import.v1'; },
  'extra version duplicates old': (d) => { d['research-asset-os.contracts.v1.schema.json'].$defs.Duplicate = structuredClone(d['research-asset-os.contracts.v1.schema.json'].$defs.Account); },
};
for (const [name, corrupt] of Object.entries(clarificationCorruptions)) test(`clarification static invariant rejects ${name}`, () => {
  const documents = loadContractDocuments(); corrupt(documents);
  expectCode('CONTRACT_INVALID', () => new V1ContractRegistry(documents));
});

test('A-001/A-002/A-005 retain IDs and have executable business suites', () => {
  for (const id of ['A-001', 'A-002', 'A-005']) {
    assert.equal(contracts.declaredCases.find((item) => item.id === id)?.status, 'executable');
    assert(loadContractDocuments()['contract-test-cases.v1.json'].cases.find((item) => item.id === id).rules.length >= 8);
  }
});
