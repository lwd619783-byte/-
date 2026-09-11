import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAll, checkCase, checkSuite, resolvePin, validate, validateBinding, assessGraph, vectors } from '../contracts/financial-research.mjs';

const clone = (x) => structuredClone(x);
const vector = (id) => clone(vectors.find((v) => v.caseId === id));
const graph = () => resolvePin(vector('closed-lineage').fixtureRef).graph;
const binding = () => JSON.parse(readFileSync('contracts/financial-research/v1/fixtures/bindings.json', 'utf8'))['fixture-macro'];
const graphQuery = { targetNodeId: 'claim', asOf: '2026-01-05T00:00:00Z' };
function nextGraph() {
  return { ...graph(), revision: 2, previousGraphRef: { ...vector('closed-lineage').fixtureRef, objectId: 'fixture', locator: '/closed-lineage/graph' } };
}

test('immediate graph revision preserves node and relation identities', () => assert.equal(assessGraph(nextGraph(), graphQuery).outcome, 'supported'));
for (const [field, mutate] of [
  ['ref', (n) => { n.ref = graph().nodes[0].ref; }],
  ['kind', (n) => { n.kind = 'evidence'; }],
  ['origin', (n) => { n.origin = 'ai_draft'; }],
  ['releaseAvailableAt', (n) => { n.releaseAvailableAt = null; }],
  ['nativeEvidenceRef', (n) => { n.nativeEvidenceRef = { refType: 'document', refId: 'changed' }; }],
  ['formulaRef', (n) => { n.formulaRef = graph().nodes[0].ref; }],
  ['inputManifestRef', (n) => { n.inputManifestRef = graph().nodes[0].ref; }],
]) test(`graph revision rejects reused nodeId with changed ${field}`, () => {
  const g = nextGraph(); mutate(g.nodes[3]);
  assert.throws(() => assessGraph(g, graphQuery), /NODE_IDENTITY_OVERWRITE/);
});
test('graph revision cannot skip its immediate predecessor', () => {
  const g = nextGraph(); g.revision = 3;
  assert.throws(() => assessGraph(g, graphQuery), /GRAPH_REVISION/);
});
test('unchanged relationId cannot silently point at a changed endpoint object', () => {
  const g = nextGraph(); g.nodes[3].ref = g.nodes[2].ref;
  assert.deepEqual(g.edges, graph().edges);
  assert.throws(() => assessGraph(g, graphQuery), /NODE_IDENTITY_OVERWRITE/);
});
test('conditions can be reprojected without changing immutable identity', () => {
  const g = nextGraph(); g.nodes[3].conditions = ['stale']; g.nodes[3].conditionSourceRefs = [g.nodes[3].ref];
  assert.deepEqual(assessGraph(g, graphQuery).conditions, ['stale']);
});
test('new node identity requires new relation identity when changing an endpoint', () => {
  const g = nextGraph(); g.nodes[3].nodeId = 'new-fact';
  for (const e of g.edges) { if (e.from === 'fact') e.from = 'new-fact'; if (e.to === 'fact') e.to = 'new-fact'; }
  assert.throws(() => assessGraph(g, graphQuery), /RELATION_OVERWRITE/);
  for (const e of g.edges.filter((e) => e.from === 'new-fact' || e.to === 'new-fact')) { e.supersedesRelationId = e.relationId; e.relationId += '-v2'; }
  assert.equal(assessGraph(g, graphQuery).outcome, 'supported');
});
for (const [name, mutate, error] of [
  ['delete', (v) => v.pop(), /SUITE_ROSTER/],
  ['add', (v) => v.push({ ...v[0], caseId: 'undeclared' }), /SUITE_ROSTER/],
  ['version mutation', (v) => { v[0].version++; }, /SUITE_ROSTER/],
  ['replace at same count', (v) => { v[0].caseId = 'undeclared'; }, /SUITE_ROSTER/],
  ['duplicate identity', (v) => { v[1] = clone(v[0]); }, /SUITE_DUPLICATE_IDENTITY/],
  ['same-version expected mutation', (v) => { v[0].expected.value = 999; }, /SUITE_CASE_DRIFT/],
]) test(`released suite rejects ${name}`, () => { const cases = clone(vectors); mutate(cases); assert.throws(() => checkSuite(cases), error); });
test('released suite allows case array reordering', () => assert.equal(checkSuite(clone(vectors).reverse()).count, 33));
test('every synthetic fixture pin checks identity, version, digest and locator', () => {
  const pins = new Map();
  function visit(x) {
    if (!x || typeof x !== 'object') return;
    if (typeof x.owner === 'string' && x.owner.includes('/fixtures/') && typeof x.sha256 === 'string') pins.set(JSON.stringify(x), x);
    for (const v of Object.values(x)) visit(v);
  }
  visit(vectors);
  visit(JSON.parse(readFileSync('contracts/financial-research/v1/fixtures/scenarios.json', 'utf8')));
  visit(binding());
  assert.ok(pins.size >= 50);
  for (const pin of pins.values()) {
    resolvePin(pin);
    for (const [key, value, error] of [['objectId', 'incorrect', /PIN_IDENTITY/], ['version', 'incorrect', /PIN_VERSION/], ['sha256', '0'.repeat(64), /PIN_DIGEST/], ['locator', '/absent', /PIN_LOCATOR/]]) {
      assert.throws(() => resolvePin({ ...pin, [key]: value }), error, `${pin.owner}${pin.locator} ${key}`);
    }
  }
});

