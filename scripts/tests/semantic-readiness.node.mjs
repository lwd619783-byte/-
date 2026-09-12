import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { ROOT, REPORT_PATH, buildReadinessReport, validateReadinessReport, serializeReadinessReport } from '../semantic-runtime/readiness.mjs';

test('committed compact inputs produce deterministic schema-valid BLOCKED readiness', () => {
  const report = buildReadinessReport();
  assert.deepEqual(report, buildReadinessReport());
  assert.equal(validateReadinessReport(report), true);
  assert.ok(report.metrics.every((metric) => metric.readiness === 'BLOCKED' && metric.blockers.length > 0));
  assert.equal(report.productionAdmitted, false);
  assert.equal(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'), serializeReadinessReport(report));
});

test('PBC preserves available/first release/backcast distinctions and blocks incomplete replay', () => {
  const report = buildReadinessReport();
  const afre = report.sourceEvidence.pbc.metricCounts.MACRO_AFRE_STOCK_YOY;
  assert.equal(afre.availableCount, 111);
  assert.equal(afre.provenFirstReleaseCount, 110);
  assert.equal(afre.backcastCount, 32);
  assert.equal(afre.vintageCount, 180);
  const m2 = report.metrics.find((metric) => metric.metricId === 'MACRO_M2_YOY');
  assert.equal(m2.counts.formalCount, null);
  assert.equal(m2.progress, 'PARTIAL');
  assert.ok(m2.blockers.some((item) => item.code === 'FULL_OBSERVATION_GRAPH_NOT_COMMITTED'));
  assert.equal(report.verification.fullRawReplay, 'NOT_RUN');
});

test('readiness consumes real adapter replay and preserves its evidence role and blockers', () => {
  const report = buildReadinessReport();
  const replay = report.sourceEvidence.pbc.runtimeReplay;
  assert.equal(replay.observationCount, 894);
  assert.equal(replay.eligibleValueCount, 0);
  assert.equal(replay.sourceAdmission, 'PARTIAL');
  assert.equal(replay.semanticBindingValidation, 'PASS');
  assert.equal(replay.semanticBindingCompleteness, 'BLOCKED');
  assert.equal(replay.retainedEvidenceReplay.artifactRole, 'TEST_FIXTURE_EXCERPT');
  assert.equal(replay.retainedEvidenceReplay.retainedBytesVerified, true);
  assert.ok(!replay.blockers.some((item) => item.code === 'COMPACT_METRIC_COUNT_MISMATCH'));
  for (const metric of report.metrics.filter((item) => item.metricId.startsWith('MACRO_'))) {
    for (const blocker of replay.blockers) assert.ok(metric.blockers.some((item) => item.code === blocker.code));
  }
});

test('gate statuses are evaluated separately and every blocking gate has stable evidence and codes', () => {
  const report = buildReadinessReport();
  assert.deepEqual(report.statusCounts, { READY: 0, PARTIAL: 0, BLOCKED: 23 });
  const raw = report.metrics.find((item) => item.metricId === 'MACRO_M2_YOY');
  assert.equal(raw.gateChecks.find((item) => item.gate === 'SEMANTIC_BINDING_VALIDATION').status, 'PASS');
  assert.equal(raw.gateChecks.find((item) => item.gate === 'SEMANTIC_BINDING_COMPLETENESS').status, 'BLOCKED');
  assert.equal(raw.gateChecks.find((item) => item.gate === 'SOURCE_DATA_ADMISSION').status, 'BLOCKED');
  for (const metricId of ['MACRO_M2', 'MACRO_SOCIAL_FINANCING']) {
    const derived = report.metrics.find((item) => item.metricId === metricId);
    for (const gate of ['SEMANTIC_BINDING_VALIDATION', 'VERSIONED_SOURCE_CONTRACT', 'CANONICAL_SCOPE_AND_UNIT']) {
      assert.equal(derived.gateChecks.find((item) => item.gate === gate).status, 'UNKNOWN');
    }
  }
  const refKeys = new Set(report.inputReferences.map((ref) => JSON.stringify(ref)));
  for (const metric of report.metrics) {
    assert.deepEqual(metric.gateChecks.map((item) => item.gate), metric.requiredGates);
    for (const gate of metric.gateChecks) {
      assert.ok(gate.evidenceReferences.every((ref) => refKeys.has(JSON.stringify(ref))));
      if (gate.status === 'PASS') assert.deepEqual(gate.blockerCodes, []);
      else assert.ok(gate.blockerCodes.length > 0 && gate.blockerCodes.every((code) => metric.blockers.some((item) => item.code === code)));
    }
    assert.equal(metric.readiness, metric.gateChecks.every((gate) => gate.status === 'PASS') ? 'READY' : 'BLOCKED');
    assert.equal(metric.normalizationReadiness, metric.readiness);
    assert.equal(metric.pitBacktestReadiness, metric.readiness);
  }
});

test('All-A candidate captures never become observations or a denominator; CSRC remains 0/260', () => {
  const report = buildReadinessReport();
  assert.deepEqual(report.sourceEvidence.allA, { candidateCount: 700, uniqueCandidateKeyCount: 688, formalCount: 0, strictPitCount: 0, targetCount: null, coveragePercent: null });
  assert.deepEqual(report.sourceEvidence.csrc, { candidateCount: 26, targetCount: 260, formalCount: 0, strictPitCount: 0 });
});

test('self-reported READY, reduced blockers, altered counts and evidence hashes are rejected', () => {
  for (const mutate of [
    (report) => { report.metrics[0].readiness = 'READY'; },
    (report) => { report.metrics[0].blockers = []; },
    (report) => { report.sourceEvidence.allA.targetCount = 688; },
    (report) => { report.inputReferences[0].sha256 = 'a'.repeat(64); },
    (report) => { report.metrics.pop(); },
  ]) {
    const report = buildReadinessReport(); mutate(report);
    assert.throws(() => validateReadinessReport(report), /READINESS_EVIDENCE_MISMATCH/);
  }
});

test('unknown schema fields and production admission are rejected', () => {
  const report = buildReadinessReport(); report.productionAdmitted = true;
  assert.throws(() => validateReadinessReport(report), /READINESS_SCHEMA_INVALID/);
  const other = buildReadinessReport(); other.silentOverride = true;
  assert.throws(() => validateReadinessReport(other), /READINESS_SCHEMA_INVALID/);
});

test('CLI roots itself at import.meta.url and defaults to read-only byte verification', () => {
  const before = readFileSync(resolve(ROOT, REPORT_PATH));
  const run = spawnSync(process.execPath, [resolve(ROOT, 'scripts/semantic-runtime/readiness.mjs')], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(readFileSync(resolve(ROOT, REPORT_PATH)), before);
  const invalid = spawnSync(process.execPath, [resolve(ROOT, 'scripts/semantic-runtime/readiness.mjs'), '--ready'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
});
