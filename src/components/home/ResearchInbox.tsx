import { useMemo, useState } from "react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import { buildResearchInbox, type ResearchInboxItem } from "../../services/researchInbox";
import { getCalendarToday } from "../../utils/dateTime";
import { DashboardCard } from "../common/terminal";
import { EvidenceDrawer } from "../research/EvidenceDrawer";
import { ResearchEventStatusBadge } from "../research/ResearchEventEvidence";
import { industryEventAudit, type IndustryChangeEvent } from '../../services/industrySignals';
import { IndustryChangeSummary } from '../industry/IndustryChangePanel';

interface ResearchInboxProps {
  events: ResearchEvent[]; tasks: ReviewTask[]; watchItems: WatchItem[]; stocks: Stock[];
  now: Date; timeZone: string;
  sourceNotice?: string;
  expectationSnapshots?: EarningsExpectationSnapshot[];
  industryEvents?: IndustryChangeEvent[];
  onOpenStock: (stock: Stock) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
  onStartReview?: (item: WatchItem) => void;
}

export function ResearchInbox({ events, industryEvents, tasks, watchItems, stocks, now, timeZone, sourceNotice, expectationSnapshots, onOpenStock, onOpenEvent, onStartReview }: ResearchInboxProps) {
  const rows = useMemo(() => buildResearchInbox({ events, industryEvents, tasks, watchItems, now, timeZone }), [events, industryEvents, tasks, watchItems, now, timeZone]);
  const [selection, setSelection] = useState<string | null>(null);
  const [limit, setLimit] = useState(6);
  const [recentLimit, setRecentLimit] = useState(4);
  const [allDates, setAllDates] = useState(false);
  const selected = rows.find(row => row.id === selection);
  const today = getCalendarToday(now, timeZone);
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const pending = rows.filter(row => row.tasks.length > 0);
  const unlinkedEvents = rows.filter(row => row.tasks.length === 0);
  const recent = unlinkedEvents.filter(row => allDates || (row.date && row.date >= cutoffDate && row.date <= today));
  const outsideWindow = unlinkedEvents.length - recent.length;

  function renderItem(row: ResearchInboxItem) {
    if (row.industryEvent) return <article key={row.id} data-inbox-id={row.id} className="inbox-item">
      <IndustryChangeSummary event={row.industryEvent} onOpenEvidence={() => setSelection(row.id)} />
      <a className="inbox-action mt-3 inline-flex" href={`#/industry?industry=${encodeURIComponent(row.industryEvent.industryId)}`}>打开对应行业 / 指标</a>
    </article>;
    const stock = stocks.find(stock => stock.id === row.stockId);
    return <article key={row.id} data-inbox-id={row.id} className="inbox-item">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="min-w-0 break-words font-semibold">{stock?.name ?? row.events[0]?.stockName ?? "研究对象未解析"}</h4><span className="text-xs text-warning">{row.tasks.length ? `待处理 ${row.tasks.length}` : row.events[0]?.reviewStatus === "pending" ? "待核验" : "研究事件"}</span></div>
      <p className="mt-1 text-xs leading-5 text-textMuted">{row.reason}</p>
      <p className="text-xs leading-5 text-textMuted">{row.tasks.length ? "最早任务日期" : "记录事件日期"}：{row.date ?? "未提供"} · {row.tasks.length ? "任务严重程度" : "事件原始影响程度"}：{({ 0: "未知", 1: "低", 2: "中", 3: "高" })[row.severity as 0 | 1 | 2 | 3]}</p>
      {row.tasks.slice(0, 2).map(task => <p key={task.id} className="mt-2 text-sm">{task.title}</p>)}
      {row.tasks.length > 2 ? <p className="mt-1 text-xs text-textMuted">另有 {row.tasks.length - 2} 项任务，打开证据查看全部原因</p> : null}
      <div className="mt-2 space-y-2">{row.events.slice(0, 2).map(event => <div key={event.id}><p className="break-words text-sm">{event.title}</p><div className="mt-1 flex flex-wrap items-center gap-2"><ResearchEventStatusBadge event={event} /><span className="break-words text-xs text-textMuted">{event.sourceName || "来源未提供"}</span></div></div>)}</div>
      {row.events.length > 2 ? <p className="mt-2 text-xs text-textMuted">另有 {row.events.length - 2} 条关联证据</p> : null}
      {!row.events.length ? <p className="mt-2 text-xs text-warning">未提供关联事件证据；任务提醒不代表公司新披露。</p> : null}
      {row.unresolvedEventIds.length ? <p className="mt-2 text-xs text-warning">{row.unresolvedEventIds.length} 个关联事件未提供或公司不匹配</p> : null}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="inbox-action" aria-label={`查看证据：${stock?.name ?? row.id}`} onClick={() => setSelection(row.id)}>查看证据</button>{row.watchItem && onStartReview ? <button type="button" className="inbox-action" onClick={() => onStartReview(row.watchItem!)}>开始复盘</button> : null}</div>
    </article>;
  }
  return <DashboardCard className="home-priorities p-4" >
    <section aria-label="研究收件箱">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">研究收件箱</h2><p className="mt-1 text-xs leading-5 text-textMuted">{today} · {timeZone} · 待处理与近期变化，点击证据继续研究。</p></div><span className="text-xs text-textMuted">已有任务关联事件已合并</span></div>
      {sourceNotice ? <p role="status" className="mt-3 rounded-md border border-warning/40 p-3 text-sm text-warning">{sourceNotice}</p> : null}
      <details className="mt-3 text-xs leading-6 text-textMuted"><summary className="cursor-pointer">排序与数据范围</summary><p>逾期任务 → 今日任务 → 其他待处理任务 → 待复盘事件 → 近期变化；左栏仅列已有待处理任务；右栏列未合并事件，默认近 30 天。各组按原始严重程度 / 影响程度、任务日期升序或事件日期降序、稳定标识排序。同一观察项合并展示所有待处理任务。已关联任务的事件不重复列出，包括已确认、忽略和稍后处理的任务。</p><p>行业事件按页面标注发布时间筛选，该日期不代表 公开可得时间；同一发布的正式指标合并展示。其他日期沿用原事件记录；财务摘要可能使用报告期，更新 / 检测时间不作为新事件日期。此处是当前已载入数据的研究提醒，不是实时新闻或投资评分。历史时点可得性（PIT） 与准入须在证据中单独核验。</p></details>
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <section aria-label="待处理事项"><h3 className="mb-3 font-semibold">今日优先事项 <span className="text-sm text-textMuted">{pending.length} 项</span></h3>
          <div className="space-y-3">{pending.slice(0, limit).map(renderItem)}</div>
          {!pending.length ? <p className="py-4 text-sm text-textMuted"><span>暂无待处理研究任务。</span> 其他事件的核验状态见右侧研究事件。</p> : null}
          {pending.length > limit ? <button type="button" className="inbox-action mt-3" onClick={() => setLimit(value => value + 6)}>显示更多待处理（剩余 {pending.length - limit}）</button> : null}
        </section>
        <section aria-label="近期变化"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">最近研究事件 <span className="text-sm text-textMuted">{recent.length} 项</span></h3><label className="text-xs text-textMuted">日期范围<select className="ml-2 min-h-11" value={allDates ? "all" : "30"} onChange={event => { setAllDates(event.target.value === "all"); setRecentLimit(4); }}><option value="30">近 30 天</option><option value="all">全部日期（含未知）</option></select></label></div>
          <div className="space-y-3">{recent.slice(0, recentLimit).map(renderItem)}</div>
          {!recent.length ? <p className="py-4 text-sm leading-6 text-textMuted">此日期范围没有未合并研究事件。任务关联事件已归入复盘事项；可切换全部日期查看历史记录与未知日期。</p> : null}
          {outsideWindow > 0 ? <p className="mt-3 text-xs leading-6 text-warning">另有 {outsideWindow} 条记录不在近 30 天范围（含历史、未来或日期未知），可切换全部日期核对。</p> : null}
          {recent.length > recentLimit ? <button type="button" className="inbox-action mt-3" onClick={() => setRecentLimit(value => value + 4)}>显示更多事件（剩余 {recent.length - recentLimit}）</button> : null}
        </section>
      </div>
      {selection ? selected ? selected.industryEvent ? <EvidenceDrawer audit={industryEventAudit(selected.industryEvent)} onClose={() => setSelection(null)} /> : <EvidenceDrawer expectationSnapshots={expectationSnapshots} key={selected.id} events={selected.events} tasks={selected.tasks} watchItem={selected.watchItem} unresolvedEventIds={selected.unresolvedEventIds} stocks={stocks} onClose={() => setSelection(null)} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent} onStartReview={onStartReview} /> : <p role="status" className="mt-3 text-warning">所选事项已不在当前结果中。<button className="inbox-action" onClick={() => setSelection(null)}>关闭选择</button></p> : null}
    </section>
  </DashboardCard>;
}
