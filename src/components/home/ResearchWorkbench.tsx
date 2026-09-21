import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChartNoAxesCombined, Factory, Building2, Plus } from "lucide-react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import type { IndustryChangeEvent } from "../../services/industrySignals";
import { buildResearchInbox } from "../../services/researchInbox";
import { needsDataReview } from "../../services/researchEventReview";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import type { ResearchDestination } from "./HomePage";
import { ResearchInbox, type ResearchDataState } from "./ResearchInbox";
import "./ResearchWorkbench.css";

export interface ResearchWorkspaceDataProps {
  stocks: Stock[]; watchItems?: WatchItem[]; tasks?: ReviewTask[]; events?: ResearchEvent[];
  expectationSnapshots?: EarningsExpectationSnapshot[]; industryEvents?: IndustryChangeEvent[];
  now?: Date; timeZone?: string; inboxSourceNotice?: string;
  dataState?: ResearchDataState; dataMessage?: string;
  onOpenStock: (stock: Stock) => void;
  onStartReview?: (item: WatchItem) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
}
export interface ResearchWorkbenchProps extends ResearchWorkspaceDataProps {
  onNavigate: (destination: ResearchDestination) => void;
  onOpenKnowledge: () => void; onOpenTasks: () => void;
  onResearchQuery?: (query: string) => void;
  onOpenSources?: () => void; onOpenResearch?: () => void;
}

