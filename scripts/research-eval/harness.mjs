// Offline evaluation infrastructure, not a business owner or production capability gate.
import { isDeepStrictEqual } from 'node:util';
import { checkSuite, resolvePin, validate, vectors, releasedSuiteSha256 } from '../contracts/financial-research.mjs';
import { assertTargetBoundary, capabilityAudit, referenceTarget, targets as defaultTargets } from './targets.mjs';

export const statuses = Object.freeze(['PASS', 'SEMANTIC_MISMATCH', 'NOT_IMPLEMENTED', 'EXECUTION_ERROR', 'INVALID_OUTPUT']);
const scalarFields = ['outcome', 'value', 'unit', 'exAnte', 'reproducible'];
const setFields = ['selectedRefs', 'citationRefs', 'conditions'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = (items) => [...items].sort(compare);
const resultSchema = 'shared.schema.json#/$defs/Result';
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function normalized(result) {
  return Object.fromEntries([...scalarFields.map((key) => [key, result[key]]), ...setFields.map((key) => [key, sorted(result[key])])]);
}
export function semanticDiff(expected, actual) {
  validate(resultSchema, expected); validate(resultSchema, actual);
  return [...scalarFields, ...setFields].flatMap((field) => {
    if (setFields.includes(field)) {
      const missing = sorted(expected[field].filter((v) => !actual[field].includes(v)));
      const unexpected = sorted(actual[field].filter((v) => !expected[field].includes(v)));
      return missing.length || unexpected.length ? [{ field, comparison: 'set', missing, unexpected }] : [];
    }
    return isDeepStrictEqual(expected[field], actual[field]) ? [] : [{ field, comparison: 'exact', expected: expected[field], actual: actual[field] }];
  });
}
function validateTarget(target) {
  assertTargetBoundary(target);
  if (!target || typeof target.targetId !== 'string' || !target.targetId || typeof target.targetVersion !== 'string' || !target.targetVersion ||
      !['reference_oracle', 'deterministic_service', 'agent_adapter'].includes(target.targetKind) || typeof target.execute !== 'function' ||
      !Array.isArray(target.supportedOperations) || target.supportedOperations.some((op) => !['retrieve', 'assess_graph', 'qualify_earnings', 'recompute'].includes(op)) ||
      new Set(target.supportedOperations).size !== target.supportedOperations.length) throw new Error('INVALID_TARGET');
}

/** Adapter seam V1: execute({operation, request, input}) -> Promise<Result> | Result.
 * Only detached, frozen inputs are provided. No expected, caseId, fixtureRef, category,
 * rationale, storage, Provider, database, SQL or output-completion capability is supplied.
 * Adapters are reviewed code, NOT an untrusted-JavaScript security sandbox.
 */
export async function evaluateRequest(target, payload, expected) {
  validateTarget(target);
  validate(resultSchema, expected);
  const base = { expected: normalized(expected), actual: null, semanticDiff: [] };
  if (!target.supportedOperations.includes(payload.operation)) return { ...base, status: 'NOT_IMPLEMENTED', diagnostic: 'UNSUPPORTED_OPERATION' };
  let actual;
  try {
    actual = await target.execute(freeze(structuredClone({ operation: payload.operation, request: payload.request, input: payload.input })));
  } catch {
    // Do not persist exception messages/stacks: they may contain paths, secrets or nondeterministic text.
    return { ...base, status: 'EXECUTION_ERROR', diagnostic: 'TARGET_EXECUTION_THROWN' };
  }
  try {
    validate(resultSchema, actual);
    actual = normalized(actual);
  } catch {
    return { ...base, status: 'INVALID_OUTPUT', diagnostic: 'RESULT_SCHEMA_INVALID' };
  }
  const diff = semanticDiff(expected, actual);
  return { ...base, actual, semanticDiff: diff, status: diff.length ? 'SEMANTIC_MISMATCH' : 'PASS' };
}
function counts(rows) {
  return Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.status === status).length]));
}
function coverage(rows, field) {
  return sorted(new Set(rows.map((row) => row[field]))).map((name) => {
    const group = rows.filter((row) => row[field] === name);
    return { [field]: name, total: group.length, ...counts(group) };
  });
}
const hasFailures = (rows) => rows.some((row) => ['SEMANTIC_MISMATCH', 'EXECUTION_ERROR', 'INVALID_OUTPUT'].includes(row.status));

