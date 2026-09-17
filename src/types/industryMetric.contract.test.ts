import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import assetSchema from '../../contracts/v1/research-asset-os.contracts.v1.schema.json';
import sharedSchema from '../../contracts/financial-research/v1/shared.schema.json';
import runtimeSchema from '../../contracts/stage-4-1/v1/semantic-runtime.schema.json';
import identitySchema from '../../contracts/stage-4-1/v2/semantic-runtime.schema.json';
import schema from '../../contracts/industry/industry-metric.v1.schema.json';
import type { IndustryMetricAdmission, IndustryMetricCondition, IndustryMetricDataset, IndustryMetricUse } from './industryMetric';
import type { DataQualityMeta } from './dataSource';

const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
for (const dependency of [assetSchema, sharedSchema, runtimeSchema, identitySchema]) ajv.addSchema(dependency);
const validate = ajv.compile(schema);

// Test-only invented identities, values and proof assertions. No Provider, UI or admission input.
// Typed object construction (without a cast) also proves V1 TypeScript representability.
function synthetic(frequency = 'quarterly', basis = 'quarter_total'): IndustryMetricDataset {
  const pin = { owner: 'synthetic-contract-test', objectId: 'synthetic-source', version: '2', sha256: '0'.repeat(64), locator: '/source' };
  const start = frequency === 'daily' ? '2025-03-31' : frequency === 'weekly' ? '2025-03-25' : frequency === 'annual' ? '2024-04-01' : '2025-01-01';
  return {
    schemaVersion: 'industry-metric.v1', generatedAt: '2025-05-05T00:00:00Z',
    definition: {
      id: 'SYNTHETIC_ENERGY_OUTPUT', revision: '2', canonicalName: 'Synthetic contract capability only', industryId: 'synthetic-energy',
      entity: { entityType: 'industry', entityId: 'synthetic-registry-id', displayName: 'Synthetic industry' },
      geography: 'SYNTHETIC_REGION', scope: 'test-only population', unit: 'MWh', nativeFrequency: frequency, basis: [basis],
      sourceId: 'SYNTHETIC_SOURCE', sourceOwner: 'Synthetic source owner', acquisitionAdapter: 'synthetic-json.v1', revisionPolicy: 'Explicit supersedes chain in synthetic fixture',
      window: { start, end: '2025-03-31' }, missingPeriods: [], freshness: 'FRESH', staleAfter: '2025-08-01T00:00:00Z',
    },
    policy: { id: 'synthetic-policy', revision: '2', entityResolution: 'RESOLVED', dataAdmission: 'ADMITTED', productionAdmission: 'ADMITTED',
      allowedUses: ['strict_pit', 'research', 'display'], forbiddenUses: [], previewUse: 'Test only, no actual allowed use' },
    definitionRef: pin,
    observations: [{
      id: 'synthetic-vintage-2', metricId: 'SYNTHETIC_ENERGY_OUTPUT', industryId: 'synthetic-energy', geography: 'SYNTHETIC_REGION',
      scope: 'test-only population', unit: 'MWh', frequency, basis, valueDate: '2025-03-31', referencePeriod: { start, end: '2025-03-31' }, value: 0,
      publicationDateTime: '2025-04-01T09:00:00Z', releaseAvailableAt: '2025-04-01T09:01:00Z', acquiredAt: '2025-05-01T00:00:00Z', generatedAt: '2025-05-05T00:00:00Z',
      revision: { status: 'revised', sequence: 1, supersedes: 'synthetic-vintage-1', retainedVintage: 'synthetic-retained-2' },
      quality: { source: 'Synthetic source owner', sourceLayer: 'test-only', status: 'real' }, conditions: [], pit: 'PROVEN', dataAdmission: 'ADMITTED', productionAdmission: 'ADMITTED',
      provenance: { sourceId: 'SYNTHETIC_SOURCE', sourceOwner: 'Synthetic source owner', acquisitionAdapter: 'synthetic-json.v1',
        rawPath: 'test-only.json', rawSha256: '0'.repeat(64), captureRef: pin, locator: '/value', transformVersion: 'synthetic-json.v1',
        evidence: { refType: 'document', refId: 'synthetic-document', quality: 'verified' } },
    }],
    completeness: { scope: 'synthetic-quarter', availableCount: 1, targetCount: 1, missingPeriods: [], historicalCoverage: 'complete' },
  };
}

