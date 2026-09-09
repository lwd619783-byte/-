import { useId, useState } from "react";
import { Factory, Layers3 } from "lucide-react";
import { roboticsPrivateCompanies } from "../../data/privateCompanies";
import type { Industry, Stock } from "../../types";
import { findStocksForSegment } from "../../utils/filters";
import { StockCard } from "../stock/StockCard";
import { DashboardCard, MetricCard, SectionHeader } from "../common/terminal";
import { RoboticsStockSection } from "./RoboticsStockSection";

interface IndustrySelection { industryId: string; segmentId: string }
interface IndustryTabProps {
  industries: Industry[];
  stocks: Stock[];
  globalSearch: string;
  onOpenStock: (stock: Stock) => void;
  initialIndustryId?: string;
  initialSegmentId?: string;
  onSelectionChange?: (selection: IndustrySelection) => void;
}

type IndustryView = "overview" | "compare" | "chain";
const industryViews: Array<{ id: IndustryView; label: string }> = [
  { id: "overview", label: "研究概览" }, { id: "compare", label: "细分比较" }, { id: "chain", label: "产业链" },
];
function defaultSegment(industry?: Industry) { return industry?.id === "robotics" ? "__all__" : industry?.segments[0]?.id ?? ""; }
function initialSelection(industries: Industry[], industryId?: string, segmentId?: string): IndustrySelection {
  const selectedId = industryId ?? industries[0]?.id ?? "";
  const industry = industries.find((item) => item.id === selectedId);
  return { industryId: selectedId, segmentId: segmentId ?? defaultSegment(industry) };
}

