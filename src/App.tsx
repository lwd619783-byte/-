import { useMemo, useState } from "react";
import { BarChart3, Binoculars, Building2, LineChart, type LucideIcon } from "lucide-react";
import { Header } from "./components/layout/Header";
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { buildDashboardDataset } from "./services/dataProvider";
import type { DashboardDataMode, Stock } from "./types";
import { GlassCard, StatusBadge, TabButton } from "./components/common/terminal";

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

  const dashboardStats = useMemo(
    () => [
      { label: "行业", value: dataset.industries.length },
      { label: "细分板块", value: dataset.industries.reduce((sum, industry) => sum + industry.segments.length, 0) },
      { label: "个股", value: dataset.stocks.length },
      { label: "观察项", value: dataset.watchlist.length },
    ],
    [dataset],
  );

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

      <main className="mx-auto grid max-w-[1760px] gap-4 px-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)_280px] lg:px-8">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <GlassCard className="p-2">
            <nav className="grid gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="h-11 justify-start">
                    <Icon className="h-4 w-4" />
                    {tab.id}
                  </TabButton>
                );
              })}
            </nav>
          </GlassCard>
        </aside>

        <section className="min-w-0">
          <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((stat) => (
              <GlassCard key={stat.label} className="p-4">
                <p className="text-xs font-medium text-textMuted">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-textStrong">{stat.value}</p>
              </GlassCard>
            ))}
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
          <GlassCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Data Console</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={dataset.mode === "mock" ? "mock" : dataset.modeLabel === "Real Data" ? "real" : "stale"} />
              <StatusBadge status="unsupported_market" />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-textMuted" title={dataset.coverageSummary}>{dataset.coverageSummary}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Missing Watch</p>
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
          </GlassCard>
        </aside>
      </main>

      <StockDetailDrawer stock={selectedStock} industries={dataset.industries} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