test('all frozen categories and Golden Cases validate without production runtime', () => assert.equal(checkAll().status, 'PASS'));
for (const v of vectors) test(`golden semantics: ${v.caseId}`, () => checkCase(v));
for (const [field, value] of [['value', 999], ['citationRefs', []], ['selectedRefs', []], ['outcome', 'blocked'], ['conditions', ['stale']]]) {
  test(`oracle rejects fabricated ${field}`, () => {
    const v = vector('past-vintage'); v.expected[field] = value;
    assert.throws(() => checkCase(v), /GOLDEN_MISMATCH/);
  });
}
test('Agent and deterministic result citation sets share order-insensitive exact semantics', () => {
  const v = vector('closed-lineage'); v.expected.citationRefs.reverse();
  checkCase(v);
  v.expected.citationRefs.push('invented-citation');
  assert.throws(() => checkCase(v), /GOLDEN_MISMATCH/);
});
test('unknown request fields and operation/request mismatches are rejected', () => {
  const v = vector('past-vintage'); v.request.sql = 'not a contract field';
  assert.throws(() => checkCase(v), /SCHEMA_INVALID/);
  const wrong = vector('closed-lineage'); wrong.operation = 'qualify_earnings';
  assert.throws(() => checkCase(wrong), /SCHEMA_INVALID/);
});
test('future release cannot be admitted by lying in expected output', () => {
  const v = vector('future-only'); v.expected = vector('past-vintage').expected;
  assert.throws(() => checkCase(v), /GOLDEN_MISMATCH/);
});
test('pin digest, locator, identity and revision are independently checked', () => {
  const pin = graph().nodes[0].ref;
  for (const [key, value] of [['sha256', '0'.repeat(64)], ['locator', '/absent'], ['objectId', 'other'], ['version', '2'], ['owner', '../outside.json']]) {
    assert.throws(() => resolvePin({ ...pin, [key]: value }), /PIN_/);
  }
});
test('time roles cannot alias observation or audit fields', () => {
  const b = binding(); b.fieldBindings.releaseAvailableAt = b.fieldBindings.observationDate;
  assert.throws(() => validateBinding(b), /TEMPORAL_ALIAS/);
  const audit = binding(); audit.fieldBindings.releaseAvailableAt.pointer = '/fetchedAt';
  assert.throws(() => validateBinding(audit), /TEMPORAL_ROLE/);
});
test('entity display label is not part of deterministic identity', () => {
  const v = vector('past-vintage'); v.request.entity.displayName = 'display only'; checkCase(v);
});
test('field mapping typo and consumer policy overlap fail closed', () => {
  const b = binding(); b.fieldBindings.releaseAvailableAt.pointer = '/inventedTime';
  assert.throws(() => validateBinding(b), /BINDING_FIELD_UNKNOWN/);
  const overlap = binding(); overlap.forbiddenUses.push('strict_pit');
  assert.throws(() => validateBinding(overlap), /POLICY_OVERLAP/);
});
for (const [label, mutate, error] of [
  ['dangling edge', (g) => { g.edges[0].from = 'absent'; }, /DANGLING_EDGE/],
  ['duplicate node', (g) => { g.nodes.push({ ...g.nodes[0], releaseAvailableAt: null }); }, /DUPLICATE_NODE/],
  ['duplicate relation', (g) => { g.edges[1].relationId = g.edges[0].relationId; }, /DUPLICATE_RELATION/],
  ['invalid relation type', (g) => { g.edges[0].type = 'supports'; }, /EDGE_TYPE/],
  ['future asserted relation', (g) => { g.edges[0].assertedAt = '2026-01-06T00:00:00Z'; }, /FUTURE_RELATION/],
  ['self correction', (g) => { g.edges[0].supersedesRelationId = g.edges[0].relationId; }, /RELATION_SELF_REVISION/],
  ['missing predecessor', (g) => { g.edges[0].supersedesRelationId = 'missing-prior'; }, /RELATION_PREDECESSOR/],
  ['unpinned graph revision', (g) => { g.revision = 2; }, /SCHEMA_INVALID/],
  ['cycle', (g) => { g.edges.push({ relationId: 'cycle', from: 'derived_metric', to: 'derived_metric', type: 'input_to', assertedAt: '2026-01-02T00:00:00Z', supersedesRelationId: null }); }, /GRAPH_CYCLE/],
]) test(`graph rejects ${label}`, () => { const g = graph(); mutate(g); assert.throws(() => assessGraph(g, graphQuery), error); });
test('missing pin, native candidate quality, formula and unproven conditions never support claims', () => {
  const mutations = [
    (g) => { g.nodes[2].ref.sha256 = '0'.repeat(64); },
    (g) => { g.nodes[2].nativeEvidenceRef.quality = 'candidate'; },
    (g) => { delete g.nodes[4].formulaRef; },
    (g) => { g.nodes[2].conditions = ['partial']; },
  ];
  for (const mutate of mutations) { const g = graph(); mutate(g); assert.equal(assessGraph(g, graphQuery).outcome, 'blocked'); }
});
test('bad lineage propagates through expression, position association and review without rewriting ledger', () => {
  const g = graph(); g.nodes[2].conditions = ['stale', 'not_admitted']; g.nodes[2].conditionSourceRefs = [g.nodes[2].ref];
  for (const targetNodeId of ['thesis', 'investment_expression', 'position', 'review']) {
    const actual = assessGraph(g, { ...graphQuery, targetNodeId });
    assert.equal(actual.outcome, 'blocked'); assert.deepEqual(actual.conditions, ['not_admitted', 'stale']);
  }
});
test('existing objects are referenced, not redefined', () => {
  const s = JSON.parse(readFileSync('contracts/financial-research/v1/shared.schema.json', 'utf8'));
  assert.match(s.$defs.Query.properties.entity.$ref, /contracts\/v1\/research-asset-os/);
  const g = JSON.parse(readFileSync('contracts/financial-research/v1/evidence-graph.v1.schema.json', 'utf8'));
  assert.match(g.properties.nodes.items.properties.nativeEvidenceRef.$ref, /#\/\$defs\/EvidenceRef$/);
  const node = graph().nodes[3]; node.value = 10;
  assert.throws(() => validate('evidence-graph.v1.schema.json', { ...graph(), nodes: [node] }), /SCHEMA_INVALID/);
});
