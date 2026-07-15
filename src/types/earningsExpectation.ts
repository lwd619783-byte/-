import type { Market } from ".";

export type EarningsExpectationSourceCategory =
  | "company_guidance"
  | "institution_single"
  | "institution_consensus"
  | "user_estimate";

export type EarningsExpectationIngestionMethod = "manual" | "json_import" | "csv_import" | "provider";
export type EarningsExpectationMetric = "revenue" | "attributable_net_profit" | "adjusted_net_profit" | "eps" | "operating_cash_flow";
export type EarningsExpectationPeriodScope = "single_quarter" | "year_to_date" | "half_year" | "first_three_quarters" | "full_year" | "ttm";
export type EarningsExpectationShape = "point" | "range";
export type EarningsExpectationCurrency = "CNY" | "HKD" | "USD";
export type EarningsExpectationUnit = "yuan" | "ten_thousand_yuan" | "million_yuan" | "hundred_million_yuan" | "currency_per_share";
export type EarningsExpectationAccountingBasis = "PRC_GAAP" | "IFRS" | "unknown";
export type EarningsExpectationVerificationStatus = "verified" | "pending" | "unverified" | "invalid";
export type EarningsExpectationTimePrecision = "date" | "datetime";
export type EarningsExpectationCorrectionScope = "value" | "basis";
export type EarningsExpectationBusinessOrderStatus = "confirmed" | "equal" | "uncertain";
export type EarningsExpectationDisclosureTimingStatus = "before" | "after" | "same_time" | "unknown";
export type EarningsExpectationSourceTimeResolution = "date" | "absolute" | "workflow_time_zone" | "unresolved_legacy";

export interface EarningsExpectationCorrectionDelta {
  correctionTargetId: string;
  previousValue: number | null;
  correctedValue: number | null;
  valueDelta: number | null;
  relativeDelta: number | null;
  changedFields: string[];
  basisChanged: boolean;
  accountingScopeChanged: boolean;
  unitChanged: boolean;
  currencyChanged: boolean;
  correctionReason: string | null;
  calculationNote: string | null;
}

export interface EarningsExpectationBusinessRevisionDelta {
  /** Legacy alias for previousEffectiveSnapshotId. */
  previousBusinessSnapshotId: string;
  previousBusinessRootSnapshotId: string;
  previousEffectiveSnapshotId: string;
  currentSnapshotId: string;
  baselineValue: number;
  resolvedThroughCorrectionChain: boolean;
  absoluteDelta: number;
  relativeDelta: number;
  direction: "up" | "down" | "unchanged";
}

export interface EarningsExpectationSnapshot {
  id: string;
  stockId: string;
  market: Market;
  reportPeriod: string;
  periodScope: EarningsExpectationPeriodScope;
  metric: EarningsExpectationMetric;
  estimateShape: EarningsExpectationShape;
  value: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  currency: EarningsExpectationCurrency;
  unit: EarningsExpectationUnit;
  accountingBasis: EarningsExpectationAccountingBasis;
  sourceCategory: EarningsExpectationSourceCategory;
  sourceName: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  /** Legacy snapshots omit this field and are migrated conservatively from sourcePublishedAt. */
  sourcePublishedAtPrecision?: EarningsExpectationTimePrecision | null;
  /** How sourcePublishedAt was made reliable; unresolved legacy wall clocks are never reinterpreted. */
  sourcePublishedAtResolution?: EarningsExpectationSourceTimeResolution | null;
  /** Set only when an unzoned wall clock was resolved with an explicit workflow IANA time zone. */
  sourcePublishedAtTimeZone?: string | null;
  asOfDate: string;
  /** Exact prediction formation time; never inferred from createdAt. */
  formedAt?: string | null;
  /** Legacy date-only records are treated as date precision. */
  formedAtPrecision?: EarningsExpectationTimePrecision;
  /** How formedAt was resolved; unresolved legacy wall clocks are retained for audit but not used as exact time. */
  formedAtResolution?: EarningsExpectationSourceTimeResolution | null;
  /** Exact IANA time zone used only when an unzoned formedAt wall clock was resolved. */
  formedAtTimeZone?: string | null;
  analystCount: number | null;
  institutionCount: number | null;
  ingestionMethod: EarningsExpectationIngestionMethod;
  createdAt: string;
  createdBy: string;
  sourceVerificationStatus: EarningsExpectationVerificationStatus;
  notes: string | null;
  correctsSnapshotId: string | null;
  correctionScope?: EarningsExpectationCorrectionScope | null;
  schemaVersion: 1;
}

export type EarningsExpectationComparisonResult = "above" | "within" | "below" | "not_comparable" | "insufficient_data";
export type EarningsExpectationComparabilityStatus = "comparable" | "not_comparable" | "insufficient_data";

