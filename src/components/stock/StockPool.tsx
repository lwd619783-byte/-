import { isRecentlyUpdated } from "../../utils/dataQuality";
import { formatStockFieldCoverage, formatStockModuleCoverage } from "../../utils/stockCoverage";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import { QuoteTrust } from "../common/QuoteTrust";
import { useId, useMemo, useState } from "react";
import { LayoutGrid, SlidersHorizontal, Table2 } from "lucide-react";
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
  PriceChange,
  SectionHeader,
  TabButton,
} from "../common/terminal";

interface StockPoolProps {
  stocks: Stock[];
  industries: Industry[];
  globalSearch: string;
  onOpenStock: (stock: Stock) => void;
  onOpenResearch?: (stock: Stock) => void;
}

type QualityFilter = "全部" | "行情状态为真实" | "缺失项" | "暂不支持" | "行情采集24小时内";
type SortMode = "默认" | "覆盖率高到低" | "覆盖率低到高" | "涨跌幅" | "市值" | "PE";

export function StockPool({ stocks, industries, globalSearch, onOpenStock, onOpenResearch }: StockPoolProps) {
  const displayNow = useDisplayNow();
  const [filters, setFilters] = useState<StockFilters>({ ...defaultStockFilters });
  const [view, setView] = useState<"table" | "cards">("table");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("全部");
  const [sortMode, setSortMode] = useState<SortMode>("默认");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFiltersId = useId();
  const moreFiltersId = useId();
  const moreFilterCount = Number(Boolean(filters.search.trim())) + Number(filters.riskLevel !== "全部");
  const activeFilterCount = moreFilterCount + Number(filters.industryId !== "全部") + Number(filters.segmentId !== "全部") + Number(filters.market !== "全部") + Number(qualityFilter !== "全部");

  const mergedFilters = { ...filters, search: [globalSearch, filters.search].filter(Boolean).join(" ") };
  const visibleStocks = useMemo(() => {
    const basic = filterStocks(stocks, mergedFilters, industries);
    const filtered = basic.filter((stock) => {
      if (qualityFilter === "行情状态为真实") return stock.quote?.quality?.status === "real";
      if (qualityFilter === "缺失项") return (stock.missingFields?.length ?? 0) > 0;
      if (qualityFilter === "暂不支持") return stock.dataQuality?.some((item) => item.status === "unsupported_market");
      if (qualityFilter === "行情采集24小时内") return isRecentlyUpdated(stock.quote?.updatedAt, displayNow);
      return true;
    });
    if (sortMode === "覆盖率高到低") return [...filtered].sort((a, b) => (b.dataCoverage ?? -1) - (a.dataCoverage ?? -1));
    if (sortMode === "覆盖率低到高") return [...filtered].sort((a, b) => (a.dataCoverage ?? 101) - (b.dataCoverage ?? 101));
    if (sortMode === "涨跌幅") return [...filtered].sort((a, b) => (b.quote?.pctChange ?? -Infinity) - (a.quote?.pctChange ?? -Infinity));
    if (sortMode === "市值") return [...filtered].sort((a, b) => (b.quote?.marketCap ?? -Infinity) - (a.quote?.marketCap ?? -Infinity));
    if (sortMode === "PE") return [...filtered].sort((a, b) => (a.quote?.peTtm ?? a.quote?.pe ?? Infinity) - (b.quote?.peTtm ?? b.quote?.pe ?? Infinity));
    return filtered;
  }, [stocks, mergedFilters, industries, qualityFilter, sortMode, displayNow]);

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
      <SectionHeader className="page-heading" title="个股研究池" description={`当前显示 ${visibleStocks.length} / ${stocks.length} 家研究池公司；数量仅表示池内范围。价格与采集时点按现有来源展示。`} />
      <div className="flex flex-wrap gap-2 sm:hidden">
        <button type="button" className="min-h-11 flex-1 rounded-md border border-control bg-panel px-3 text-left text-sm" aria-expanded={mobileFiltersOpen} aria-controls={mobileFiltersId} onClick={() => setMobileFiltersOpen((value) => !value)}>
          筛选与排序 · {activeFilterCount} 项条件 · {sortMode}{mobileFiltersOpen ? " · 收起" : " · 展开"}
        </button>
        {activeFilterCount || sortMode !== "默认" ? <button type="button" className="min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={() => { setFilters({ ...defaultStockFilters }); setQualityFilter("全部"); setSortMode("默认"); }}>清除池内条件</button> : null}
      </div>
      <div id={mobileFiltersId} className={mobileFiltersOpen ? "space-y-3" : "hidden space-y-3 sm:block"}>
      <FilterBar
        className="[&>div]:xl:flex-col [&>div]:xl:items-stretch [&>div>div:first-child]:xl:grid-cols-5"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-expanded={showMoreFilters} aria-controls={moreFiltersId}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control bg-panel2 px-3 text-sm text-text sm:min-h-10"
              onClick={() => setShowMoreFilters((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" />更多筛选{moreFilterCount ? `（${moreFilterCount}）` : ""}
            </button>
            {moreFilterCount ? <button type="button" className="min-h-11 rounded-md border border-control px-3 text-sm text-accent sm:min-h-10"
              onClick={() => setFilters((current) => ({ ...current, search: "", riskLevel: "全部" }))}>清除更多筛选</button> : null}
          <div className="flex rounded-md border border-borderSoft bg-bg2 p-1" aria-label="研究池展示方式">
            <TabButton active={view === "table"} onClick={() => setView("table")}>
              <Table2 className="h-4 w-4" />
              表格
            </TabButton>
            <TabButton active={view === "cards"} onClick={() => setView("cards")}>
              <LayoutGrid className="h-4 w-4" />
              卡片
            </TabButton>
          </div>
          </div>
        }
      >
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
        <FilterSelect label="数据质量" value={qualityFilter} onChange={(value) => setQualityFilter(value as QualityFilter)}>
          {["全部", "行情状态为真实", "缺失项", "暂不支持", "行情采集24小时内"].map((item) => (
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
      <div id={moreFiltersId} hidden={!showMoreFilters} className="rounded-lg border border-borderSoft bg-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterInput label="池内搜索" value={filters.search} onChange={(value) => updateFilter("search", value)} />
          <FilterSelect label="风险等级" value={filters.riskLevel} onChange={(value) => updateFilter("riskLevel", value as "全部" | RiskLevel)}>
            {["全部", "低", "中", "高"].map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
        </div>
      </div>
      </div>
      {globalSearch ? <p className="text-xs text-textMuted">当前研究池顶栏搜索：{globalSearch}；此条件在顶栏修改。</p> : null}

      {visibleStocks.length === 0 ? (
        <EmptyState title={stocks.length ? "没有匹配个股" : "研究池暂无公司"} description={stocks.length ? "请调整搜索词、行业或数据质量筛选条件；清除筛选不会删除研究记录。" : "当前数据集尚未提供可展示的研究对象。"} />
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} onOpenResearch={onOpenResearch} />
          ))}
        </div>
      ) : (
        <>
          <div className="lg:hidden">
            <SectionHeader title="筛选结果" description={`当前显示 ${visibleStocks.length} 只股票。移动端优先使用卡片阅读。`} />
            <MobileCardList className="mt-3">
              {visibleStocks.map((stock) => (
                <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} onOpenResearch={onOpenResearch} />
              ))}
            </MobileCardList>
          </div>
          <DataTable className="hidden lg:block" minWidth="1040px">
            <thead className="sticky top-0 bg-bg2 text-xs text-textMuted">
              <tr>
                {["公司 / 代码", "市场", "快照价格", "涨跌幅", "PE（原始估值口径）", "来源、质量与时效", "风险", "操作 / 原始字段"].map((header) => (
                  <th key={header} className={`px-3 py-3 font-medium ${["快照价格", "涨跌幅", "PE（原始估值口径）"].includes(header) ? "text-right" : ""}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStocks.map((stock) => (
                <tr key={stock.id} className="h-16 border-t border-borderSoft transition hover:bg-cyan/5">
                  <td className="px-3 py-3">
                    <button type="button" data-stock-id={stock.id} className="min-h-11 max-w-full break-words text-left font-medium text-accent hover:underline" onClick={() => onOpenStock(stock)} title={stock.name}>
                      {stock.name}
                    </button>
                    <p className="text-xs text-textMuted">{stock.code}</p>
                  </td>
                  <td className="px-3 py-3 text-textMuted">{stock.market}</td>
                  <DataValue value={stock.quote?.latestPrice} numeric note="币种：源字段未提供" />
                  <td className="px-3 py-3 text-right">
                    <PriceChange value={stock.quote?.pctChange} />
                  </td>
                  <DataValue value={stock.valuation.pe} numeric />
                  <td className="px-3 py-3 text-right">
                    <QuoteTrust quote={stock.quote} now={displayNow} />
                  </td>
                  <td className="px-3 py-3 text-textMuted">{stock.riskLevel}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" data-stock-id={stock.id} aria-label={`快速预览 ${stock.name}`} onClick={() => onOpenStock(stock)} className="min-h-10 rounded-md border border-control px-3 text-xs text-accent">快速预览</button>
                      {onOpenResearch ? <button type="button" aria-label={`完整研究 ${stock.name}`} onClick={() => onOpenResearch(stock)} className="min-h-10 rounded-md border border-control px-3 text-xs text-text">完整研究</button> : null}
                    </div>
                    <details className="mt-2 max-w-[320px]">
                      <summary className="cursor-pointer py-2 text-xs text-accent">字段与研究摘要</summary>
                      <dl className="space-y-2 break-words text-xs leading-5 text-textMuted">
                        <div><dt>行业 / 细分板块</dt><dd>{getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}</dd></div>
                        <div><dt>市值（原始字段）</dt><dd>{stock.financial.marketCap}</dd></div>
                        <div><dt>行情 / 财务字段</dt><dd>{formatStockFieldCoverage(stock.dataCoverageDetails)}</dd><dd>{formatStockModuleCoverage(stock.dataCoverageDetails)}</dd></div>
                        <div><dt>缺失字段数</dt><dd className={(stock.missingFields?.length ?? 0) > 0 ? "text-warning" : "text-textMuted"}>{stock.missingFields?.length ?? 0}</dd></div>
                        <div><dt>核心看点</dt><dd>{stock.thesis || "资料暂缺"}</dd></div>
                      </dl>
                    </details>
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

function DataValue({ value, numeric = false, note }: { value: string | number | null | undefined; numeric?: boolean; note?: string }) {
  const missing = value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value)) || String(value).includes("数据暂缺");
  return (
    <td className={`px-3 py-3 ${numeric ? "text-right tabular-nums" : ""}`}>
      {missing ? (
        <span className="inline-flex rounded border border-borderSoft bg-surface/70 px-2 py-0.5 text-xs text-textWeak" title="数据源暂未覆盖">
          —
        </span>
      ) : (
        <span className="whitespace-nowrap text-text">{value}</span>
      )}
      {note ? <p className="mt-1 text-xs text-textMuted">{note}</p> : null}
    </td>
  );
}
