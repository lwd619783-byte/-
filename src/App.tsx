import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Binoculars, Building2, Database, LineChart, RefreshCw, type LucideIcon } from "lucide-react";
import { Header } from "./components/layout/Header";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RightRail } from "./components/layout/RightRail";
import { Sidebar } from "./components/layout/Sidebar";
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { buildDashboardDataset } from "./services/dataProvider";
import type { DashboardDataMode, Stock } from "./types";
import { DashboardCard, KpiCard, SectionHeader } from "./components/common/terminal";
import { formatPercent } from "./utils/normalize";

type MainTab = "宏观" | "行业" | "个股池" | "观察清单";

const tabs: Array<{ id: MainTab; icon: LucideIcon }> = [
  { id: "宏观", icon: LineChart },
  { id: "行业", icon: Building2 },
  { id: "个股池", icon: BarChart3 },
  { id: "观察清单", icon: Binoculars },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("行业");
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [dataMode, setDataMode] = useState<DashboardDataMode>("mixed");
  const dataset = useMemo(() => buildDashboardDataset(dataMode), [dataMode]);
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
    };
  }, [dataset]);

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
                title="市场覆盖、风险核验与核心资产跟踪"
                description="整合 mock 研究框架和本地生成真实行情数据，优先展示覆盖质量、行情变化、缺失风险和待跟踪资产。"
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
              label="真实行情覆盖"
              value={`${dashboardStats.quoteCoverageReal}/${dashboardStats.quoteCoverageTotal}`}
              delta={dashboardStats.quoteCoverageReal === dashboardStats.quoteCoverageTotal ? "A股全量覆盖" : "A股部分覆盖"}
              description={`A 股真实行情覆盖；${dashboardStats.hkCoverageSummary}`}
              tone={dashboardStats.quoteCoverageReal === dashboardStats.quoteCoverageTotal ? "positive" : "info"}
              icon={<Database className="h-4 w-4" />}
            />
            <KpiCard
              label="平均涨跌幅"
              value={formatPercent(dashboardStats.averagePct)}
              delta={dashboardStats.averagePct === null ? "待接入" : dashboardStats.averagePct >= 0 ? "上行" : "下行"}
              description="基于已获取最新行情的个股均值"
              tone={dashboardStats.averagePct === null ? "neutral" : dashboardStats.averagePct >= 0 ? "positive" : "negative"}
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="缺失字段"
              value={dashboardStats.missingFields}
              delta={dashboardStats.missingFields > 0 ? "需核验" : "完整"}
              description="所有股票待补字段总数"
              tone={dashboardStats.missingFields > 0 ? "warning" : "positive"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <KpiCard
              label="最近更新"
              value={dashboardStats.recentlyUpdated}
              delta="近端数据"
              description="标记为最近更新的样本数量"
              tone="info"
              icon={<RefreshCw className="h-4 w-4" />}
            />
          </section>

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
