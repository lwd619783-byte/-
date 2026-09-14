import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv';
import { ROOT, bytes, read, sha256, unique } from './common.mjs';
import { buildReadinessReport, validateReadinessReport, evaluateReadinessGates, REPORT_PATH as V1_REPORT } from './readiness.mjs';
import { createIdentityBridge, checkIdentityPolicy, IDENTITY_POLICY, MAPPING_SCHEMA } from './identity-bridge-v2.mjs';
import { buildPbcEvidenceClosure, validatePbcEvidenceClosure, PBC_CLOSURE_REPORT } from './pbc-evidence-v2.mjs';

export const V2_REPORT = 'research-data/market-regime/semantic-readiness/report.v2.json';
export const PRESERVED_V1 = 'contracts/stage-4-1/v2/preserved-v1.json';
const PRESERVED_MANIFEST_SHA = 'bb940c282fc111dfb2f10bd6f8b6b60b476459417e513d49b03b51df0449233f';
const SCHEMA = 'contracts/stage-4-1/v2/readiness.schema.json';
const reference = (owner, root) => ({path: owner, sha256: sha256(bytes(owner, root))});
export function verifyPublishedV1({ root = ROOT } = {}) {
  if (sha256(bytes(PRESERVED_V1, root)) !== PRESERVED_MANIFEST_SHA) throw new Error('V1_PRESERVATION_MANIFEST_DRIFT');
  for (const ref of read(PRESERVED_V1, root).files) {
    if (sha256(bytes(ref.path, root).toString('utf8').replaceAll('\r\n', '\n')) !== ref.sha256) throw new Error(`V1_PUBLISHED_SEMANTICS_CHANGED: ${ref.path}`);
  }
  validateReadinessReport(read(V1_REPORT, root), {root});
  return true;
}
const counts = (metrics, field) => Object.fromEntries(['READY', 'BLOCKED'].map((status) => [status, metrics.filter((m) => m[field] === status).length]));

