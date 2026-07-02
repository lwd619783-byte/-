import { useMemo, useState } from "react";
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
import {
  DataTable,
  EmptyState,
  FilterBar,
  FilterInput,
  FilterSelect,
  MobileCardList,
  OverflowTooltip,
  PriceChange,
  SectionHeader,
  TabButton,
  TextClamp,
} from "../common/terminal";

interface StockPoolProps {
  stocks: Stock[];
  industries: Industry[];
  globalSearch: string;
  onOpenStock: (stock: Stock) => void;
}

type QualityFilter = "全部" | "真实数据" | "缺失项" | "暂不支持" | "最近更新";
type SortMode = "默认" | "覆盖率高到低" | "覆盖率低到高" | "涨跌幅" | "市值" | "PE";

export function StockPool({ stocks, industries, globalSearch, onOpenStock }: StockPoolProps) {
  const [filters, setFilters] = useState<StockFilters>({ ...defaultStockFilters, search: globalSearch });
  const [view, setView] = useState<"table" | "cards">("table");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("全部");
  const [sortMode, setSortMode] = useState<SortMode>("默认");

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
    if (sortMode === "覆盖率高到低") return [...filtered].sort((a, b) => (b.dataCoverage ?? -1) - (a.dataCoverage ?? -1));
    if (sortMode === "覆盖率低到高") return [...filtered].sort((a, b) => (a.dataCoverage ?? 101) - (b.dataCoverage ?? 101));
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
      <FilterBar
        action={
          <div className="flex shrink-0 rounded-md border border-borderSoft bg-bg2 p-1">
            <TabButton active={view === "table"} onClick={() => setView("table")}>
              <Table2 className="h-4 w-4" />
              表格
            </TabButton>
            <TabButton active={view === "cards"} onClick={() => setView("cards")}>
              <LayoutGrid className="h-4 w-4" />
              卡片
            </TabButton>
          </div>
        }
      >
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
        <FilterSelect label="风险等级" value={filters.riskLevel} onChange={(value) => updateFilter("riskLevel", value as "全部" | RiskLevel)}>
          {["全部", "低", "中", "高"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="数据质量" value={qualityFilter} onChange={(value) => setQualityFilter(value as QualityFilter)}>
          {["全部", "真实数据", "缺失项", "暂不支持", "最近更新"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="排序" value={sortMode} onChange={(value) => setSortMode(value as SortMode)}>
          {["默认", "覆盖率高到低", "覆盖率低到高", "涨跌幅", "市值", "PE"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {visibleStocks.length === 0 ? (
        <EmptyState title="没有匹配个股" description="请调整搜索词、行业或数据质量筛选条件。" />
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} />
          ))}
        </div>
      ) : (
        <>
          <div className="lg:hidden">
            <SectionHeader title="筛选结果" description={`当前显示 ${visibleStocks.length} 只股票。移动端优先使用卡片阅读。`} />
            <MobileCardList className="mt-3">
              {visibleStocks.map((stock) => (
                <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} />
              ))}
            </MobileCardList>
          </div>
          <DataTable className="hidden lg:block" minWidth="1180px">
            <thead className="sticky top-0 bg-bg2 text-xs text-textMuted">
              <tr>
                {["股票", "代码", "市场", "行业", "细分板块", "最新价", "涨跌幅", "市值", "PE", "覆盖率", "缺失", "风险", "核心看点"].map((header) => (
                  <th key={header} className={`px-3 py-3 font-medium ${["最新价", "涨跌幅", "市值", "PE", "覆盖率", "缺失"].includes(header) ? "text-right" : ""}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStocks.map((stock) => (
                <tr key={stock.id} className="h-16 border-t border-borderSoft transition hover:bg-cyan/5">
                  <td className="px-3 py-3">
                    <button className="max-w-full truncate font-medium text-cyan hover:underline" onClick={() => onOpenStock(stock)} title={stock.name}>
                      {stock.name}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-textMuted">{stock.code}</td>
                  <td className="px-3 py-3 text-textMuted">{stock.market}</td>
                  <td className="px-3 py-3">
                    <OverflowTooltip title={getIndustryName(industries, stock.industryId)}>
                      {getIndustryName(industries, stock.industryId)}
                    </OverflowTooltip>
                  </td>
                  <td className="px-3 py-3">
                    <OverflowTooltip title={getSegmentName(industries, stock.segmentId)}>
                      {getSegmentName(industries, stock.segmentId)}
                    </OverflowTooltip>
                  </td>
                  <DataValue value={stock.quote?.latestPrice} numeric />
                  <td className="px-3 py-3 text-right">
                    <PriceChange value={stock.quote?.pctChange} />
                  </td>
                  <DataValue value={stock.financial.marketCap} numeric />
                  <DataValue value={stock.valuation.pe} numeric />
                  <DataValue value={typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"} numeric />
                  <td className="px-3 py-3 text-right">
                    <span className={`rounded border px-2 py-1 text-xs ${(stock.missingFields?.length ?? 0) > 0 ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>
                      {stock.missingFields?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-textMuted">{stock.riskLevel}</td>
                  <td className="px-3 py-3">
                    <TextClamp lines={2} title={stock.thesis} className="max-w-[260px] text-textMuted">
                      {stock.thesis}
                    </TextClamp>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </section>
  );
}

function DataValue({ value, numeric = false }: { value: string | number | null | undefined; numeric?: boolean }) {
  const missing = value === null || value === undefined || String(value).includes("数据暂缺");
  return (
    <td className={`px-3 py-3 ${numeric ? "text-right tabular-nums" : ""}`}>
      {missing ? (
        <span className="inline-flex rounded border border-borderSoft bg-surface/70 px-2 py-0.5 text-xs text-textWeak" title="数据源暂未覆盖">
          —
        </span>
      ) : (
        <span className="whitespace-nowrap text-text">{value}</span>
      )}
    </td>
  );
}
