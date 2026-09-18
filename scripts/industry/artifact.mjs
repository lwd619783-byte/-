import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, bytes, read, sha256, pin, resolve, instant } from '../semantic-runtime/common.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';
import { parseNbsProduction } from './nbs-parser.mjs';

export const PLAN = 'config/industry/nbs-robotics-pilot.v1.json';
export const MANIFEST = 'research-data/industry/nbs-robotics-v1/manifest.json';
export const ARTIFACT = 'src/data/real/industry-robotics.generated.json';
export const BINDING = 'config/industry/nbs-robotics-semantic-binding.v2.json';
export { SCHEMA, validateIndustryMetric } from './metric-artifact.mjs';
import { buildBinding as buildMetricBinding, validateIndustryMetric } from './metric-artifact.mjs';
export function buildBinding(root = ROOT, owner = OUTPUT_OWNER) { return buildMetricBinding(root, owner); }
export const OUTPUT_OWNER = { plan: PLAN, artifact: ARTIFACT, binding: BINDING, bindingId: 'nbs-industrial-robot-output.v1', measure: 'output', planHash: 'f1df61268372e3d435d8ede1c874aefef08e61e8b978ab74f06a3b14b779d664' };
export const YOY_OWNER = { plan: 'config/industry/nbs-robotics-yoy.v1.json', artifact: 'src/data/real/industry-robotics-yoy.generated.json', binding: 'config/industry/nbs-robotics-yoy-semantic-binding.v2.json', bindingId: 'nbs-industrial-robot-output-yoy.v1', measure: 'official_yoy', planHash: 'b9b2c47a75d077db34902bbcb7f859d82816ab577b58d3502fa2cd5e9db51bfd' };
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };

function pilotPlan(root, owner) {
  // Reviewed Slice 1 owner plan, not a restriction on Industry Metric V1.
  // Changing source, window or policy needs an explicit owner review, not just resealing artifact/binding pins.
  requireThat(sha256(bytes(owner.plan, root)) === owner.planHash, 'PILOT_PLAN_DRIFT');
  return read(owner.plan, root);
}

