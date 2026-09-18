import { isDeepStrictEqual } from 'node:util';
import { ROOT, bytes, read, sha256, pin, instant } from '../semantic-runtime/common.mjs';
import { buildBinding, validateIndustryMetric } from './metric-artifact.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';
import { parseEiaPetroleum } from './eia-parser.mjs';

export const EIA_OWNER = Object.freeze({ plan: 'config/industry/eia-commercial-crude-stocks.v1.json', artifact: 'src/data/real/industry-eia-commercial-crude-stocks.generated.json', binding: 'config/industry/eia-commercial-crude-stocks-semantic-binding.v2.json', bindingId: 'eia-commercial-crude-stocks.v1', planHash: 'fbfcaf825afaf6dc9849d6cae9b90102f04a4d8efc85a0eb7664348e2d6239ae' });
export const EIA_MANIFEST = 'research-data/industry/eia-petroleum-v1/manifest.json';
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
export function buildEiaArtifact(generatedAt, root = ROOT) {
  requireThat(sha256(bytes(EIA_OWNER.plan, root)) === EIA_OWNER.planHash, 'EIA_PLAN_DRIFT');
  // This reviewed snapshot is immutable; a newly acquired/revised capture requires explicit review.
  requireThat(sha256(bytes(EIA_MANIFEST, root)) === '8defdd1c0ae10105d7f3d15263a8658e26d361c672bb093bd5ad4b511607cea9', 'EIA_CAPTURE_DRIFT');
  const plan = read(EIA_OWNER.plan, root), manifest = read(EIA_MANIFEST, root), d = plan.definition;
  requireThat(Number.isFinite(instant(generatedAt)), 'GENERATION_TIME_REQUIRED');
  for (const c of manifest.captures) {
    const raw = bytes(c.path, root);
    requireThat(raw.length === c.byteLength && sha256(raw) === c.sha256, 'EIA_RAW_DIGEST');
    requireThat(c.finalUrl === c.url && new URL(c.url).hostname === 'www.eia.gov' && c.status === 200, 'EIA_SOURCE_IDENTITY');
    requireThat(Number.isFinite(instant(c.acquiredAt)) && instant(c.acquiredAt) <= instant(generatedAt), 'ACQUISITION_TIME');
  }
  const capture = manifest.captures[0];
  const parsed = parseEiaPetroleum(bytes(capture.path, root).toString('utf8'), plan.source, d.window);
  const observations = parsed.map(({ period, value, row, column, locator }) => ({
    id: `${d.id}:${period}:week_ending:${capture.sha256}`, metricId: d.id, industryId: d.industryId,
    geography: d.geography, scope: d.scope, unit: d.unit, frequency: d.nativeFrequency, basis: 'week_ending',
    valueDate: period, referencePeriod: { start: period, end: period }, value,
    publicationDateTime: null, releaseAvailableAt: null, acquiredAt: capture.acquiredAt, generatedAt,
    revision: { status: 'unknown', sequence: null, supersedes: null, retainedVintage: capture.sha256 },
    quality: { source: d.sourceOwner, sourceLayer: 'official', sourceEndpoint: d.acquisitionAdapter, sourceUrl: capture.url, status: value === null ? 'missing' : 'real' },
    conditions: [...(value === null ? ['partial'] : []), 'not_admitted', 'unknown'], pit: 'UNPROVED', dataAdmission: plan.policy.dataAdmission, productionAdmission: plan.policy.productionAdmission,
    provenance: { sourceId: d.sourceId, sourceOwner: d.sourceOwner, acquisitionAdapter: d.acquisitionAdapter,
      rawPath: capture.path, rawSha256: capture.sha256, captureRef: pin(EIA_MANIFEST, '/captures/0', `${manifest.series}:${capture.sha256}`, '1', root),
      locator, column, rawRow: row, transformVersion: d.acquisitionAdapter,
      evidence: { refType: 'web_source', refId: `${capture.sha256}:${locator}`, title: `${period} ${plan.source.title}`, sourceUrl: capture.url, quality: 'candidate' } }
  }));
  const periods = [];
  for (let t = Date.parse(d.window.start); t <= Date.parse(d.window.end); t += 7 * 86400000) periods.push(new Date(t).toISOString().slice(0, 10));
  const missingPeriods = periods.filter(p => !observations.some(o => o.valueDate === p && o.value !== null));
  const artifact = { schemaVersion: 'industry-metric.v1', generatedAt, definition: d, policy: plan.policy,
    definitionRef: pin(EIA_OWNER.plan, '/definition', d.id, d.revision, root), observations,
    completeness: { scope: 'declared_window_only', availableCount: periods.length - missingPeriods.length, targetCount: periods.length, missingPeriods, historicalCoverage: 'partial' } };
  requireThat(validateIndustryMetric(artifact), 'EIA_INDUSTRY_SCHEMA');
  return artifact;
}
export function checkEiaArtifact(root = ROOT) {
  const actual = read(EIA_OWNER.artifact, root), expected = buildEiaArtifact(actual.generatedAt, root);
  requireThat(isDeepStrictEqual(actual, expected), 'EIA_NORMALIZED_ARTIFACT_DRIFT');
  const binding = read(EIA_OWNER.binding, root);
  requireThat(isDeepStrictEqual(binding, buildBinding(root, EIA_OWNER)), 'EIA_BINDING_DRIFT');
  if (root === ROOT) validateBinding(binding);
  return { status: 'PASS', captures: 2, observations: actual.observations.length, coverage: actual.completeness, semanticBinding: 'VALID / NOT_READY', entity: 'UNRESOLVED', pit: 'UNPROVED', revisionContinuity: 'unknown', dataAdmission: actual.policy.dataAdmission, productionAdmission: actual.policy.productionAdmission };
}
