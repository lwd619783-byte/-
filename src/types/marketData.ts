import type { DataManifest, DataQualityMeta } from "./dataSource";
import type { Market } from ".";

export interface StockProfile {
  id: string;
  name: string;
  code: string;
  market: Market;
  fullName?: string | null;
  industryName?: string | null;
  industryClassifications?: Array<{ scheme: string; name: string | null }>;
  listDate?: string | null;
  totalShares?: number | null;
  floatShares?: number | null;
  companyProfile?: string | null;
  businessScope?: string | null;
  f10Summary?: string | null;
  revenueComposition?: Array<{ name: string; revenue?: number | null; ratio?: number | null }>;
  mainProducts?: string[];
  quality: DataQualityMeta;
}

export interface StockQuote {
  id: string;
  latestPrice: number | null;
  pctChange: number | null;
  amount?: number | null;
  marketCap: number | null;
  floatMarketCap?: number | null;
  pe: number | null;
  peTtm?: number | null;
  pb: number | null;
  ps?: number | null;
  dividendYield?: number | null;
  turnover?: number | null;
  limitUp?: number | null;
  limitDown?: number | null;
  updatedAt?: string | null;
  quality: DataQualityMeta;
}

export interface PricePoint {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number | null;
  volume?: number | null;
  amount: number | null;
  pctChange: number | null;
}

export interface PriceHistorySeries {
  id: string;
  points: PricePoint[];
  quality: DataQualityMeta;
}

export interface RealFinancialMetric {
  id: string;
  reportDate?: string | null;
  revenue: number | null;
  revenueGrowth: number | null;
  netProfit: number | null;
  profitGrowth: number | null;
  eps?: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  debtRatio: number | null;
  operatingCashFlow: number | null;
  updatedAt?: string | null;
  quality: DataQualityMeta;
}

export type FinancialFetchStatus = "success" | "partial" | "not_applicable" | "source_unavailable" | "fetch_error" | "validation_error" | "stale";
export type FinancialReportType = "Q1" | "H1" | "Q3" | "FY" | "unknown";
export type FinancialStatementScope = "consolidated" | "parent" | "unknown";

export interface IncomeStatementMetrics {
  operatingRevenue: number | null;
  operatingCost: number | null;
  operatingProfit: number | null;
  totalProfit: number | null;
  netProfit: number | null;
  netProfitAttributableToParent: number | null;
  netProfitExcludingNonRecurring: number | null;
  researchAndDevelopmentExpense: number | null;
  sellingExpense: number | null;
  administrativeExpense: number | null;
  financialExpense: number | null;
}

export interface CashFlowMetrics {
  netOperatingCashFlow: number | null;
  cashReceivedFromSales: number | null;
  cashPaidForGoodsAndServices: number | null;
  capitalExpenditure: number | null;
  netInvestingCashFlow: number | null;
  netFinancingCashFlow: number | null;
}

export type FinancialPeriodMetrics = IncomeStatementMetrics & CashFlowMetrics;

export interface BalanceSheetMetrics {
  totalAssets: number | null;
  totalLiabilities: number | null;
  equityAttributableToParent: number | null;
  cashAndCashEquivalents: number | null;
  accountsReceivable: number | null;
  notesReceivable: number | null;
  contractAssets: number | null;
  inventory: number | null;
  accountsPayable: number | null;
  contractLiabilities: number | null;
  shortTermBorrowings: number | null;
  longTermBorrowings: number | null;
  goodwill: number | null;
}

export interface FinancialChangeMetric {
  value: number | null;
  changeAmount: number | null;
  reason: "missing_value" | "denominator_zero" | null;
  baseSign: "positive" | "negative" | "zero" | null;
}

export interface FinancialDerivedMetrics {
  revenueYoY: FinancialChangeMetric;
  revenueQoQ: FinancialChangeMetric;
  parentNetProfitYoY: FinancialChangeMetric;
  parentNetProfitQoQ: FinancialChangeMetric;
  deductedNetProfitYoY: FinancialChangeMetric;
  deductedNetProfitQoQ: FinancialChangeMetric;
  grossMargin: number | null;
  netMargin: number | null;
  operatingCashFlowToNetProfit: number | null;
  receivablesToRevenue: number | null;
  inventoryToRevenue: number | null;
  debtToAssetRatio: number | null;
  researchExpenseRatio: number | null;
}

