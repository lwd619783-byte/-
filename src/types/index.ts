export type Market = "A股" | "港股" | "美股";
export type RiskLevel = "低" | "中" | "高";
export type Prosperity = "高" | "中" | "低";
export type InvestmentStage =
  | "左侧布局"
  | "景气上行"
  | "主升浪"
  | "高位震荡"
  | "景气下行";
export type InvestmentStyle = "趋势" | "价值" | "主题" | "周期" | "防御";

export interface MacroIndicator {
  id: string;
  category: "宏观环境" | "流动性" | "政策窗口" | "市场风格";
  name: string;
  currentStatus: string;
  trend: "上行" | "下行" | "震荡" | "待验证";
  marketImpact: string;
  trackingIndicators: string[];
  metrics: Array<{
    label: string;
    value: string;
    note: string;
    source?: string;
    updatedAt?: string;
    status?: import("./dataSource").DataSourceStatus;
  }>;
  dataQuality?: import("./dataSource").DataQualityMeta[];
}

export interface IndustrySegment {
  id: string;
  name: string;
  industryId: string;
  logic: string;
  demandSource: string;
  supplyPattern: string;
  moat: string;
  trend: string;
  keyVariables: string[];
  stockIds: string[];
}

export interface Industry {
  id: string;
  name: string;
  prosperity: Prosperity;
  stage: InvestmentStage;
  drivers: string[];
  catalysts: string[];
  risks: string[];
  styles: InvestmentStyle[];
  chain: Array<{ stage: "上游" | "中游" | "下游"; items: string[] }>;
  segments: IndustrySegment[];
}

export interface FinancialMetric {
  revenue: string;
  netProfit: string;
  grossMargin: string;
  netMargin: string;
  roe: string;
  debtRatio: string;
  operatingCashFlow: string;
  revenueGrowth: string;
  profitGrowth: string;
  marketCap: string;
}

export interface ValuationMetric {
  pe: string;
  pb: string;
  ps: string;
  dividendYield?: string;
}

export type EvidenceSourceType =
  | "年报"
  | "半年报"
  | "公告"
  | "官网"
  | "投资者关系"
  | "互动易"
  | "调研纪要"
  | "机构纪要"
  | "媒体报道"
  | "招股书"
  | "其他";

export interface EvidenceItem {
  id: string;
  claim: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  sourceDate?: string;
  confidence: "高" | "中" | "低";
  url?: string;
  note?: string;
  relatedSegmentId?: string;
  verificationStatus?: "已验证" | "部分验证" | "待验证";
}

export interface Stock {
  id: string;
  name: string;
  code: string;
  market: Market;
  industryId: string;
  segmentId: string;
  leaderPosition: string;
  business: string;
  thesis: string;
  financial: FinancialMetric;
  valuation: ValuationMetric;
  growthDrivers: string[];
  risks: string[];
  trackingMetrics: string[];
  riskLevel: RiskLevel;
  chainPosition: string;
  evidenceLevel?: "高" | "中" | "低";
  verificationStatus?: "已验证" | "部分验证" | "待验证";
  themeTags?: string[];
  candidateType?: "核心池" | "观察池";
  evidenceNotes?: string[];
  evidenceItems?: EvidenceItem[];
  profile?: import("./marketData").StockProfile;
  quote?: import("./marketData").StockQuote;
  realFinancial?: import("./marketData").RealFinancialMetric;
  aShareFinancialSummary?: import("./marketData").AShareFinancialSummary;
  aShareAnnouncementSummary?: import("./marketData").AShareAnnouncementSummary;
  dataMode?: import("./dataSource").DashboardDataMode;
  priceHistory?: import("./marketData").PricePoint[];
  research?: import("./marketData").ResearchReportSeries;
  announcements?: import("./marketData").AnnouncementSeries;
  signals?: import("./marketData").StockSignalSummary;
  sectorMembership?: import("./marketData").SectorMembership;
  dataQuality?: import("./dataSource").DataQualityMeta[];
  missingFields?: string[];
  isRecentlyUpdated?: boolean;
  dataCoverage?: number;
  researchProfile?: {
    macroMapping?: string[];
    industryLogic?: string;
    businessBreakdown?: Array<{
      name: string;
      description: string;
      revenueDriver?: string;
      marginDriver?: string;
    }>;
    profitDrivers?: string[];
    competitiveAdvantages?: string[];
    weaknesses?: string[];
    validationSignals?: string[];
  };
  relations?: Array<{
    stockId: string;
    relationType: "上游" | "下游" | "同行竞争" | "同环节" | "同主题" | "客户" | "供应商";
    strength?: "强" | "中" | "弱";
    reason?: string;
  }>;
}

