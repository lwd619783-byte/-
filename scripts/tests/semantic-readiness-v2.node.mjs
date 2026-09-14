import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { bytes, read } from '../semantic-runtime/common.mjs';
import { buildReadinessV2, validateReadinessV2, verifyPublishedV1, V2_REPORT, PRESERVED_V1 } from '../semantic-runtime/readiness-v2.mjs';
import { evaluateReadinessGates, NORMALIZATION_GATES, PIT_BACKTEST_GATES } from '../semantic-runtime/readiness.mjs';
import { queryMacro, queryForDefinition } from '../semantic-runtime/market-regime-adapter-v2.mjs';

const report = read(V2_REPORT), baseline = read('research-data/market-regime/semantic-readiness/report.v1.json');
test('V1 published owners and verdict remain verifiable; V2 is deterministic', () => {
  assert.equal(verifyPublishedV1(), true);
  assert.deepEqual(buildReadinessV2(), report);
  assert.equal(validateReadinessV2(report), true);
});
test('V1 preservation rejects changing old owner semantics or report, not only old verdict counts', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'readiness-v1-freeze-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const owner of [PRESERVED_V1, ...read(PRESERVED_V1).files.map((f) => f.path)]) {
    mkdirSync(dirname(join(root, owner)), {recursive: true}); writeFileSync(join(root, owner), bytes(owner));
  }
  const owner = 'config/market-regime/semantic-owner-policy.v1.json';
  const changed = read(owner); changed.policy.entityResolution.status = 'RESOLVED';
  writeFileSync(join(root, owner), JSON.stringify(changed));
  assert.throws(() => verifyPublishedV1({root}), /V1_PUBLISHED_SEMANTICS_CHANGED/);
});
test('23 metrics and all 368 full-scope gate deltas reproduce their V1 and V2 owners', () => {
  assert.equal(report.metrics.length, 23); assert.equal(report.gateDelta.length, 368);
  for (const delta of report.gateDelta) {
    const old = baseline.metrics.find((m) => m.metricId === delta.metricId).gateChecks.find((g) => g.gate === delta.gate);
    const current = report.metrics.find((m) => m.metricId === delta.metricId).gateChecks.find((g) => g.gate === delta.gate);
    assert.equal(delta.previousStatus, old.status); assert.equal(delta.currentStatus, current.status);
    assert.deepEqual(delta.previousBlockers, old.blockerCodes); assert.deepEqual(delta.currentBlockers, current.blockerCodes);
    assert.equal(delta.closedByThisTaskEvidence, false);
  }
  const canary = report.evidenceCapabilityDelta[0];
  assert.equal(canary.previousStatus, 'BLOCKED'); assert.equal(canary.currentStatus, 'PASS');
  assert.equal(canary.closedByThisTaskEvidence, true); assert.ok(canary.supportingRefs.length > 1);
});
for (const mutation of ['delete blocker', 'forge PASS', 'forge delta']) test(`V2 validator rejects ${mutation}`, () => {
  const forged = structuredClone(report);
  if (mutation === 'delete blocker') forged.metrics[0].blockers.pop();
  if (mutation === 'forge PASS') forged.metrics[0].gateChecks[0].status = 'PASS';
  if (mutation === 'forge delta') forged.gateDelta[0].closedByThisTaskEvidence = true;
  assert.throws(() => validateReadinessV2(forged), /READINESS_V2_EVIDENCE_OR_DELTA_MISMATCH/);
});
test('normalization and backtest eligibility are still independently evaluated', () => {
  const gates = [...new Set([...NORMALIZATION_GATES, ...PIT_BACKTEST_GATES])].map((gate) => ({gate, status: gate === 'HISTORICAL_COVERAGE' ? 'BLOCKED' : 'PASS'}));
  assert.deepEqual(evaluateReadinessGates(gates), {normalizationReadiness: 'READY', pitBacktestReadiness: 'BLOCKED', readiness: 'BLOCKED'});
  assert.deepEqual(report.normalizationCounts, {READY: 0, BLOCKED: 23}); assert.deepEqual(report.pitBacktestCounts, {READY: 0, BLOCKED: 23});
});
test('CSRC and all-A source counts and every non-identity gate are unchanged', () => {
  for (const owner of ['csrc', 'allA']) assert.deepEqual(report.sourceEvidence[owner], baseline.sourceEvidence[owner]);
  for (const metricId of ['SUPPLY_IPO_FINANCING', 'SENT_A_SHARE_TURNOVER', 'VAL_BUFFETT_INDICATOR_CN']) {
    const old = baseline.metrics.find((m) => m.metricId === metricId), current = report.metrics.find((m) => m.metricId === metricId);
    assert.deepEqual(current.counts, old.counts);
    assert.deepEqual(current.gateChecks.filter((g) => g.gate !== 'ENTITY_REGISTRY_RESOLUTION'), old.gateChecks.filter((g) => g.gate !== 'ENTITY_REGISTRY_RESOLUTION'));
  }
  assert.ok(report.metrics.filter((m) => m.metricId.startsWith('MACRO_')).every((m) => m.gateChecks.find((g) => g.gate === 'COMPLETE_OBSERVATION_GRAPH_REPLAY').status === 'BLOCKED'));
});
test('V2 query consumes canary native graph only after cutoff; source and identity stay blocked', () => {
  const q = queryForDefinition('pbc-m2-yoy-2011-v2', {start:'2011-10-01',end:'2011-10-31'}, '2011-11-14T08:00:00+08:00', 'strict_pit', {entityType:'macro',entityId:'caller-claim'});
  const after = queryMacro(q), before = queryMacro({...q, asOf:'2011-11-07T08:00:00+08:00'});
  assert.equal(after.value, null); assert.ok(after.blockers.some((b) => b.code === 'ENTITY_REGISTRY_UNRESOLVED'));
  assert.ok(after.evidenceRefs.some((r) => r.includes('/dataset/fieldExtractions/0')));
  assert.ok(!after.blockers.some((b) => b.code === 'EXCERPT_IS_NOT_RAW_SOURCE'));
  assert.deepEqual(before.selectedRefs, []); assert.ok(!JSON.stringify(before).includes('obs-pbc-'));
  const ajv = new Ajv2020({strict: true, strictRequired: false}); addFormats(ajv);
  for (const p of ['contracts/v1/research-asset-os.contracts.v1.schema.json', 'contracts/financial-research/v1/shared.schema.json', 'contracts/stage-4-1/v2/semantic-runtime.schema.json']) ajv.addSchema(read(p));
  const validate = ajv.getSchema(read('contracts/stage-4-1/v2/semantic-runtime.schema.json').$id);
  assert.equal(validate(after), true, ajv.errorsText(validate.errors));
  assert.equal(validate(before), true, ajv.errorsText(validate.errors));
});
test('Hosted CI checks preserved V1, V2 and canary with direct failure-propagating commands', () => {
  const yaml = bytes('.github/workflows/ci.yml').toString('utf8');
  for (const command of ['data:validate:semantic-bindings', 'test:semantic-runtime', 'data:validate:semantic-readiness', 'test:stage-4-1-g', 'data:validate:pbc-evidence-v2', 'data:validate:semantic-readiness:v2']) {
    assert.ok(yaml.includes('run: npm run ' + command));
  }
  assert.ok(!yaml.includes('data:build:semantic-readiness')); assert.ok(!yaml.includes('continue-on-error'));
});