export function IndustryTab({ industries, stocks, globalSearch, onOpenStock, initialIndustryId, initialSegmentId, onSelectionChange }: IndustryTabProps) {
  const sourceKey = JSON.stringify([initialIndustryId, initialSegmentId]);
  const [storedSelection, setStoredSelection] = useState(() => ({ sourceKey, ...initialSelection(industries, initialIndustryId, initialSegmentId) }));
  const selection = storedSelection.sourceKey === sourceKey ? storedSelection : { sourceKey, ...initialSelection(industries, initialIndustryId, initialSegmentId) };
  if (storedSelection.sourceKey !== sourceKey) setStoredSelection(selection);
  const [activeView, setActiveView] = useState<IndustryView>("overview");
  const [compareView, setCompareView] = useState<"summary" | "table" | "companies">("summary");
  const [industrySearch, setIndustrySearch] = useState("");
  const panelId = useId();
  const activeIndustry = industries.find((industry) => industry.id === selection.industryId);
  const isRobotics = activeIndustry?.id === "robotics";
  const segment = activeIndustry?.segments.find((item) => item.id === selection.segmentId);
  const validSelection = activeIndustry && (segment || (isRobotics && selection.segmentId === "__all__") || (!activeIndustry.segments.length && !selection.segmentId));
  const matchedIndustries = industries.filter((industry) => industry.name.toLowerCase().includes(industrySearch.trim().toLowerCase()));

  function select(next: IndustrySelection) {
    const industry = industries.find((item) => item.id === next.industryId);
    if (!industry || !(industry.segments.some((item) => item.id === next.segmentId) || (industry.id === "robotics" && next.segmentId === "__all__") || (!industry.segments.length && !next.segmentId))) return;
    setStoredSelection({ sourceKey, ...next });
    onSelectionChange?.(next);
  }
  function switchIndustry(industry: Industry) { select({ industryId: industry.id, segmentId: defaultSegment(industry) }); }

  if (!industries.length) return <EmptyState title="暂无行业数据" description="当前数据集尚未提供行业与细分板块资料。" />;
  if (!validSelection || !activeIndustry) return <section className="space-y-4">
    <SectionHeader className="page-heading" title="找不到行业或细分板块" description="链接中的对象不在当前研究池中，请重新选择行业。" />
    <div className="flex flex-wrap gap-2">{industries.map((industry) => <button key={industry.id} type="button" className="min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={() => switchIndustry(industry)}>{industry.name}</button>)}</div>
  </section>;

  const industryStocks = stocks.filter((stock) => stock.industryId === activeIndustry.id);
  const segmentStocks = isRobotics && selection.segmentId === "__all__" ? industryStocks : segment ? findStocksForSegment(stocks, segment.id) : [];
  const keyword = globalSearch.trim().toLowerCase();
  const visibleSegmentStocks = keyword ? segmentStocks.filter((stock) =>
    [stock.name, stock.code, stock.thesis, segment?.name ?? "全部", activeIndustry.name, stock.themeTags?.join(" ") ?? ""].join(" ").toLowerCase().includes(keyword),
  ) : segmentStocks;
  const segmentOptions = isRobotics ? [{ id: "__all__", name: "全部" }, ...activeIndustry.segments] : activeIndustry.segments;

  return <section className="min-w-0 space-y-4">
    <SectionHeader className="page-heading" title="行业研究" description="按研究资料、细分比较与产业链组织；研究池公司数量不代表行业景气或全市场统计。" />
    <div className="grid min-w-0 gap-4 min-[1440px]:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="hidden min-w-0 self-start rounded-lg border border-borderSoft bg-card p-3 min-[1440px]:block" aria-label="行业选择">
        <label className="mb-3 block text-xs text-textMuted">搜索行业<input value={industrySearch} onChange={(event) => setIndustrySearch(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-control bg-panel2 px-2 text-sm text-text" /></label>
        <div className="grid gap-2">{matchedIndustries.map((industry) => <button key={industry.id} type="button" aria-pressed={industry.id === activeIndustry.id}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${industry.id === activeIndustry.id ? "border-accent bg-selected text-accent" : "border-control bg-panel text-text"}`}
          onClick={() => switchIndustry(industry)}><span className="block font-medium">{industry.name}</span><span className="mt-1 block text-xs text-textMuted">景气：{industry.prosperity} · {industry.stage}</span></button>)}</div>
        {!matchedIndustries.length ? <p className="text-xs text-textMuted">没有匹配行业</p> : null}
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 rounded-lg border border-borderSoft bg-panel p-3 sm:grid-cols-2 min-[1440px]:hidden">
          <label className="block text-xs text-textMuted">查找行业<input value={industrySearch} onChange={(event) => setIndustrySearch(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-control bg-panel2 px-3 text-sm text-text" /></label>
          <label className="block text-xs text-textMuted">选择行业<select value={activeIndustry.id} onChange={(event) => { const industry = industries.find((item) => item.id === event.target.value); if (industry) switchIndustry(industry); }} className="mt-1 h-11 w-full rounded-md border border-control bg-panel2 px-3 text-sm text-text">
            {!matchedIndustries.some((industry) => industry.id === activeIndustry.id) ? <option value={activeIndustry.id}>{activeIndustry.name}（当前）</option> : null}
            {matchedIndustries.map((industry) => <option value={industry.id} key={industry.id}>{industry.name}</option>)}
          </select></label>
          {!matchedIndustries.length ? <p className="text-xs text-textMuted">没有匹配行业；保留当前研究对象。</p> : null}
        </div>
        <div className="rounded-lg border border-borderSoft bg-panel p-4">
          <h2 className="break-words text-xl font-semibold text-textStrong">{activeIndustry.name}</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">行业资料来源与更新时间：当前字段未提供。景气、阶段、驱动和风险为既有研究资料，未换算为评分。</p>
          <div role="tablist" aria-label="行业研究视图" className="mt-3 flex flex-wrap gap-2">{industryViews.map((view, index) => <button key={view.id} id={`${panelId}-tab-${view.id}`} type="button" role="tab" aria-selected={activeView === view.id} aria-controls={`${panelId}-${view.id}`} tabIndex={activeView === view.id ? 0 : -1}
            className={`min-h-11 rounded-md border px-3 text-sm font-medium ${activeView === view.id ? "border-accent bg-selected text-accent" : "border-control text-textMuted"}`}
            onClick={() => setActiveView(view.id)} onKeyDown={(event) => { const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0; if (!direction && event.key !== "Home" && event.key !== "End") return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? industryViews.length - 1 : (index + direction + industryViews.length) % industryViews.length; setActiveView(industryViews[next].id); document.getElementById(`${panelId}-tab-${industryViews[next].id}`)?.focus(); }}>{view.label}</button>)}</div>
        </div>
        <div role="tabpanel" id={`${panelId}-overview`} aria-labelledby={`${panelId}-tab-overview`} hidden={activeView !== "overview"} className="space-y-4">
          <IndustryOverview industry={activeIndustry} />
          <PoolDistribution industry={activeIndustry} stocks={industryStocks} onSelectSegment={(segmentId) => { select({ industryId: activeIndustry.id, segmentId }); setActiveView("compare"); }} />
        </div>
        <div role="tabpanel" id={`${panelId}-compare`} aria-labelledby={`${panelId}-tab-compare`} hidden={activeView !== "compare"} className="space-y-4">
          <DashboardCard className="p-4">
            <SectionHeader title="细分比较" description={`当前细分显示 ${visibleSegmentStocks.length} / ${segmentStocks.length} 家研究池公司。顶栏搜索仅过滤本细分原有公司字段，不检索外部资料。`} action={<Layers3 className="h-5 w-5 text-accent" />} />
            <label className="mt-3 block max-w-md text-xs text-textMuted">选择细分板块<select value={selection.segmentId} onChange={(event) => select({ industryId: activeIndustry.id, segmentId: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-control bg-panel2 px-3 text-sm text-text">{!segmentOptions.length ? <option value="">暂无细分</option> : segmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="细分内容">{([{ id: "summary", label: "逻辑与行情摘要" }, { id: "table", label: "公司比较表" }, { id: "companies", label: "公司列表" }] as const).map((view) => <button key={view.id} type="button" aria-pressed={compareView === view.id} className={`min-h-11 rounded-md border px-3 text-sm ${compareView === view.id ? "border-accent bg-selected text-accent" : "border-control text-textMuted"}`} onClick={() => setCompareView(view.id)}>{view.label}</button>)}</div>
            <div hidden={compareView !== "summary"} className="mt-4 space-y-4">{segment ? <SegmentLogic industry={activeIndustry} segment={segment} /> : isRobotics ? <AllRoboticsSummary industry={activeIndustry} stocks={visibleSegmentStocks} /> : <EmptyState title="细分资料暂缺" description="当前行业尚未提供细分逻辑。" compact />}<SegmentMarketSummary stocks={visibleSegmentStocks} /></div>
            <div hidden={compareView !== "table"} className="mt-4"><p className="mb-3 text-xs leading-5 text-textMuted">以下为各公司原始快照字段；报告期、币种和数据时点可能不同，不据此形成可比排名。</p><StockCompare stocks={visibleSegmentStocks} onOpenStock={onOpenStock} /></div>
          </DashboardCard>
          <div hidden={compareView !== "companies"}>{visibleSegmentStocks.length === 0 ? <EmptyState title="没有匹配个股" description="请调整搜索词，或查看其他细分板块。" /> : isRobotics ? <RoboticsStockSection stocks={visibleSegmentStocks} industries={industries} onOpenStock={onOpenStock} /> : <StockGrid stocks={visibleSegmentStocks} industries={industries} onOpenStock={onOpenStock} />}</div>
        </div>
        <div role="tabpanel" id={`${panelId}-chain`} aria-labelledby={`${panelId}-tab-chain`} hidden={activeView !== "chain"} className="space-y-4"><ChainMap industry={activeIndustry} />{isRobotics ? <PrivateCompanySection /> : null}</div>
      </div>
    </div>
  </section>;
}

function PoolDistribution({ industry, stocks, onSelectSegment }: { industry: Industry; stocks: Stock[]; onSelectSegment: (segmentId: string) => void }) {
  return <DashboardCard className="p-4"><SectionHeader title="研究池公司分布" description={`范围为当前行业研究池的 ${stocks.length} 家上市公司，未应用公司搜索；按原列表逐项统计，每家公司归属一个细分。未上市线索不计入分母。`} />
    {!industry.segments.length ? <p className="mt-3 text-sm text-textMuted">细分资料暂缺</p> : <ul className="mt-4 space-y-3">{industry.segments.map((segment) => { const count = stocks.filter((stock) => stock.segmentId === segment.id).length; return <li key={segment.id}>
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm" onClick={() => onSelectSegment(segment.id)}><span className="break-words text-accent">{segment.name}</span><span className="shrink-0 tabular-nums text-textMuted">{count} / {stocks.length} 家</span></button>
      <div aria-hidden="true" className="h-2 rounded-full bg-panel2"><div className="h-2 rounded-full bg-accent" style={{ width: `${stocks.length ? count / stocks.length * 100 : 0}%` }} /></div>
    </li>; })}</ul>}
  </DashboardCard>;
}
function StockGrid({ stocks, industries, onOpenStock }: { stocks: Stock[]; industries: Industry[]; onOpenStock: (stock: Stock) => void }) {
  if (stocks.length === 0) return <EmptyState title="暂无公司" description="当前筛选条件下没有匹配公司。" compact />;

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {stocks.map((stock) => (
        <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} />
      ))}
    </div>
  );
}

function IndustryOverview({ industry }: { industry: Industry }) {
  return (
    <DashboardCard className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-textMuted">行业总览</p>
          <h2 className="mt-1 text-2xl font-semibold text-textStrong">{industry.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs text-cyan">景气：{industry.prosperity}</span>
            <span className="rounded border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs text-secondary">阶段：{industry.stage}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {industry.styles.map((style) => (
            <span key={style} className="rounded border border-accent/20 bg-accent/10 px-2 py-1 text-xs text-accent">
              {style}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoBlock title="核心驱动" items={industry.drivers} />
        <InfoBlock title="近期催化剂" items={industry.catalysts} />
        <InfoBlock title="主要风险" items={industry.risks} risk />
      </div>
    </DashboardCard>
  );
}

function ChainMap({ industry }: { industry: Industry }) {
  return (
    <DashboardCard className="p-4">
      <div className="flex items-center gap-2">
        <Factory className="h-5 w-5 text-textMuted" />
        <h2 className="text-lg font-semibold text-textStrong">产业链结构</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-textMuted">仅展示既有上中下游结构关系；位置不表示收入权重或资金流向。</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {industry.chain.map((chain) => (
          <div key={chain.stage} className="rounded-lg border border-borderSoft bg-bg2/70 p-3">
            <p className="text-sm font-semibold text-textStrong">{chain.stage}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chain.items.map((item) => (
                <span key={item} className="rounded border border-borderSoft bg-surface/70 px-2 py-1 text-xs leading-5 text-textMuted" title={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function SegmentLogic({ industry, segment }: { industry: Industry; segment: Industry["segments"][number] }) {
  return (
    <article className="rounded-lg border border-borderSoft bg-surface/72 p-4">
      <p className="text-xs font-semibold text-textMuted">{industry.name}</p>
      <h3 className="mt-1 text-xl font-semibold text-textStrong">{segment.name}</h3>
      <p className="mt-3 break-words text-sm leading-6 text-textMuted">
        {segment.logic}
      </p>
      <div className="mt-4 grid gap-2 text-sm">
        <Field label="需求来源" value={segment.demandSource} />
        <Field label="供给格局" value={segment.supplyPattern} />
        <Field label="竞争壁垒" value={segment.moat} />
        <Field label="价格 / 订单 / 产能趋势" value={segment.trend} />
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-textMuted">未来 6-12 个月关键变量</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {segment.keyVariables.map((item) => (
            <span key={item} className="rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-xs leading-5 text-textMuted" title={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function AllRoboticsSummary({ industry, stocks }: { industry: Industry; stocks: Stock[] }) {
  const coreCount = stocks.filter((stock) => stock.candidateType !== "观察池").length;
  const observationCount = stocks.filter((stock) => stock.candidateType === "观察池").length;
  return (
    <article className="rounded-lg border border-borderSoft bg-surface/72 p-4">
      <p className="text-xs font-semibold text-textMuted">{industry.name}</p>
      <h3 className="mt-1 text-xl font-semibold text-textStrong">全部机器人产业链</h3>
      <p className="mt-3 text-sm leading-6 text-textMuted">
        当前展示机器人行业全部上市公司池，覆盖本体整机、关节与执行器、精密减速器、线性执行器与丝杠、运动控制、感知层和汽零迁移。
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniSummary label="核心池" value={`${coreCount} 家`} />
        <MiniSummary label="观察池" value={`${observationCount} 家`} />
        <MiniSummary label="细分环节" value={`${industry.segments.length} 个`} />
      </div>
    </article>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
      <p className="text-xs text-textMuted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-textStrong">{value}</p>
    </div>
  );
}

function PrivateCompanySection() {
  return (
    <DashboardCard className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-textStrong">未上市公司 / 待上市公司</h3>
        <p className="mt-1 text-sm text-textMuted">未上市公司不参与行情合并，只作为产业链跟踪线索展示。</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {roboticsPrivateCompanies.map((company) => (
          <div key={company.id} className="rounded-lg border border-borderSoft bg-bg2/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-textStrong">{company.name}</h4>
                <p className="mt-1 text-xs text-textMuted">市场：{company.market} · 细分：本体整机</p>
              </div>
              <span className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">无法接入行情</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-textMuted">{company.thesis}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {company.themeTags.map((tag) => (
                <span key={tag} className="rounded border border-cyan/20 bg-cyan/10 px-2 py-1 text-xs text-cyan">{tag}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-textWeak">需跟踪：{company.trackingMetrics.join(" / ")}</p>
            <p className="mt-2 text-xs text-warning">无法接入行情，需跟踪 IPO 和产品进展。</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function StockCompare({ stocks, onOpenStock }: { stocks: Stock[]; onOpenStock: (stock: Stock) => void }) {
  if (stocks.length === 0) {
    return <EmptyState title="暂无对比数据" description="该细分板块没有匹配个股。" compact />;
  }

  return (
    <div tabIndex={0} role="region" aria-label="公司比较表，可横向滚动" className="max-w-full overflow-x-auto rounded-lg border border-borderSoft bg-card">
      <table className="w-full min-w-[1080px] text-left text-[13px]">
        <thead className="sticky top-0 bg-bg2 text-xs text-textMuted">
          <tr>
            {["股票", "市值", "营收增速", "利润增速", "毛利率", "ROE", "PE", "产业链位置", "龙头逻辑", "风险"].map(
              (header) => (
                <th key={header} className={`px-3 py-3 font-medium ${["市值", "营收增速", "利润增速", "毛利率", "ROE", "PE"].includes(header) ? "text-right" : ""}`}>
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.id} className="h-16 border-t border-borderSoft transition hover:bg-cyan/5">
              <td className="px-3 py-3 font-medium text-textStrong"><button type="button" data-stock-id={stock.id} className="min-h-11 break-words text-left text-accent" onClick={() => onOpenStock(stock)}>{stock.name}</button><p className="text-xs text-textMuted">{stock.market} · {stock.code}</p></td>
              <ValueCell value={stock.financial.marketCap} numeric />
              <ValueCell value={stock.financial.revenueGrowth} numeric />
              <ValueCell value={stock.financial.profitGrowth} numeric />
              <ValueCell value={stock.financial.grossMargin} numeric />
              <ValueCell value={stock.financial.roe} numeric />
              <ValueCell value={stock.valuation.pe} numeric />
              <td className="px-3 py-3"><p className="break-words">{stock.chainPosition}</p></td>
              <td className="px-3 py-3"><p className="break-words">{stock.leaderPosition}</p></td>
              <td className="px-3 py-3">{stock.riskLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentMarketSummary({ stocks }: { stocks: Stock[] }) {
  const quotes = stocks.map((stock) => stock.quote).filter(Boolean);
  const pctValues = quotes.map((quote) => quote?.pctChange).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const mcapValues = quotes.map((quote) => quote?.marketCap).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const amountValues = quotes.map((quote) => quote?.amount).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const mixedMarkets = new Set(stocks.filter((stock) => stock.quote).map((stock) => stock.market)).size > 1;
  const averagePct = pctValues.length ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length : null;
  const totalMcap = mcapValues.length ? mcapValues.reduce((sum, value) => sum + value, 0) : null;
  const averageAmount = amountValues.length ? amountValues.reduce((sum, value) => sum + value, 0) / amountValues.length : null;
  const financialDates = stocks
    .map((stock) => stock.realFinancial?.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestFinancial = financialDates.length ? financialDates[financialDates.length - 1] : undefined;
  const coveredStocks = stocks.filter((stock) => stock.dataQuality?.some((item) => item.status === "real" || item.status === "stale")).length;
  const latestUpdates = quotes
    .map((quote) => quote?.updatedAt).filter((value): value is string => Boolean(value))
    .sort();
  const latestUpdate = latestUpdates.length ? latestUpdates[latestUpdates.length - 1] : undefined;
  const coverage = stocks.length ? `${coveredStocks}/${stocks.length}` : "数据暂缺";

  return (
    <div><p className="mb-3 text-xs leading-5 text-textMuted">仅汇总当前筛选内有值快照，时点可能不同；均值不表示行业指数，币种源字段未提供。{mixedMarkets ? "跨市场金额口径未确认，金额汇总不可比。" : "金额沿用原行情摘要的亿单位，详情逐公司查证。"}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label={`池内快照平均涨跌（${pctValues.length}/${stocks.length}）`}
        value={averagePct === null ? "暂无" : `${averagePct > 0 ? "+" : ""}${averagePct.toFixed(2)}%`}
        tone={averagePct === null || averagePct === 0 ? "neutral" : averagePct > 0 ? "red" : "green"}
      />
      <MetricCard label={`池内快照市值合计（${mcapValues.length}/${stocks.length}）`} value={mixedMarkets ? "跨市场不可比" : totalMcap === null ? "暂无" : `${totalMcap.toFixed(1)} 亿`} />
      <MetricCard label={`平均成交额（${amountValues.length}/${stocks.length}）`} value={mixedMarkets ? "跨市场不可比" : averageAmount === null ? "暂无" : `${averageAmount.toFixed(1)} 亿`} tone="cyan" />
      <MetricCard label="含真实或过期数据条目的公司" value={coverage} tone="cyan" />
      <MetricCard label="财务数据更新时间" value={latestFinancial ?? "暂无"} />
      <MetricCard label="最近行情采集时间" value={latestUpdate ?? "暂无"} />
    </div></div>
  );
}

function ValueCell({ value, numeric = false }: { value: string; numeric?: boolean }) {
  const missing = !value || value.includes("数据暂缺");
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

function InfoBlock({ title, items, risk = false }: { title: string; items: string[]; risk?: boolean }) {
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/70 p-3">
      <p className="text-sm font-semibold text-textStrong">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-textMuted">
        {items.map((item) => (
          <li key={item} className={risk ? "text-warning" : ""}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-textStrong">{label}：</span>
      <span className="break-words text-textMuted">{value}</span>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-dashed border-borderSoft bg-surface/70 text-center ${compact ? "p-6" : "p-10"}`}>
      <p className="font-medium text-textStrong">{title}</p>
      <p className="mt-1 text-sm text-textMuted">{description}</p>
    </div>
  );
}
