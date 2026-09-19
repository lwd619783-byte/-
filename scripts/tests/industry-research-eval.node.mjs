import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runIndustryEval, INDUSTRY_CASES } from '../research-eval/industry-suite.mjs';
const cases = JSON.parse(fs.readFileSync(INDUSTRY_CASES, 'utf8'));
test('F3 shared Harness executes five real Industry service cases, no reference fallback', async () => {
  const report = await runIndustryEval();
  assert.equal(report.targetKind, 'deterministic_service'); assert.equal(report.passed, 5); assert.equal(report.status, 'PASS');
  assert.equal(report.frozenFoundationCoverage, 'UNCHANGED_0_OF_33');
  assert.equal(report.cases.filter(c => c.inputKind === 'RETAINED_REAL').length, 2);
  assert.equal(report.cases.filter(c => c.inputKind === 'SYNTHETIC_MUTATION_OF_RETAINED_REAL').length, 3);
  assert.deepEqual(await runIndustryEval([...cases].reverse()), report);
});
test('Industry target consumes only payload and real service seams, never expected or reference execution', () => {
  const target = fs.readFileSync('scripts/research-eval/industry-target.mjs', 'utf8');
  assert.doesNotMatch(target, /executeReference|checkCase|checkAll|\.expected\b|\.caseId\b|golden-cases|eval\(|new Function|fetch\(/);
  assert.match(target, /buildIndustrySignalClaims/); assert.match(target, /assessIndustryGraph/); assert.match(target, /retainedDifference/);
});
for (const mutate of [c => c.pop(), c => { c[0].expected.value = 0; }, c => { c[0].fixtureRef.sha256 = '0'.repeat(64); }, c => { c[0].version++; }]) {
  test('Industry roster/expected/pin/version drift rejects before execution', async () => { const c = structuredClone(cases); mutate(c); await assert.rejects(runIndustryEval(c), /INDUSTRY_EVAL_ROSTER_DRIFT/); });
}
