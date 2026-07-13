export type WatchStatus = "观察" | "已配置" | "等回调" | "等业绩验证" | "剔除观察";
export type WatchPriority = "high" | "medium" | "low";
export type WatchItemSource = "user" | "sample";

export interface WatchItemSnapshot {
  status: WatchStatus;
  thesis: string;
  validationCriteria: string[];
  riskCriteria: string[];
}

export interface WatchItem {
  id: string;
  stockId: string;
  createdAt: string;
  updatedAt: string;
  status: WatchStatus;
  priority: WatchPriority;
  tags: string[];
  reason: string;
  thesis: string;
  validationCriteria: string[];
  riskCriteria: string[];
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  archivedAt: string | null;
  source: WatchItemSource;
  schemaVersion: 2;
}

export type ReviewTriggerType =
  | "manual"
  | "review_due"
  | "financial_event"
  | "announcement_event"
  | "data_quality_warning";

export interface ReviewEvidenceRef {
  eventId?: string;
  announcementId?: string;
  reportPeriod?: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface ReviewEntry {
  id: string;
  watchItemId: string;
  createdAt: string;
  triggerType: ReviewTriggerType;
  triggerEventIds: string[];
  beforeSnapshot: WatchItemSnapshot;
  afterSnapshot: WatchItemSnapshot;
  summary: string;
  rationale: string;
  evidenceRefs: ReviewEvidenceRef[];
  decision: string;
  nextReviewAt: string | null;
  correctsReviewEntryId: string | null;
}

export type ReviewTaskRuleType =
  | "due_review"
  | "overdue_review"
  | "earnings_preview"
  | "earnings_preview_revision"
  | "earnings_flash"
  | "periodic_report"
  | "material_difference"
  | "cash_flow_profit_divergence"
  | "data_quality_warning"
  | "long_unreviewed"
  | "earnings_expectation_added"
  | "earnings_expectation_revision_up"
  | "earnings_expectation_revision_down"
  | "earnings_expectation_comparison"
  | "earnings_expectation_data_warning";

export type ReviewTaskSeverity = "high" | "medium" | "low";
export type ReviewTaskStatus = "pending" | "acknowledged" | "dismissed" | "snoozed";

export interface ReviewTask {
  id: string;
  watchItemId: string;
  ruleType: ReviewTaskRuleType;
  relatedEventIds: string[];
  createdAt: string;
  dueAt: string | null;
  severity: ReviewTaskSeverity;
  title: string;
  description: string;
  status: ReviewTaskStatus;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
}

export interface ReviewTaskState {
  taskId: string;
  status: Exclude<ReviewTaskStatus, "pending">;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
  updatedAt: string;
}

export interface WatchlistSettings {
  longUnreviewedDays: number;
}

export interface WatchlistStoreEnvelope {
  schemaVersion: 2;
  updatedAt: string;
  watchItems: WatchItem[];
  reviewEntries: ReviewEntry[];
  reviewTaskStates: ReviewTaskState[];
  settings: WatchlistSettings;
}

export interface WatchlistExportFile extends WatchlistStoreEnvelope {
  format: "investment-research-dashboard.watchlist";
  exportedAt: string;
}
