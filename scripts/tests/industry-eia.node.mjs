import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { read, bytes } from '../semantic-runtime/common.mjs';
import { EIA_OWNER, EIA_MANIFEST, buildEiaArtifact, checkEiaArtifact } from '../industry/eia-artifact.mjs';
import { resolveCliTarget, sourceAdapter, SOURCE_ADAPTER_VERSION } from '../industry/source-adapters.mjs';
import { parseEiaPetroleum } from '../industry/eia-parser.mjs';
const plan = read(EIA_OWNER.plan), artifact = read(EIA_OWNER.artifact), manifest = read(EIA_MANIFEST);
const raw = bytes(manifest.captures[0].path).toString('utf8');
const parse = html => parseEiaPetroleum(html, plan.source, plan.definition.window);
const entry = read('config/industry/industry-metric-registry.v1.json').entries.find(e => e.metricId === plan.definition.id);

test('CLI without --metric resolves the historical NBS output target, independent of registry order', () => {
  const registry = read('config/industry/industry-metric-registry.v1.json');
  registry.entries.reverse();
  for (const args of [[], ['--write']]) {
    const target = resolveCliTarget(args, registry);
    assert.equal(target.metricId, 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT');
    assert.equal(sourceAdapter(target, read(target.definitionRef.owner).definition).id, 'nbs-industrial-production-html.v1');
  }
  registry.entries = registry.entries.filter(e => e.metricId !== 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT');
  assert.throws(() => resolveCliTarget([], registry), /EXACT_REGISTERED_METRIC_REQUIRED/);
});
test('CLI explicit EIA target remains exact and uses the EIA adapter', () => {
  const registry = read('config/industry/industry-metric-registry.v1.json');
  const target = resolveCliTarget(['--write', '--metric', 'US_EIA_COMMERCIAL_CRUDE_STOCKS'], registry);
  assert.deepEqual(target, entry);
  assert.equal(sourceAdapter(target, plan.definition).id, 'eia-petroleum-history-html.v1');
});
test('CLI unknown or missing explicit metric never falls back to the historical default', () => {
  const registry = read('config/industry/industry-metric-registry.v1.json');
  for (const args of [['--metric', 'UNKNOWN'], ['--metric'], ['--metric', '--write'], ['--metric', '']]) {
    assert.throws(() => resolveCliTarget(args, registry), /EXACT_REGISTERED_METRIC_REQUIRED/);
  }
});

test('official EIA retained bytes replay exact 11-week owner with unknown vintage/time and no admission', () => {
  assert.deepEqual(buildEiaArtifact(artifact.generatedAt), artifact);
  assert.deepEqual(parse(raw), parse(raw));
  assert.equal(checkEiaArtifact().status, 'PASS');
  assert.equal(artifact.observations.length, 11);
  assert.equal(artifact.observations.at(-1).value, 423429);
  assert.equal(artifact.observations[0].value, 411357);
  for (const o of artifact.observations) {
    assert.equal(o.frequency, 'weekly'); assert.equal(o.unit, 'Thousand Barrels');
    assert.equal(o.publicationDateTime, null); assert.equal(o.releaseAvailableAt, null);
    assert.equal(o.revision.status, 'unknown'); assert.equal(o.pit, 'UNPROVED');
    assert.equal(o.dataAdmission, 'NOT_ADMITTED'); assert.equal(o.provenance.evidence.quality, 'candidate');
  }
});
test('EIA raw parser preserves missing/zero and rejects title, unit, frequency, series, duplicate and date drift', () => {
  for (const [token, value] of [['0', 0], ['-', null], ['--', null], ['NA', null], ['W', null]]) {
    assert.equal(parse(raw.replace('423,429', token)).at(-1).value, value);
  }
  for (const [a,b] of [['Thousand Barrels','Barrels'],['WCESTUS1w.xls','WTESTUS1w.xls'],['End Date','Start Date'],['09/11','09/12'],['423,429','bad']]) assert.throws(() => parse(raw.replaceAll(a,b)), /EIA_/);
  const duplicate = raw.match(/<tr>\s*<td class='B6'>&nbsp;&nbsp;2026-Aug[\s\S]*?<\/tr>/)[0];
  assert.throws(() => parse(raw.replace(duplicate, duplicate + duplicate)), /DUPLICATE_PERIOD/);
});
test('versioned source dispatch rejects unknown adapter and swapped/resealed owner identities', () => {
  assert.equal(SOURCE_ADAPTER_VERSION, 'industry-source-adapters.v1');
  assert.equal(sourceAdapter(entry, plan.definition).id, plan.definition.acquisitionAdapter);
  assert.throws(() => sourceAdapter(entry, {...plan.definition, acquisitionAdapter:'unknown'}), /UNREGISTERED/);
  assert.throws(() => sourceAdapter(entry, {...plan.definition, acquisitionAdapter:'nbs-industrial-production-html.v1'}), /OWNER_MISMATCH/);
  for (const key of ['definitionRef','artifactRef','bindingRef','policyRef']) {
    const e = structuredClone(entry); e[key].owner = 'foreign.json'; assert.throws(() => sourceAdapter(e, plan.definition), /OWNER_MISMATCH/);
  }
  const e = structuredClone(entry); e.definitionRef.sha256 = '0'.repeat(64); assert.throws(() => sourceAdapter(e, plan.definition), /OWNER_MISMATCH/);
});
test('replay rejects modified bytes, capture roster/time, resealed numeric/coverage/evidence/admission', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'industry-eia-'));
  const put = (p, b) => { const dest = path.join(root,p); mkdirSync(path.dirname(dest),{recursive:true}); writeFileSync(dest, b); };
  try {
    for (const p of [EIA_OWNER.plan,EIA_OWNER.artifact,EIA_OWNER.binding,EIA_MANIFEST,'contracts/financial-research/v1/examples/pbc-binding.json',...manifest.captures.map(c=>c.path)]) put(p,bytes(p));
    for (const mutate of [a=>{a.observations[0].value=0;}, a=>{a.completeness.targetCount=10;}, a=>{a.observations[0].releaseAvailableAt=a.observations[0].acquiredAt;},a=>{a.observations[0].provenance.evidence.quality='verified';},a=>{a.policy.dataAdmission='ADMITTED';},a=>{a.observations[0].provenance.captureRef.objectId='foreign';}]) {
      const a = structuredClone(artifact); mutate(a); put(EIA_OWNER.artifact,JSON.stringify(a)); assert.throws(()=>checkEiaArtifact(root),/ARTIFACT_DRIFT/);
    }
    put(EIA_OWNER.artifact,bytes(EIA_OWNER.artifact));
    put(manifest.captures[0].path,raw+' '); assert.throws(()=>checkEiaArtifact(root),/RAW_DIGEST/); put(manifest.captures[0].path,bytes(manifest.captures[0].path));
    const m = structuredClone(manifest); m.captures[0].acquiredAt='2000-01-01T00:00:00Z'; put(EIA_MANIFEST,JSON.stringify(m)); assert.throws(()=>checkEiaArtifact(root),/CAPTURE_DRIFT/);
    put(EIA_MANIFEST,bytes(EIA_MANIFEST)); const p = structuredClone(plan); p.definition.window.start='2026-08-07'; put(EIA_OWNER.plan,JSON.stringify(p)); assert.throws(()=>checkEiaArtifact(root),/PLAN_DRIFT/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
