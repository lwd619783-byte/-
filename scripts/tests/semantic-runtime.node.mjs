import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, bytes, read } from '../semantic-runtime/common.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { selectVintage } from '../semantic-runtime/selection.mjs';
import { queryMacro, queryForDefinition, replayCommittedPbc } from '../semantic-runtime/market-regime-adapter.mjs';
import { checkBindings } from '../semantic-runtime/bindings.mjs';

const sample = read('research-data/market-regime/catalog/observation-catalog.sample.v1.json');
const first = sample.observations.find((o) => o.metricId === 'MACRO_M2_BALANCE' && o.valueDate === '2005-11');
const definition = sample.sourceDefinitions.find((d) => d.sourceDefinitionId === first.sourceDefinitionId);
// A caller-supplied query identity is not a resolved Registry identity.
const queryEntity = { entityType: 'macro', entityId: 'synthetic-query-claim' };
const query = () => queryForDefinition(definition.sourceDefinitionId, {start: '2005-11-01', end: '2005-11-30'}, '2006-01-01T00:00:00+08:00', 'strict_pit', queryEntity);
// Synthetic adapter assessment only; it is never registered in queryMacro.
const context = () => ({ definition, blockers: [], admission: 'ADMITTED', coverage: {targetCount: 1, availableCount: 1}, conflict: 'CLEAR', freshness: 'FRESH', verifyEvidence: (o) => ({blockers: [], refs: [o.rawArtifactId]}) });
const revised = () => ({ ...structuredClone(first), observationId: 'synthetic-revision-1', value: 31, revisionSequence: 1,
  supersedesObservationId: first.observationId, qualityStatus: 'REVISED', releaseDateTime: '2006-02-01T00:00:00+08:00', releaseAvailableAt: '2006-02-01T00:00:00+08:00', fetchedAt: '2026-09-12T00:00:00Z' });
