import { useMemo, useState } from "react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import { buildResearchInbox, type ResearchInboxItem } from "../../services/researchInbox";
import { getCalendarToday } from "../../utils/dateTime";
import { auditDisplayText } from "../../utils/displayLabels";
import { EvidenceDrawer } from "../research/EvidenceDrawer";
import { ResearchEventStatusBadge } from "../research/ResearchEventEvidence";
import { industryEventAudit, type IndustryChangeEvent } from "../../services/industrySignals";
import { IndustryChangeSummary } from "../industry/IndustryChangePanel";
import "./ResearchInbox.css";

export type ResearchDataState = "ready" | "loading" | "error" | "locked";
export interface ResearchInboxProps {
  events: ResearchEvent[]; tasks: ReviewTask[]; watchItems: WatchItem[]; stocks: Stock[];
  now: Date; timeZone: string;
  sourceNotice?: string; dataState?: ResearchDataState; dataMessage?: string;
  mode?: "research" | "review" | "verification";
  initialLimit?: number; compact?: boolean; onOpenAll?: () => void;
  expectationSnapshots?: EarningsExpectationSnapshot[]; industryEvents?: IndustryChangeEvent[];
  onOpenStock: (stock: Stock) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
  onStartReview?: (item: WatchItem) => void;
}

