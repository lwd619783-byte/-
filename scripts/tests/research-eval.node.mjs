import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkAll, checkCase, vectors, resolvePin, executeReference, releasedSuiteSha256 } from '../contracts/financial-research.mjs';
import { evaluateRequest, runResearchEval, semanticDiff } from '../research-eval/harness.mjs';
import { targets, referenceTarget, deterministicTargets, capabilityAudit } from '../research-eval/targets.mjs';

const clone = (x) => structuredClone(x);
const result = { outcome: 'eligible', value: 0, unit: 'percent', exAnte: null, reproducible: null, selectedRefs: ['a', 'b'], citationRefs: ['c', 'd'], conditions: [] };
const payload = { operation: 'retrieve', request: { asOf: '2026-01-05T00:00:00Z' }, input: { kind: 'retrieve' } };
// Test doubles only, never exported or registered as real service capability.
const target = (execute, extra = {}) => ({ targetId: 'test-double', targetVersion: '1', targetKind: 'deterministic_service', supportedOperations: ['retrieve'], execute, ...extra });
const report = await runResearchEval();

test('released 33-case suite, digests and contract oracle remain frozen', () => {
  assert.equal(checkAll().cases, 33);
  assert.equal(createHash('sha256').update(readFileSync('contracts/financial-research/v1/golden-suite.v1.json')).digest('hex'), releasedSuiteSha256);
  assert.equal(report.suite.integrity.status, 'VERIFIED');
  for (const row of report.targets[0].cases) assert.deepEqual(row.actual, Object.fromEntries(Object.entries(checkCase(vectors.find((v) => v.caseId === row.caseId))).map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value])));
});
for (const [name, mutate, error] of [
  ['delete', (v) => v.pop(), /SUITE_ROSTER/],
  ['add', (v) => v.push({ ...v[0], caseId: 'new' }), /SUITE_ROSTER/],
  ['replace', (v) => { v[0].caseId = 'new'; }, /SUITE_ROSTER/],
  ['version', (v) => { v[0].version++; }, /SUITE_ROSTER/],
  ['duplicate', (v) => { v[1] = clone(v[0]); }, /SUITE_DUPLICATE_IDENTITY/],
  ['expected', (v) => { v[0].expected.value = 0; }, /SUITE_CASE_DRIFT/],
  ['request', (v) => { v[0].request.asOf = '2027-01-01T00:00:00Z'; }, /SUITE_CASE_DRIFT/],
  ['fixture pin', (v) => { v[0].fixtureRef.sha256 = '0'.repeat(64); }, /SUITE_CASE_DRIFT/],
]) test(`harness preflight rejects ${name} before target execution`, async () => {
  const cases = clone(vectors); mutate(cases); let calls = 0;
  await assert.rejects(runResearchEval({ cases, targets: [target(() => { calls++; return result; })] }), error);
  assert.equal(calls, 0);
});
test('case and JSON key order cannot change the entire deterministic report', async () => {
  const reordered = JSON.parse(JSON.stringify(vectors), (_key, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value).reverse();
  assert.deepEqual(await runResearchEval({ cases: reordered }), report);
});
test('set-valued output ordering does not change comparison or normalized actual', async () => {
  const actual = { ...clone(result), selectedRefs: ['b', 'a'], citationRefs: ['d', 'c'] };
  const evaluation = await evaluateRequest(target(() => actual), payload, result);
  assert.equal(evaluation.status, 'PASS'); assert.deepEqual(evaluation.actual, result);
});
for (const [field, value] of [['outcome', 'blocked'], ['value', 1], ['unit', 'CNY'], ['exAnte', false], ['reproducible', false]]) {
  test(`exact ${field} drift is a structured mismatch`, async () => {
    const evaluation = await evaluateRequest(target(() => ({ ...result, [field]: value })), payload, result);
    assert.equal(evaluation.status, 'SEMANTIC_MISMATCH');
    assert.deepEqual(evaluation.semanticDiff, [{ field, comparison: 'exact', expected: result[field], actual: value }]);
  });
}
for (const field of ['conditions', 'selectedRefs', 'citationRefs']) test(`${field} missing and extra items are exact set diffs`, () => {
  const a = { ...result, [field]: ['stale'] }, b = { ...result, [field]: ['unknown'] };
  assert.deepEqual(semanticDiff(a, b), [{ field, comparison: 'set', missing: ['stale'], unexpected: ['unknown'] }]);
});
test('reference health is separate from zero real service coverage, not a denominator shrink', () => {
  assert.deepEqual(targets, [referenceTarget]); assert.equal(deterministicTargets.length, 0);
  assert.equal(report.goldenContractHealth.counts.PASS, 33); assert.equal(report.goldenContractHealth.claim, 'REFERENCE_ONLY');
  assert.equal(report.actualServiceCoverage.denominator, 33); assert.equal(report.actualServiceCoverage.passedCases, 0);
  assert.equal(report.actualServiceCoverage.counts.NOT_IMPLEMENTED, 33);
  assert.equal(report.actualServiceCoverage.registeredTargets, 0);
  assert.deepEqual(report.actualServiceCoverage.operationCoverage.map((r) => [r.operation, r.NOT_IMPLEMENTED]), [['assess_graph', 9], ['qualify_earnings', 7], ['recompute', 3], ['retrieve', 14]]);
  assert.equal(report.actualServiceCoverage.categoryCoverage.length, 8);
  for (const item of capabilityAudit) for (const seam of item.seams) assert.ok(readFileSync(seam).length);
});
test('reference descriptor and executor cannot be relabeled as service or agent', async () => {
  for (const kind of ['deterministic_service', 'agent_adapter']) {
    await assert.rejects(runResearchEval({ targets: [{ ...referenceTarget, targetKind: kind }] }), /REFERENCE_TARGET_RELABEL/);
    await assert.rejects(runResearchEval({ targets: [target(executeReference, { targetKind: kind })] }), /REFERENCE_TARGET_RELABEL/);
  }
  assert.throws(() => { referenceTarget.targetKind = 'deterministic_service'; }, TypeError);
});
test('unsupported operation never executes a target or falls back to reference', async () => {
  const evaluation = await evaluateRequest(target(() => { throw new Error('must not execute'); }, { supportedOperations: [] }), payload, result);
  assert.equal(evaluation.status, 'NOT_IMPLEMENTED'); assert.equal(evaluation.actual, null);
});
test('exception and rejected promise are execution errors; messages are not retained', async () => {
  for (const execute of [() => { throw new Error('private details'); }, async () => { throw new Error('private details'); }]) {
    const evaluation = await evaluateRequest(target(execute), payload, result);
    assert.equal(evaluation.status, 'EXECUTION_ERROR'); assert.equal(evaluation.actual, null);
    assert.ok(!JSON.stringify(evaluation).includes('private details'));
  }
});
for (const [name, value] of [
  ['null', null], ['undefined', undefined], ['missing field', { ...result, unit: undefined }],
  ['NaN', { ...result, value: NaN }], ['infinity', { ...result, value: Infinity }],
  ['unknown outcome', { ...result, outcome: 'PASS' }], ['duplicate set', { ...result, selectedRefs: ['a', 'a'] }],
  ['prose in result', { ...result, explanation: 'sounds right' }], ['numeric string', { ...result, value: '0' }],
]) test(`invalid ${name} is INVALID_OUTPUT with no completion from expected`, async () => {
  const evaluation = await evaluateRequest(target(() => value), payload, result);
  assert.equal(evaluation.status, 'INVALID_OUTPUT'); assert.equal(evaluation.actual, null);
});
test('adapter only sees frozen operation/request/input, not expected or caseId', async () => {
  let seen;
  await evaluateRequest(target((request) => { seen = request; return result; }), { ...payload, expected: result, caseId: 'injected', fixtureRef: {}, rationale: 'injected' }, result);
  assert.deepEqual(Object.keys(seen).sort(), ['input', 'operation', 'request']);
  assert.equal(seen.expected, undefined); assert.equal(seen.caseId, undefined);
  assert.throws(() => { seen.request.asOf = '2099'; }, TypeError);
  assert.equal(payload.request.asOf, '2026-01-05T00:00:00Z');
});
test('caseId matcher and expected-reader false-green adapters cannot use the seam', async () => {
  for (const execute of [(p) => p.expected, (p) => ({ 'past-vintage': result })[p.caseId]]) {
    const evaluation = await evaluateRequest(target(execute), { ...payload, expected: result, caseId: 'past-vintage' }, result);
    assert.equal(evaluation.status, 'INVALID_OUTPUT');
  }
});
test('unregistered oracle wrappers or metadata mutation cannot mint a service coverage report', async () => {
  for (const kind of ['deterministic_service', 'agent_adapter']) {
    for (const execute of [(request) => executeReference(request), async (request) => executeReference(request), executeReference.bind(null)]) {
      const adapter = target(execute, { targetKind: kind, supportedOperations: [...referenceTarget.supportedOperations] });
      await assert.rejects(runResearchEval({ targets: [adapter] }), /UNREGISTERED_TARGET/);
    }
  }
  assert.throws(() => { referenceTarget.supportedOperations.length = 0; }, TypeError);
  assert.throws(() => { targets.push(target(() => result)); }, TypeError);
});
for (const condition of ['unknown', 'not_admitted', 'conflicted', 'missing_evidence']) test(`${condition} survives reference and comparison unchanged`, async () => {
  const vector = vectors.find((v) => v.expected.conditions.includes(condition));
  assert.ok(vector);
  const actual = await evaluateRequest(referenceTarget, { operation: vector.operation, request: vector.request, input: resolvePin(vector.fixtureRef) }, vector.expected);
  assert.equal(actual.status, 'PASS'); assert.ok(actual.actual.conditions.includes(condition));
  const green = { ...actual.actual, outcome: 'eligible', conditions: [] };
  assert.ok(semanticDiff(actual.actual, green).length > 0);
});
test('zero is a valid semantic value and cannot silently become null', async () => {
  assert.equal((await evaluateRequest(target(() => result), payload, result)).status, 'PASS');
  assert.equal((await evaluateRequest(target(() => ({ ...result, value: null })), payload, result)).status, 'SEMANTIC_MISMATCH');
});
test('future agent seam uses the same exact comparison but cannot inflate service coverage', async () => {
  const adapter = target(async () => ({ ...result, value: 1 }), { targetKind: 'agent_adapter' });
  assert.equal((await evaluateRequest(adapter, payload, result)).status, 'SEMANTIC_MISMATCH');
  await assert.rejects(runResearchEval({ targets: [adapter] }), /UNREGISTERED_TARGET/);
  const output = await runResearchEval({ targets: [] });
  assert.equal(output.goldenContractHealth.status, 'NOT_RUN');
  assert.equal(output.actualServiceCoverage.counts.NOT_IMPLEMENTED, 33);
});
test('registry rejects duplicate or invalid targets', async () => {
  await assert.rejects(runResearchEval({ targets: [referenceTarget, referenceTarget] }), /DUPLICATE_TARGET/);
  await assert.rejects(runResearchEval({ targets: [target(() => result, { supportedOperations: ['invented'] })] }), /INVALID_TARGET/);
});
test('default CLI is deterministic and runs with network, process launch and filesystem writes forbidden', () => {
  const cli = new URL('../research-eval/cli.mjs', import.meta.url).href;
  const script = `
    import fs from 'node:fs'; import fsp from 'node:fs/promises';
    import net from 'node:net'; import http from 'node:http'; import https from 'node:https';
    import tls from 'node:tls'; import dns from 'node:dns'; import child from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const deny = () => { throw new Error('SIDE_EFFECT_FORBIDDEN'); };
    for (const name of ['writeFile','writeFileSync','appendFile','appendFileSync','mkdir','mkdirSync','rm','rmSync','unlink','unlinkSync','rename','renameSync','createWriteStream']) if (name in fs) fs[name] = deny;
    for (const name of ['writeFile','appendFile','mkdir','rm','unlink','rename']) fsp[name] = deny;
    for (const [owner, name] of [[fs, 'open'], [fs, 'openSync'], [fsp, 'open']]) {
      const original = owner[name];
      owner[name] = (path, flags, ...rest) => {
        if (flags !== 'r' && flags !== 0) deny();
        return original.call(owner, path, flags, ...rest);
      };
    }
    net.connect = net.createConnection = net.Socket.prototype.connect = deny;
    http.request = http.get = https.request = https.get = tls.connect = dns.lookup = dns.resolve = deny;
    for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) child[name] = deny;
    globalThis.fetch = deny; globalThis.WebSocket = deny;
    globalThis.localStorage = globalThis.sessionStorage = new Proxy({}, { get: deny });
    syncBuiltinESMExports(); await import(${JSON.stringify(cli)});
  `;
  const run = () => spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const a = run(), b = run();
  assert.equal(a.status, 0, a.stderr); assert.equal(b.status, 0, b.stderr); assert.equal(a.stdout, b.stdout);
  assert.deepEqual(JSON.parse(a.stdout), report);
});
test('reviewed eval modules have no business writes, dynamic adapter loading, case matchers or application integration', () => {
  for (const file of readdirSync('scripts/research-eval').filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync('scripts/research-eval/' + file, 'utf8');
    assert.doesNotMatch(source, /(?:fetch\(|localStorage\.|sessionStorage\.|node:sqlite|better-sqlite3|node:child_process|import\()/);
    if (file !== 'cli.mjs') assert.doesNotMatch(source, /writeFile|appendFile|mkdir/);
    if (file === 'targets.mjs') {
      assert.doesNotMatch(source, /\.expected\b|\.caseId\b|golden-cases|checkCase|checkAll|vectors/);
      assert.deepEqual([...source.matchAll(/^import .+ from '([^']+)'/gm)].map((m) => m[1]), ['../contracts/financial-research.mjs']);
    }
  }
  // Actual targets MUST be added with a source-graph audit; empty is not waived coverage.
  assert.equal(deterministicTargets.length, 0);
});
test('committed deterministic report reproduces exactly', () => {
  const retained = readFileSync(fileURLToPath(new URL('../../docs/stage-4-1b-slice-3/eval-report.v1.json', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(retained, JSON.stringify(report, null, 2) + '\n');
});
