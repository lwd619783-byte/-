import test from 'node:test';
import assert from 'node:assert/strict';
import { V1ContractRegistry, loadContractDocuments } from '../../.local-core-build/contracts/registry.js';
import { entityTypes, entityStatuses } from '../../.local-core-build/domain/types.js';
import { contracts, entityFixture, requestFixture, auditFixture, fixedId, expectCode } from './fixtures.mjs';

const versions = ['account.v1', 'asset-import-bundle.v1', 'asset-import-commit-request.v1', 'asset-import-plan.v1', 'asset.v1', 'backup-manifest.v1', 'bridge-audit-event.v1', 'cash-flow.v1', 'contribution-bundle.v1', 'contribution-commit-request.v1', 'contribution-plan.v1', 'conversation-archive-manifest.v1', 'dca-execution.v1', 'dca-plan.v1', 'entity-registry-entry.v1', 'entity-resolution-request.v1', 'entity-resolution-result.v1', 'industry-extension.v1', 'industry-research-module.v1', 'industry-research-profile.v1', 'legacy-asset-import.v1', 'performance-snapshot.v1', 'position-snapshot.v1', 'research-bridge.v1', 'restore-commit-request.v1', 'restore-plan.v1', 'transaction.v1'];
test('all 5 V1 schema roots and all 37 definitions compile; frozen versions have no aliases', () => {
  assert.equal(contracts.schemaCount, 5);
  assert.equal(contracts.definitionCount, 37);
  assert.deepEqual(contracts.versions, versions);
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
test('Phase 1B case availability distinguishes executable, partial and future work; no cached PASS', () => {
  assert.equal(contracts.declaredCases.length, 21);
  assert.deepEqual(contracts.declaredCases.filter(v => v.status === 'executable').map(v => v.id), ['A-003', 'A-004', 'A-006', 'A-007', 'A-008']);
  assert.deepEqual(contracts.declaredCases.filter(v => v.status === 'partially executable / contract blocker').map(v => v.id), ['A-001', 'A-002', 'A-005']);
  assert.equal(contracts.declaredCases.find(v => v.id === 'P-001').status, 'declared / not-yet-executable');
});
test('entity types and statuses exactly match frozen contract', () => {
  const definitions = loadContractDocuments()['entity-resolution.v1.schema.json'].$defs;
  assert.deepEqual(entityTypes, definitions.RegistryEntry.properties.entityType.enum);
  assert.deepEqual(entityTypes, definitions.ResolutionRequest.properties.expectedEntityTypes.items.enum);
  assert.deepEqual(entityStatuses, definitions.RegistryEntry.properties.status.enum);
});
