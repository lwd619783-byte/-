import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Binoculars, Building2, Database, LineChart, RefreshCw, type LucideIcon } from "lucide-react";
import { Header } from "./components/layout/Header";
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { buildDashboardDataset } from "./services/dataProvider";
import type { DashboardDataMode, Stock } from "./types";
import { DashboardCard, KpiCard, SectionHeader, StatusBadge, TabButton } from "./components/common/terminal";
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

  const dashboardStats = useMemo(() => {
    const stocksWithReal = dataset.stocks.filter((stock) =>
      stock.dataQuality?.some((item) => item.status === "real" || item.status === "stale"),
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

    return { stocksWithReal, missingFields, averagePct, recentlyUpdated, highRisk, segments, focusStocks };
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

      <main className="mx-auto grid max-w-[1760px] gap-4 px-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:px-8">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <DashboardCard className="p-2">
            <nav className="scrollbar-thin flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="h-11 shrink-0 justify-start">
                    <Icon className="h-4 w-4" />
                    {tab.id}
                  </TabButton>
                );
              })}
            </nav>
          </DashboardCard>
        </aside>

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
              value={`${dashboardStats.stocksWithReal}/${dataset.stocks.length}`}
              delta={dashboardStats.stocksWithReal === dataset.stocks.length ? "全量覆盖" : "混合数据"}
              description="A 股优先真实数据，缺失项保留标记"
              tone={dashboardStats.stocksWithReal === dataset.stocks.length ? "positive" : "info"}
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

        <aside className="space-y-3 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <DashboardCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Data Console</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={dataset.mode === "mock" ? "mock" : dataset.modeLabel === "Real Data" ? "real" : "stale"} />
              <StatusBadge status="unsupported_market" />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-textMuted" title={dataset.coverageSummary}>{dataset.coverageSummary}</p>
          </DashboardCard>
          <DashboardCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Risk Radar</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                <p className="text-xs text-textMuted">高风险</p>
                <p className="mt-1 text-lg font-semibold text-warning tabular-nums">{dashboardStats.highRisk}</p>
              </div>
              <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                <p className="text-xs text-textMuted">缺失字段</p>
                <p className="mt-1 text-lg font-semibold text-warning tabular-nums">{dashboardStats.missingFields}</p>
              </div>
            </div>
          </DashboardCard>
          <DashboardCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Focus Assets</p>
            <div className="mt-3 space-y-2 text-sm">
              {dashboardStats.focusStocks.map((stock) => (
                <button
                  key={stock.id}
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-borderSoft bg-bg2/60 px-3 py-2 text-left transition hover:border-borderGlow hover:bg-cardHover"
                  onClick={() => setSelectedStock(stock)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-textStrong" title={stock.name}>{stock.name}</span>
                    <span className="block truncate text-xs text-textMuted">{stock.market} · {stock.code}</span>
                  </span>
                  <span className={(stock.quote?.pctChange ?? 0) >= 0 ? "text-success" : "text-danger"}>{formatPercent(stock.quote?.pctChange)}</span>
                </button>
              ))}
            </div>
          </DashboardCard>
          <DashboardCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Missing Watch</p>
            <div className="mt-3 space-y-2 text-sm text-textMuted">
              {dataset.stocks
                .filter((stock) => (stock.missingFields?.length ?? 0) > 0)
                .slice(0, 6)
                .map((stock) => (
                  <div key={stock.id} className="flex items-center justify-between gap-3 border-b border-borderSoft/70 pb-2">
                    <span className="truncate" title={stock.name}>{stock.name}</span>
                    <span className="text-warning">{stock.missingFields?.length ?? 0}</span>
                  </div>
                ))}
            </div>
          </DashboardCard>
        </aside>
      </main>

      <StockDetailDrawer stock={selectedStock} industries={dataset.industries} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
