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
export type CanonicalTemporalStatus = "resolved" | "date_only" | "uncertain" | "unresolved_legacy" | "invalid";
export type CanonicalTemporalUncertaintyReason = "date_precision" | "mixed_precision" | "missing_time" | "legacy_time_zone_unknown" | null;
export type CanonicalTemporalBoundsUncertaintyReason =
  | "overlapping_date_precision"
  | "mixed_precision_overlap"
  | "legacy_time_zone_unknown"
  | "missing_time"
  | "invalid_time"
  | null;
export type EarningsExpectationWarningCode =
  | "business_order_ambiguous"
  | "business_order_equal"
  | "business_order_unresolved"
  | "availability_uncertain"
  | "source_verification_pending"
  | "source_time_unresolved"
  | "disclosure_scope_uncertain"
  | "actual_value_unavailable"
  | "audit_time_invalid";

export type EarningsExpectationWarningFamily =
  | "availability"
  | "business_order"
  | "verification"
  | "disclosure"
  | "actual_value"
  | "audit";

export interface CanonicalBusinessTemporal {
  value: string | null;
  precision: EarningsExpectationTimePrecision | null;
  businessCalendarDate: string | null;
  instant: string | null;
  interpretationTimeZone: string | null;
  resolution: EarningsExpectationSourceTimeResolution | null;
  status: CanonicalTemporalStatus;
  uncertaintyReason: CanonicalTemporalUncertaintyReason;
  bounds: CanonicalTemporalBounds;
}

export interface CanonicalTemporalBoundary {
  businessCalendarDate: string;
  instant: string | null;
  edge: "start" | "instant" | "end";
}

export interface CanonicalTemporalBounds {
  earliest: CanonicalTemporalBoundary | null;
  latest: CanonicalTemporalBoundary | null;
  businessDateMin: string | null;
  businessDateMax: string | null;
  bounded: boolean;
  uncertaintyReason: CanonicalTemporalBoundsUncertaintyReason;
}

export type EarningsExpectationAvailabilityResolution =
  | { status: "resolved"; value: CanonicalBusinessTemporal; decisiveSide: "formation" | "source" | "equal"; bounds: CanonicalTemporalBounds }
  | { status: "uncertain"; value: null; candidates: CanonicalBusinessTemporal[]; reason: Exclude<CanonicalTemporalUncertaintyReason, null>; bounds: CanonicalTemporalBounds };

export type PreviousBusinessNodeStatus = "unique" | "none" | "ambiguous" | "equal_time" | "unresolved";

