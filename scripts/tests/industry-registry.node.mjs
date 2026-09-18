import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { read, bytes, sha256 } from '../semantic-runtime/common.mjs';
import { REGISTRY, registryResources, checkRegistry, validateRegistry } from '../industry/registry.mjs';
import { YOY_OWNER, MANIFEST, checkArtifact, buildArtifact, buildBinding, validateIndustryMetric } from '../industry/artifact.mjs';
import { parseNbsProduction } from '../industry/nbs-parser.mjs';
import { createIndustryMetricProvider } from '../../src/services/industryMetricRegistry.mjs';
const registry = read(REGISTRY), resources = registryResources();
const create = (r = registry, files = resources) => createIndustryMetricProvider(r, files, sha256);
const growth = read(YOY_OWNER.artifact), manifest = read(MANIFEST);
const raw = bytes(manifest.captures.at(-1).path).toString('utf8');

test('two real owners replay with existing schema, F1/Evidence checks and unchanged admission', async () => {
  assert.equal(validateRegistry(registry), true);
  const result = await checkRegistry(); assert.equal(result.metrics, 2);
  for (const owner of result.replay) { assert.equal(owner.observations, 13); assert.equal(owner.dataAdmission, 'NOT_ADMITTED'); assert.equal(owner.semanticBinding, 'VALID / NOT_READY'); }
  assert.deepEqual(buildArtifact(growth.generatedAt, undefined, YOY_OWNER), growth);
  assert.deepEqual(buildBinding(undefined, YOY_OWNER), read(YOY_OWNER.binding));
  for (const o of growth.observations) {
    assert.equal(o.unit, '%'); assert.equal(o.releaseAvailableAt, null); assert.equal(o.pit, 'UNPROVED');
    assert.equal(o.provenance.evidence.quality, 'candidate'); assert.equal(o.value, Number(o.provenance.rawRow[o.provenance.column]));
    assert.equal(o.provenance.column, o.basis === 'monthly' ? 2 : (o.valueDate === '2026-02' ? 2 : 4));
  }
});
test('official native growth columns preserve signed values, zero and missing; never derive from absolute columns', () => {
  assert.deepEqual(parseNbsProduction(raw, '2026-08', 'official_yoy').values, [{ basis: 'monthly', value: 34.6, column: 2 }, { basis: 'year_to_date', value: 29, column: 4 }]);
  for (const [text, value] of [['0', 0], ['-3.4', -3.4], ['—', null]]) assert.equal(parseNbsProduction(raw.replaceAll('34.6', text), '2026-08', 'official_yoy').values[0].value, value);
  assert.equal(parseNbsProduction(raw.replaceAll('96174', '1'), '2026-08', 'official_yoy').values[0].value, 34.6);
  assert.throws(() => parseNbsProduction(raw.replaceAll('同比增长', '环比增长'), '2026-08', 'official_yoy'), /VALUE_COLUMN_HEADER/);
  assert.throws(() => parseNbsProduction(raw.replaceAll('34.6', 'unproved'), '2026-08', 'official_yoy'), /NUMBER_INVALID/);
  const march = bytes(manifest.captures[1].path).toString('utf8');
  const value = parseNbsProduction(march, '2026-03', 'official_yoy').values[0].value;
  assert.throws(() => parseNbsProduction(march.replace(String(value), '999.9'), '2026-03', 'official_yoy'), /ROWS_CONFLICTED/);
});
test('registry/resource ordering is irrelevant; exact identity only, immutable snapshots', async () => {
  const a = await create(), b = await create({ ...registry, entries: [...registry.entries].reverse() }, [...resources].reverse());
  assert.deepEqual(a.list('robotics'), b.list('robotics'));
  assert.equal(a.list('robotics').length, 2);
  assert.equal(a.get('other', registry.entries[0].metricId), null);
  assert.equal(a.get('robotics', 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YO'), null);
  assert.deepEqual(a.list('other'), []);
  assert.throws(() => { a.list('robotics')[0].owner.definition.id = 'mutated'; }, TypeError);
});
const cases = [
  ['duplicate identity', r => r.entries.push(structuredClone(r.entries[0])), /DUPLICATE_METRIC/],
  ['wrong industry', r => { r.entries[0].industryId = 'other'; }, /ARTIFACT_IDENTITY/],
  ['dangling artifact', r => { r.entries[0].artifactRef.owner = 'src/data/real/missing.json'; }, /MISSING_OWNER/],
  ['wrong digest', r => { r.entries[0].artifactRef.sha256 = '0'.repeat(64); }, /PIN_DIGEST/],
  ['wrong version', r => { r.entries[0].artifactRef.version = '2'; }, /PIN_IDENTITY/],
  ['wrong pin identity', r => { r.entries[0].definitionRef.objectId = 'other'; }, /PIN_IDENTITY/],
  ['wrong locator', r => { r.entries[0].artifactRef.locator = '/missing'; }, /PIN_LOCATOR/],
  ['artifact substitution', r => { r.entries[0].artifactRef = r.entries[1].artifactRef; }, /ARTIFACT_IDENTITY/],
  ['binding substitution', r => { r.entries[0].bindingRef = r.entries[1].bindingRef; }, /BINDING_IDENTITY/],
  ['policy substitution', r => { r.entries[0].policyRef = r.entries[1].policyRef; }, /OWNER_IDENTITY/],
  ['percent absolute delta', r => { r.entries[1].presentation.delta = 'absolute_difference'; }, /PRESENTATION/],
];
for (const [name, mutate, error] of cases) test(`fail closed: ${name}`, async () => { const r = structuredClone(registry); mutate(r); await assert.rejects(create(r), error); });
test('missing, duplicated and unregistered conflicting owner cannot be silently substituted', async () => {
  await assert.rejects(create(registry, resources.filter(f => f.path !== YOY_OWNER.artifact)), /MISSING_OWNER/);
  await assert.rejects(create(registry, [...resources, resources[0]]), /DUPLICATE_RESOURCE_OWNER/);
  await assert.rejects(create(registry, [...resources, { path: 'src/data/real/conflicting.json', raw: JSON.stringify(growth) }]), /CONFLICTING_OWNER/);
});
for (const name of ['artifact', 'binding', 'evidence']) test(`resealed ${name} identity drift still fails closed`, async () => {
  const r = structuredClone(registry), files = structuredClone(resources), entry = r.entries[1];
  const ref = name === 'binding' ? entry.bindingRef : entry.artifactRef;
  const resource = files.find(f => f.path === ref.owner), object = JSON.parse(resource.raw);
  if (name === 'artifact') object.definition.id = 'OTHER_METRIC';
  else if (name === 'binding') object.metricDefinitionRef = r.entries[0].definitionRef;
  else object.observations[0].provenance.captureRef.sha256 = '0'.repeat(64);
  resource.raw = JSON.stringify(object); ref.sha256 = sha256(resource.raw);
  await assert.rejects(create(r, files), /IDENTITY_DRIFT|PIN_DIGEST/);
});
test('generic registry supports a second industry without robotics-dependent discovery', async () => {
  // Explicit synthetic fixture: no production source or admission claim.
  const r = structuredClone(registry), files = structuredClone(resources), e = r.entries[1];
  const plan = JSON.parse(files.find(f => f.path === e.definitionRef.owner).raw);
  const artifact = JSON.parse(files.find(f => f.path === e.artifactRef.owner).raw);
  const binding = JSON.parse(files.find(f => f.path === e.bindingRef.owner).raw);
  e.industryId = plan.definition.industryId = artifact.definition.industryId = 'synthetic-industry';
  artifact.observations.forEach(o => { o.industryId = e.industryId; });
  const put = (ref, object) => { const f = files.find(f => f.path === ref.owner); f.raw = JSON.stringify(object); ref.sha256 = sha256(f.raw); };
  put(e.definitionRef, plan); e.policyRef.sha256 = e.definitionRef.sha256;
  artifact.definitionRef = e.definitionRef;
  binding.metricDefinitionRef = e.definitionRef; binding.sourceDefinitionRef = e.definitionRef; binding.policyRef = e.policyRef;
  put(e.artifactRef, artifact); put(e.bindingRef, binding);
  const p = await create(r, files);
  assert.equal(p.list('robotics').length, 1); assert.equal(p.list('synthetic-industry').length, 1);
  assert.equal(p.get('robotics', e.metricId), null);
});
test('reviewed YOY owner rejects resealed schema-valid numeric, admission and evidence promotion', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'industry-yoy-replay-'));
  const put = (p, value) => { const target = path.join(root, p); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  try {
    for (const p of [YOY_OWNER.plan, YOY_OWNER.artifact, YOY_OWNER.binding, MANIFEST, 'contracts/financial-research/v1/examples/pbc-binding.json', ...manifest.captures.map(c => c.path)]) put(p, bytes(p));
    for (const mutate of [a => { a.observations[0].value = 0; }, a => { a.policy.dataAdmission = 'ADMITTED'; }, a => { a.observations[0].releaseAvailableAt = a.observations[0].publicationDateTime; }, a => { a.observations[0].provenance.evidence.quality = 'verified'; }, a => { a.observations[0].provenance.captureRef.objectId = 'foreign-capture'; }]) {
      await setImmediate(); const a = structuredClone(growth); mutate(a); assert.equal(validateIndustryMetric(a), true); put(YOY_OWNER.artifact, a);
      assert.throws(() => checkArtifact(root, YOY_OWNER), /ARTIFACT_DRIFT/);
    }
    put(YOY_OWNER.artifact, bytes(YOY_OWNER.artifact));
    const plan = read(YOY_OWNER.plan); plan.definition.unit = '套'; put(YOY_OWNER.plan, plan);
    assert.throws(() => buildArtifact(growth.generatedAt, root, YOY_OWNER), /PILOT_PLAN_DRIFT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