export type { DashboardDataMode, DataQualityMeta, DataSourceStatus, DataManifest } from "./dataSource";
export type {
  ReviewEntry,
  ReviewEvidenceRef,
  ReviewTask,
  ReviewTaskRuleType,
  ReviewTaskSeverity,
  ReviewTaskState,
  ReviewTaskStatus,
  ReviewTriggerType,
  WatchItem,
  WatchItemSnapshot,
  WatchItemSource,
  WatchPriority,
  WatchStatus,
  WatchlistExportFile,
  WatchlistSettings,
  WatchlistStoreEnvelope,
} from "./watchlist";
export type {
  EarningsVerificationChain,
  EarningsVerificationDifference,
  EarningsVerificationStage,
  ResearchEvent,
  ResearchEventMetric,
  ResearchEventSnapshot,
  ResearchEventType,
  PerformanceDisclosureScope,
  ResearchMateriality,
  ResearchMetricPeriodBasis,
  ResearchParseStatus,
  ResearchReviewStatus,
  ResearchVerificationStatus,
} from "./researchEvent";
export type {
  AShareAnnouncementData,
  AShareAnnouncementDetailItem,
  AShareAnnouncementManifest,
  AShareAnnouncementManifestEntry,
  AShareAnnouncementPreview,
  AShareAnnouncementSummary,
  AnnouncementCategory,
  AnnouncementFetchStatus,
  AnnouncementParseStatus,
  AShareFinancialData,
  AShareFinancialManifest,
  AShareFinancialManifestEntry,
  AShareFinancialSummary,
  BalanceSheetMetrics,
  CashFlowMetrics,
  FinancialDataProvenance,
  FinancialChangeMetric,
  FinancialDerivedMetrics,
  FinancialFetchStatus,
  FinancialPeriodMetrics,
  FinancialReport,
  IncomeStatementMetrics,
  GeneratedRealDataBundle,
  Announcement,
  AnnouncementSeries,
  PerformanceExpressEvent,
  PerformanceForecastEvent,
  PriceHistorySeries,
  PricePoint,
  RealFinancialMetric,
  ResearchReport,
  ResearchReportSeries,
  SectorEntry,
  SectorMembership,
  StockProfile,
  StockQuote,
  StockSignalSummary,
} from "./marketData";
export type {
  CanonicalBusinessTemporal,
  CanonicalTemporalStatus,
  CanonicalTemporalUncertaintyReason,
  EarningsExpectationAccountingBasis,
  EarningsExpectationBusinessOrderStatus,
  EarningsExpectationBusinessOrderCandidate,
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationAvailabilityResolution,
  EarningsExpectationComparabilityStatus,
  EarningsExpectationComparison,
  EarningsExpectationComparisonResult,
  EarningsExpectationCurrency,
  EarningsExpectationEventPayload,
  EarningsExpectationExportFile,
  EarningsExpectationImportIssue,
  EarningsExpectationImportRecord,
  EarningsExpectationIngestionMethod,
  EarningsExpectationMetric,
  EarningsExpectationPeriodScope,
  EarningsExpectationCorrectionScope,
  EarningsExpectationFormationTimeBasis,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationDisclosureTimingStatus,
  EarningsExpectationSettings,
  EarningsExpectationShape,
  EarningsExpectationSnapshot,
  EarningsExpectationSourceCategory,
  EarningsExpectationSourceTimeResolution,
  EarningsExpectationStoreEnvelope,
  EarningsExpectationUnit,
  EarningsExpectationVerificationStatus,
  EarningsExpectationTimePrecision,
  EarningsExpectationWarningCode,
  EarningsExpectationWarningFamily,
  EarningsExpectationProviderSnapshot,
  EarningsExpectationProviderSourceAnnouncementType,
  CompanyGuidanceExpectationProviderStatus,
  CompanyGuidanceExpectationMetric,
  CompanyGuidanceExpectationStructuredWarningCode,
  CompanyGuidanceExpectationExclusionReason,
  CompanyGuidanceExpectationExclusion,
  CompanyGuidanceExpectationWarning,
  CompanyGuidanceExpectationDetail,
  CompanyGuidanceExpectationDetailProviderRecord,
  CompanyGuidanceExpectationWorkflowRecord,
  CompanyGuidanceExpectationCorrectionContentProjection,
  CompanyGuidanceExpectationCorrectionProof,
  CompanyGuidanceExpectationManifestEntry,
  CompanyGuidanceExpectationManifest,
  CompanyGuidanceExpectationSummaryItem,
  CompanyGuidanceExpectationSummary,
  CompanyGuidanceExpectationSummaryAudit,
  CompanyGuidanceExpectationLoadStatus,
  CompanyGuidanceExpectationWorkflowIndex,
  ProviderEvidenceRelation,
  ProviderEvidenceRelationRecord,
  AggregatedEarningsExpectationEvidence,
  PerformanceDisclosureEvidence,
  PreviousBusinessNodeStatus,
} from "./earningsExpectation";
