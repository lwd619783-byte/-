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
    <div className="min-h-screen bg-panel">
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

      <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-8">
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-white p-4 shadow-soft">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{stat.value}</p>
            </div>
          ))}
        </section>

        <nav className="mb-4 flex gap-2 overflow-x-auto rounded-lg border border-line bg-white p-2 shadow-soft">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium transition ${
                  activeTab === tab.id ? "bg-ink text-white" : "text-slate-600 hover:bg-panel hover:text-ink"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                {tab.id}
              </button>
            );
          })}
        </nav>

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
      </main>

      <StockDetailDrawer stock={selectedStock} industries={dataset.industries} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