/** Existing observations and inbox projection only; no invented research or reading history. */
export function ResearchWorkbench({ stocks, watchItems = [], tasks = [], events = [], industryEvents, expectationSnapshots, now, timeZone = "Asia/Shanghai", inboxSourceNotice, dataState = "ready", dataMessage, onNavigate, onOpenStock, onStartReview, onOpenEvent, onOpenTasks, onOpenSources, onOpenResearch }: ResearchWorkbenchProps) {
  const displayNow = useDisplayNow(now);
  const watched = watchItems.filter(item => !item.archivedAt);
  const pending = useMemo(() => buildResearchInbox({ events, tasks, watchItems, now: displayNow, timeZone }).filter(row => row.tasks.length), [events, tasks, watchItems, displayNow, timeZone]);
  const showSide = dataState === "ready" && pending.length > 0;
  return <section className="ui-v2-workbench" aria-label="工作台">
    <header className="ui-v21-workbench-head"><h1>工作台</h1>{onOpenSources ? <button type="button" className="ui-v2-primary" onClick={onOpenSources}><Plus size={16} aria-hidden="true" />添加资料</button> : null}</header>
    <nav aria-label="研究快捷入口" className="ui-v21-quicklinks">
      {([{ title: "宏观指标", description: "观测与来源", destination: "宏观", Icon: ChartNoAxesCombined }, { title: "行业研究", description: "产业链与公司", destination: "行业", Icon: Factory }, { title: "公司研究", description: "业务、财务与估值", destination: "个股池", Icon: Building2 }] as const).map(({ title, description, destination, Icon }) => <button key={destination} type="button" onClick={() => onNavigate(destination)}><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}
    </nav>
    <div className={`ui-v21-home-columns ${showSide ? "has-tasks" : ""}`} data-columns={showSide ? "2" : "1"}>
      <section aria-labelledby="workbench-observations-title" className="ui-v21-observations">
        <div className="ui-v21-section-heading"><h2 id="workbench-observations-title">我的观察</h2><button type="button" className="ui-v21-text-button" onClick={() => onNavigate("观察清单")}>全部观察 <ArrowRight size={16} aria-hidden="true" /></button></div>
        {dataState !== "ready" ? <p role={dataState === "loading" ? "status" : "alert"} className="ui-v21-quiet-strip">{dataMessage ?? ({ loading: "正在载入观察记录，数量尚未确定。", error: "观察记录读取失败，不能判断是否为空。", locked: "观察记录已锁定，请先处理存储或权限问题。" })[dataState]}</p> : watched.length ? <ul className="ui-v21-watch-list">{watched.slice(0, 4).map(item => {
          const stock = stocks.find(value => value.id === item.stockId);
          return <li key={item.id}><button type="button" aria-label={stock ? `继续研究：${stock.name}` : "查看观察记录"} onClick={() => stock ? onOpenStock(stock) : onNavigate("观察清单")}><span className="ui-v21-watch-body"><strong>{stock?.name ?? "研究对象未载入"}<small>{stock?.code}</small></strong><span>{item.thesis || "尚未记录论点"}</span></span><span className="ui-v21-status">{item.status}</span><ArrowRight size={16} aria-hidden="true" /></button></li>;
        })}</ul> : <div className="ui-v21-quiet-strip"><div><h3>还没有观察项</h3><p>从公司研究中选择对象，加入观察清单。</p></div><button type="button" className="inbox-action" onClick={() => onNavigate("个股池")}>查看公司</button></div>}
      </section>
      {showSide ? <aside className="ui-v21-home-tasks" aria-label="待处理复盘"><div className="ui-v21-section-heading"><h2>研究复盘</h2><span>{pending.reduce((sum, row) => sum + row.tasks.length, 0)} 项</span></div>{pending.slice(0, 2).map(row => <div key={row.id} className="ui-v21-task-mini"><p>{row.tasks[0].title}</p><span>最早任务日期：{row.date ?? "未提供"}</span>{row.watchItem && onStartReview ? <button type="button" className="ui-v21-text-button" onClick={() => onStartReview(row.watchItem!)}>开始复盘</button> : null}</div>)}<button type="button" className="ui-v21-text-button" onClick={onOpenTasks}>查看任务 <ArrowRight size={16} aria-hidden="true" /></button></aside> : null}
    </div>
    <ResearchInbox compact initialLimit={3} stocks={stocks} events={events} tasks={tasks} watchItems={watchItems} industryEvents={industryEvents} expectationSnapshots={expectationSnapshots} now={displayNow} timeZone={timeZone} sourceNotice={inboxSourceNotice} dataState={dataState} dataMessage={dataMessage} onOpenStock={onOpenStock} onStartReview={onStartReview} onOpenEvent={onOpenEvent} onOpenAll={onOpenResearch ?? (() => onNavigate("验证中心"))} />
    {!showSide && dataState === "ready" ? <button type="button" className="ui-v21-text-button ui-v21-task-link" onClick={onOpenTasks}>查看待办分类 <ArrowRight size={16} aria-hidden="true" /></button> : null}
  </section>;
}

export type TaskQueue = "knowledge" | "review" | "verification";
export interface TaskWorkspaceProps extends ResearchWorkspaceDataProps {
  onOpenReview: () => void;
  activeQueue?: TaskQueue; onQueueChange?: (queue: TaskQueue) => void;
  knowledgeState?: { status: ResearchDataState; count?: number; message?: string };
  knowledgeReview?: ReactNode;
}

export function TaskWorkspace({ stocks, watchItems = [], tasks = [], events = [], expectationSnapshots, now, timeZone = "Asia/Shanghai", inboxSourceNotice, dataState = "ready", dataMessage, onOpenStock, onStartReview, onOpenEvent, onOpenReview, activeQueue, onQueueChange, knowledgeState, knowledgeReview }: TaskWorkspaceProps) {
  const displayNow = useDisplayNow(now);
  const [localQueue, setLocalQueue] = useState<TaskQueue>("review");
  const queue = activeQueue ?? localQueue;
  const reviewRows = useMemo(() => buildResearchInbox({ events, tasks, watchItems, now: displayNow, timeZone }).filter(row => row.tasks.length), [events, tasks, watchItems, displayNow, timeZone]);
  const verificationEvents = useMemo(() => events.filter(needsDataReview), [events]);
  const chooseQueue = (value: TaskQueue) => { setLocalQueue(value); onQueueChange?.(value); if (value === "knowledge" && !onQueueChange && !knowledgeReview) onOpenReview(); };
  const count = (value: TaskQueue) => {
    if (value === "knowledge") return knowledgeState?.status === "ready" && knowledgeState.count !== undefined ? String(knowledgeState.count) : knowledgeState?.status === "error" ? "读取失败" : knowledgeState?.status === "locked" ? "已锁定" : "待载入";
    return dataState === "ready" ? String(value === "review" ? reviewRows.reduce((sum, row) => sum + row.tasks.length, 0) : verificationEvents.length) : dataState === "loading" ? "载入中" : dataState === "locked" ? "已锁定" : "读取失败";
  };
  const queues = [{ key: "knowledge", label: "知识待审" }, { key: "review", label: "研究复盘" }, { key: "verification", label: "事件核验" }] as const;
  return <section className="ui-v2-task-workspace" aria-label="任务工作区">
    <header className="ui-v21-workbench-head"><h1>任务</h1></header>
    <div role="tablist" aria-label="任务类别" className="ui-v21-task-tabs">{queues.map((item, index) => <button key={item.key} id={`task-tab-${item.key}`} type="button" role="tab" aria-selected={queue === item.key} tabIndex={queue === item.key ? 0 : -1} aria-controls={`task-panel-${item.key}`} onClick={() => chooseQueue(item.key)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1; if (next >= 0) { event.preventDefault(); chooseQueue(queues[next].key); document.getElementById(`task-tab-${queues[next].key}`)?.focus(); } }}>{item.label}<span>{count(item.key)}</span></button>)}</div>
    {queue === "knowledge" ? knowledgeReview ? <div role="tabpanel" id="task-panel-knowledge" aria-labelledby="task-tab-knowledge">{knowledgeReview}</div> : null : <div role="tabpanel" id={`task-panel-${queue}`} aria-labelledby={`task-tab-${queue}`}>
      <ResearchInbox key={queue} mode={queue} stocks={stocks} watchItems={watchItems} tasks={queue === "review" ? tasks : []} events={queue === "verification" ? verificationEvents : events} expectationSnapshots={expectationSnapshots} now={displayNow} timeZone={timeZone} sourceNotice={inboxSourceNotice} dataState={dataState} dataMessage={dataMessage} onOpenStock={onOpenStock} onStartReview={onStartReview} onOpenEvent={onOpenEvent} />
    </div>}
  </section>;
}
