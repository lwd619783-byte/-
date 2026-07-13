import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Binoculars, Building2, CheckSquare, FileCheck2, FlaskConical, LineChart, RefreshCw, type LucideIcon } from "lucide-react";
import { Header } from "./components/layout/Header";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RightRail } from "./components/layout/RightRail";
import { Sidebar } from "./components/layout/Sidebar";
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
import { ResearchEventCenter } from "./components/research/ResearchEventCenter";
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { buildDashboardDataset } from "./services/dataProvider";
import { buildResearchEventSnapshot } from "./services/researchEventProvider";
import type { DashboardDataMode, Stock } from "./types";
import { DashboardCard, KpiCard, SectionHeader } from "./components/common/terminal";
import { formatPercent } from "./utils/normalize";

type MainTab = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心";

const tabs: Array<{ id: MainTab; icon: LucideIcon }> = [
  { id: "宏观", icon: LineChart },
  { id: "行业", icon: Building2 },
  { id: "个股池", icon: BarChart3 },
  { id: "观察清单", icon: Binoculars },
  { id: "验证中心", icon: FlaskConical },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("行业");
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [dataMode, setDataMode] = useState<DashboardDataMode>("mixed");
  const dataset = useMemo(() => buildDashboardDataset(dataMode), [dataMode]);
  const researchSnapshot = useMemo(() => buildResearchEventSnapshot(dataset.stocks), [dataset.stocks]);
  const activeSelectedStock = selectedStock ? dataset.stocks.find((stock) => stock.id === selectedStock.id) ?? null : null;

  const dashboardStats = useMemo(() => {
    const quoteCoverage = dataset.realManifest.coverage?.quotes;
    const hkQuoteCoverage = dataset.realManifest.coverage?.hkQuotes;
    const hkRealCount = hkQuoteCoverage?.real ?? 0;
    const hkQuoteTotal = hkQuoteCoverage?.total ?? quoteCoverage?.unsupportedTotal ?? dataset.realManifest.universe?.markets?.["港股"];
    const stocksWithReal = dataset.stocks.filter((stock) =>
      stock.dataQuality?.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale"),
    ).length;
    const missingFields = dataset.stocks.reduce((sum, stock) => sum + (stock.missingFields?.length ?? 0), 0);
    const pctValues = dataset.stocks
      .map((stock) => stock.quote?.pctChange)
      .filter((value): value is number => typeof value === "number");
    const averagePct = pctValues.length ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length : null;
    const recentlyUpdated = dataset.stocks.filter((stock) => stock.isRecentlyUpdated).length;
    const highRisk = dataset.stocks.filter((stock) => stock.riskLevel === "高").length;
    const segments = dataset.industries.reduce((sum, industry) => sum + industry.segments.length, 0);
    const focusStocks = [...dataset.stocks]
      .sort((a, b) => Math.abs(b.quote?.pctChange ?? 0) - Math.abs(a.quote?.pctChange ?? 0))
      .slice(0, 4);
    const missingStocks = dataset.stocks.filter((stock) => (stock.missingFields?.length ?? 0) > 0).slice(0, 6);
    const quoteCoverageReal = quoteCoverage?.real ?? stocksWithReal;
    const quoteCoverageTotal = quoteCoverage?.total ?? dataset.stocks.filter((stock) => stock.market === "A股").length;
    const hkCoverageSummary =
      hkQuoteCoverage
        ? `港股行情 ${hkQuoteCoverage.real}/${hkQuoteCoverage.total}`
        : hkQuoteTotal === undefined
          ? "港股暂未接入"
          : `港股 ${hkRealCount}/${hkQuoteTotal} 暂未接入`;
    const sevenDayCutoff = new Date();
    sevenDayCutoff.setDate(sevenDayCutoff.getDate() - 6);
    const cutoff = `${sevenDayCutoff.getFullYear()}-${String(sevenDayCutoff.getMonth() + 1).padStart(2, "0")}-${String(sevenDayCutoff.getDate()).padStart(2, "0")}`;
    const recentEvents = researchSnapshot.events.filter((event) => event.eventType !== "data_warning" && (event.eventDate ?? event.publishedAt?.slice(0, 10) ?? event.updatedAt?.slice(0, 10) ?? "") >= cutoff).length;
    const pendingReviewCompanies = new Set(researchSnapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
    const verificationChains = researchSnapshot.chains.length;
    const dataReviewItems = researchSnapshot.events.filter((event) => event.eventType === "data_warning" || event.reviewStatus === "pending").length;

    return {
      stocksWithReal,
      missingFields,
      averagePct,
      recentlyUpdated,
      highRisk,
      segments,
      focusStocks,
      missingStocks,
      quoteCoverageReal,
      quoteCoverageTotal,
      hkCoverageSummary,
      recentEvents,
      pendingReviewCompanies,
      verificationChains,
      dataReviewItems,
    };
  }, [dataset, researchSnapshot]);

  return (
    <div className="terminal-grid min-h-screen bg-bg text-text">
      <Header
        search={globalSearch}
        onSearchChange={setGlobalSearch}
        updatedAt={dataset.dataUpdatedAt}
        sourceNote={dataMode === "mock" ? dataSourceNote : dataset.dataSourceNote}
        dataMode={dataMode}
        modeLabel={dataset.modeLabel}
        coverageSummary={dataset.coverageSummary}
        onDataModeChange={setDataMode}
      />

      <DashboardLayout
        sidebar={<Sidebar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />}
        main={
          <section className="min-w-0 space-y-4">
          <DashboardCard className="overflow-hidden p-5">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
              <SectionHeader
                eyebrow="Research Command Center"
                title="事件验证、风险核验与核心资产跟踪"
                description="优先展示真实公告和财务数据触发的投研动作；数据健康与缺失覆盖保留为底层证据状态。"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">行业 / 细分</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">
                    {dataset.industries.length} / {dashboardStats.segments}
                  </p>
                </div>
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">个股池</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">{dataset.stocks.length}</p>
                </div>
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">观察项</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">{dataset.watchlist.length}</p>
                </div>
              </div>
            </div>
          </DashboardCard>

          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              label="最近事件"
              value={dashboardStats.recentEvents}
              delta="最近 7 天"
              description="真实公告与财务更新时间触发"
              tone="info"
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <KpiCard
              label="待复盘"
              value={dashboardStats.pendingReviewCompanies}
              delta="公司数量"
              description="存在新事件、部分解析或数据缺口"
              tone={dashboardStats.pendingReviewCompanies ? "warning" : "positive"}
              icon={<CheckSquare className="h-4 w-4" />}
            />
            <KpiCard
              label="业绩验证"
              value={dashboardStats.verificationChains}
              delta="公司 / 报告期链"
              description="预告、修正、快报与正式报告关联"
              tone="positive"
              icon={<FileCheck2 className="h-4 w-4" />}
            />
            <KpiCard
              label="数据核验"
              value={dashboardStats.dataReviewItems}
              delta="待人工核验"
              description="保留部分解析、过期、缺失和错误状态"
              tone={dashboardStats.dataReviewItems ? "warning" : "positive"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </section>

          <DashboardCard className="p-3">
            <div className="grid gap-2 text-xs text-textMuted sm:grid-cols-2 xl:grid-cols-4" aria-label="数据健康信息">
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">真实行情覆盖：<strong className="text-textStrong">{dashboardStats.quoteCoverageReal}/{dashboardStats.quoteCoverageTotal}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">平均涨跌幅：<strong className="text-textStrong">{formatPercent(dashboardStats.averagePct)}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">缺失字段：<strong className="text-warning">{dashboardStats.missingFields}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">最近更新样本：<strong className="text-textStrong">{dashboardStats.recentlyUpdated}</strong> · {dashboardStats.hkCoverageSummary}</span>
            </div>
          </DashboardCard>

          {activeTab === "宏观" && <MacroTab indicators={macroIndicators} />}
          {activeTab === "行业" && (
            <IndustryTab
              industries={dataset.industries}
              stocks={dataset.stocks}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "个股池" && (
            <StockPool
              stocks={dataset.stocks}
              industries={dataset.industries}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "观察清单" && (
            <WatchlistTab
              watchlist={dataset.watchlist}
              stocks={dataset.stocks}
              industries={dataset.industries}
              events={researchSnapshot.events}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "验证中心" && (
            <ResearchEventCenter
              snapshot={researchSnapshot}
              stocks={dataset.stocks}
              industries={dataset.industries}
              onOpenStock={setSelectedStock}
            />
          )}
        </section>
        }
        rightRail={
          <RightRail
            mode={dataset.mode}
            modeLabel={dataset.modeLabel}
            coverageSummary={dataset.coverageSummary}
            highRisk={dashboardStats.highRisk}
            missingFields={dashboardStats.missingFields}
            focusStocks={dashboardStats.focusStocks}
            missingStocks={dashboardStats.missingStocks}
            onOpenStock={setSelectedStock}
          />
        }
      />

      <StockDetailDrawer
        stock={activeSelectedStock}
        stocks={dataset.stocks}
        industries={dataset.industries}
        onClose={() => setSelectedStock(null)}
        onOpenStock={setSelectedStock}
      />
    </div>
  );
}