export interface FinancialDataProvenance {
  provider: string;
  providerVersion: string;
  sourceDescription: string;
  sourceUrl: string;
  sourceIdentifier: string;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  generatedAt: string;
}

export interface FinancialReport extends FinancialDataProvenance {
  stockCode: string;
  market: "SH" | "SZ" | "BJ" | "unknown";
  companyName: string;
  reportPeriod: string;
  reportType: FinancialReportType;
  fiscalYear: number;
  fiscalQuarter: number;
  announcementDate: string | null;
  statementScope: FinancialStatementScope;
  currency: "CNY";
  unit: "yuan";
  sourceUnit: string;
  normalizedUnit: "元";
  normalizationFactor: number;
  status: "success" | "partial" | "conflicted";
  errorCode: string | null;
  errorMessage: string | null;
  isRestated: boolean | null;
  isDerived: boolean;
  derivationMethod: string | null;
  sourcePeriods: Array<string | null>;
  rawFieldCoverage: { available: number; total: number };
  coreFieldCoverage: { available: number; total: number };
  fieldStatus: Record<string, "available" | "missing" | "not_applicable">;
  cumulative: FinancialPeriodMetrics;
  singleQuarter: FinancialPeriodMetrics | null;
  balanceSheet: BalanceSheetMetrics;
  derived: FinancialDerivedMetrics;
  auditStatus: string | null;
}

export interface AShareFinancialData {
  schemaVersion: string;
  id: string;
  stockCode: string;
  market: "SH" | "SZ" | "BJ" | "unknown";
  companyName: string;
  industryType: "general" | "financial";
  status: FinancialFetchStatus;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  providerVersion: string;
  fetchedAt: string;
  generatedAt: string;
  lastSuccessfulFetchAt: string | null;
  currentFetchError: string | null;
  reports: FinancialReport[];
  quality: DataQualityMeta;
}

export interface AShareFinancialSummary {
  id: string;
  stockCode: string;
  companyName: string;
  market: "SH" | "SZ" | "BJ" | "unknown";
  industryType: "general" | "financial";
  status: FinancialFetchStatus;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  providerVersion: string;
  fetchedAt: string;
  generatedAt: string;
  lastSuccessfulFetchAt: string | null;
  currentFetchError: string | null;
  quality: DataQualityMeta;
  latestReportPeriod: string | null;
  latestReportType: FinancialReportType;
  latestSingleQuarter: Pick<FinancialPeriodMetrics, "operatingRevenue" | "netProfitAttributableToParent" | "netProfitExcludingNonRecurring" | "netOperatingCashFlow">;
  latestChanges: Pick<FinancialDerivedMetrics, "revenueYoY" | "revenueQoQ" | "parentNetProfitYoY" | "parentNetProfitQoQ" | "deductedNetProfitYoY" | "deductedNetProfitQoQ">;
  latestRatios: Pick<FinancialDerivedMetrics, "grossMargin" | "netMargin" | "debtToAssetRatio" | "researchExpenseRatio">;
  latestBalanceSheet: Pick<BalanceSheetMetrics, "accountsReceivable" | "inventory">;
  fieldStatus: Record<string, "available" | "missing" | "not_applicable">;
  detailPath: string;
}

export interface AShareFinancialManifestEntry {
  id: string;
  stockCode: string;
  relativePath: string;
  byteSize: number;
  checksumSha256: string;
  latestReportPeriod: string | null;
  status: FinancialFetchStatus;
}

export interface AShareFinancialManifest {
  schemaVersion: string;
  generatedAt: string;
  provider: string;
  providerVersion: string;
  total: number;
  success: number;
  partial: number;
  error: number;
  items: AShareFinancialManifestEntry[];
}

export interface ResearchReport {
  title: string;
  org?: string | null;
  analyst?: string | null;
  date?: string | null;
  rating?: string | null;
  epsForecast?: string | number | null;
  url?: string | null;
}

export interface ResearchReportSeries {
  id: string;
  reports: ResearchReport[];
  quality: DataQualityMeta;
}