/** Re-evaluate the frozen full-scope gates; canary is a separate evidence capability. */
export function buildReadinessV2({root = ROOT} = {}) {
  verifyPublishedV1({root});
  const baseline = read(V1_REPORT, root), report = buildReadinessReport({root});
  if (report.metrics.length !== 23) throw new Error('V2_METRIC_SCOPE_DRIFT');
  const checked = checkIdentityPolicy({root}), identityBridge = createIdentityBridge({root});
  const closure = buildPbcEvidenceClosure({root});
  const identityRefs = unique([IDENTITY_POLICY, MAPPING_SCHEMA, ...checked.refs.map((r) => r.split('#')[0])]).map((p) => reference(p, root));
  const closureRefs = closure.positiveReplay.supportingRefs.map(({owner, sha256}) => ({path: owner, sha256}));
  const evidenceRefs = [reference(PBC_CLOSURE_REPORT, root), ...closureRefs];
  const identities = report.metrics.map((m) => identityBridge.resolve(m.metricId));
  report.schemaVersion = '2.0.0';
  report.assessmentScope = 'COMMITTED_EVIDENCE_WITH_REVIEWED_IDENTITY_AND_RETAINED_CANARY';
  report.baselineReferences = [reference(V1_REPORT, root), reference(PRESERVED_V1, root)];
  report.identityDiagnostics = {resolvedCount: identities.filter((i) => i.status === 'RESOLVED').length,
    unresolvedCount: identities.filter((i) => i.status !== 'RESOLVED').length, allowAutoCreate: false, policyRefs: identityRefs};
  report.gateDelta = [];
  report.metrics.forEach((metric, index) => {
    const resolution = identities[index], oldMetric = baseline.metrics.find((m) => m.metricId === metric.metricId);
    const gate = metric.gateChecks.find((g) => g.gate === 'ENTITY_REGISTRY_RESOLUTION');
    gate.status = resolution.status === 'RESOLVED' ? 'PASS' : 'BLOCKED';
    gate.blockerCodes = resolution.status === 'RESOLVED' ? [] : unique(resolution.blockers.map((b) => b.code));
    gate.evidenceReferences = identityRefs;
    metric.blockers = metric.blockers.filter((b) => b.code !== 'ENTITY_REGISTRY_UNRESOLVED');
    metric.blockers.push(...resolution.blockers.map((b) => ({code: b.code, detail: 'V2 requires a reviewed exact mapping and current original Registry state; the committed owner evidence does not resolve this metric.', evidenceReferences: identityRefs})));
    Object.assign(metric, evaluateReadinessGates(metric.gateChecks));
    for (const current of metric.gateChecks) {
      const previous = oldMetric.gateChecks.find((g) => g.gate === current.gate);
      const registryGate = current.gate === 'ENTITY_REGISTRY_RESOLUTION';
      report.gateDelta.push({metricId: metric.metricId, gate: current.gate,
        previousStatus: previous.status, currentStatus: current.status,
        previousBlockers: previous.blockerCodes, currentBlockers: current.blockerCodes,
        supportingRefs: current.evidenceReferences,
        closedByThisTaskEvidence: previous.status !== 'PASS' && current.status === 'PASS',
        requiresSourceTask: !registryGate && current.status !== 'PASS',
        requiresRegistryOwnerTask: registryGate && current.status !== 'PASS'});
    }
  });
  report.evidenceCapabilityDelta = [{metricId: 'MACRO_M2_YOY', gate: 'RAW_SOURCE_NATIVE_OBSERVATION_CANARY_REPLAY',
    previousStatus: 'BLOCKED', currentStatus: closure.positiveReplay.status,
    previousBlockers: ['EXCERPT_IS_NOT_RAW_SOURCE', 'FIELD_EXTRACTION_GRAPH_NOT_COMMITTED'],
    currentBlockers: closure.positiveReplay.blockers, supportingRefs: evidenceRefs,
    closedByThisTaskEvidence: closure.positiveReplay.status === 'PASS',
    requiresSourceTask: closure.positiveReplay.status !== 'PASS', requiresRegistryOwnerTask: false}];
  report.statusCounts = counts(report.metrics, 'readiness');
  report.normalizationCounts = counts(report.metrics, 'normalizationReadiness');
  report.pitBacktestCounts = counts(report.metrics, 'pitBacktestReadiness');
  report.overallStatus = report.statusCounts.BLOCKED === 0 ? 'READY' : 'BLOCKED';
  report.inputReferences = [...new Map([...report.inputReferences, ...report.baselineReferences, ...identityRefs, ...evidenceRefs].map((r) => [r.path, r])).values()];
  report.sourceEvidence.pbc.evidenceClosureV2 = closure;
  report.verification.positiveRawReplay = closure.positiveReplay.status;
  report.gatePolicy.rationale += ' V2 evaluates exact reviewed identity plus current Registry state. The canary capability is outside both full-scope eligibility sets.';
  report.interpretation = 'V1 is preserved. One authentic retained raw canary proves its own native graph only; full 894-observation closure, source admission and all non-task sources remain at their original gates. Identity implementation does not create confirmed Registry owners.';
  return report;
}
export function validateReadinessV2(report, {root = ROOT} = {}) {
  const validate = new Ajv({allErrors: true, strict: true}).compile(read(SCHEMA, root));
  if (!validate(report)) throw new Error('READINESS_V2_SCHEMA_INVALID: ' + JSON.stringify(validate.errors));
  validatePbcEvidenceClosure({root});
  if (!isDeepStrictEqual(report, buildReadinessV2({root}))) throw new Error('READINESS_V2_EVIDENCE_OR_DELTA_MISMATCH');
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some((arg) => arg !== '--write')) throw new Error('Usage: readiness-v2.mjs [--write]');
    const report = buildReadinessV2(); validateReadinessV2(report);
    const serialized = JSON.stringify(report, null, 2) + '\n';
    if (args.includes('--write')) writeFileSync(resolve(ROOT, V2_REPORT), serialized);
    else if (bytes(V2_REPORT).toString('utf8') !== serialized) throw new Error('READINESS_V2_REPORT_BYTES_STALE');
    console.log(JSON.stringify({status: 'PASS', metrics: report.metrics.length, normalization: report.normalizationCounts,
      backtest: report.pitBacktestCounts, identity: report.identityDiagnostics, positiveReplay: report.verification.positiveRawReplay}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
