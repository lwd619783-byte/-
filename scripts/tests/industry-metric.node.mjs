import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { read, bytes, resolve } from '../semantic-runtime/common.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';
import { parseNbsProduction } from '../industry/nbs-parser.mjs';
import { ARTIFACT, BINDING, MANIFEST, PLAN, buildArtifact, buildBinding, checkArtifact, validateIndustryMetric } from '../industry/artifact.mjs';

const manifest = read(MANIFEST), artifact = read(ARTIFACT);
const august = manifest.captures.at(-1), raw = bytes(august.path).toString('utf8');
test('authentic seven-page retained replay, exact source/adapter, 13 observations, independent times', () => {
  assert.equal(checkArtifact().observations, 13);
  for (const o of artifact.observations) {
    assert.notEqual(o.publicationDateTime, null);
    assert.equal(o.releaseAvailableAt, null);
    assert.equal(o.revision.sequence, null);
    assert.equal(o.pit, 'UNPROVED');
    assert.equal(o.dataAdmission, 'NOT_ADMITTED');
    assert.equal(o.provenance.sourceOwner, '国家统计局');
    assert.notEqual(o.provenance.sourceOwner, o.provenance.acquisitionAdapter);
    assert.equal(o.provenance.evidence.quality, 'candidate');
    assert.equal(resolve(o.provenance.captureRef).sha256, o.provenance.rawSha256);
  }
  assert.deepEqual(buildArtifact(artifact.generatedAt).observations, artifact.observations);
});
test('real row positions distinguish monthly output from cumulative and growth columns', () => {
  const parsed = parseNbsProduction(raw, '2026-08');
  assert.deepEqual(parsed.row, ['工业机器人（套）', '96174', '34.6', '729352', '29.0']);
  assert.deepEqual(parsed.values, [{ basis: 'monthly', value: 96174, column: 1 }, { basis: 'year_to_date', value: 729352, column: 3 }]);
  const february = parseNbsProduction(bytes(manifest.captures[0].path).toString('utf8'), '2026-02');
  assert.deepEqual(february.values, [{ basis: 'year_to_date', value: 143608, column: 1 }]);
});
test('synthetic mutations of authentic bytes: zero, missing, invalid numbers and absent publication', () => {
  assert.equal(parseNbsProduction(raw.replace('96174', '0'), '2026-08').values[0].value, 0);
  assert.equal(parseNbsProduction(raw.replace('96174', '—'), '2026-08').values[0].value, null);
  assert.throws(() => parseNbsProduction(raw.replace('96174', 'bad'), '2026-08'), /NUMBER_INVALID/);
  assert.equal(parseNbsProduction(raw.replace('发布时间：', '未知：'), '2026-08').publicationDateTime, null);
});
test('parser fails closed on missing/wrong row, ambiguous copies, period and basis header drift', () => {
  assert.throws(() => parseNbsProduction(raw.replaceAll('工业机器人', '服务机器人'), '2026-08'), /ROW_MISSING/);
  assert.throws(() => parseNbsProduction(raw, '2026-07'), /PERIOD_TABLE_TITLE/);
  assert.throws(() => parseNbsProduction(raw.replaceAll('绝对量', '累计量'), '2026-08'), /VALUE_COLUMN_HEADER/);
  assert.throws(() => parseNbsProduction(raw.replaceAll('2000', '500'), '2026-08'), /SCOPE_UNPROVEN/);
  const march = bytes(manifest.captures[1].path).toString('utf8');
  assert.throws(() => parseNbsProduction(march.replace('91954', '0'), '2026-03'), /ROWS_CONFLICTED/);
});
test('F1 binding uses the existing validator, unresolved entity and no admitted use', () => {
  const binding = read(BINDING); validateBinding(binding);
  assert.equal(binding.domain, 'industry');
  assert.equal(binding.fieldBindings.entity, null);
  assert.deepEqual(binding.allowedUses, []);
  assert.deepEqual(binding.forbiddenUses, ['strict_pit', 'research', 'display']);
  const wrong = structuredClone(binding); wrong.fieldBindings.releaseAvailableAt = wrong.fieldBindings.publicationDate;
  assert.throws(() => validateBinding(wrong), /TEMPORAL_ALIAS/);
  const pinMutation = structuredClone(binding); pinMutation.sourceDefinitionRef.sha256 = '0'.repeat(64);
  assert.throws(() => validateBinding(pinMutation), /PIN_DIGEST/);
});
test('offline validation rejects normalized drift, raw mutation, roster deletion and semantic promotion', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'industry-replay-'));
  const put = (p, value) => { const target = path.join(root, p); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  try {
    for (const p of [PLAN, MANIFEST, ARTIFACT, BINDING, 'contracts/financial-research/v1/examples/pbc-binding.json', ...manifest.captures.map(c => c.path)]) put(p, bytes(p));
    // plan bytes and pins stay exact in a clean replay root.
    assert.equal(checkArtifact(root).status, 'PASS');
    const mutation = structuredClone(artifact); mutation.observations.at(-1).value = 0; put(ARTIFACT, mutation);
    assert.throws(() => checkArtifact(root), /ARTIFACT_DRIFT/); put(ARTIFACT, bytes(ARTIFACT));
    put(august.path, raw + ' '); assert.throws(() => checkArtifact(root), /RAW_DIGEST/); put(august.path, bytes(august.path));
    put(MANIFEST, { ...manifest, captures: manifest.captures.slice(1) }); assert.throws(() => checkArtifact(root), /CAPTURE_ROSTER/); put(MANIFEST, bytes(MANIFEST));
    const promoted = read(BINDING); promoted.allowedUses = ['strict_pit']; put(BINDING, promoted);
    assert.throws(() => checkArtifact(root), /BINDING_DRIFT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('generic-schema-valid mutations cannot promote or change the committed robotics owner', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'industry-owner-drift-'));
  const put = (p, value) => { const target = path.join(root, p); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  try {
    for (const p of [PLAN, MANIFEST, ARTIFACT, BINDING, 'contracts/financial-research/v1/examples/pbc-binding.json', ...manifest.captures.map(c => c.path)]) put(p, bytes(p));
    const mutations = [
      a => { a.definition.id = 'OTHER_METRIC'; },
      a => { a.definition.industryId = 'other-industry'; },
      a => { a.definition.unit = 'MWh'; },
      a => { a.definition.sourceId = 'OTHER_SOURCE'; },
      a => { a.definition.sourceOwner = 'Other owner'; },
      a => { a.definition.acquisitionAdapter = 'other-adapter'; },
      a => { a.definition.window.start = '2025-01'; },
      a => { a.definition.missingMonthlyPeriods = []; },
      a => { a.completeness.monthlyTarget = 6; },
      a => { a.definition.nativeFrequency = 'quarterly'; a.definition.basis = ['quarter_total']; },
      a => { a.definition.entity = { entityType: 'industry', entityId: 'unproved-entity' }; a.policy.entityResolution = 'RESOLVED'; },
      a => { a.policy.dataAdmission = 'ADMITTED'; a.policy.allowedUses = ['display']; a.policy.forbiddenUses = ['strict_pit', 'research']; },
      a => { a.policy.productionAdmission = 'ADMITTED'; },
      a => { a.observations[0].releaseAvailableAt = a.observations[0].publicationDateTime; },
      a => { a.observations[0].pit = 'PROVEN'; },
      a => { a.observations[0].revision = { status: 'revised', sequence: 1, supersedes: 'unproved-previous', retainedVintage: 'unproved-vintage' }; },
      a => { a.observations[0].dataAdmission = 'ADMITTED'; },
      a => { a.observations[0].productionAdmission = 'ADMITTED'; },
      a => { a.observations[0].provenance.evidence.quality = 'verified'; },
    ];
    for (const mutate of mutations) {
      // Let closed JSDOM windows finish their queued cleanup between full seven-page replays.
      await setImmediate();
      const mutation = structuredClone(artifact); mutate(mutation);
      assert.equal(validateIndustryMetric(mutation), true, JSON.stringify(validateIndustryMetric.errors));
      put(ARTIFACT, mutation);
      assert.throws(() => checkArtifact(root), /NORMALIZED_ARTIFACT_DRIFT/);
    }
    put(ARTIFACT, bytes(ARTIFACT));
    assert.equal(checkArtifact(root).status, 'PASS');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reviewed pilot plan cannot be changed and re-sealed through either artifact or binding builder', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'industry-plan-drift-'));
  const target = path.join(root, PLAN);
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    const mutations = [
      p => { p.definition.id = 'OTHER_METRIC'; },
      p => { p.definition.sourceId = 'OTHER_SOURCE'; },
      p => { p.definition.window.end = '2026-09'; },
      p => { p.definition.missingMonthlyPeriods = []; },
      p => { p.policy.dataAdmission = 'ADMITTED'; },
      p => { p.policy.productionAdmission = 'ADMITTED'; },
      p => { p.policy.allowedUses = ['strict_pit']; },
      p => { p.releases[0].url = p.releases[1].url; },
    ];
    for (const mutate of mutations) {
      const plan = read(PLAN); mutate(plan); writeFileSync(target, JSON.stringify(plan));
      assert.throws(() => buildArtifact(artifact.generatedAt, root), /PILOT_PLAN_DRIFT/);
      assert.throws(() => buildBinding(root), /PILOT_PLAN_DRIFT/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
