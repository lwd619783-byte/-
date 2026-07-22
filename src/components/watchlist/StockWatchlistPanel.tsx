import { Binoculars, ExternalLink, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { ResearchEvent, ReviewEntry, ReviewTask, WatchItem } from "../../types";
import { ReviewTimeline } from "./ReviewTimeline";

interface StockWatchlistPanelProps {
  activeItem?: WatchItem;
  archivedItem?: WatchItem;
  tasks: ReviewTask[];
  entries: ReviewEntry[];
  events: ResearchEvent[];
  onAdd: () => void;
  onEdit: (item: WatchItem) => void;
  onStartReview: (item: WatchItem) => void;
  onCorrectReview?: (entry: ReviewEntry) => void;
  onRestore: (item: WatchItem) => void;
}

export function StockWatchlistPanel({ activeItem, archivedItem, tasks, entries, events, onAdd, onEdit, onStartReview, onCorrectReview, onRestore }: StockWatchlistPanelProps) {
  if (!activeItem) return <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4"><p className="inline-flex items-center gap-2 text-sm font-semibold text-textStrong"><Binoculars className="h-4 w-4 text-cyan" />尚未加入观察清单</p><p className="mt-2 text-sm text-textMuted">加入后可记录投资假设、接收只读事件提醒并形成复盘时间线。</p>{archivedItem ? <button type="button" onClick={() => onRestore(archivedItem)} className="mt-3 inline-flex h-9 items-center gap-2 rounded border border-cyan/50 px-3 text-sm text-cyan"><RotateCcw className="h-4 w-4" />恢复已归档观察项</button> : <button type="button" onClick={onAdd} className="mt-3 inline-flex h-9 items-center gap-2 rounded border border-cyan/50 px-3 text-sm text-cyan"><Plus className="h-4 w-4" />加入观察清单</button>}</div>;
  const pending = tasks.filter((task) => task.watchItemId === activeItem.id && task.status === "pending");
  return <div className="space-y-4">
    <div className="rounded-lg border border-cyan/25 bg-cyan/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-textMuted">当前观察状态</p><p className="mt-1 text-lg font-semibold text-textStrong">{activeItem.status} · {priorityLabel(activeItem.priority)}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(activeItem)} className={buttonClass}>编辑元数据</button><button type="button" onClick={() => onStartReview(activeItem)} className={`${buttonClass} border-cyan/50 text-cyan`}><RefreshCw className="h-4 w-4" />开始复盘</button></div></div><p className="mt-3 whitespace-pre-wrap break-words text-sm text-textMuted">{activeItem.thesis || "未填写投资假设"}</p><p className="mt-2 text-xs text-textMuted">下一次复盘：{activeItem.nextReviewAt ?? "未设置"} · 待处理任务：{pending.length}</p></div>
    {pending.length ? <div className="space-y-2"><h4 className="text-sm font-semibold text-textStrong">当前待处理复盘任务</h4>{pending.map((task) => <article key={task.id} className="rounded border border-warning/30 bg-warning/10 p-3"><p className="text-sm text-textStrong">{task.title}</p><p className="mt-1 break-words text-xs text-textMuted">{task.description}</p>{task.relatedEventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is ResearchEvent => Boolean(event)).map((event) => <div key={event.id} className="mt-2 text-xs"><p className="text-textMuted">{event.expectation?.ingestionMethod === "provider" ? `公司官方指引 · Provider ${event.expectation.providerVersion ?? "-"} · 只读` : event.sourceName}</p>{event.sourceUrl || event.pdfUrl ? <a href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-cyan"><ExternalLink className="h-3 w-3" />{event.expectation?.ingestionMethod === "provider" ? "巨潮官方公告" : event.sourceName}</a> : null}</div>)}</article>)}</div> : null}
    <div><h4 className="mb-3 text-sm font-semibold text-textStrong">复盘时间线</h4><ReviewTimeline entries={entries.filter((entry) => entry.watchItemId === activeItem.id)} events={events} onCorrect={onCorrectReview} /></div>
  </div>;
}

const buttonClass = "inline-flex h-9 items-center gap-2 rounded border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan";
function priorityLabel(value: WatchItem["priority"]) { return ({ high: "高优先级", medium: "中优先级", low: "低优先级" })[value]; }
