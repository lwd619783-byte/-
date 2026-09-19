import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { industrySignalContext, checkIndustrySignalClaims } from '../industry/signal-claim.mjs';
import { buildIndustrySignalClaims, retainedDifference, assessIndustryGraph, prosperityEligibility, SIGNAL_POLICY, canonical } from '../../src/services/industrySignalClaim.mjs';
import { createIndustryMetricProvider } from '../../src/services/industryMetricRegistry.mjs';
import { createIndustryDimensions } from '../../src/services/industryDimensions.mjs';
import { resolvePin } from '../contracts/financial-research.mjs';
const clone = value => structuredClone(value);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const context = await industrySignalContext(), result = await buildIndustrySignalClaims(context);
const owner = context.provider.get('oil-shipping', 'US_EIA_CRUDE_EXPORTS').owner;
const oil = result.graphs.find(g => g.graph.graphId.startsWith('US_EIA_CRUDE_EXPORTS:'));
const assess = g => assessIndustryGraph(g, { asOf: oil.graph.asOf, targetNodeId: oil.targetNodeId }, result.resolvePin);

test('five reviewed deterministic absolute changes, exact pins and retained bytes replay', async () => {
  assert.equal((await checkIndustrySignalClaims()).status, 'PASS');
  assert.deepEqual(result.derived.signals.map(s => [s.metricId, s.value]), [
    ['CN_NBS_INDUSTRIAL_ROBOT_OUTPUT', -2503], ['US_EIA_COMMERCIAL_CRUDE_STOCKS', -640],
    ['US_EIA_CRUDE_EXPORTS', 1414], ['US_EIA_CRUDE_PRODUCTION', -3], ['US_EIA_REFINERY_CRUDE_INPUT', -256],
  ]);
  for (const signal of result.derived.signals) assert.deepEqual(signal.conditions, ['not_admitted', 'partial', 'unknown']);
  assert.equal(result.derived.claims.length, 5);
  for (const g of result.graphs) {
    assert.deepEqual([...new Set(g.graph.nodes.map(n => n.kind))].sort(), ['artifact', 'claim', 'derived_metric', 'evidence', 'fact', 'source']);
    for (const n of g.graph.nodes) assert.deepEqual(result.resolvePin(n.ref), resolvePin(n.ref));
    assert.equal(g.assessment.outcome, 'blocked');
  }
});
test('same inputs, resource/provider/Registry/mapping reordering leaves every output identical', async () => {
  const registry = read('config/industry/industry-metric-registry.v1.json'); registry.entries.reverse();
  const provider = await createIndustryMetricProvider(registry, [...context.resources].reverse());
  const mapping = read('config/industry/industry-dimension-mapping.v1.json'); mapping.entries.reverse();
  const dimensions = await createIndustryDimensions(mapping, provider);
  const actual = await buildIndustrySignalClaims({ provider: { get: provider.get, list: id => provider.list(id).reverse() }, dimensions, resources: [...context.resources].reverse() });
  assert.deepEqual(actual.derived, result.derived); assert.deepEqual(actual.graphs, result.graphs); assert.deepEqual(actual.gates, result.gates);
  const shuffled = clone(owner); shuffled.observations.reverse();
  assert.deepEqual(retainedDifference(shuffled, 'week_ending'), retainedDifference(owner, 'week_ending'));
});
for (const [name, mutate, expectedValue, flag] of [
  ['zero is data', o => { o.observations.at(-1).value = 0; }, -3417, 'not_admitted'],
  ['equal values retain zero difference', o => { o.observations.at(-1).value = 3417; }, 0, 'unknown'],
  ['missing endpoint', o => { o.observations.pop(); }, null, 'missing_evidence'],
  ['missing previous', o => { o.observations.splice(-2, 1); }, null, 'missing_evidence'],
  ['null endpoint', o => { o.observations.at(-1).value = null; }, null, 'missing_evidence'],
  ['missing operand evidence', o => { o.observations.at(-1).conditions.push('missing_evidence'); }, null, 'missing_evidence'],
  ['non-finite endpoint', o => { o.observations.at(-1).value = Infinity; }, null, 'missing_evidence'],
  ['duplicate conflict', o => { o.observations.push(clone(o.observations.at(-1))); }, null, 'conflicted'],
  ['explicit conflict', o => { o.observations.at(-1).conditions.push('conflicted'); }, null, 'conflicted'],
  ['stale owner', o => { o.definition.freshness = 'STALE'; }, 1414, 'stale'],
  ['stale observation', o => { o.observations.at(-1).conditions.push('stale'); }, 1414, 'stale'],
  ['foreign industry', o => { o.observations[0].industryId = 'robotics'; }, null, 'conflicted'],
  ['foreign metric', o => { o.observations[0].metricId = 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT'; }, null, 'conflicted'],
]) test(`arithmetic kernel explicit synthetic mutation: ${name}`, () => {
  const copy = clone(owner); mutate(copy); const output = retainedDifference(copy, 'week_ending');
  assert.equal(output.value, expectedValue); assert.ok(output.conditions.includes(flag));
  assert.ok(output.conditions.includes('not_admitted')); assert.ok(output.conditions.includes('unknown'));
});
test('YoY and accumulated values have no formula or inferred growth', () => {
  const nbs = context.provider.get('robotics', 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT').owner;
  assert.equal(retainedDifference(nbs, 'year_to_date').value, null);
  const yoy = context.provider.get('robotics', 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY').owner;
  assert.equal(retainedDifference(yoy, 'monthly').value, null);
  assert.ok(!result.derived.signals.some(s => s.metricId === yoy.definition.id));
});
for (const [name, mutate] of [
  ['formula version', c => { c.formula.version = '2'; }], ['formula operation', c => { c.formula.operation = 'eval'; }],
  ['formula substitution', c => { c.entries[0].formulaId = 'percentage'; }], ['foreign industry', c => { c.entries[0].industryId = 'oil-shipping'; }],
  ['foreign pin', c => { c.entries[0].definitionRef.sha256 = '0'.repeat(64); }], ['template text', c => { c.template.text = '景气上行'; }],
  ['free text', c => { c.claimText = 'bullish'; }], ['roster shrink', c => { c.entries.pop(); }],
  ['gate denominator shrink', c => { c.gate.requiredDimensions.robotics = ['supply']; }],
]) test(`review fingerprint rejects ${name} even if JSON is valid`, async () => {
  const resources = clone(context.resources); const resource = resources.find(r => r.path === SIGNAL_POLICY);
  const c = JSON.parse(resource.raw); mutate(c); resource.raw = JSON.stringify(c);
  await assert.rejects(buildIndustrySignalClaims({ ...context, resources }), /SIGNAL_POLICY_REVIEW_DRIFT/);
});
test('same-count foreign/resealed artifact cannot enter the reviewed service', async () => {
  const metrics = [...context.provider.list('oil-shipping'), ...context.provider.list('robotics')].map(clone);
  metrics[0].owner.observations.at(-1).value = 0;
  const provider = { list: id => metrics.filter(m => m.entry.industryId === id), get: (id, metric) => metrics.find(m => m.entry.industryId === id && m.entry.metricId === metric) };
  await assert.rejects(buildIndustrySignalClaims({ ...context, provider }), /SIGNAL_OWNER_BYTES_DRIFT/);
});
test('reviewed template has no caller text and never promotes candidate', () => {
  for (const c of result.derived.claims) {
    assert.equal(c.generation, 'TEMPLATE'); assert.equal(c.status, 'CANDIDATE'); assert.equal(c.origin, 'ai_draft');
    assert.match(c.text, /^当前留存快照中，/); assert.ok(c.templateRef.sha256);
    assert.ok(!/bullish|bearish|景气上行|景气下行|买入|卖出|Verified/.test(c.text));
  }
});
test('support and contradiction survive together; all bad branches propagate', () => {
  const g = clone(oil.graph), fact = g.nodes.find(n => n.kind === 'fact');
  g.edges.push({ relationId: 'explicit-test-counterevidence', from: fact.nodeId, to: oil.targetNodeId, type: 'contradicts', assertedAt: g.asOf, supersedesRelationId: null });
  const before = canonical(g), actual = assess(g);
  assert.equal(actual.outcome, 'conflicted'); assert.ok(actual.conditions.includes('conflicted'));
  assert.equal(canonical(g), before); assert.ok(g.edges.some(e => e.type === 'supports')); assert.ok(g.edges.some(e => e.type === 'contradicts'));
});
for (const [name, mutate] of [
  ['evidence absent', g => { g.edges = g.edges.filter(e => e.type !== 'establishes'); }],
  ['claim unsupported', g => { g.edges = g.edges.filter(e => e.type !== 'supports'); }],
  ['input manifest mismatch', g => { g.edges = g.edges.filter(e => e.type !== 'input_to'); }],
  ['pin drift', g => { g.nodes[0].ref.sha256 = '0'.repeat(64); }],
  ['foreign valid owner', g => { g.nodes[0].ref = clone(result.graphs[0].graph.nodes[0].ref); }],
  ['formula pin drift', g => { g.nodes.find(n => n.kind === 'derived_metric').formulaRef.version = '2'; }],
  ['locator drift', g => { g.nodes.find(n => n.kind === 'fact').ref.locator = '/observations/0'; }],
  ['native Evidence substitution', g => { g.nodes.find(n => n.kind === 'evidence').nativeEvidenceRef.refId = 'foreign'; }],
  ['conditions stripped', g => { for (const n of g.nodes) n.conditions = []; }],
  ['invented release time', g => { g.nodes[0].releaseAvailableAt = g.asOf; }],
  ['swapped exact observation lineage', g => { const e = g.edges.filter(e => e.type === 'establishes'); [e[0].from, e[1].from] = [e[1].from, e[0].from]; }],
]) test(`F2 fail closed: ${name}`, () => { const g = clone(oil.graph); mutate(g); assert.ok(assess(g).conditions.includes('missing_evidence')); });
for (const [name, mutate, error] of [
  ['dangling ref', g => { g.edges[0].from = 'missing'; }, /DANGLING_EDGE/],
  ['cycle', g => { const n = g.nodes.find(n => n.kind === 'derived_metric'); g.edges.push({ ...g.edges[0], relationId: 'cycle', from: n.nodeId, to: n.nodeId, type: 'input_to' }); }, /GRAPH_CYCLE/],
  ['unretained revision', g => { g.revision = 2; }, /F2_SCHEMA_INVALID/],
]) test(`F2 rejects ${name}`, () => { const g = clone(oil.graph); mutate(g); assert.throws(() => assess(g), error); });
test('resolved pins and returned read models cannot mutate beneath their archived digest', () => {
  assert.throws(() => { result.derived.signals[0].value = 0; }, TypeError);
  assert.throws(() => { result.resolvePin(oil.graph.nodes.find(n => n.kind === 'fact').ref).value = 0; }, TypeError);
  assert.throws(() => { result.graphs[0].graph.nodes.pop(); }, TypeError);
});
test('eligibility never emits score/direction and returns fixed dimension blockers', () => {
  for (const g of result.gates) {
    assert.equal(g.outcome, 'ABSTAIN'); assert.equal(g.eligibility, 'NOT_ELIGIBLE');
    for (const code of ['DATA_NOT_ADMITTED', 'PIT_UNPROVED', 'RELEASE_TIME_UNKNOWN', 'REVISION_CONTINUITY_UNKNOWN', 'DIMENSION_MISSING']) assert.ok(g.blockers.includes(code));
    for (const key of ['score', 'direction', 'trend', 'thesis', 'bullish', 'bearish']) assert.ok(!Object.hasOwn(g, key));
  }
  assert.deepEqual(result.gates.find(g => g.industryId === 'oil-shipping').missingDimensions, ['price']);
  assert.deepEqual(result.gates.find(g => g.industryId === 'robotics').missingDimensions, ['demand', 'margin', 'price']);
  const metrics = context.provider.list('oil-shipping').map(clone); metrics[0].owner.observations[0].conditions.push('conflicted');
  const gate = prosperityEligibility('oil-shipping', metrics, context.dimensions, result.graphs, read(SIGNAL_POLICY).gate);
  assert.ok(gate.blockers.includes('CONFLICTED_INPUT'));
});