export interface EarningsExpectationComparison {
  id: string;
  snapshotId: string;
  actualEventId: string | null;
  stockId: string;
  reportPeriod: string;
  periodScope: EarningsExpectationPeriodScope;
  metric: EarningsExpectationMetric;
  expectedValue: number | null;
  expectedLowerBound: number | null;
  expectedUpperBound: number | null;
  actualValue: number | null;
  absoluteDifference: number | null;
  relativeDifference: number | null;
  comparisonResult: EarningsExpectationComparisonResult;
  comparisonMethod: string;
  isExAnte: boolean;
  businessOrderStatus?: EarningsExpectationBusinessOrderStatus;
  businessRootSnapshotId?: string;
  effectiveSnapshotId?: string;
  /** isExAnte means beforeAnyPerformanceDisclosure, not merely before the selected actual value. */
  beforeActualDisclosure?: boolean | null;
  beforeAnyPerformanceDisclosure?: boolean | null;
  actualDisclosureTimingStatus?: EarningsExpectationDisclosureTimingStatus;
  performanceDisclosureTimingStatus?: EarningsExpectationDisclosureTimingStatus;
  performanceDisclosureUncertain?: boolean;
  originalBusinessTime?: string;
  effectiveBusinessTime?: string;
  originalSourcePublishedAt?: string | null;
  effectiveSourcePublishedAt?: string | null;
  temporalCorrectionApplied?: boolean;
  correctedTemporalFields?: string[];
  actualSourceInterpretationTimeZone?: string | null;
  actualDisclosureAt?: string | null;
  performanceInformationCutoff?: string | null;
  comparisonAvailableAt?: string | null;
  comparabilityStatus: EarningsExpectationComparabilityStatus;
  nonComparableReasons: string[];
  calculatedAt: string;
}

export interface EarningsExpectationImportIssue {
  row: number;
  code: string;
  message: string;
  raw?: Record<string, unknown>;
}

export interface EarningsExpectationImportRecord {
  id: string;
  importedAt: string;
  ingestionMethod: "json_import" | "csv_import";
  mode: "merge" | "replace";
  fileName: string | null;
  totalCount: number;
  addedCount: number;
  duplicateCount: number;
  conflictCount: number;
  invalidCount: number;
  issues: EarningsExpectationImportIssue[];
}

export interface EarningsExpectationSettings {
  revisionReminderThreshold: number;
  nearZeroThreshold: number;
  roundingTolerance: number;
  /** IANA time zone used for calendar-date validation and display. */
  timeZone: string;
}

export interface EarningsExpectationStoreEnvelope {
  schemaVersion: 1;
  updatedAt: string;
  snapshots: EarningsExpectationSnapshot[];
  settings: EarningsExpectationSettings;
  importHistory: EarningsExpectationImportRecord[];
}

export interface EarningsExpectationExportFile extends EarningsExpectationStoreEnvelope {
  format: "investment-research-dashboard.earnings-expectation";
  exportedAt: string;
}

export interface EarningsExpectationEventPayload {
  snapshotId: string;
  businessRootSnapshotId?: string;
  effectiveSnapshotId?: string;
  correctionChainSnapshotIds?: string[];
  originalBusinessTime?: string;
  effectiveBusinessTime?: string;
  originalSourcePublishedAt?: string | null;
  effectiveSourcePublishedAt?: string | null;
  temporalCorrectionApplied?: boolean;
  correctedTemporalFields?: string[];
  actualSourceInterpretationTimeZone?: string | null;
  correctionRecordedAt?: string | null;
  sourceCategory: EarningsExpectationSourceCategory;
  sourceName: string;
  reportPeriod: string;
  metric: EarningsExpectationMetric;
  expectedValue: number | null;
  expectedLowerBound: number | null;
  expectedUpperBound: number | null;
  isExAnte: boolean | null;
  beforeActualDisclosure?: boolean | null;
  beforeAnyPerformanceDisclosure?: boolean | null;
  performanceInformationCutoff?: string | null;
  comparisonResult: EarningsExpectationComparisonResult | null;
  sourceVerificationStatus: EarningsExpectationVerificationStatus;
  sourcePublishedAt?: string | null;
  sourcePublishedAtPrecision?: EarningsExpectationTimePrecision | null;
  sourcePublishedAtResolution?: EarningsExpectationSourceTimeResolution | null;
  sourcePublishedAtTimeZone?: string | null;
  correctsSnapshotId?: string | null;
  businessOrderStatus?: EarningsExpectationBusinessOrderStatus;
  correctionDelta?: EarningsExpectationCorrectionDelta | null;
  businessRevisionDelta?: EarningsExpectationBusinessRevisionDelta | null;
  actualDisclosureTimingStatus?: EarningsExpectationDisclosureTimingStatus;
  performanceDisclosureTimingStatus?: EarningsExpectationDisclosureTimingStatus;
  performanceDisclosureUncertain?: boolean;
  /** Legacy compatibility fields. New consumers must use businessRevisionDelta. */
  revisionDirection?: "up" | "down" | "unchanged" | null;
  revisionMagnitude?: number | null;
  businessTimePrecision?: EarningsExpectationTimePrecision;
  effectiveBusinessTimePrecision?: EarningsExpectationTimePrecision;
  businessOrderUncertain?: boolean;
}
