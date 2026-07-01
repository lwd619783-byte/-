import type { DataManifest, DataQualityMeta } from "./dataSource";
import type { Market } from ".";

export interface StockProfile {
  id: string;
  name: string;
  code: string;
  market: Market;
  industryName?: string | null;
  listDate?: string | null;
  totalShares?: number | null;
  floatShares?: number | null;
  companyProfile?: string | null;
  businessScope?: string | null;
  f10Summary?: string | null;
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
  mainFundFlow20d?: number | null;
  latestMainFundFlow?: number | null;
  dragonTigerCount30d?: number | null;
  marginBalance?: number | null;
  holderChangePct?: number | null;
  upcomingLockupCount?: number | null;
  hotReason?: string | null;
  quality: DataQualityMeta;
}

export interface GeneratedRealDataBundle {
  manifest: DataManifest;
  profiles: Record<string, StockProfile>;
  quotes: Record<string, StockQuote>;
  financials: Record<string, RealFinancialMetric>;
  priceHistory: Record<string, PriceHistorySeries>;
  research: Record<string, ResearchReportSeries>;
  announcements: Record<string, AnnouncementSeries>;
  signals: Record<string, StockSignalSummary>;
  sectorMembership: Record<string, SectorMembership>;
}