export interface PerformanceDisclosureEvidence {
  eventId: string;
  occurredAt: string;
  /** Persisted event business date; prevents display-zone reinterpretation of absolute disclosure instants. */
  businessCalendarDate?: string | null;
  category: "confirmed" | "possible";
}

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
  /** IANA zone used to interpret an unzoned clock or to freeze an absolute instant's source business date. */
  sourcePublishedAtTimeZone?: string | null;
  asOfDate: string;
  /** Exact prediction formation time; never inferred from createdAt. */
  formedAt?: string | null;
  /** Legacy date-only records are treated as date precision. */
  formedAtPrecision?: EarningsExpectationTimePrecision;
  /** How formedAt was resolved; unresolved legacy wall clocks are retained for audit but not used as exact time. */
  formedAtResolution?: EarningsExpectationSourceTimeResolution | null;
  /** IANA zone used to interpret/validate formedAt against the persisted asOfDate. */
  formedAtTimeZone?: string | null;
  /** Persisted authority for the prediction business date; never recomputed from the current UI time zone. */
  formedAtCalendarDate?: string | null;
  analystCount: number | null;
  institutionCount: number | null;
  ingestionMethod: EarningsExpectationIngestionMethod;
  createdAt: string;
  createdBy: string;
  sourceVerificationStatus: EarningsExpectationVerificationStatus;
  notes: string | null;
  correctsSnapshotId: string | null;
  correctionScope?: EarningsExpectationCorrectionScope | null;
  /** Persisted authority for the source publication business date. */
  sourcePublishedAtCalendarDate?: string | null;
  /** Runtime storage writes V2; V1 is accepted only as a legacy input for idempotent migration. */
  schemaVersion: 1 | 2;
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
  earliestConfirmedDisclosure?: PerformanceDisclosureEvidence | null;
  earliestPossibleDisclosure?: PerformanceDisclosureEvidence | null;
  decisiveDisclosureEvent?: PerformanceDisclosureEvidence | null;
  disclosureUncertaintyReasonCode?: EarningsExpectationWarningCode | null;
  originalBusinessTime?: string | null;
  effectiveBusinessTime?: string | null;
  originalFormationTime?: string | null;
  effectiveFormationTime?: string | null;
  originalSourcePublishedAt?: string | null;
  effectiveSourcePublishedAt?: string | null;
  temporalCorrectionApplied?: boolean;
  correctedTemporalFields?: string[];
  actualSourceInterpretationTimeZone?: string | null;
  actualDisclosureAt?: string | null;
  performanceInformationCutoff?: string | null;
  comparisonAvailableAt?: string | null;
  comparisonAvailableBusinessCalendarDate?: string | null;
  availableAt?: EarningsExpectationAvailabilityResolution;
  availabilityBounds?: CanonicalTemporalBounds;
  businessCalendarDate?: string | null;
  interpretationTimeZone?: string | null;
  availabilityStatus?: "resolved" | "uncertain";
  availabilityUncertaintyReason?: CanonicalTemporalUncertaintyReason;
  previousResolutionStatus?: PreviousBusinessNodeStatus;
  previousCandidateIds?: string[];
  previousCandidateEffectiveSnapshotIds?: string[];
  auditTimeStatus?: "valid" | "invalid";
  structuredWarningCodes?: EarningsExpectationWarningCode[];
  nonComparableReasonCodes?: EarningsExpectationWarningCode[];
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
  schemaVersion: 2;
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
  businessEventKey?: string;
  businessRootSnapshotId?: string;
  effectiveSnapshotId?: string;
  correctionChainSnapshotIds?: string[];
  originalBusinessTime?: string | null;
  effectiveBusinessTime?: string | null;
  originalFormationTime?: string | null;
  effectiveFormationTime?: string | null;
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
  earliestConfirmedDisclosure?: PerformanceDisclosureEvidence | null;
  earliestPossibleDisclosure?: PerformanceDisclosureEvidence | null;
  decisiveDisclosureEvent?: PerformanceDisclosureEvidence | null;
  disclosureUncertaintyReasonCode?: EarningsExpectationWarningCode | null;
  availableAt?: EarningsExpectationAvailabilityResolution;
  businessCalendarDate?: string | null;
  interpretationTimeZone?: string | null;
  availabilityStatus?: "resolved" | "uncertain";
  availabilityUncertaintyReason?: CanonicalTemporalUncertaintyReason;
  availabilityBounds?: CanonicalTemporalBounds;
  warningEpisodeKey?: string | null;
  warningActivationEntityIds?: string[];
  warningFamily?: EarningsExpectationWarningFamily | null;
  businessOrderCandidates?: EarningsExpectationBusinessOrderCandidate[];
  eventOccurredAt?: string | null;
  eventBusinessDate?: string | null;
  detectedAt?: string | null;
  stateActivatedAt?: string | null;
  recordedAt?: string | null;
  previousResolutionStatus?: PreviousBusinessNodeStatus;
  previousCandidateIds?: string[];
  previousCandidateEffectiveSnapshotIds?: string[];
  auditTimeStatus?: "valid" | "invalid";
  structuredWarningCodes?: EarningsExpectationWarningCode[];
  nonComparableReasonCodes?: EarningsExpectationWarningCode[];
  /** Legacy compatibility fields. New consumers must use businessRevisionDelta. */
  revisionDirection?: "up" | "down" | "unchanged" | null;
  revisionMagnitude?: number | null;
  businessTimePrecision?: EarningsExpectationTimePrecision | null;
  effectiveBusinessTimePrecision?: EarningsExpectationTimePrecision | null;
  businessOrderUncertain?: boolean;
}

export interface EarningsExpectationBusinessOrderCandidate {
  businessRootSnapshotId: string;
  effectiveSnapshotId: string;
  sourceName: string;
  formationTime: CanonicalBusinessTemporal;
  availableAt: EarningsExpectationAvailabilityResolution;
}