const ajv = new Ajv2020({strict: true, strictRequired: false}); addFormats(ajv);
for (const owner of ['contracts/v1/research-asset-os.contracts.v1.schema.json', 'contracts/financial-research/v1/shared.schema.json', 'contracts/stage-4-1/v1/semantic-runtime.schema.json']) ajv.addSchema(read(owner));
const schema = ajv.getSchema('https://investment-dashboard.local/contracts/stage-4-1/v1/semantic-runtime.schema.json');
function run(rows = [first], q = query(), c = context()) {
  const before = structuredClone({rows, q, definition: c.definition});
  const result = selectVintage(rows, q, c);
  assert.equal(schema(result), true, ajv.errorsText(schema.errors));
  assert.deepEqual({rows, q, definition: c.definition}, before);
  return result;
}
test('F1 bindings use current definition pins and real policy, no fixture policy', () => {
  const bindings = checkBindings(); assert.equal(bindings.length, read('config/market-regime/pbc-historical-definitions.v1.json').length);
  assert.ok(bindings.every((b) => !b.policyRef.owner.includes('fixtures')));
});
test('historical asOf chooses only available native revision; future value/refs absent', () => {
  const out = run([first, revised()]); assert.equal(out.value, first.value); assert.deepEqual(out.selectedRefs, [first.observationId]);
  assert.ok(!JSON.stringify(out).includes('synthetic-revision-1'));
});
test('exact <= release boundary selects next revision without string/array ordering', () => {
  const q = {...query(), asOf: revised().releaseAvailableAt};
  const out = run([revised(), first], q); assert.equal(out.value, 31);
  assert.deepEqual(out, run([first, revised()], q));
});
test('independent chains and forked siblings are conflicted', () => {
  for (const other of [{...first, observationId: 'independent'}, {...revised(), observationId: 'fork'}]) {
    const out = run([first, revised(), other], {...query(), asOf: '2007-01-01T00:00:00Z'});
    assert.equal(out.outcome, 'conflicted'); assert.equal(out.value, null);
  }
});
test('missing predecessor and duplicate identity fail closed', () => {
  assert.equal(run([revised()], {...query(), asOf: '2007-01-01T00:00:00Z'}).outcome, 'conflicted');
  assert.equal(run([first, first]).outcome, 'conflicted');
});
for (const admission of ['PARTIAL', 'NOT_ADMITTED', 'UNKNOWN']) test(`${admission} never yields trusted value`, () => {
  const out = run([first], query(), {...context(), admission}); assert.equal(out.value, null); assert.notEqual(out.outcome, 'eligible');
});
test('latest available bad revision cannot fall back to an older good value', () => {
  const out = run([first, {...revised(), qualityStatus: 'PROVISIONAL'}], {...query(), asOf: '2007-01-01T00:00:00Z'});
  assert.equal(out.value, null); assert.ok(out.conditions.includes('partial'));
});
test('missing raw and extraction evidence propagates', () => {
  const out = run([first], query(), {...context(), verifyEvidence: () => ({refs: [], blockers: [{code: 'ARTIFACT_MISSING', condition: 'missing_evidence', refs: [first.rawArtifactId]}]})});
  assert.equal(out.value, null); assert.ok(out.conditions.includes('missing_evidence'));
});
test('unknown denominator, partial coverage, stale and unknown freshness block', () => {
  for (const delta of [{coverage: {targetCount: null, availableCount: 1}}, {coverage: {targetCount: 2, availableCount: 1}}, {freshness: 'STALE'}, {freshness: 'UNKNOWN'}]) assert.equal(run([first], query(), {...context(), ...delta}).value, null);
});
test('period/source/unit/definition match is exact', () => {
  for (const delta of [{valueDate: '2005-12'}, {unit: '亿元'}, {sourceId: 'OTHER'}, {sourceDefinitionId: 'different'}, {metricId: 'OTHER'}]) assert.equal(run([{...first, ...delta}]).value, null);
});
test('unknown/unsafe release confidence and fetchedAt never supply PIT time', () => {
  for (const confidence of ['SCHEDULE_INFERRED', 'LATEST_REVISED_PROXY', 'BACKCAST_RELEASED_LATER']) assert.equal(run([{...first, releaseConfidenceClass: confidence}]).value, null);
  assert.equal(run([{...first, releaseAvailableAt: null}]).value, null);
  assert.equal(run([first], {...query(), asOf: '2000-01-01T00:00:00Z'}).value, null);
});
test('repeated run is byte deterministic', () => assert.equal(JSON.stringify(run()), JSON.stringify(run())));
test('zero exact candidates are missing; future-only candidates are unavailable and never selected', () => {
  const missing = run([]); assert.equal(missing.outcome, 'missing'); assert.equal(missing.value, null);
  assert.ok(missing.blockers.some((b) => b.code === 'EXACT_OBSERVATION_MISSING'));
  const future = run([revised()]); assert.equal(future.outcome, 'blocked'); assert.deepEqual(future.selectedRefs, []);
  assert.ok(future.blockers.some((b) => b.code === 'NO_RELEASE_AT_AS_OF'));
});
test('real committed PBC retained evidence replay verifies role, identity and 894 ledger rows', () => {
  const result = replayCommittedPbc(); assert.equal(result.observationCount, 894); assert.equal(result.eligibleValueCount, 0);
  assert.equal(result.sourceAdmission, 'PARTIAL'); assert.equal(result.retainedEvidenceReplay.retainedBytesVerified, true);
  assert.equal(result.retainedEvidenceReplay.artifactRole, 'TEST_FIXTURE_EXCERPT');
  assert.equal(result.retainedEvidenceReplay.matchingObservationRefs.length, 2);
  assert.ok(result.blockers.some((b) => b.code === 'FORMAL_CATALOG_NOT_COMMITTED'));
});
test('public runtime reads committed owners and returns real blockers, no eligible synthetic fallback', () => {
  const out = queryMacro(query()); assert.equal(schema(out), true, ajv.errorsText(schema.errors)); assert.equal(out.value, null);
  assert.equal(out.admission, 'PARTIAL'); assert.ok(out.blockers.some((b) => b.code === 'OWNER_USE_NOT_ADMITTED'));
  assert.deepEqual(out, queryMacro(query()));
});
test('real compact query retains only cutoff-available diagnostic refs and known temporal fields', () => {
  const before = queryForDefinition('pbc-m2-balance-2011-v2', {start: '2011-10-01', end: '2011-10-31'}, '2011-11-01T00:00:00+08:00', 'strict_pit', queryEntity);
  const after = {...before, asOf: '2011-11-12T00:00:00+08:00'};
  const old = queryMacro(before), available = queryMacro(after);
  assert.deepEqual(old.temporal, []); assert.equal(available.temporal.length, 1);
  assert.equal(available.temporal[0].releaseAvailableAt, '2011-11-11T15:05:06+08:00');
  assert.equal(available.temporal[0].publicationDateTime, null);
  assert.equal(available.lineage[0].transformVersion, null);
  assert.equal(available.value, null); assert.deepEqual(available.selectedRefs, []);
});
test('public runtime rejects bad entity/pin/version/scope/period and ignores displayName', () => {
  const q = query();
  for (const changed of [{...q, entity: {...q.entity, entityId: 'wrong'}}, {...q, definitionVersion: 'wrong'}, {...q, scopeVersion: 'wrong'}, {...q, scopeRef: {...q.scopeRef, objectId: 'wrong'}}, {...q, period: {...q.period, scope: 'cumulative'}}, {...q, bindingRef: {...q.bindingRef, sha256: '0'.repeat(64)}}]) {
    const out = queryMacro(changed); assert.equal(out.value, null); assert.ok(out.blockers.some((b) => /IDENTITY|MISMATCH|INVALID|ENTITY_REGISTRY_UNRESOLVED/.test(b.code)));
  }
  assert.deepEqual(queryMacro({...q, entity: {...q.entity, displayName: 'irrelevant'}}), queryMacro(q));
});
test('catalog absent returns evidence blocker', () => {
  const out = queryMacro(query(), {catalogPath: 'research-data/market-regime/catalog/absent.json'});
  assert.ok(out.blockers.some((b) => b.code === 'CATALOG_MISSING')); assert.equal(out.value, null);
});
test('sample catalog never becomes real raw evidence', () => {
  const out = queryMacro(query(), {catalogPath: 'research-data/market-regime/catalog/observation-catalog.sample.v1.json'});
  assert.equal(out.value, null); assert.ok(out.blockers.some((b) => b.code === 'EXCERPT_IS_NOT_RAW_SOURCE'));
});
test('no Registry mapping: policy has no Entity identity and the binding remains null', () => {
  const policy = read('config/market-regime/semantic-owner-policy.v1.json');
  assert.equal(policy.policy.revision, '2');
  assert.deepEqual(policy.policy.entityResolution, {status: 'UNRESOLVED', registryEntryRef: null, reviewedMappingRef: null, allowAutoCreate: false});
  assert.ok(Object.values(policy.scopes).every((scope) => !Object.hasOwn(scope, 'entity')));
  assert.ok(checkBindings().every((binding) => binding.fieldBindings.entity === null));
  assert.equal(replayCommittedPbc().entityResolutionStatus, 'UNRESOLVED');
});
test('request builder cannot manufacture an EntityRef from a metric key', () => {
  assert.throws(() => queryForDefinition(definition.sourceDefinitionId, {start: '2005-11-01', end: '2005-11-30'}, '2006-01-01T00:00:00Z'), /ENTITY_REGISTRY_UNRESOLVED/);
  assert.deepEqual(query().entity, queryEntity);
});
test('unresolved, wrong and metric-equal Entity IDs all remain blocked without Registry proof', () => {
  for (const entityId of [queryEntity.entityId, 'wrong', definition.metricId]) {
    const out = queryMacro({...query(), entity: {entityType: 'macro', entityId, displayName: definition.metricId}});
    assert.equal(out.outcome, 'blocked'); assert.equal(out.value, null);
    assert.ok(out.blockers.some((item) => item.code === 'ENTITY_REGISTRY_UNRESOLVED'));
  }
  const incompatible = queryMacro({...query(), entity: {entityType: 'macro_metric', entityId: definition.metricId}});
  assert.ok(incompatible.blockers.some((item) => item.code === 'QUERY_SCHEMA_INVALID'));
});
test('public query does not need entity creation or any filesystem write permission', () => {
  const script = `import {queryMacro} from './scripts/semantic-runtime/market-regime-adapter.mjs';
    const result = queryMacro(${JSON.stringify(query())});
    if (result.outcome !== 'blocked' || !result.blockers.some(b => b.code === 'ENTITY_REGISTRY_UNRESOLVED')) process.exit(1);`;
  // Exported source trees may resolve locked dependencies from a parent node_modules.
  // Grant reads to that installed dependency directory, never writes or Registry access.
  const dependencies = dirname(dirname(createRequire(import.meta.url).resolve('ajv/package.json')));
  const run = spawnSync(process.execPath, ['--permission', '--allow-fs-read=' + ROOT, '--allow-fs-read=' + dependencies, '--input-type=module', '-e', script], {cwd: ROOT, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});
test('PR/main CI runs all three semantic gates without generation or failure suppression', () => {
  const workflow = bytes('.github/workflows/ci.yml').toString('utf8');
  assert.match(workflow, /^  pull_request:/m); assert.match(workflow, /^    branches: \[main\]$/m);
  assert.doesNotMatch(workflow, /continue-on-error:/);
  const steps = workflow.split(/^      - name: /m).slice(1);
  const commands = ['npm run data:validate:semantic-bindings', 'npm run test:semantic-runtime', 'npm run data:validate:semantic-readiness'];
  const positions = commands.map((command) => {
    const index = steps.findIndex((step) => step.split(/\r?\n/).includes('        run: ' + command));
    assert.ok(index >= 0, command + ' must run directly and propagate nonzero exit');
    assert.doesNotMatch(steps[index], /^\s+if:/m);
    return index;
  });
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  assert.match(steps.slice(0, positions[0]).join('\n'), /uses: actions\/checkout@/);
  assert.match(steps.slice(0, positions[0]).join('\n'), /run: npm ci/);
  assert.doesNotMatch(steps.slice(0, positions[2] + 1).join('\n'), /data:build:semantic|semantic-runtime\/\S+.*--write/);
  assert.equal(read('package.json').scripts['test:semantic-runtime'], 'node --test scripts/tests/semantic-runtime.node.mjs scripts/tests/semantic-readiness.node.mjs');
});