export function buildArtifact(generatedAt, root = ROOT, owner = OUTPUT_OWNER) {
  const plan = pilotPlan(root, owner), manifest = read(MANIFEST, root);
  requireThat(Number.isFinite(instant(generatedAt)), 'GENERATION_TIME_REQUIRED');
  requireThat(manifest.schemaVersion === 'nbs-capture.v1' && manifest.id === 'nbs-robotics-capture-v1' && manifest.revision === '1', 'CAPTURE_IDENTITY');
  requireThat(isDeepStrictEqual(manifest.captures.map(c => ({ period: c.period, url: c.url })), plan.releases), 'CAPTURE_ROSTER');
  const observations = manifest.captures.flatMap((capture, index) => {
    const url = new URL(capture.url);
    requireThat(url.protocol === 'https:' && url.hostname === 'www.stats.gov.cn' && capture.finalUrl === capture.url && capture.role === 'REACQUIRED_OFFICIAL_PAGE', 'SOURCE_IDENTITY');
    requireThat(capture.path === `research-data/industry/nbs-robotics-v1/raw/${capture.sha256}.html`, 'RAW_LOCATOR');
    const raw = bytes(capture.path, root);
    requireThat(raw.length === capture.byteLength && sha256(raw) === capture.sha256, 'RAW_DIGEST');
    requireThat(Number.isFinite(instant(capture.acquiredAt)) && instant(capture.acquiredAt) <= instant(generatedAt), 'ACQUISITION_TIME');
    const parsed = parseNbsProduction(raw.toString('utf8'), capture.period, owner.measure);
    requireThat(parsed.publicationDateTime === null || instant(parsed.publicationDateTime) <= instant(capture.acquiredAt), 'PUBLICATION_AFTER_ACQUISITION');
    return parsed.values.map(({ basis, value, column }) => ({
      id: `${plan.definition.id}:${capture.period}:${basis}:${capture.sha256}`,
      metricId: plan.definition.id, industryId: plan.definition.industryId,
      geography: plan.definition.geography, scope: plan.definition.scope, unit: plan.definition.unit,
      frequency: plan.definition.nativeFrequency, basis, valueDate: capture.period,
      referencePeriod: { start: basis === 'monthly' ? capture.period : `${capture.period.slice(0, 4)}-01`, end: capture.period },
      value, publicationDateTime: parsed.publicationDateTime, releaseAvailableAt: null,
      acquiredAt: capture.acquiredAt, generatedAt,
      revision: { status: 'unknown', sequence: null, supersedes: null, retainedVintage: capture.sha256 },
      quality: { source: plan.definition.sourceOwner, sourceLayer: 'official', sourceEndpoint: plan.definition.acquisitionAdapter, sourceUrl: capture.url, status: value === null ? 'missing' : 'real' },
      conditions: [...(value === null ? ['partial'] : []), 'not_admitted', 'unknown'],
      pit: 'UNPROVED', dataAdmission: plan.policy.dataAdmission, productionAdmission: plan.policy.productionAdmission,
      provenance: { sourceId: plan.definition.sourceId, sourceOwner: plan.definition.sourceOwner, acquisitionAdapter: plan.definition.acquisitionAdapter,
        rawPath: capture.path, rawSha256: capture.sha256, captureRef: pin(MANIFEST, `/captures/${index}`, `${capture.period}:${capture.sha256}`, '1', root),
        locator: parsed.locator, column, rawRow: parsed.row, transformVersion: owner.measure === 'output' ? 'nbs-industrial-production-html.v1' : 'nbs-industrial-production-official-yoy.v1',
        evidence: { refType: 'web_source', refId: `${capture.sha256}:${parsed.locator}:${column}`, title: `${capture.period} 工业机器人 ${basis}${owner.measure === 'official_yoy' ? ' 官方同比增长（%）' : ''} 原始表格`, sourceUrl: capture.url, quality: 'candidate' } }
    }));
  });
  const artifact = { schemaVersion: 'industry-metric.v1', generatedAt, definition: plan.definition, policy: plan.policy,
    definitionRef: pin(owner.plan, '/definition', plan.definition.id, plan.definition.revision, root),
    observations, completeness: { scope: 'declared_window_only', monthlyAvailable: observations.filter(o => o.basis === 'monthly' && o.value !== null).length, monthlyTarget: 8,
      missingMonthlyPeriods: plan.definition.missingMonthlyPeriods, historicalCoverage: 'partial' } };
  requireThat(validateIndustryMetric(artifact), `INDUSTRY_SCHEMA: ${JSON.stringify(validateIndustryMetric.errors)}`);
  return artifact;
}


export function checkArtifact(root = ROOT, owner = OUTPUT_OWNER) {
  const actual = read(owner.artifact, root), expected = buildArtifact(actual.generatedAt, root, owner);
  requireThat(isDeepStrictEqual(actual, expected), 'NORMALIZED_ARTIFACT_DRIFT');
  const binding = read(owner.binding, root);
  requireThat(isDeepStrictEqual(binding, buildBinding(root, owner)), 'INDUSTRY_BINDING_DRIFT');
  for (const observation of actual.observations) {
    const capture = resolve(observation.provenance.captureRef, root);
    requireThat(capture.sha256 === observation.provenance.rawSha256 && capture.period === observation.valueDate, 'EVIDENCE_IDENTITY');
  }
  if (root === ROOT) validateBinding(binding);
  return { status: 'PASS', captures: 7, observations: actual.observations.length, monthly: actual.completeness,
    semanticBinding: 'VALID / NOT_READY', entity: 'UNRESOLVED', pit: 'UNPROVED', revisionContinuity: 'unknown', dataAdmission: actual.policy.dataAdmission, productionAdmission: actual.policy.productionAdmission };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const owner = process.argv.includes('--yoy') ? YOY_OWNER : OUTPUT_OWNER;
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(ROOT, owner.artifact), JSON.stringify(buildArtifact(new Date().toISOString(), ROOT, owner), null, 2) + '\n');
    writeFileSync(path.join(ROOT, owner.binding), JSON.stringify(buildBinding(ROOT, owner), null, 2) + '\n');
  }
  console.log(JSON.stringify(checkArtifact(ROOT, owner), null, 2));
}
