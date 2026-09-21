import { useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, Search, Upload } from "lucide-react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import type { IndustryChangeEvent } from "../../services/industrySignals";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import type { ResearchDestination } from "./HomePage";
import { ResearchInbox } from "./ResearchInbox";
import "./ResearchWorkbench.css";

export interface ResearchWorkspaceDataProps {
  stocks: Stock[];
  watchItems?: WatchItem[];
  tasks?: ReviewTask[];
  events?: ResearchEvent[];
  expectationSnapshots?: EarningsExpectationSnapshot[];
  industryEvents?: IndustryChangeEvent[];
  now?: Date;
  timeZone?: string;
  inboxSourceNotice?: string;
  onOpenStock: (stock: Stock) => void;
  onStartReview?: (item: WatchItem) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
}

export interface ResearchWorkbenchProps extends ResearchWorkspaceDataProps {
  onNavigate: (destination: ResearchDestination) => void;
  onOpenKnowledge: () => void;
  onOpenTasks: () => void;
  onResearchQuery?: (query: string) => void;
  onOpenSources?: () => void;
}

/** A view of the existing owners. This page creates no tasks or reading history. */
export function ResearchWorkbench({ stocks, watchItems = [], tasks = [], inboxSourceNotice, onNavigate, onOpenStock, onStartReview, onOpenKnowledge, onOpenTasks, onResearchQuery, onOpenSources }: ResearchWorkbenchProps) {
  const [question, setQuestion] = useState("");
  const watched = watchItems.filter(item => !item.archivedAt);
  const pending = tasks.filter(task => task.status === "pending");

  return <section className="ui-v2-workbench" aria-label="工作台">
    <header className="ui-v2-hero">
      <div className="ui-v2-overline">研究工作台</div>
      <h1>从一个问题，开始研究。</h1>
      <p>补齐基础知识，连接产业与公司，把新资料变成可持续更新的认识。</p>
      <form className="ui-v2-questionbox" onSubmit={event => { event.preventDefault(); const query = question.trim(); if (query && onResearchQuery) onResearchQuery(query); else onNavigate("个股池"); }}>
        <Search aria-hidden="true" size={20} />
        <input aria-label="输入研究主题" placeholder="输入你感兴趣的行业、公司或问题" maxLength={120} value={question} onChange={event => setQuestion(event.target.value)} />
        <button type="submit" className="ui-v2-workbench-button ui-v2-primary">开始研究 <ArrowRight aria-hidden="true" size={20} /></button>
      </form>
      <div className="ui-v2-input-caption">
        {onOpenSources ? <button type="button" onClick={onOpenSources}><Upload aria-hidden="true" size={20} />添加资料</button> : null}
        <span>当前支持公司研究池检索</span><span>正式更新需本人审核</span>
      </div>
    </header>

    <div className="ui-v2-home-grid">
      <section aria-labelledby="workbench-continue-title" className="ui-v2-home-main">
        <div className="ui-v2-sectiontitle"><h2 id="workbench-continue-title">继续研究</h2><button type="button" className="ui-v2-workbench-text" onClick={() => onNavigate("观察清单")}>全部观察 <ArrowRight aria-hidden="true" size={20} /></button></div>
        <div className="ui-v2-panel">
          {watched.length ? <ul>{watched.slice(0, 5).map(item => {
            const stock = stocks.find(value => value.id === item.stockId);
            return <li key={item.id}><button type="button" className="ui-v2-listitem" aria-label={stock ? `继续研究：${stock.name}` : "查看观察记录"} onClick={() => stock ? onOpenStock(stock) : onNavigate("观察清单")}>
              <span className="ui-v2-listicon"><BookOpen aria-hidden="true" size={20} /></span>
              <span className="ui-v2-listbody"><strong>{stock ? `${stock.name} · ${stock.code}` : "研究对象未载入"}</strong><span>{item.thesis || "尚未记录研究论点，可继续补充验证条件。"}</span></span>
              <span className="ui-v2-workbench-badge">{item.status}</span><ChevronRight className="ui-v2-rightchev" aria-hidden="true" size={20} />
            </button></li>;
          })}</ul> : <div className="ui-v2-home-empty"><BookOpen aria-hidden="true" size={33} /><h3>从你的第一项研究开始</h3><p>尚无未归档的观察项。选择研究对象后，可沿用观察清单记录论点与验证条件。</p></div>}
        </div>
        <p className="ui-v2-inline-note">来自当前观察清单，保留原有排列；不代表最近阅读顺序。</p>
        <section className="ui-v2-home-spaced" aria-labelledby="workbench-path-title">
          <div className="ui-v2-sectiontitle"><h2 id="workbench-path-title">研究路径</h2></div>
          <div className="ui-v2-home-paths">
            <button type="button" className="ui-v2-panel ui-v2-panel-pad ui-v2-path" onClick={() => onNavigate("宏观")}><span><strong>从宏观到产业</strong><ArrowRight aria-hidden="true" size={20} /></span><p>从指标变化提出问题，再到行业中验证影响。</p></button>
            <button type="button" className="ui-v2-panel ui-v2-panel-pad ui-v2-path" onClick={() => onNavigate("个股池")}><span><strong>从产业到公司</strong><ArrowRight aria-hidden="true" size={20} /></span><p>按业务角色、产品能力与证据进行比较。</p></button>
          </div>
        </section>
      </section>
      <aside className="ui-v2-home-side">
        <section aria-labelledby="workbench-pending-title">
          <div className="ui-v2-sectiontitle"><h2 id="workbench-pending-title">待我处理</h2><span className="ui-v2-workbench-badge ui-v2-badge-outline">{pending.length} 项复盘</span></div>
          <div className="ui-v2-panel ui-v2-panel-pad">
            <span className="ui-v2-overline">研究复盘</span>
            {inboxSourceNotice ? <p role="status" className="ui-v2-home-source-notice">{inboxSourceNotice}</p> : null}
            {pending.length ? pending.slice(0, 2).map(task => {
              const item = watchItems.find(value => value.id === task.watchItemId && !value.archivedAt);
              return <div key={task.id} className="ui-v2-taskcall"><h3>{task.title}</h3><p>待处理 · 计划日期：{task.dueAt ?? "未提供"}</p>{item && onStartReview ? <button type="button" className="ui-v2-workbench-text" onClick={() => onStartReview(item)}>开始复盘 <ArrowRight aria-hidden="true" size={20} /></button> : null}</div>;
            }) : <div className="ui-v2-taskcall"><h3>当前没有待处理复盘</h3><p>仅统计已载入的复盘任务。事件核验与知识待审稿在任务页分别查看。</p></div>}
            {pending.length > 2 ? <p className="ui-v2-inline-note">另有 {pending.length - 2} 项待处理。</p> : null}
            <button type="button" className="ui-v2-workbench-button ui-v2-button-small" onClick={onOpenTasks}>打开任务 <ArrowRight aria-hidden="true" size={20} /></button>
          </div>
        </section>
        <section aria-labelledby="workbench-reading-title" className="ui-v2-home-spaced">
          <div className="ui-v2-sectiontitle"><h2 id="workbench-reading-title">最近阅读</h2></div>
          <p className="ui-v2-reading-empty">当前尚未记录阅读历史。可前往知识库查看已有条目和修订历史。</p>
          <button type="button" className="ui-v2-linkline" onClick={onOpenKnowledge}>打开知识库 <ArrowRight aria-hidden="true" size={20} /></button>
          <p className="ui-v2-inline-note">证据在需要时展开。技术标识不占用正文阅读空间。</p>
        </section>
      </aside>
    </div>
  </section>;
}

