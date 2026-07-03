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
export type WatchStatus = "观察" | "已配置" | "等回调" | "等业绩验证" | "剔除观察";

export interface MacroIndicator {
  id: string;
  category: "宏观环境" | "流动性" | "政策窗口" | "市场风格";
  name: string;
  currentStatus: string;
  trend: "上行" | "下行" | "震荡" | "待验证";
  marketImpact: string;
  trackingIndicators: string[];
  metrics: Array<{ label: string; value: string; note: string }>;
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
  profile?: import("./marketData").StockProfile;
  quote?: import("./marketData").StockQuote;
  realFinancial?: import("./marketData").RealFinancialMetric;
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

export interface WatchlistItem {
  id: string;
  stockId: string;
  reason: string;
  status: WatchStatus;
  trigger: string;
  questions: string[];
  nextReviewDate: string;
  latestNote: string;
}

export type { DashboardDataMode, DataQualityMeta, DataSourceStatus, DataManifest } from "./dataSource";
export type {
  GeneratedRealDataBundle,
  Announcement,
  AnnouncementSeries,
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
