import type { Market } from ".";
import type { AnnouncementParseStatus } from "./marketData";

export type ResearchEventType =
  | "earnings_preview"
  | "earnings_preview_revision"
  | "earnings_flash"
  | "periodic_report"
  | "financial_update"
  | "announcement"
  | "data_warning";

export type ResearchEventSourceType = "announcement" | "financial_report" | "provider_status";
export type ResearchVerificationStatus = "verified" | "partial" | "metadata_only" | "stale" | "missing" | "error";
export type ResearchParseStatus = AnnouncementParseStatus | "not_applicable" | "missing" | "stale" | "error";
export type ResearchMateriality = "high" | "medium" | "low" | "unknown";
export type ResearchReviewStatus = "pending" | "reviewed" | "not_required";
export type ResearchMetricPeriodBasis = "cumulative" | "single_quarter" | "range" | "point";

export interface ResearchEventMetric {
  key: string;
  label: string;
  value: number | null;
  unit: "CNY" | "percent" | "ratio" | "count" | "unknown";
  periodBasis: ResearchMetricPeriodBasis;
  sourceAnnouncementId: string | null;
  sourceFinancialPeriod: string | null;
}

export interface ResearchEvent {
  id: string;
  stockId: string;
  stockName: string;
  stockCode: string;
  industryId: string;
  market: Market;
  eventType: ResearchEventType;
  eventDate: string | null;
  publishedAt: string | null;
  reportPeriod: string | null;
  title: string;
  summary: string;
  sourceType: ResearchEventSourceType;
  sourceName: string;
  sourceUrl: string | null;
  pdfUrl: string | null;
  verificationStatus: ResearchVerificationStatus;
  parseStatus: ResearchParseStatus;
  materiality: ResearchMateriality;
  metrics: ResearchEventMetric[];
  relatedAnnouncementIds: string[];
  relatedFinancialPeriod: string | null;
  reviewStatus: ResearchReviewStatus;
  reviewReasons: string[];
  isRestated: boolean | null;
  updatedAt: string | null;
}

export type EarningsVerificationStage = "preview" | "revision" | "flash" | "formal";

export interface EarningsVerificationDifference {
  from: "preview" | "flash";
  to: "flash" | "formal";
  metricKey: string;
  metricLabel: string;
  fromValue: number;
  toValue: number;
  absoluteDifference: number;
  relativeDifference: number | null;
}

export interface EarningsVerificationChain {
  id: string;
  stockId: string;
  stockName: string;
  stockCode: string;
  reportPeriod: string;
  preview: ResearchEvent[];
  revision: ResearchEvent[];
  flash: ResearchEvent[];
  formal: ResearchEvent[];
  financialUpdates: ResearchEvent[];
  missingStages: EarningsVerificationStage[];
  differences: EarningsVerificationDifference[];
  hasMaterialDifference: boolean;
  needsReview: boolean;
}

export interface ResearchEventSnapshot {
  events: ResearchEvent[];
  chains: EarningsVerificationChain[];
  generatedAt: string;
}
