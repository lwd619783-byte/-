import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAll, checkCase, resolvePin, validate, validateBinding, assessGraph, vectors } from '../contracts/financial-research.mjs';

const clone = (x) => structuredClone(x);
const vector = (id) => clone(vectors.find((v) => v.caseId === id));
const graph = () => resolvePin(vector('closed-lineage').fixtureRef).graph;
const binding = () => JSON.parse(readFileSync('contracts/financial-research/v1/fixtures/bindings.json', 'utf8'))['fixture-macro'];
const graphQuery = { targetNodeId: 'claim', asOf: '2026-01-05T00:00:00Z' };

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
