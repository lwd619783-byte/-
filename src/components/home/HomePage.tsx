import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DashboardDataMode, Stock, WatchItem, ReviewTask, ResearchEvent } from "../../types";
import { QuoteTrust, QuoteTrustSummary } from "../common/QuoteTrust";
import { DashboardCard, KpiCard, PriceChange } from "../common/terminal";
import { StockPriceHistoryChart } from "../stock/StockPriceHistoryChart";
import { describeDataTime } from "../../utils/dataTrustDisplay";
import { dataModeDisplayLabel, localizeDataSourceNote, statusDisplayLabel } from "../../utils/displayLabels";
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
  watchItems?: WatchItem[];
  tasks?: ReviewTask[];
  events?: ResearchEvent[];
  onStartReview?: (item: WatchItem) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
  dataMode: DashboardDataMode;
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
export function HomePage({ dataMode, modeLabel, updatedAt, sourceNote, coverageSummary, stats, focusStocks, quoteStocks, activeWatchCount, onNavigate, onOpenStock, now, watchItems=[], tasks=[], events=[], onStartReview, onOpenEvent }: HomePageProps) {
  const displayNow=useDisplayNow(now);
  const pending=tasks.filter(task=>task.status==="pending");
  const pendingCompanies=new Set(pending.map(task=>task.watchItemId)).size;
  const watched=watchItems.filter(item=>!item.archivedAt);
  const [priceId,setPriceId]=useState("");
  const selected=quoteStocks.find(stock=>stock.id===priceId) ?? focusStocks[0] ?? quoteStocks[0];
  return <section className="home-workbench space-y-5" aria-label="首页研究工作台">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[26px] font-semibold text-textStrong">首页 / 研究工作台</h1><p className="mt-2 text-sm text-textMuted">先处理待验证的研究，再进入完整信息。</p></div><button type="button" onClick={()=>onNavigate("观察清单")} className="inline-flex items-center gap-2 rounded-md border border-control px-3 py-2 text-sm text-accent">打开观察清单<ArrowUpRight className="h-4 w-4"/></button></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard label="待复盘公司" value={pendingCompanies} description="仅统计有待处理任务的用户观察项" tone="warning"/>
      <KpiCard label="近 7 日研究事件" value={stats.recentEvents} description="当前研究事件摘要，非实时新闻" tone="info"/>
      <KpiCard label="正在观察" value={activeWatchCount} description="个人观察清单，不包含未载入模板" tone="info"/>
      <KpiCard label="预期来源待核验" value={stats.pendingExpectationSources} description="现有预期快照的来源核验项" tone="warning"/>
    </div>
    <div className="home-research-grid">
      <DashboardCard className="p-5"><h2 className="text-lg font-semibold">今天先处理什么</h2><p className="mt-1 text-xs text-textMuted">按现有任务优先级与到期时间排列</p>
        <div className="mt-4 divide-y divide-borderSoft">{pending.slice(0,5).map(task=>{const item=watchItems.find(item=>item.id===task.watchItemId);const stock=quoteStocks.find(stock=>stock.id===item?.stockId);return <article key={task.id} className="py-3"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{stock?.name ?? "研究对象待核验"}</h3><span className="text-xs text-warning">{task.dueAt ?? "待核验"}</span></div><p className="mt-2 text-sm">{task.title}</p><p className="mt-1 text-xs leading-6 text-textMuted">{task.description}</p>{item ? <button type="button" onClick={()=>onStartReview?.(item)} className="mt-2 min-h-11 text-sm text-accent">开始复盘</button>:null}</article>;})}
        {!pending.length ? <div className="py-8 text-sm leading-7 text-textMuted"><p>暂无待处理研究任务。</p><p>添加观察项后，按约定复盘时间和已有研究事件查看提醒。</p><button type="button" className="mt-3 min-h-11 text-accent" onClick={()=>onNavigate("观察清单")}>进入观察清单</button></div>:null}</div>
      </DashboardCard>
      <div className="min-w-0 space-y-3"><label className="flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted">研究对象价格脉络<select aria-label="价格脉络研究对象" value={selected?.id ?? ""} onChange={event=>setPriceId(event.target.value)}>{!quoteStocks.length ? <option value="">暂无研究对象</option>:null}{quoteStocks.map(stock=><option key={stock.id} value={stock.id}>{stock.name} · {stock.code}</option>)}</select></label>{selected ? <StockPriceHistoryChart stock={selected} compact/>:<DashboardCard className="p-6 text-textMuted">研究池暂无对象，价格历史不可用。</DashboardCard>}</div>
      <DashboardCard className="home-events p-5"><h2 className="text-lg font-semibold">最近研究事件</h2><p className="mt-1 text-xs text-textMuted">现有研究事件，保留原始来源与时间</p><div className="mt-5 space-y-5">{events.slice(0,6).map(event=><article key={event.id} className="border-l-2 border-accent/60 pl-3"><button type="button" className="min-h-11 text-left text-sm font-medium hover:text-accent" onClick={()=>onOpenEvent ? onOpenEvent(event) : onNavigate("验证中心")}>{event.title}</button><p className="mt-1 text-xs leading-6 text-textMuted">{event.stockName} · {event.eventDate ?? event.publishedAt ?? "时间未提供"}</p><p className="text-xs text-textMuted">{event.sourceName} · {statusDisplayLabel(event.verificationStatus)}</p></article>)}{!events.length ? <p className="py-6 text-sm text-textMuted">当前没有研究事件。</p>:null}</div><button type="button" onClick={()=>onNavigate("验证中心")} className="mt-5 min-h-11 text-sm text-accent">查看全部研究事件</button></DashboardCard>
      <DashboardCard className="home-watched p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">关注公司</h2><span className="text-xs text-textMuted">个人观察清单</span></div>
        {!watched.length ? <p className="py-6 text-sm text-textMuted">尚无用户观察项。示例模板不会自动成为个人观察记录。</p>:<div className="mt-4 divide-y divide-borderSoft">{watched.map(item=>{const stock=quoteStocks.find(stock=>stock.id===item.stockId);return <div key={item.id} className="flex flex-wrap items-center gap-4 py-3"><button type="button" data-stock-id={stock?.id} disabled={!stock} onClick={()=>stock&&onOpenStock(stock)} className="min-w-0 flex-1 text-left font-medium text-accent">{stock?.name ?? item.stockId}<span className="mt-1 block text-xs text-textMuted">{stock?.code} · {item.status}</span></button><span className="tabular-nums">{stock?.quote?.latestPrice ?? "—"}</span><PriceChange value={stock?.quote?.pctChange}/></div>;})}</div>}
      </DashboardCard>
    </div>
    <nav aria-label="研究快捷入口" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{destinations.map(destination=><button type="button" key={destination} className="flex min-h-11 items-center justify-between rounded-md border border-control bg-panel px-3 text-sm hover:text-accent" onClick={()=>onNavigate(destination)}>{destination}<ArrowUpRight className="h-4 w-4"/></button>)}</nav>
    <details className="rounded-lg border border-borderSoft p-4 text-xs text-textMuted"><summary>行情覆盖与来源明细</summary><div className="mt-3 space-y-2"><p>当前模式：{dataModeDisplayLabel(modeLabel)}。{localizeDataSourceNote(sourceNote)}</p><p>{describeDataTime(dataMode==="mock" ? undefined : updatedAt,"package_updated",displayNow).text}</p><p>A 股行情覆盖（质量状态 real 且有价格）：{stats.quoteStatusRealCovered} / {stats.quoteCoverageTotal}</p><QuoteTrustSummary stocks={quoteStocks} now={displayNow}/><p>{coverageSummary}</p>{selected ? <QuoteTrust quote={selected.quote} now={displayNow}/>:null}</div></details>
  </section>;
}