export interface Announcement {
  title: string;
  date?: string | null;
  type?: string | null;
  url?: string | null;
  source?: string | null;
}

export interface AnnouncementSeries {
  id: string;
  announcements: Announcement[];
  quality: DataQualityMeta;
}

export type AnnouncementCategory =
  | "performance_forecast" | "performance_forecast_revision" | "performance_express"
  | "annual_report" | "semi_annual_report" | "quarterly_report" | "periodic_report_summary"
  | "correction" | "investor_relations" | "major_contract" | "share_repurchase"
  | "shareholding_change" | "equity_incentive" | "financing" | "merger_acquisition"
  | "regulatory" | "other" | "unknown";

export type AnnouncementFetchStatus = "success" | "partial" | "empty" | "source_unavailable" | "fetch_error" | "validation_error" | "stale";
export type AnnouncementParseStatus = "metadata_only" | "parse_success" | "parse_partial" | "parse_unavailable";

export interface PerformanceForecastEvent {
  forecastPeriod: string | null;
  forecastType: "increase" | "decrease" | "turn_positive" | "turn_negative" | "increase_loss" | "reduce_loss" | "uncertain" | "no_material_change" | "unknown";
  profitMetric: "netProfitAttributableToParent" | "netProfitExcludingNonRecurring" | "netProfit" | "operatingRevenue" | "other" | "unknown";
  lowerBound: number | null;
  upperBound: number | null;
  priorPeriodValue: number | null;
  changeLowerPercent: number | null;
  changeUpperPercent: number | null;
  expectedDirection: string;
  turnPositive: boolean;
  turnNegative: boolean;
  increaseLoss: boolean;
  reduceLoss: boolean;
  revisionType: string | null;
  previousForecastAnnouncementId: string | null;
  previousLowerBound: number | null;
  previousUpperBound: number | null;
  revisionDirection: string | null;
  derivedMidpoint: number | null;
  sourceTextEvidence: string;
  extractionMethod: string;
  extractionConfidence: "high" | "medium" | "low";
}

export interface PerformanceExpressEvent {
  reportPeriod: string | null;
  operatingRevenue: number | null;
  operatingProfit: number | null;
  totalProfit: number | null;
  netProfit: number | null;
  netProfitAttributableToParent: number | null;
  netProfitExcludingNonRecurring: number | null;
  basicEPS: number | null;
  totalAssets: number | null;
  equityAttributableToParent: number | null;
  revenueYoY: number | null;
  parentNetProfitYoY: number | null;
  sourceUnit: string;
  normalizedUnit: "CNY";
  correctionStatus: string;
  sourceTextEvidence: string;
  extractionMethod: string;
  extractionConfidence: "high" | "medium" | "low";
}

export interface AShareAnnouncementDetailItem {
  schemaVersion: string;
  announcementId: string;
  stockId: string;
  stockCode: string;
  companyName: string;
  market: "A股";
  title: string;
  rawTitle: string;
  category: AnnouncementCategory;
  subcategory: string | null;
  classificationConfidence: "high" | "medium" | "low";
  classificationEvidence: string[];
  announcementDate: string | null;
  announcementTime: string | null;
  reportPeriod: string | null;
  sourceProvider: string;
  sourceDescription: string;
  officialUrl: string | null;
  pdfUrl: string | null;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  status: "success" | "partial";
  parseStatus: AnnouncementParseStatus;
  parseErrorCode: string | null;
  parseErrorMessage: string | null;
  isCorrection: boolean;
  correctedAnnouncementId: string | null;
  isCancelled: boolean;
  isDuplicate: boolean;
  duplicateOf: string | null;
  supersededBy: string | null;
  performanceForecastEvents: PerformanceForecastEvent[];
  performanceExpressEvent: PerformanceExpressEvent | null;
  periodicReportEvent: { reportPeriod: string | null; reportType: string | null; summaryUrl: string | null; linkedFinancialReportPeriod: string | null; linkedFinancialStatus: "matched" | "not_found" | "not_applicable"; linkedFinancialGeneratedAt: string | null } | null;
  reasonSummary: string | null;
  reasonItems: Array<{ category: string; summary: string; evidenceText: string; sourcePage: number | null; extractionMethod: string; confidence: "high" | "medium" | "low" }>;
  announcementParsingResult: { status: AnnouncementParseStatus; method: string; confidence: "high" | "medium" | "low"; evidenceCount: number };
}