export async function runResearchEval({ cases = vectors, targets = defaultTargets } = {}) {
  // Freeze detached vectors before validation; no target can mutate expected or later inputs.
  const retainedCases = freeze(structuredClone(cases));
  const suite = checkSuite(retainedCases); // Frozen manifest digest + exact roster + every case digest.
  const ordered = [...retainedCases].sort((a, b) => compare(a.caseId, b.caseId) || a.version - b.version);
  const prepared = ordered.map((vector) => {
    validate('golden-case.v1.schema.json', vector);
    const input = resolvePin(vector.fixtureRef);
    validate('test-input.v1.schema.json', input);
    if (input.kind !== vector.operation) throw new Error('OPERATION_MISMATCH');
    return { vector, input };
  });
  for (const target of targets) {
    validateTarget(target);
    // Only reviewed registry objects may produce capability reports. Function identity
    // alone cannot detect an oracle hidden behind a wrapper. Custom test doubles may
    // exercise evaluateRequest, but cannot mint service/Agent PASS claims here.
    if (!defaultTargets.includes(target)) throw new Error('UNREGISTERED_TARGET');
  }
  if (new Set(targets.map((target) => target.targetId)).size !== targets.length) throw new Error('DUPLICATE_TARGET');
  const results = [];
  const executionTargets = targets.map((target) => target === referenceTarget ? target : Object.freeze({
    targetId: target.targetId, targetVersion: target.targetVersion, targetKind: target.targetKind,
    supportedOperations: Object.freeze([...target.supportedOperations]), execute: target.execute,
  }));
  for (const target of executionTargets.sort((a, b) => compare(a.targetId, b.targetId))) {
    // Snapshot descriptors so execution cannot rewrite the reported identity/coverage.
    const descriptor = { targetId: target.targetId, targetVersion: target.targetVersion, targetKind: target.targetKind,
      supportedOperations: sorted(target.supportedOperations), claim: target.targetKind === 'reference_oracle' ? 'REFERENCE_ONLY' : 'SYNTHETIC_EVAL_ONLY' };
    const rows = [];
    for (const { vector, input } of prepared) {
      rows.push({ caseId: vector.caseId, version: vector.version, operation: vector.operation, category: vector.category,
        integrity: { status: 'VERIFIED', sha256: suite.cases.find((c) => c.caseId === vector.caseId).sha256, fixturePin: 'VERIFIED' },
        ...await evaluateRequest(target, { operation: vector.operation, request: vector.request, input }, vector.expected) });
    }
    results.push({ ...descriptor, counts: counts(rows), operationCoverage: coverage(rows, 'operation'), categoryCoverage: coverage(rows, 'category'), cases: rows });
  }
  const reference = results.filter((target) => target.targetKind === 'reference_oracle');
  const services = results.filter((target) => target.targetKind === 'deterministic_service');
  const serviceRows = ordered.map((vector) => {
    const rows = services.flatMap((target) => target.cases.filter((row) => row.caseId === vector.caseId).map((row) => ({ targetId: target.targetId, status: row.status })));
    const implemented = rows.filter((row) => row.status !== 'NOT_IMPLEMENTED');
    // No target, or no supporting operation, is explicitly NOT_IMPLEMENTED. Never oracle fallback.
    const status = statuses.filter((s) => s !== 'NOT_IMPLEMENTED').reverse().find((s) => implemented.some((r) => r.status === s)) ?? 'NOT_IMPLEMENTED';
    return { caseId: vector.caseId, version: vector.version, operation: vector.operation, category: vector.category, status, targetResults: rows };
  });
  return {
    schemaVersion: 'research-eval-report.v1',
    suite: { suiteId: suite.suiteId, version: suite.version, schemaVersion: suite.schemaVersion, count: suite.count,
      integrity: { status: 'VERIFIED', manifestSha256: releasedSuiteSha256, roster: 'VERIFIED', caseDigests: 'VERIFIED', fixturePins: 'VERIFIED' } },
    scope: { input: 'SYNTHETIC_ONLY', productionAdmission: 'NOT_EVALUATED', agentRuntime: 'NOT_IMPLEMENTED' },
    goldenContractHealth: { status: reference.length && reference.every((t) => t.counts.PASS === suite.count) ? 'PASS' : reference.length ? 'FAIL' : 'NOT_RUN',
      claim: 'REFERENCE_ONLY', targetIds: reference.map((t) => t.targetId), counts: counts(reference.flatMap((t) => t.cases)) },
    actualServiceCoverage: { denominator: suite.count, registeredTargets: services.length,
      passedCases: serviceRows.filter((row) => row.status === 'PASS').length, counts: counts(serviceRows),
      operationCoverage: coverage(serviceRows, 'operation'), categoryCoverage: coverage(serviceRows, 'category'), cases: serviceRows },
    capabilityAudit,
    targets: results,
    evaluationStatus: results.some((target) => hasFailures(target.cases)) ? 'FAIL' : 'COMPLETED',
  };
}
