import { ResearchInbox, isReadableResearchState, type ResearchDataState } from "./ResearchInbox";
import type { IndustryChangeEvent } from '../../services/industrySignals';
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DashboardDataMode, Stock, WatchItem, ReviewTask, ResearchEvent, EarningsExpectationSnapshot } from "../../types";
import { QuoteTrust, QuoteTrustSummary } from "../common/QuoteTrust";
import { DashboardCard, PriceChange } from "../common/terminal";
import { StockPriceHistoryChart } from "../stock/StockPriceHistoryChart";
import { RelatedResearchEvidence } from "../research/RelatedResearchEvidence";
import { describeDataTime } from "../../utils/dataTrustDisplay";
import { dataModeDisplayLabel, localizeDataSourceNote } from "../../utils/displayLabels";
import { useDisplayNow } from "../../hooks/useDisplayNow";
export type ResearchDestination = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心" | "预期证据" | "观点追踪" | "研究记忆";
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
  dataState?: ResearchDataState;
  dataMessage?: string;
  observationState?: ResearchDataState; observationMessage?: string;
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


const destinations: ResearchDestination[] = ["宏观", "行业", "个股池", "观察清单", "验证中心", "预期证据", "观点追踪"];
export function HomePage({ dataMode, modeLabel, updatedAt, sourceNote, coverageSummary, stats, focusStocks, quoteStocks, activeWatchCount, onNavigate, onOpenStock, now, watchItems=[], tasks=[], events=[], onStartReview, onOpenEvent, timeZone = "Asia/Shanghai", inboxSourceNotice, dataState = "ready", dataMessage, observationState = dataState, observationMessage, expectationSnapshots, industryEvents }: HomePageProps) {
  const displayNow=useDisplayNow(now);
  const watched=watchItems.filter(item=>!item.archivedAt);
  const [priceId,setPriceId]=useState("");
  const [showPrice, setShowPrice] = useState(false);
  const selected=quoteStocks.find(stock=>stock.id===priceId) ?? focusStocks[0] ?? quoteStocks[0];
  return <section className="home-workbench space-y-5" aria-label="首页研究工作台">
    <header className="ui-v21-workbench-head"><div><h1>研究总览</h1><p className="mt-1 text-sm text-textMuted">研究池的事件与变化；个人待办按类型在任务中处理。</p></div><button type="button" className="inbox-action" onClick={() => onNavigate("观察清单")}>打开观察清单</button></header>
    <ResearchInbox industryEvents={industryEvents} expectationSnapshots={expectationSnapshots} events={events} tasks={tasks} watchItems={watchItems} stocks={quoteStocks} now={displayNow} timeZone={timeZone} sourceNotice={inboxSourceNotice} dataState={dataState} dataMessage={dataMessage} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent} onStartReview={onStartReview} />
    <details className="ui-v21-overview-tools"><summary>行情、关注公司与研究辅助</summary><p className="mt-3 text-sm text-textMuted">{dataState === "ready" ? `个人观察 ${activeWatchCount} 项 · 近 7 日研究事件 ${stats.recentEvents} 项 · 预期来源待核验 ${stats.pendingExpectationSources} 项` : "部分研究记录不可读取，汇总数量尚不完整。"}</p>
    <div className="home-research-grid">
      <details className="home-price min-w-0" onToggle={event => setShowPrice(event.currentTarget.open)}><summary className="inbox-action">查看价格脉络</summary>{showPrice && selected ? <StockPriceHistoryChart stock={selected} compact objectControl={<label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-textMuted">研究对象<select aria-label="价格脉络研究对象" value={selected.id} onChange={event=>setPriceId(event.target.value)}>{quoteStocks.map(stock=><option key={stock.id} value={stock.id}>{stock.name} · {stock.code}</option>)}</select></label>}/>: !selected ? <p className="p-4 text-textMuted">研究池暂无对象，价格历史不可用。</p> : null}</details>
      <DashboardCard className="home-watched p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">关注公司</h2><span className="text-xs text-textMuted">个人观察清单</span></div>
        {!isReadableResearchState(observationState) ? <p role="alert" className="py-6 text-sm text-warning">{observationMessage ?? dataMessage ?? "观察记录不可读取，数量未知。"}</p> : !watched.length ? <p className="py-6 text-sm text-textMuted">尚无用户观察项。示例模板不会自动成为个人观察记录。</p>:<div className="mt-4 divide-y divide-borderSoft">{watched.map(item=>{const stock=quoteStocks.find(stock=>stock.id===item.stockId);return <div key={item.id} className="flex flex-wrap items-center gap-4 py-3"><button type="button" data-stock-id={stock?.id} disabled={!stock} onClick={()=>stock&&onOpenStock(stock)} className="min-w-0 flex-1 text-left font-medium text-accent">{stock?.name ?? item.stockId}<span className="mt-1 block text-xs text-textMuted">{stock?.code} · {item.status}</span></button><span className="tabular-nums">{stock?.quote?.latestPrice ?? "—"}</span><PriceChange value={stock?.quote?.pctChange}/></div>;})}</div>}
      </DashboardCard>
      <DashboardCard className="home-data min-w-0 p-5"><h2 className="text-lg font-semibold">数据状态</h2><p className="mt-2 text-sm text-textMuted">{coverageSummary}</p><p className="mt-2 text-xs text-textMuted">A 股行情覆盖：{stats.quoteStatusRealCovered} / {stats.quoteCoverageTotal}（质量状态为真实数据 且有价格）</p>
    <details className="mt-3 text-xs text-textMuted"><summary>行情覆盖与来源明细</summary><div className="mt-3 space-y-2"><p>当前模式：{dataModeDisplayLabel(modeLabel)}。{localizeDataSourceNote(sourceNote)}</p><p>{describeDataTime(dataMode==="mock" ? undefined : updatedAt,"package_updated",displayNow).text}</p><p>A 股行情覆盖（质量状态为真实数据 且有价格）：{stats.quoteStatusRealCovered} / {stats.quoteCoverageTotal}</p><QuoteTrustSummary stocks={quoteStocks} now={displayNow}/><p>{coverageSummary}</p>{selected ? <QuoteTrust quote={selected.quote} now={displayNow}/>:null}</div></details></DashboardCard>
    </div>
    {selected ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="inbox-action" onClick={() => onOpenStock(selected)}>继续公司研究</button><RelatedResearchEvidence stock={selected} events={events} expectationSnapshots={expectationSnapshots} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent}/></div> : null}
    </details>
    <nav aria-label="研究快捷入口" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{destinations.map(destination=><button type="button" key={destination} className="flex min-h-11 items-center justify-between rounded-md border border-control bg-panel px-3 text-sm hover:text-accent" onClick={()=>onNavigate(destination)}>{destination}<ArrowUpRight className="h-4 w-4"/></button>)}</nav>

  </section>;
}
