import type { EvidenceRef } from '../../local-core/domain/asset-types';
import type { DataQualityMeta } from './dataSource';

/** Source facts only. Industry.prosperity/stage/drivers/... remain research context. */
export type IndustryMetricBasis = 'monthly' | 'year_to_date';
export interface IndustryMetricPin { owner: string; objectId: string; version: string; sha256: string; locator: string }
export interface IndustryMetricObservation {
  id: string; metricId: string; industryId: string; geography: string; scope: string; unit: string;
  frequency: string; basis: IndustryMetricBasis; valueDate: string;
  referencePeriod: { start: string; end: string }; value: number | null;
  publicationDateTime: string | null; releaseAvailableAt: string | null; acquiredAt: string; generatedAt: string;
  revision: { status: string; sequence: number | null; supersedes: string | null; retainedVintage: string };
  quality: DataQualityMeta; conditions: string[]; pit: string; dataAdmission: string; productionAdmission: string;
  provenance: { sourceId: string; sourceOwner: string; acquisitionAdapter: string; rawPath: string; rawSha256: string;
    captureRef: IndustryMetricPin; locator: string; column: number; rawRow: string[]; transformVersion: string; evidence: EvidenceRef };
}
export interface IndustryMetricDataset {
  schemaVersion: 'industry-metric.v1'; generatedAt: string;
  definition: { id: string; revision: string; canonicalName: string; industryId: string; entity: null;
    geography: string; scope: string; unit: string; nativeFrequency: string; basis: IndustryMetricBasis[];
    sourceId: string; sourceOwner: string; acquisitionAdapter: string; revisionPolicy: string;
    window: { start: string; end: string }; missingMonthlyPeriods: string[]; freshness: string; staleAfter: string | null };
  policy: { id: string; revision: string; entityResolution: string; dataAdmission: string; productionAdmission: string;
    allowedUses: string[]; forbiddenUses: string[]; previewUse: string };
  definitionRef: IndustryMetricPin;
  observations: IndustryMetricObservation[];
  completeness: { scope: string; monthlyAvailable: number; monthlyTarget: number; missingMonthlyPeriods: string[]; historicalCoverage: string };
}