describe('reusable Industry Metric V1 wire contract (synthetic only)', () => {
  it.each([['quarterly', 'quarter_total'], ['daily', 'daily_average'], ['weekly', 'week_total'], ['annual', 'fiscal_year']])('represents %s / %s without changing the schema', (frequency, basis) => {
    const value = synthetic(frequency, basis);
    expect(validate(value), ajv.errorsText(validate.errors)).toBe(true);
    expect(value.observations[0].value).toBe(0);
    expect(value.observations[0].releaseAvailableAt).not.toBe(value.observations[0].publicationDateTime);
  });
  it('keeps unknown counts, missing values and partial/not-admitted states distinct from zero', () => {
    const value = synthetic();
    value.completeness = { scope: 'unknown denominator', availableCount: 0, targetCount: null, missingPeriods: ['2025-03-31'], historicalCoverage: 'unknown' };
    value.definition.entity = null; value.definition.freshness = 'STALE'; value.definition.staleAfter = null;
    value.policy.entityResolution = 'UNRESOLVED'; value.policy.allowedUses = []; value.policy.forbiddenUses = ['strict_pit', 'research', 'display'];
    value.policy.dataAdmission = 'PARTIAL'; value.policy.productionAdmission = 'NOT_ADMITTED';
    const o = value.observations[0];
    o.value = null; o.publicationDateTime = null; o.releaseAvailableAt = null; o.pit = 'UNPROVED';
    o.revision = { status: 'unknown', sequence: null, supersedes: null, retainedVintage: 'synthetic-retained' };
    o.quality.status = 'missing'; o.dataAdmission = 'PARTIAL'; o.productionAdmission = 'NOT_ADMITTED';
    o.conditions = ['missing_evidence', 'partial', 'stale', 'conflicted', 'not_admitted', 'unknown'];
    o.provenance.evidence.quality = 'candidate';
    expect(validate(value), ajv.errorsText(validate.errors)).toBe(true);
  });
  it('reuses shared enum vocabulary and matches TypeScript unions exhaustively', () => {
    const admission = { ADMITTED: true, PARTIAL: true, NOT_ADMITTED: true, UNKNOWN: true } satisfies Record<IndustryMetricAdmission, true>;
    const uses = { strict_pit: true, research: true, display: true } satisfies Record<IndustryMetricUse, true>;
    const conditions = { missing_evidence: true, partial: true, stale: true, conflicted: true, not_admitted: true, unknown: true } satisfies Record<IndustryMetricCondition, true>;
    const quality = { mock: true, real: true, partial: true, stale: true, missing: true, error: true, not_implemented: true, unsupported_market: true, conflicted: true, source_unavailable: true,
      generated_real: true, manual_verified: true, manual_unverified: true, static_reference: true, inferred: true, placeholder: true, unknown: true } satisfies Record<DataQualityMeta['status'], true>;
    expect(Object.keys(admission)).toEqual(runtimeSchema.$defs.context.properties.admission.enum);
    expect(Object.keys(uses)).toEqual(sharedSchema.$defs.Query.properties.use.enum);
    expect(Object.keys(conditions)).toEqual(sharedSchema.$defs.Conditions.items.enum);
    expect(Object.keys(quality).sort()).toEqual([...schema.$defs.observation.properties.quality.properties.status.enum].sort());
  });
  it('still rejects invalid identity, timestamps, revision sequence, enums and ambiguous coverage groups', () => {
    const mutations: Array<(value: IndustryMetricDataset) => void> = [
      v => { v.definition.id = ''; },
      v => { v.definition.window.end = '2025-02-30'; },
      v => { v.observations[0].releaseAvailableAt = '2025-03'; },
      v => { v.observations[0].revision.sequence = -1; },
      v => { Object.assign(v.definition.entity!, { entityType: 'macro_metric' }); },
      v => { Object.assign(v.policy, { dataAdmission: 'READY' }); },
      v => { Object.assign(v.policy, { allowedUses: ['trade'] }); },
      v => { Object.assign(v.observations[0], { pit: 'READY' }); },
      v => { Object.assign(v.completeness, { monthlyAvailable: 1, monthlyTarget: 1, missingMonthlyPeriods: [] }); },
      v => { delete (v.completeness as { targetCount?: number }).targetCount; },
    ];
    for (const mutate of mutations) {
      const value = synthetic(); expect(validate(value)).toBe(true);
      mutate(value); expect(validate(value)).toBe(false);
    }
  });
});