export interface TaskWorkspaceProps extends ResearchWorkspaceDataProps {
  onOpenReview: () => void;
}

export function TaskWorkspace({ stocks, watchItems = [], tasks = [], events = [], expectationSnapshots, industryEvents, now, timeZone = "Asia/Shanghai", inboxSourceNotice, onOpenStock, onStartReview, onOpenEvent, onOpenReview }: TaskWorkspaceProps) {
  const displayNow = useDisplayNow(now);
  return <section className="ui-v2-task-workspace space-y-5" aria-label="任务工作区">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-borderSoft pb-5">
      <div><h1 className="text-2xl font-semibold">任务</h1><p className="mt-2 text-sm leading-6 text-textMuted">处理复盘提醒、核验证据，以及阅读和审核知识稿件。</p></div>
      <button type="button" className="inbox-action" onClick={onOpenReview}>打开知识待审</button>
    </header>
    <ResearchInbox stocks={stocks} watchItems={watchItems} tasks={tasks} events={events} expectationSnapshots={expectationSnapshots} industryEvents={industryEvents} now={displayNow} timeZone={timeZone} sourceNotice={inboxSourceNotice} onOpenStock={onOpenStock} onStartReview={onStartReview} onOpenEvent={onOpenEvent} />
  </section>;
}
