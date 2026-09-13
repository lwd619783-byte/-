import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPbcEvidenceClosure, validatePbcEvidenceClosure, queryCanaryEvidence } from '../semantic-runtime/pbc-evidence-v2.mjs';

test('retained PBC canary is deterministic while full graph and source admission remain blocked', () => {
  const report = validatePbcEvidenceClosure();
  assert.deepEqual(buildPbcEvidenceClosure(), report);
  assert.equal(report.positiveReplay.status, 'PASS');
  assert.equal(report.positiveReplay.nativeObservationCount, 1);
  assert.equal(report.fullGraphReplay.status, 'BLOCKED');
  assert.equal(report.fullGraphReplay.expectedObservationCount, 894);
  assert.equal(report.sourceAdmission.status, 'BLOCKED');
  assert.ok(report.fullGraphReplay.missingOwners.length > 0);
});

test('query canary filters future native identities and refs before exposing them', () => {
  const request = { asOf: '2011-11-07T08:00:00+08:00', metricId: 'MACRO_M2_YOY', sourceDefinitionId: 'pbc-m2-yoy-2011-v2', valueDate: '2011-10' };
  const before = queryCanaryEvidence(request);
  assert.deepEqual(before.observations, []);
  assert.deepEqual(before.evidenceRefs, []);
  const after = queryCanaryEvidence({ ...request, asOf: '2011-11-14T08:00:00+08:00' });
  assert.equal(after.observations[0].value, 12.9);
  assert.ok(after.evidenceRefs.some((ref) => ref.includes('/fieldExtractions/')));
  assert.equal(after.fullGraphReplay, 'BLOCKED');
});
