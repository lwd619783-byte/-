import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { ROOT, read, pin } from '../semantic-runtime/common.mjs';
import { DEFINITIONS } from '../semantic-runtime/bindings.mjs';
import { createIdentityBridge, checkIdentityPolicy, mappingDigest, IDENTITY_POLICY } from '../semantic-runtime/identity-bridge-v2.mjs';
import { queryMacro as v1 } from '../semantic-runtime/market-regime-adapter.mjs';
import { createMacroRuntimeV2, queryMacro, queryForDefinition } from '../semantic-runtime/market-regime-adapter-v2.mjs';

// Synthetic retained owner exports and a read-only repository seam, never real entities.
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'macro-identity-v2-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (p, value) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), JSON.stringify(value, null, 2) + '\n'); };
  const defs = read(DEFINITIONS); write(DEFINITIONS, defs);
  const index = defs.findIndex((d) => d.sourceDefinitionId === 'pbc-m2-yoy-2011-v2');
  assert.ok(index >= 0);
  const entry = { schemaVersion: 'entity-registry-entry.v1', entityType: 'macro_metric', entityId: 'synthetic-registry-identity',
    canonicalName: 'Synthetic macro metric', aliases: [], status: 'active', userConfirmed: true, revision: 1 };
  write('owners/registry.json', { entry });
  const mapping = { schemaVersion: 'macro-identity-mapping.v1', mappingId: 'synthetic-map', revision: 1, status: 'reviewed',
    entity: { entityType: 'macro', entityId: 'synthetic-f1-identity' }, metricId: 'MACRO_M2_YOY',
    metricDefinitionRef: pin(DEFINITIONS, '/' + index, defs[index].sourceDefinitionId, defs[index].version, root),
    registryEntryRef: pin('owners/registry.json', '/entry', entry.entityId, '1', root), previousRef: null };
  let mappings = [mapping], current = [structuredClone(entry)];
  const policy = { ...read(IDENTITY_POLICY), registryOwner: 'synthetic-local-core-owner', mappingRefs: [] };
  function publish() {
    for (const [i, m] of mappings.entries()) {
      const review = { reviewId: `synthetic-review-${i}`, revision: 1, mappingId: m.mappingId, mappingRevision: m.revision,
        mappingSha256: mappingDigest(m), decision: m.status, reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-09-13T00:00:00Z' };
      write(`owners/review-${i}.json`, { review });
      m.reviewRef = pin(`owners/review-${i}.json`, '/review', review.reviewId, '1', root);
    }
    write('owners/mappings.json', mappings);
    policy.mappingRefs = mappings.map((m, i) => pin('owners/mappings.json', '/' + i, m.mappingId, String(m.revision), root));
    write(IDENTITY_POLICY, policy);
  }
  publish();
  const registry = Object.freeze({ owner: policy.registryOwner, list: () => structuredClone(current) });
  const bridge = createIdentityBridge({ root, registry });
  return { root, entry, mapping, policy, registry, write, publish, bridge,
    setMappings: (value) => { mappings = value; publish(); }, setCurrent: (value) => { current = value; },
    resolve: (entity = mapping.entity) => bridge.resolve(mapping.metricId, entity) };
}
const request = (entity = {entityType: 'macro', entityId: 'synthetic-f1-identity'}) => queryForDefinition('pbc-m2-yoy-2011-v2',
  {start: '2011-10-01', end: '2011-10-31'}, '2011-11-12T00:00:00+08:00', 'strict_pit', entity);
const code = (out, expected) => assert.ok(out.blockers.some((b) => b.code === expected), JSON.stringify(out));