/** Display composition only: the existing projection retains ordering and grouping. */
export function ResearchInbox({ events, industryEvents, tasks, watchItems, stocks, now, timeZone, sourceNotice, dataState = "ready", dataMessage, mode = "research", initialLimit = 8, compact = false, onOpenAll, expectationSnapshots, onOpenStock, onOpenEvent, onStartReview }: ResearchInboxProps) {
  const rows = useMemo(() => buildResearchInbox({ events, industryEvents, tasks, watchItems, now, timeZone }), [events, industryEvents, tasks, watchItems, now, timeZone]);
  const [selection, setSelection] = useState<string | null>(null);
  const [limit, setLimit] = useState(6), [recentLimit, setRecentLimit] = useState(initialLimit);
  const [allDates, setAllDates] = useState(mode === "verification");
  const selected = rows.find(row => row.id === selection);
  const today = getCalendarToday(now, timeZone);
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const pending = rows.filter(row => row.tasks.length > 0);
  const unlinkedEvents = rows.filter(row => row.tasks.length === 0);
  const recent = unlinkedEvents.filter(row => allDates || (row.date && row.date >= cutoffDate && row.date <= today));
  const outsideWindow = unlinkedEvents.length - recent.length;
  const showPending = mode === "review" || (mode === "research" && !compact && pending.length > 0);
  const showEvents = mode !== "review";
  const hasTwoTracks = showPending && showEvents && pending.length > 0 && recent.length > 0;

  function renderTask(row: ResearchInboxItem) {
    const stock = stocks.find(value => value.id === row.stockId);
    return <article key={row.id} data-inbox-id={row.id} className="inbox-review-row">
      <div className="inbox-review-content"><h4>{stock?.name ?? row.events[0]?.stockName ?? "研究对象未解析"}</h4><p>{row.tasks[0]?.title}</p><span className="inbox-secondary">最早任务日期：{row.date ?? "未提供"} · 待处理 {row.tasks.length} 项</span>
        {!row.events.length ? <p className="text-warning">未提供关联事件证据；任务提醒不代表公司新披露。</p> : null}
        {row.unresolvedEventIds.length ? <p className="text-warning">{row.unresolvedEventIds.length} 个关联事件未提供或公司不匹配</p> : null}
      </div>
      <div className="inbox-row-actions"><button type="button" className="inbox-action" aria-label={`查看证据：${stock?.name ?? row.id}`} onClick={() => setSelection(row.id)}>查看证据</button>{row.watchItem && onStartReview ? <button type="button" className="inbox-action" onClick={() => onStartReview(row.watchItem!)}>开始复盘</button> : null}</div>
    </article>;
  }
  function renderEvent(row: ResearchInboxItem) {
    if (row.industryEvent) return <article role="row" key={row.id} data-inbox-id={row.id} className="inbox-industry-row"><div role="cell" aria-colspan={5}><IndustryChangeSummary event={row.industryEvent} onOpenEvidence={() => setSelection(row.id)} /><a className="inbox-action" href={`#/industry?industry=${encodeURIComponent(row.industryEvent.industryId)}`}>打开对应行业 / 指标</a></div></article>;
    const event = row.events[0]; if (!event) return null;
    const stock = stocks.find(value => value.id === row.stockId);
    return <article role="row" key={row.id} data-inbox-id={row.id} className="inbox-event-row">
      <div role="cell" className="inbox-event-date"><span className="inbox-mobile-label">记录事件日期</span>{row.date ?? "未提供"}</div>
      <div role="cell" className="inbox-event-company">{stock?.name ?? event.stockName ?? "研究对象未解析"}</div>
      <div role="cell" className="inbox-event-content"><span className="inbox-event-title">{event.title}</span>{event.reviewStatus === "pending" ? <span className="inbox-secondary">待复盘</span> : null}{event.reviewReasons.length ? <p className="inbox-event-limit text-warning">{event.reviewReasons.map(auditDisplayText).join("；")}</p> : null}</div>
      <div role="cell" className="inbox-event-status"><ResearchEventStatusBadge event={event} />{!row.date ? <span className="text-warning">日期未知</span> : null}</div>
      <div role="cell" className="inbox-row-actions"><button type="button" className="inbox-action" aria-label={`查看证据：${stock?.name ?? row.id}`} onClick={() => setSelection(row.id)}>查看</button></div>
    </article>;
  }
  const title = mode === "review" ? "研究复盘" : mode === "verification" ? "事件核验" : "近期研究事件";
  return <section className={`research-inbox ${compact ? "is-compact" : ""}`} aria-label="研究收件箱" data-state={dataState} data-mode={mode}>
    <div className="inbox-toolbar"><h2>{title}</h2>{onOpenAll ? <button type="button" className="inbox-action" onClick={onOpenAll}>查看全部研究</button> : null}{dataState === "ready" && !compact ? <details className="inbox-scope"><summary>排序与数据范围</summary><div><p>逾期任务 → 今日任务 → 其他待处理任务 → 待复盘事件 → 近期变化。各组按原始严重程度 / 影响程度、任务日期升序或事件日期降序、稳定标识排序。同一观察项合并展示所有待处理任务。</p><p>{mode === "verification" ? "核验队列采用原有数据核验规则，包含符合条件的任务关联事件，不等于全部普通事件。" : "已关联任务的事件不重复列出，包括已确认、忽略和稍后处理的任务。"}</p><p>行业日期为原记录标注发布时间，不证明公开可得时间；其他事件日期可能为报告期。更新、检测与记录时间不作为新事件日期。历史时点可得性与准入仍须独立核验。</p><p>{today} · {timeZone} · 当前已载入范围；不是实时新闻或投资评分。</p></div></details> : null}</div>
    {sourceNotice ? <p role="status" className="inbox-source-notice">{sourceNotice}</p> : null}
    {dataState !== "ready" ? <p role={dataState === "error" || dataState === "locked" ? "alert" : "status"} className="inbox-empty">{dataMessage ?? ({ loading: "正在载入研究数据，尚不能确定队列数量。", error: "研究数据读取失败，当前范围不完整。", locked: "研究数据已锁定，请先处理存储或权限问题。" })[dataState]}</p> : <>
      <div className={`inbox-tracks ${hasTwoTracks ? "has-review-track" : ""}`} data-columns={hasTwoTracks ? "2" : "1"}>
        {showPending ? <section aria-label="待处理事项" className="inbox-review-track"><h3>研究复盘 <span>{pending.length} 个观察项 · {pending.reduce((sum, row) => sum + row.tasks.length, 0)} 项任务</span></h3>{pending.slice(0, limit).map(renderTask)}{!pending.length ? <p className="inbox-empty">暂无待处理研究任务。后续复盘提醒会在这里显示。</p> : null}{pending.length > limit ? <button type="button" className="inbox-action" onClick={() => setLimit(value => value + 6)}>显示更多待处理（剩余 {pending.length - limit}）</button> : null}</section> : null}
        {showEvents ? <section aria-label="近期变化" className="inbox-events-track">
          <div className="inbox-event-controls"><p className="inbox-range">显示 {Math.min(recentLimit, recent.length)} / {recent.length} 项 · {mode === "verification" ? "核验队列" : "未合并事件"}共 {unlinkedEvents.length} 项</p>{!compact ? <label>日期范围<select value={allDates ? "all" : "30"} onChange={event => { setAllDates(event.target.value === "all"); setRecentLimit(initialLimit); }}><option value="30">近 30 天</option><option value="all">全部日期（含未知）</option></select></label> : null}</div>
          <div role="table" aria-label={mode === "verification" ? "事件核验列表" : "研究事件列表"} className="inbox-event-table"><div role="row" className="inbox-event-header"><span role="columnheader">记录事件日期</span><span role="columnheader">公司</span><span role="columnheader">标题与限制</span><span role="columnheader">数据 / 核验状态</span><span role="columnheader">查看</span></div>{recent.slice(0, recentLimit).map(renderEvent)}</div>
          {!recent.length ? <p className="inbox-empty">{unlinkedEvents.length ? "此日期范围没有未合并研究事件。任务关联事件已归入复盘事项；可切换全部日期查看历史记录与未知日期。" : mode === "verification" ? "当前已载入范围内没有需数据核验的事件。" : "当前已载入范围内没有未合并研究事件。"}</p> : null}
          {outsideWindow > 0 ? <p className="inbox-range text-warning">另有 {outsideWindow} 条记录不在近 30 天范围（含历史、未来或日期未知）{compact ? "，进入研究查看完整范围。" : "，可切换全部日期核对。"}</p> : null}
          {recent.length > recentLimit && !compact ? <button type="button" className="inbox-action" onClick={() => setRecentLimit(value => value + initialLimit)}>显示更多事件（剩余 {recent.length - recentLimit}）</button> : null}
        </section> : null}
      </div>
      {selection ? selected ? selected.industryEvent ? <EvidenceDrawer audit={industryEventAudit(selected.industryEvent)} onClose={() => setSelection(null)} /> : <EvidenceDrawer expectationSnapshots={expectationSnapshots} key={selected.id} events={selected.events} tasks={selected.tasks} watchItem={selected.watchItem} unresolvedEventIds={selected.unresolvedEventIds} stocks={stocks} onClose={() => setSelection(null)} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent} onStartReview={onStartReview} /> : <p role="status">所选事项已不在当前结果中。<button className="inbox-action" onClick={() => setSelection(null)}>关闭选择</button></p> : null}
    </>}
  </section>;
}
