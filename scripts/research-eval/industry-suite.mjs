import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluateRequest } from './harness.mjs';
import { industryTarget } from './industry-target.mjs';
import { canonical } from '../../src/services/industrySignalClaim.mjs';
import { resolvePin } from '../contracts/financial-research.mjs';
export const INDUSTRY_CASES = 'contracts/industry/eval/industry-cases.v1.json';
export const INDUSTRY_CASES_REVIEWED_SHA256 = 'b45222b2336c4f23ee4b2cac920e918896b465e852bc8fa90879f5978a60e62c';
export async function runIndustryEval(cases = JSON.parse(fs.readFileSync(INDUSTRY_CASES, 'utf8'))) {
  const ordered = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId, 'en'));
  const sha = createHash('sha256').update(canonical(ordered)).digest('hex');
  if (sha !== INDUSTRY_CASES_REVIEWED_SHA256) throw new Error('INDUSTRY_EVAL_ROSTER_DRIFT');
  const rows = [];
  for (const c of ordered) {
    const input = resolvePin(c.fixtureRef);
    rows.push({ caseId: c.caseId, version: c.version, inputKind: c.inputKind, fixtureRef: c.fixtureRef,
      ...await evaluateRequest(industryTarget, { operation: c.operation, request: c.request, input }, c.expected) });
  }
  return { schemaVersion: 'industry-research-eval-report.v1', suiteId: 'industry-signal-claim', version: 1,
    targetId: industryTarget.targetId, targetVersion: industryTarget.targetVersion, targetKind: industryTarget.targetKind,
    scope: 'RETAINED_INDUSTRY_PREVIEW_AND_EXPLICIT_MUTATIONS', productionAdmission: 'NOT_ADMITTED',
    frozenFoundationCoverage: 'UNCHANGED_0_OF_33', caseDigest: sha, count: rows.length, passed: rows.filter(r => r.status === 'PASS').length,
    status: rows.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', cases: rows };
}
