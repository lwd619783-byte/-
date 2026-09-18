import { ResearchInbox } from "./ResearchInbox";
import type { IndustryChangeEvent } from '../../services/industrySignals';
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DashboardDataMode, Stock, WatchItem, ReviewTask, ResearchEvent, EarningsExpectationSnapshot } from "../../types";
import { QuoteTrust, QuoteTrustSummary } from "../common/QuoteTrust";
import { DashboardCard, KpiCard, PriceChange } from "../common/terminal";
import { StockPriceHistoryChart } from "../stock/StockPriceHistoryChart";
import { ProductShell } from "../layout/ProductShell";
import { RelatedResearchEvidence } from "../research/RelatedResearchEvidence";
import { describeDataTime } from "../../utils/dataTrustDisplay";
import { dataModeDisplayLabel, localizeDataSourceNote } from "../../utils/displayLabels";
import { useDisplayNow } from "../../hooks/useDisplayNow";
export type ResearchDestination = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心" | "预期证据";
interface HomeStats {
  segments: number;
  highRisk: number;
  recentEvents: number;
  verificationChains: number;
  todayReview: number;
  overdueReview: number;
  quoteStatusRealCovered: number;
  quoteCoverageTotal: number;
  pendingExpectationSources: number;
}

interface HomePageProps {
  expectationSnapshots?: EarningsExpectationSnapshot[];
  industryEvents?: IndustryChangeEvent[];
  timeZone?: string;
  inboxSourceNotice?: string;
  watchItems?: WatchItem[];
  tasks?: ReviewTask[];
  events?: ResearchEvent[];
  onStartReview?: (item: WatchItem) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
  dataMode?: DashboardDataMode;
  modeLabel: string;
  updatedAt: string;
  sourceNote: string;
  coverageSummary: string;
  industriesCount: number;
  stocksCount: number;
  activeWatchCount: number;
  expectationCount: number;
  macroCount: number;
  stats: HomeStats;
  focusStocks: Stock[];
  quoteStocks: Stock[];
  now?: Date;
  onDataModeChange: (mode: DashboardDataMode) => void;
  onNavigate: (destination: ResearchDestination) => void;
  onOpenStock: (stock: Stock) => void;
}


