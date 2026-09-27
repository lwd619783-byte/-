import type { IndustryMetricDataset } from '../types/industryMetric';

/** Isolated tests only; no runtime registry entry, real source or real admission. */
export function syntheticFreight(): IndustryMetricDataset {
  const pin = { owner: 'synthetic-only', objectId: 'synthetic-freight', version: '1', sha256: '0'.repeat(64), locator: '/' };
  return {
    schemaVersion: 'industry-metric.v1', generatedAt: '2026-09-25T00:00:00Z',
    definition: { id: 'synthetic-freight', revision: '1', canonicalName: 'SYNTHETIC 运价图示', industryId: 'oil-shipping', entity: null,
      geography: 'synthetic', scope: 'Synthetic single route — never a real freight source', unit: 'WS', nativeFrequency: 'weekly', basis: ['week_ending'],
      sourceId: 'synthetic', sourceOwner: 'SYNTHETIC ONLY', acquisitionAdapter: 'synthetic', revisionPolicy: 'synthetic',
      window: { start: '2026-09-04', end: '2026-09-25' }, missingPeriods: [], freshness: 'FRESH', staleAfter: '2026-10-02' },
    policy: { id: 'synthetic', revision: '1', entityResolution: 'UNRESOLVED', dataAdmission: 'ADMITTED', productionAdmission: 'NOT_ADMITTED', allowedUses: ['display'], forbiddenUses: ['strict_pit'], previewUse: 'SYNTHETIC ONLY' },
    definitionRef: pin, completeness: { scope: 'synthetic', historicalCoverage: 'synthetic', availableCount: 4, targetCount: 4, missingPeriods: [] },
    observations: ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'].map((date, i) => ({
      id: `synthetic-${i}`, metricId: 'synthetic-freight', industryId: 'oil-shipping', geography: 'synthetic', scope: 'Synthetic single route — never a real freight source', unit: 'WS', frequency: 'weekly', basis: 'week_ending', valueDate: date,
      referencePeriod: { start: date, end: date }, value: 100 + i * 10, publicationDateTime: `${date}T09:00:00Z`, releaseAvailableAt: `${date}T09:00:00Z`, acquiredAt: `${date}T10:00:00Z`, generatedAt: `${date}T11:00:00Z`,
      revision: { status: 'unknown', sequence: null, supersedes: null, retainedVintage: 'synthetic' },
      quality: { source: 'SYNTHETIC ONLY', status: 'real' }, conditions: [], pit: 'UNPROVED', dataAdmission: 'ADMITTED', productionAdmission: 'NOT_ADMITTED',
      provenance: { sourceId: 'synthetic', sourceOwner: 'SYNTHETIC ONLY', acquisitionAdapter: 'synthetic', rawPath: 'synthetic-only', rawSha256: '0'.repeat(64), captureRef: pin, locator: `/synthetic/${i}`, transformVersion: 'synthetic', evidence: { refType: 'web_source', refId: `synthetic-${i}`, title: 'Synthetic fixture only', sourceUrl: 'https://example.invalid/synthetic', quality: 'candidate' } },
    })),
  };
}
