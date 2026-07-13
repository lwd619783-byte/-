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
  asOfDate: string;
  analystCount: number | null;
  institutionCount: number | null;
  ingestionMethod: EarningsExpectationIngestionMethod;
  createdAt: string;
  createdBy: string;
  sourceVerificationStatus: EarningsExpectationVerificationStatus;
  notes: string | null;
  correctsSnapshotId: string | null;
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
  sourceCategory: EarningsExpectationSourceCategory;
  sourceName: string;
  reportPeriod: string;
  metric: EarningsExpectationMetric;
  expectedValue: number | null;
  expectedLowerBound: number | null;
  expectedUpperBound: number | null;
  isExAnte: boolean | null;
  comparisonResult: EarningsExpectationComparisonResult | null;
  sourceVerificationStatus: EarningsExpectationVerificationStatus;
  revisionDirection?: "up" | "down" | "unchanged" | null;
  revisionMagnitude?: number | null;
}
