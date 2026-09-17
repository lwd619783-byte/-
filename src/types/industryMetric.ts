import type { EvidenceRef } from '../../local-core/domain/asset-types';
import type { BridgeAuditEvent } from '../../local-core/domain/types';
import type { DataQualityMeta } from './dataSource';

/** Source facts only. Industry.prosperity/stage/drivers/... remain research context. */
// F1 reportingBasis/nativeFrequency are owner-defined strings, not a pilot vocabulary.
export type IndustryMetricBasis = string;
// Wire vocabulary mirrors the existing semantic runtime/shared schemas (tested for parity).
export type IndustryMetricAdmission = 'ADMITTED' | 'PARTIAL' | 'NOT_ADMITTED' | 'UNKNOWN';
export type IndustryMetricUse = 'strict_pit' | 'research' | 'display';
export type IndustryMetricCondition = 'missing_evidence' | 'partial' | 'stale' | 'conflicted' | 'not_admitted' | 'unknown';
export interface IndustryMetricPin { owner: string; objectId: string; version: string; sha256: string; locator: string }
export interface IndustryMetricObservation {
  id: string; metricId: string; industryId: string; geography: string; scope: string; unit: string;
  frequency: string; basis: IndustryMetricBasis; valueDate: string;
  referencePeriod: { start: string; end: string }; value: number | null;
  publicationDateTime: string | null; releaseAvailableAt: string | null; acquiredAt: string; generatedAt: string;
  revision: { status: string; sequence: number | null; supersedes: string | null; retainedVintage: string };
  quality: DataQualityMeta; conditions: IndustryMetricCondition[]; pit: 'PROVEN' | 'UNPROVED';
  dataAdmission: IndustryMetricAdmission; productionAdmission: IndustryMetricAdmission;
  provenance: { sourceId: string; sourceOwner: string; acquisitionAdapter: string; rawPath: string; rawSha256: string;
    captureRef: IndustryMetricPin; locator: string; column?: number; rawRow?: string[]; transformVersion: string; evidence: EvidenceRef };
}
export interface IndustryMetricDataset {
  schemaVersion: 'industry-metric.v1'; generatedAt: string;
  definition: { id: string; revision: string; canonicalName: string; industryId: string; entity: NonNullable<BridgeAuditEvent['entity']> | null;
    geography: string; scope: string; unit: string; nativeFrequency: string; basis: IndustryMetricBasis[];
    sourceId: string; sourceOwner: string; acquisitionAdapter: string; revisionPolicy: string;
    window: { start: string; end: string }; missingMonthlyPeriods?: string[]; missingPeriods?: string[];
    freshness: 'FRESH' | 'STALE' | 'UNKNOWN' | 'unknown'; staleAfter: string | null };
  policy: { id: string; revision: string; entityResolution: 'RESOLVED' | 'UNRESOLVED'; dataAdmission: IndustryMetricAdmission; productionAdmission: IndustryMetricAdmission;
    allowedUses: IndustryMetricUse[]; forbiddenUses: IndustryMetricUse[]; previewUse: string };
  definitionRef: IndustryMetricPin;
  observations: IndustryMetricObservation[];
  completeness: { scope: string; historicalCoverage: string } & (
    { monthlyAvailable: number; monthlyTarget: number; missingMonthlyPeriods: string[];
      availableCount?: never; targetCount?: never; missingPeriods?: never }
    | { availableCount: number | null; targetCount: number | null; missingPeriods: string[];
      monthlyAvailable?: never; monthlyTarget?: never; missingMonthlyPeriods?: never }
  );
}