test('exact reviewed mapping resolves three different identities without creating an entity', (t) => {
  const f = fixture(t), before = structuredClone(f.entry);
  assert.equal(f.resolve().status, 'RESOLVED');
  assert.equal(f.resolve().registryEntityId, f.entry.entityId);
  assert.equal(f.resolve().allowAutoCreate, false);
  assert.deepEqual(f.entry, before); assert.deepEqual(Object.keys(f.registry), ['owner', 'list']);
});
test('missing mapping remains unresolved even when metricId equals entityId', () => {
  const result = queryMacro(request({entityType: 'macro', entityId: 'MACRO_M2_YOY'}));
  code(result, 'ENTITY_REGISTRY_UNRESOLVED'); code(result, 'MAPPING_MISSING');
});
test('query claims cannot provide mapping, owner, approval or admission', () => {
  for (const injected of [{identityResolution: {status: 'RESOLVED'}}, {mapping: {status: 'reviewed'}}, {registry: {}}, {admission: 'ADMITTED'}]) {
    const result = queryMacro({...request(), ...injected});
    code(result, 'QUERY_SCHEMA_INVALID'); code(result, 'ENTITY_REGISTRY_UNRESOLVED');
  }
});
test('valid mapping removes only identity blocker in V2 while V1 remains unresolved', (t) => {
  const f = fixture(t), q = request();
  const result = createMacroRuntimeV2(f).queryMacro(q);
  assert.equal(result.identityResolution.status, 'RESOLVED');
  assert.ok(!result.blockers.some((b) => b.code === 'ENTITY_REGISTRY_UNRESOLVED'));
  assert.equal(result.value, null); code(result, 'OWNER_USE_NOT_ADMITTED');
  code(v1(q), 'ENTITY_REGISTRY_UNRESOLVED');
});
test('a different caller EntityRef or matching displayName cannot use a valid mapping', (t) => {
  const f = fixture(t);
  for (const entity of [{entityType: 'macro', entityId: f.mapping.metricId},
    {entityType: 'macro', entityId: 'other', displayName: f.entry.canonicalName}, {entityType: 'company', entityId: f.mapping.entity.entityId}]) code(f.resolve(entity), 'ENTITY_CLAIM_MISMATCH');
});
test('duplicate and conflicting mappings fail the complete policy closed', (t) => {
  const f = fixture(t);
  for (const delta of [{}, {mappingId: 'second'}, {mappingId: 'second', entity: {entityType: 'macro', entityId: 'other'}}]) {
    f.setMappings([f.mapping, {...structuredClone(f.mapping), ...delta}]);
    code(f.resolve(), 'MAPPING_DUPLICATE_OR_CONFLICTING');
  }
});
for (const status of ['candidate', 'archived', 'merged']) test(`current ${status} Registry identity is never resolved from an active retained export`, (t) => {
  const f = fixture(t); f.setCurrent([{...f.entry, status}]); code(f.resolve(), 'REGISTRY_IDENTITY_INACTIVE_OR_UNCONFIRMED');
});
test('current unconfirmed/merged target/revised/duplicate/missing owner each fails closed', (t) => {
  const f = fixture(t);
  for (const [entries, expected] of [
    [[{...f.entry, userConfirmed: false}], 'REGISTRY_IDENTITY_INACTIVE_OR_UNCONFIRMED'],
    [[{...f.entry, mergedIntoEntityId: 'target'}], 'REGISTRY_IDENTITY_INACTIVE_OR_UNCONFIRMED'],
    [[{...f.entry, revision: 2}], 'REGISTRY_REVISION_OR_CONTENT_DRIFT'],
    [[f.entry, f.entry], 'CURRENT_REGISTRY_MISSING_OR_DUPLICATE'], [[], 'CURRENT_REGISTRY_MISSING_OR_DUPLICATE']]) {
    f.setCurrent(entries); code(f.resolve(), expected);
  }
  code(createIdentityBridge({root: f.root}).resolve(f.mapping.metricId), 'CURRENT_REGISTRY_OWNER_UNAVAILABLE');
});
test('same runtime re-reads current Registry on every query', (t) => {
  const f = fixture(t); assert.equal(f.resolve().status, 'RESOLVED');
  f.setCurrent([{...f.entry, status: 'archived', revision: 2}]); assert.equal(f.resolve().status, 'UNRESOLVED');
});
test('pin digest, locator, identity, version and review body are independently checked', (t) => {
  const f = fixture(t), original = structuredClone(f.mapping.registryEntryRef);
  for (const delta of [{sha256: '0'.repeat(64)}, {locator: '/absent'}, {objectId: 'wrong'}, {version: '9'}]) {
    f.mapping.registryEntryRef = {...original, ...delta}; f.publish(); assert.equal(f.resolve().status, 'UNRESOLVED');
  }
  f.mapping.registryEntryRef = original; f.publish();
  const review = read('owners/review-0.json', f.root); review.review.mappingSha256 = '0'.repeat(64);
  f.write('owners/review-0.json', review);
  f.mapping.reviewRef = pin('owners/review-0.json', '/review', review.review.reviewId, '1', f.root);
  f.write('owners/mappings.json', [f.mapping]);
  f.policy.mappingRefs = [pin('owners/mappings.json', '/0', f.mapping.mappingId, '1', f.root)]; f.write(IDENTITY_POLICY, f.policy);
  code(f.resolve(), 'MAPPING_REVIEW_MISMATCH');
});
test('revoked mapping remains an audited denial; invalid revision cannot skip history', (t) => {
  const f = fixture(t); f.mapping.status = 'revoked'; f.publish(); code(f.resolve(), 'MAPPING_REVOKED');
  f.mapping.status = 'reviewed'; f.mapping.revision = 2; f.publish(); code(f.resolve(), 'MAPPING_PREDECESSOR_MISSING');
});
test('reviewed revision chain requires immediate predecessor and stable endpoints', (t) => {
  const f = fixture(t);
  f.write('owners/prior.json', {mapping: structuredClone(f.mapping)});
  // Retain the prior review under its original pin before publishing the next revision.
  f.write('owners/prior-review.json', read('owners/review-0.json', f.root));
  const prior = read('owners/prior.json', f.root);
  prior.mapping.reviewRef = pin('owners/prior-review.json', '/review', 'synthetic-review-0', '1', f.root);
  f.write('owners/prior.json', prior);
  f.mapping.revision = 2; f.mapping.previousRef = pin('owners/prior.json', '/mapping', f.mapping.mappingId, '1', f.root); f.publish();
  assert.equal(f.resolve().status, 'RESOLVED');
  f.mapping.entity.entityId = 'changed'; f.publish(); code(f.resolve(), 'MAPPING_REVISION_IDENTITY');
});
test('committed policy is empty, schema-checked and does not claim real Registry resolution', () => {
  const checked = checkIdentityPolicy({root: ROOT});
  assert.deepEqual(checked.mappings, []); assert.equal(checked.policy.registryOwner, null);
});
