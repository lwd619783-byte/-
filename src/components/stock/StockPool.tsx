import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import type { Industry, Market, RiskLevel, Stock } from "../../types";
import {
  defaultStockFilters,
  filterStocks,
  getIndustryName,
  getSegmentName,
  getSegmentsByIndustry,
  type StockFilters,
} from "../../utils/filters";
import { StockCard } from "./StockCard";
import { GlassCard, PriceChange } from "../common/terminal";

interface StockPoolProps {
  stocks: Stock[];
  industries: Industry[];
  globalSearch: string;
  onOpenStock: (stock: Stock) => void;
}

export function StockPool({ stocks, industries, globalSearch, onOpenStock }: StockPoolProps) {
  const [filters, setFilters] = useState<StockFilters>({ ...defaultStockFilters, search: globalSearch });
  const [view, setView] = useState<"table" | "cards">("table");
  const [qualityFilter, setQualityFilter] = useState<"全部" | "真实数据" | "缺失项" | "暂不支持" | "最近更新">("全部");
  const [sortMode, setSortMode] = useState<"默认" | "覆盖率高到低" | "覆盖率低到高" | "涨跌幅" | "市值" | "PE">("默认");

  const mergedFilters = { ...filters, search: [globalSearch, filters.search].filter(Boolean).join(" ") };
  const visibleStocks = useMemo(() => {
    const basic = filterStocks(stocks, mergedFilters, industries);
    const filtered = basic.filter((stock) => {
      if (qualityFilter === "真实数据") return stock.dataQuality?.some((item) => item.status === "real" || item.status === "stale");
      if (qualityFilter === "缺失项") return (stock.missingFields?.length ?? 0) > 0;
      if (qualityFilter === "暂不支持") return stock.dataQuality?.some((item) => item.status === "unsupported_market");
      if (qualityFilter === "最近更新") return Boolean(stock.isRecentlyUpdated);
      return true;
    });
    if (sortMode === "覆盖率高到低") {
      return [...filtered].sort((a, b) => (b.dataCoverage ?? -1) - (a.dataCoverage ?? -1));
    }
    if (sortMode === "覆盖率低到高") {
      return [...filtered].sort((a, b) => (a.dataCoverage ?? 101) - (b.dataCoverage ?? 101));
    }
    if (sortMode === "涨跌幅") return [...filtered].sort((a, b) => (b.quote?.pctChange ?? -Infinity) - (a.quote?.pctChange ?? -Infinity));
    if (sortMode === "市值") return [...filtered].sort((a, b) => (b.quote?.marketCap ?? -Infinity) - (a.quote?.marketCap ?? -Infinity));
    if (sortMode === "PE") return [...filtered].sort((a, b) => (a.quote?.peTtm ?? a.quote?.pe ?? Infinity) - (b.quote?.peTtm ?? b.quote?.pe ?? Infinity));
    return filtered;
  }, [stocks, mergedFilters, industries, qualityFilter, sortMode]);
  const segmentOptions = getSegmentsByIndustry(industries, filters.industryId);

  function updateFilter<T extends keyof StockFilters>(key: T, value: StockFilters[T]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "industryId" ? { segmentId: "全部" } : {}),
    }));
  }

  return (
    <section className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <FilterInput label="池内搜索" value={filters.search} onChange={(value) => updateFilter("search", value)} />
            <FilterSelect label="行业" value={filters.industryId} onChange={(value) => updateFilter("industryId", value)}>
              <option value="全部">全部</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="细分板块" value={filters.segmentId} onChange={(value) => updateFilter("segmentId", value)}>
              <option value="全部">全部</option>
              {segmentOptions.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="市场" value={filters.market} onChange={(value) => updateFilter("market", value as "全部" | Market)}>
              {["全部", "A股", "港股", "美股"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="风险等级"
              value={filters.riskLevel}
              onChange={(value) => updateFilter("riskLevel", value as "全部" | RiskLevel)}
            >
              {["全部", "低", "中", "高"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="数据质量" value={qualityFilter} onChange={(value) => setQualityFilter(value as typeof qualityFilter)}>
              {["全部", "真实数据", "缺失项", "暂不支持", "最近更新"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="排序" value={sortMode} onChange={(value) => setSortMode(value as typeof sortMode)}>
              {["默认", "覆盖率高到低", "覆盖率低到高", "涨跌幅", "市值", "PE"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
          </div>
          <div className="flex rounded-md border border-line bg-bg2 p-1">
            <button
              className={`inline-flex h-9 items-center gap-1 rounded px-3 text-sm ${view === "table" ? "bg-signal/15 text-signal shadow-sm" : "text-steel"}`}
              onClick={() => setView("table")}
            >
              <Table2 className="h-4 w-4" />
              表格
            </button>
            <button
              className={`inline-flex h-9 items-center gap-1 rounded px-3 text-sm ${view === "cards" ? "bg-signal/15 text-signal shadow-sm" : "text-steel"}`}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
              卡片
            </button>
          </div>
        </div>
      </GlassCard>

      {visibleStocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-panel/70 p-10 text-center">
          <p className="font-medium text-ink">没有匹配个股</p>
          <p className="mt-1 text-sm text-slate-500">请调整搜索词或筛选条件。</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-card shadow-soft">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-bg2 text-xs text-steel">
              <tr>
                {["股票", "代码", "市场", "行业", "细分板块", "最新价", "涨跌幅", "市值", "PE", "覆盖率", "缺失", "风险", "核心看点"].map((header) => (
                  <th key={header} className="px-3 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStocks.map((stock) => (
                <tr key={stock.id} className="border-t border-line hover:bg-signal/5">
                  <td className="px-3 py-3">
                    <button className="font-medium text-signal hover:underline" onClick={() => onOpenStock(stock)}>
                      {stock.name}
                    </button>
                  </td>
                  <td className="px-3 py-3">{stock.code}</td>
                  <td className="px-3 py-3">{stock.market}</td>
                  <td className="px-3 py-3">{getIndustryName(industries, stock.industryId)}</td>
                  <td className="px-3 py-3">{getSegmentName(industries, stock.segmentId)}</td>
                  <td className="px-3 py-3 text-right">{stock.quote?.latestPrice ?? "数据暂缺"}</td>
                  <td className="px-3 py-3 text-right"><PriceChange value={stock.quote?.pctChange} /></td>
                  <td className="px-3 py-3 text-right">{stock.financial.marketCap}</td>
                  <td className="px-3 py-3 text-right">{stock.valuation.pe}</td>
                  <td className="px-3 py-3 text-right">{typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"}</td>
                  <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs ${(stock.missingFields?.length ?? 0) > 0 ? "border-warning/40 bg-warning/10 text-warning" : "border-signal/30 bg-signal/10 text-signal"}`}>{stock.missingFields?.length ?? 0}</span></td>
                  <td className="px-3 py-3">{stock.riskLevel}</td>
                  <td className="px-3 py-3">{stock.thesis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-line bg-panel/80 px-3 text-sm text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="名称 / 代码"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-md border border-line bg-panel/80 px-3 text-sm text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
