import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, bytes, read, sha256, pin, resolve, instant } from '../semantic-runtime/common.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';
import { parseNbsProduction } from './nbs-parser.mjs';

export const PLAN = 'config/industry/nbs-robotics-pilot.v1.json';
export const MANIFEST = 'research-data/industry/nbs-robotics-v1/manifest.json';
export const ARTIFACT = 'src/data/real/industry-robotics.generated.json';
export const BINDING = 'config/industry/nbs-robotics-semantic-binding.v2.json';
export const SCHEMA = 'contracts/industry/industry-metric.v1.schema.json';
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(read('contracts/v1/research-asset-os.contracts.v1.schema.json'));
ajv.addSchema(read('contracts/financial-research/v1/shared.schema.json'));
ajv.addSchema(read('contracts/stage-4-1/v1/semantic-runtime.schema.json'));
ajv.addSchema(read('contracts/stage-4-1/v2/semantic-runtime.schema.json'));
// Structural validation only. The pilot additionally requires its reviewed plan and exact replay.
export const validateIndustryMetric = ajv.compile(read(SCHEMA));

function pilotPlan(root) {
  // Reviewed Slice 1 owner plan, not a restriction on Industry Metric V1.
  // Changing source, window or policy needs an explicit owner review, not just resealing artifact/binding pins.
  requireThat(sha256(bytes(PLAN, root)) === 'f1df61268372e3d435d8ede1c874aefef08e61e8b978ab74f06a3b14b779d664', 'PILOT_PLAN_DRIFT');
  return read(PLAN, root);
}

export function buildArtifact(generatedAt, root = ROOT) {
  const plan = pilotPlan(root), manifest = read(MANIFEST, root);
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
    const parsed = parseNbsProduction(raw.toString('utf8'), capture.period);
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
        locator: parsed.locator, column, rawRow: parsed.row, transformVersion: 'nbs-industrial-production-html.v1',
        evidence: { refType: 'web_source', refId: `${capture.sha256}:${parsed.locator}:${column}`, title: `${capture.period} 工业机器人 ${basis} 原始表格`, sourceUrl: capture.url, quality: 'candidate' } }
    }));
  });
  const artifact = { schemaVersion: 'industry-metric.v1', generatedAt, definition: plan.definition, policy: plan.policy,
    definitionRef: pin(PLAN, '/definition', plan.definition.id, plan.definition.revision, root),
    observations, completeness: { scope: 'declared_window_only', monthlyAvailable: observations.filter(o => o.basis === 'monthly' && o.value !== null).length, monthlyTarget: 8,
      missingMonthlyPeriods: plan.definition.missingMonthlyPeriods, historicalCoverage: 'partial' } };
  requireThat(validateIndustryMetric(artifact), `INDUSTRY_SCHEMA: ${ajv.errorsText(validateIndustryMetric.errors)}`);
  return artifact;
}

export function buildBinding(root = ROOT) {
  // Reuse the existing F1 binding contract and validator; no alternate registry or readiness algorithm.
  const plan = pilotPlan(root);
  const fields = Object.fromEntries(Object.keys(read('contracts/financial-research/v1/examples/pbc-binding.json', root).fieldBindings).map(k => [k, null]));
  const observationFields = { metricId: 'metricId', value: 'value', unit: 'unit', reportingBasis: 'basis', observationDate: 'valueDate', publicationDate: 'publicationDateTime', releaseAvailableAt: 'releaseAvailableAt', revision: 'revision', source: 'provenance', provider: 'quality', artifact: 'provenance', transform: 'provenance', quality: 'quality', admission: 'dataAdmission' };
  for (const [role, property] of Object.entries(observationFields)) fields[role] = { ownerContract: `${SCHEMA}#/$defs/observation`, pointer: `/${property}` };
  for (const [role, property] of Object.entries({ canonicalName: 'canonicalName', nativeFrequency: 'nativeFrequency', revisionPolicy: 'revisionPolicy', freshness: 'freshness', staleAfter: 'staleAfter' })) fields[role] = { ownerContract: `${SCHEMA}#/$defs/definition`, pointer: `/${property}` };
  return { schemaVersion: 'financial-semantic-binding.v2', bindingId: 'nbs-industrial-robot-output.v1', domain: 'industry',
    metricDefinitionRef: pin(PLAN, '/definition', plan.definition.id, '1', root), sourceDefinitionRef: pin(PLAN, '/definition', plan.definition.id, '1', root),
    fieldBindings: fields, policyRef: pin(PLAN, '/policy', plan.policy.id, '1', root), allowedUses: [], forbiddenUses: plan.policy.forbiddenUses };
}

export function checkArtifact(root = ROOT) {
  const actual = read(ARTIFACT, root), expected = buildArtifact(actual.generatedAt, root);
  requireThat(isDeepStrictEqual(actual, expected), 'NORMALIZED_ARTIFACT_DRIFT');
  const binding = read(BINDING, root);
  requireThat(isDeepStrictEqual(binding, buildBinding(root)), 'INDUSTRY_BINDING_DRIFT');
  for (const observation of actual.observations) {
    const capture = resolve(observation.provenance.captureRef, root);
    requireThat(capture.sha256 === observation.provenance.rawSha256 && capture.period === observation.valueDate, 'EVIDENCE_IDENTITY');
  }
  if (root === ROOT) validateBinding(binding);
  return { status: 'PASS', captures: 7, observations: actual.observations.length, monthly: actual.completeness,
    semanticBinding: 'VALID / NOT_READY', entity: 'UNRESOLVED', pit: 'UNPROVED', revisionContinuity: 'unknown', dataAdmission: actual.policy.dataAdmission, productionAdmission: actual.policy.productionAdmission };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(ROOT, ARTIFACT), JSON.stringify(buildArtifact(new Date().toISOString()), null, 2) + '\n');
    writeFileSync(path.join(ROOT, BINDING), JSON.stringify(buildBinding(), null, 2) + '\n');
  }
  console.log(JSON.stringify(checkArtifact(), null, 2));
}
