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
  financials: Record<string, RealFinancialMetric>;
  aShareFinancials: Record<string, AShareFinancialData>;
  priceHistory: Record<string, PriceHistorySeries>;
  research: Record<string, ResearchReportSeries>;
  announcements: Record<string, AnnouncementSeries>;
  signals: Record<string, StockSignalSummary>;
  sectorMembership: Record<string, SectorMembership>;
}