const destinations: ResearchDestination[] = ["宏观", "行业", "个股池", "观察清单", "验证中心", "预期证据"];
export function HomePage({ dataMode, modeLabel, updatedAt, sourceNote, coverageSummary, stats, focusStocks, quoteStocks, activeWatchCount, onNavigate, onOpenStock, now, watchItems=[], tasks=[], events=[], onStartReview, onOpenEvent, timeZone = "Asia/Shanghai", inboxSourceNotice, expectationSnapshots, industryEvents }: HomePageProps) {
  const displayNow=useDisplayNow(now);
  const pending=tasks.filter(task=>task.status==="pending");
  const pendingCompanies=new Set(pending.map(task=>task.watchItemId)).size;
  const watched=watchItems.filter(item=>!item.archivedAt);
  const [priceId,setPriceId]=useState("");
  const selected=quoteStocks.find(stock=>stock.id===priceId) ?? focusStocks[0] ?? quoteStocks[0];
  return <section className="home-workbench space-y-5" aria-label="首页研究工作台">
    <ProductShell section="研究入口" title="首页 / 研究工作台" scope={selected ? `当前图表对象：${selected.name} · ${selected.code}；收件箱范围：当前研究池` : "当前研究池为空"} quality={<><span>{coverageSummary}</span><span className="mt-1 block">公司相关证据是研究导航，不代表价格图表的精确证据关联。</span></>} actions={<>
      {selected ? <><button type="button" className="inbox-action" onClick={() => onOpenStock(selected)}>继续公司研究</button><RelatedResearchEvidence stock={selected} events={events} expectationSnapshots={expectationSnapshots} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent}/></> : null}
      <button type="button" onClick={()=>onNavigate("观察清单")} className="inbox-action">打开观察清单</button>
    </>} />
    <ResearchInbox industryEvents={industryEvents} expectationSnapshots={expectationSnapshots} events={events} tasks={tasks} watchItems={watchItems} stocks={quoteStocks} now={displayNow} timeZone={timeZone} sourceNotice={inboxSourceNotice} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent} onStartReview={onStartReview} />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard label="待复盘公司" value={pendingCompanies} description="仅统计有待处理任务的用户观察项" tone="warning"/>
      <KpiCard label="近 7 日研究事件" value={stats.recentEvents} description="当前研究事件摘要，非实时新闻" tone="info"/>
      <KpiCard label="正在观察" value={activeWatchCount} description="个人观察清单，不包含未载入模板" tone="info"/>
      <KpiCard label="预期来源待核验" value={stats.pendingExpectationSources} description="现有预期快照的来源核验项" tone="warning"/>
    </div>
    <div className="home-research-grid">
      <div className="home-price min-w-0">{selected ? <StockPriceHistoryChart stock={selected} compact objectControl={<label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-textMuted">研究对象<select aria-label="价格脉络研究对象" value={selected.id} onChange={event=>setPriceId(event.target.value)}>{quoteStocks.map(stock=><option key={stock.id} value={stock.id}>{stock.name} · {stock.code}</option>)}</select></label>}/>:<DashboardCard className="p-6 text-textMuted">研究池暂无对象，价格历史不可用。</DashboardCard>}</div>
      <DashboardCard className="home-watched p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">关注公司</h2><span className="text-xs text-textMuted">个人观察清单</span></div>
        {!watched.length ? <p className="py-6 text-sm text-textMuted">尚无用户观察项。示例模板不会自动成为个人观察记录。</p>:<div className="mt-4 divide-y divide-borderSoft">{watched.map(item=>{const stock=quoteStocks.find(stock=>stock.id===item.stockId);return <div key={item.id} className="flex flex-wrap items-center gap-4 py-3"><button type="button" data-stock-id={stock?.id} disabled={!stock} onClick={()=>stock&&onOpenStock(stock)} className="min-w-0 flex-1 text-left font-medium text-accent">{stock?.name ?? item.stockId}<span className="mt-1 block text-xs text-textMuted">{stock?.code} · {item.status}</span></button><span className="tabular-nums">{stock?.quote?.latestPrice ?? "—"}</span><PriceChange value={stock?.quote?.pctChange}/></div>;})}</div>}
      </DashboardCard>
      <DashboardCard className="home-data min-w-0 p-5"><h2 className="text-lg font-semibold">数据状态</h2><p className="mt-2 text-sm text-textMuted">{coverageSummary}</p><p className="mt-2 text-xs text-textMuted">A 股行情覆盖：{stats.quoteStatusRealCovered} / {stats.quoteCoverageTotal}（质量状态为真实数据 且有价格）</p>
    <details className="mt-3 text-xs text-textMuted"><summary>行情覆盖与来源明细</summary><div className="mt-3 space-y-2"><p>当前模式：{dataModeDisplayLabel(modeLabel)}。{localizeDataSourceNote(sourceNote)}</p><p>{describeDataTime(dataMode==="mock" ? undefined : updatedAt,"package_updated",displayNow).text}</p><p>A 股行情覆盖（质量状态为真实数据 且有价格）：{stats.quoteStatusRealCovered} / {stats.quoteCoverageTotal}</p><QuoteTrustSummary stocks={quoteStocks} now={displayNow}/><p>{coverageSummary}</p>{selected ? <QuoteTrust quote={selected.quote} now={displayNow}/>:null}</div></details></DashboardCard>
    </div>
    <nav aria-label="研究快捷入口" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{destinations.map(destination=><button type="button" key={destination} className="flex min-h-11 items-center justify-between rounded-md border border-control bg-panel px-3 text-sm hover:text-accent" onClick={()=>onNavigate(destination)}>{destination}<ArrowUpRight className="h-4 w-4"/></button>)}</nav>

  </section>;
}