export interface AShareAnnouncementData {
  schemaVersion: string;
  stockId: string;
  stockCode: string;
  companyName: string;
  market: "A股";
  provider: string;
  providerVersion: string;
  generatedAt: string;
  fetchedAt: string;
  lastSuccessfulFetchAt: string | null;
  currentFetchError: string | null;
  status: AnnouncementFetchStatus;
  dateRange: { start: string; end: string };
  announcements: AShareAnnouncementDetailItem[];
  quality: DataQualityMeta;
}

export interface AShareAnnouncementPreview {
  announcementId: string;
  title: string;
  category: AnnouncementCategory;
  announcementDate: string | null;
  reportPeriod?: string | null;
  officialUrl: string | null;
  pdfUrl: string | null;
  status?: "success" | "partial";
  parseStatus: AnnouncementParseStatus;
  performanceForecastEvents?: PerformanceForecastEvent[];
  performanceExpressEvent?: PerformanceExpressEvent | null;
  reasonSummary?: string | null;
}

export interface AShareAnnouncementSummary {
  stockId: string;
  stockCode: string;
  companyName: string;
  market: "A股";
  status: AnnouncementFetchStatus;
  provider: string;
  providerVersion: string;
  fetchedAt: string;
  generatedAt: string;
  lastSuccessfulFetchAt: string | null;
  currentFetchError: string | null;
  announcementCount: number;
  categoryCounts: Partial<Record<AnnouncementCategory, number>>;
  latestAnnouncementDate: string | null;
  latestPerformanceAnnouncementDate: string | null;
  recentAnnouncements: AShareAnnouncementPreview[];
  latestPerformanceAnnouncement: AShareAnnouncementPreview | null;
  detailPath: string;
  quality: DataQualityMeta;
}

export interface AShareAnnouncementManifestEntry {
  stockId: string;
  stockCode: string;
  relativePath: string;
  byteSize: number;
  checksumSha256: string;
  announcementCount: number;
  latestAnnouncementDate: string | null;
  latestPerformanceAnnouncementDate: string | null;
  status: AnnouncementFetchStatus;
}

export interface AShareAnnouncementManifest {
  schemaVersion: string;
  generatedAt: string;
  provider: string;
  providerVersion: string;
  totalCompanies: number;
  totalAnnouncements: number;
  dateRange: { start: string | null; end: string | null };
  success: number;
  partial: number;
  error: number;
  empty: number;
  items: AShareAnnouncementManifestEntry[];
}

export interface SectorEntry {
  name: string;
  changePct?: number | null;
  code?: string | null;
  description?: string | null;
  rank?: number | null;
  coverage?: number | null;
}

export interface SectorMembership {
  id: string;
  industry: SectorEntry[];
  concept: SectorEntry[];
  region: SectorEntry[];
  quality: DataQualityMeta;
}

export interface StockSignalSummary {
  id: string;
  mainFundFlow5d?: number | null;
  mainFundFlow20d?: number | null;
  latestMainFundFlow?: number | null;
  dragonTigerCount30d?: number | null;
  marginBalance?: number | null;
  holderChangePct?: number | null;
  upcomingLockupCount?: number | null;
  popularityRank?: number | null;
  hotReason?: string | null;
  latestInteraction?: string | null;
  fieldSources?: Record<string, DataQualityMeta>;
  quality: DataQualityMeta;
}

export interface GeneratedRealDataBundle {
  manifest: DataManifest;
  profiles: Record<string, StockProfile>;
  quotes: Record<string, StockQuote>;
  aShareFinancialSummaries: Record<string, AShareFinancialSummary>;
  priceHistory: Record<string, PriceHistorySeries>;
  research: Record<string, ResearchReportSeries>;
  aShareAnnouncementSummaries: Record<string, AShareAnnouncementSummary>;
  signals: Record<string, StockSignalSummary>;
  sectorMembership: Record<string, SectorMembership>;
}
