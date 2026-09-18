import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { read, bytes } from '../semantic-runtime/common.mjs';
import { EIA_ADDITIONAL_OWNERS } from '../industry/eia-reviewed-owners.mjs';
import { buildEiaArtifact, checkEiaArtifact } from '../industry/eia-artifact.mjs';
import { sourceAdapter } from '../industry/source-adapters.mjs';
import { parseEiaPetroleum } from '../industry/eia-parser.mjs';

for (const owner of EIA_ADDITIONAL_OWNERS) {
  const plan = read(owner.plan), artifact = read(owner.artifact), manifest = read(owner.manifest);
  const raw = bytes(manifest.captures[0].path).toString('utf8');
  const entry = read('config/industry/industry-metric-registry.v1.json').entries.find(e => e.metricId === plan.definition.id);
  test(`${plan.source.series}: exact official retained replay/schema/F1, no delta/admission/time inference`, async () => {
    assert.deepEqual(buildEiaArtifact(artifact.generatedAt, undefined, owner), artifact);
    await setImmediate();
    assert.equal(checkEiaArtifact(undefined, owner).status, 'PASS');
    assert.equal(artifact.observations.length, 11); assert.equal(entry.presentation.delta, 'none');
    assert.equal(artifact.definition.unit, 'Thousand Barrels per Day');
    for (const o of artifact.observations) {
      assert.equal(o.value, Number(o.provenance.rawRow[o.provenance.column].replaceAll(',', '')));
      assert.equal(o.publicationDateTime, null); assert.equal(o.releaseAvailableAt, null);
      assert.equal(o.pit, 'UNPROVED'); assert.equal(o.revision.status, 'unknown'); assert.equal(o.dataAdmission, 'NOT_ADMITTED');
      assert.equal(o.provenance.evidence.quality, 'candidate');
    }
    await setImmediate();
  });
  test(`${plan.source.series}: source parser rejects identity/header/date drift and preserves zero/missing`, async () => {
    const parse = html => parseEiaPetroleum(html, plan.source, plan.definition.window);
    const value = artifact.observations.at(-1).provenance.rawRow[artifact.observations.at(-1).provenance.column];
    for (const [from, to] of [['Thousand Barrels per Day', 'Thousand Barrels'], [plan.source.series + 'w.xls', 'OTHERw.xls'], ['End Date', 'Start Date'], ['09/11', '09/12'], [value, 'bad']]) {
      assert.throws(() => parse(raw.replaceAll(from, to)), /EIA_/); await setImmediate();
    }
    for (const [replacement, expected] of [['0', 0], ['NA', null]]) { assert.equal(parse(raw.replaceAll(value, replacement)).at(-1).value, expected); await setImmediate(); }
    assert.throws(() => sourceAdapter(entry, { ...plan.definition, acquisitionAdapter: 'nbs-industrial-production-html.v1' }), /OWNER_MISMATCH/);
    assert.throws(() => sourceAdapter({ ...entry, bindingRef: { ...entry.bindingRef, owner: 'foreign' } }, plan.definition), /OWNER_MISMATCH/);
    assert.throws(() => buildEiaArtifact(artifact.generatedAt, undefined, { ...owner }), /UNREVIEWED_OWNER/);
  });
  test(`${plan.source.series}: raw, manifest, plan, artifact and binding drift fail closed`, async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'eia-dimension-replay-'));
    const put = (p, value) => { mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); writeFileSync(path.join(root, p), value); };
    try {
      for (const p of [owner.plan, owner.artifact, owner.binding, owner.manifest, 'contracts/financial-research/v1/examples/pbc-binding.json', ...manifest.captures.map(c => c.path)]) put(p, bytes(p));
      for (const [p, pattern] of [[manifest.captures[0].path, /RAW_DIGEST/], [owner.manifest, /CAPTURE_DRIFT/], [owner.plan, /PLAN_DRIFT/], [owner.binding, /BINDING_DRIFT/]]) {
        if (p === owner.binding) { const b = read(p); b.allowedUses = ['research']; put(p, JSON.stringify(b)); }
        else put(p, Buffer.concat([bytes(p), Buffer.from(' ')]));
        assert.throws(() => checkEiaArtifact(root, owner), pattern); put(p, bytes(p)); await setImmediate();
      }
      for (const mutate of [a => a.observations.pop(), a => a.observations[0].value++, a => a.observations[0].releaseAvailableAt = a.observations[0].acquiredAt, a => a.observations[0].provenance.evidence.quality = 'verified', a => a.completeness.targetCount--]) {
        const a = structuredClone(artifact); mutate(a); put(owner.artifact, JSON.stringify(a));
        assert.throws(() => checkEiaArtifact(root, owner), /ARTIFACT_DRIFT/); await setImmediate();
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
