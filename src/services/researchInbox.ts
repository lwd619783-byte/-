import type { ResearchEvent, ReviewTask, WatchItem } from "../types";
import { getCalendarToday, getTemporalCalendarDate, isPreciseInstant, resolveSafeWorkflowTimeZone } from "../utils/dateTime";
import { deduplicateIndustryEvents, type IndustryChangeEvent } from './industrySignals';

/** Ephemeral projection. References stay owned by the existing event/task/watch stores. */
export interface ResearchInboxItem {
  id: string;
  watchItem?: WatchItem;
  tasks: ReviewTask[];
  events: ResearchEvent[];
  industryEvent?: IndustryChangeEvent;
  unresolvedEventIds: string[];
  stockId: string | null;
  bucket: "overdue" | "due" | "pending" | "event_pending" | "recent";
  reason: string;
  date: string | null;
  severity: number;
}

const severity = { high: 3, medium: 2, low: 1, unknown: 0 };
const bucketOrder = { overdue: 0, due: 1, pending: 2, event_pending: 3, recent: 4 };
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function inboxCalendarDate(value: string | null | undefined, timeZone: string): string | null {
  return value ? getTemporalCalendarDate(value, isPreciseInstant(value) ? "datetime" : "date", timeZone) : null;
}

// Audit/detection/update clocks never make an old business event a new occurrence.
export function inboxEventDate(event: ResearchEvent, timeZone: string) {
  return inboxCalendarDate(event.eventOccurredAt ?? event.eventBusinessDate ?? event.eventDate, timeZone);
}

export function buildResearchInbox({ events, industryEvents = [], tasks, watchItems, now, timeZone: requestedTimeZone }: {
  events: ResearchEvent[]; industryEvents?: IndustryChangeEvent[]; tasks: ReviewTask[]; watchItems: WatchItem[]; now: Date; timeZone: string;
}): ResearchInboxItem[] {
  const timeZone = resolveSafeWorkflowTimeZone(requestedTimeZone);
  const today = getCalendarToday(now, timeZone);
  const eventById = new Map(events.map(event => [event.id, event]));
  const watchById = new Map(watchItems.map(item => [item.id, item]));
  const groups = new Map<string, ReviewTask[]>();
  const referenced = new Set<string>();
  for (const task of new Map(tasks.map(task => [task.id, task])).values()) {
    const watch = watchById.get(task.watchItemId);
    if (watch?.archivedAt) continue;
    // Acknowledged/dismissed/snoozed tasks must not reappear as pending event reminders.
    for (const id of task.relatedEventIds) {
      if (watch && eventById.get(id)?.stockId === watch.stockId) referenced.add(id);
    }
    if (task.status !== "pending") continue;
    groups.set(task.watchItemId, [...(groups.get(task.watchItemId) ?? []), task]);
  }
  const rows: ResearchInboxItem[] = [];
  for (const [watchId, group] of groups) {
    const watchItem = watchById.get(watchId);
    const sorted = [...group].sort((a, b) => severity[b.severity] - severity[a.severity]
      || compareId(inboxCalendarDate(a.dueAt, timeZone) ?? "9999", inboxCalendarDate(b.dueAt, timeZone) ?? "9999") || compareId(a.id, b.id));
    const ids = [...new Set(sorted.flatMap(task => task.relatedEventIds))].sort(compareId);
    const related = ids.flatMap(id => { const event = eventById.get(id); return event && event.stockId === watchItem?.stockId ? [event] : []; });
    const unresolvedEventIds = ids.filter(id => !related.some(event => event.id === id));
    const date = sorted.map(task => inboxCalendarDate(task.dueAt, timeZone)).filter((date): date is string => date !== null).sort(compareId)[0] ?? null;
    const bucket = date && date < today ? "overdue" : date === today ? "due" : "pending";
    rows.push({ id: `watch:${watchId}`, watchItem, tasks: sorted, events: related, unresolvedEventIds,
      stockId: watchItem?.stockId ?? null, bucket, date, severity: Math.max(...sorted.map(task => severity[task.severity])),
      reason: `${({ overdue: "任务日期已逾期", due: "任务日期为今天", pending: "已有待处理任务" })[bucket]} · ${sorted.length} 项任务合并展示` });
  }
  for (const event of eventById.values()) {
    if (referenced.has(event.id)) continue;
    const watchItem = [...watchById.values()].filter(watch => watch.stockId === event.stockId && !watch.archivedAt).sort((a, b) => compareId(a.id, b.id))[0];
    rows.push({ id: `event:${event.id}`, watchItem, tasks: [], events: [event], unresolvedEventIds: [], stockId: event.stockId,
      bucket: event.reviewStatus === "pending" ? "event_pending" : "recent", date: inboxEventDate(event, timeZone), severity: severity[event.materiality],
      reason: event.reviewStatus === "pending" ? "事件原状态：待复盘；当前无关联任务" : "研究事件变化；当前无关联任务" });
  }
  for (const event of deduplicateIndustryEvents(industryEvents)) {
    rows.push({ id: `industry:${event.id}`, industryEvent: event, tasks: [], events: [], unresolvedEventIds: [], stockId: null,
      bucket: 'recent', date: inboxCalendarDate(event.publicationDateTime, timeZone), severity: 0,
      reason: '正式行业指标留存变化 · 同一发布合并展示 · 来源核对预览' });
  }
  return rows.sort((a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || b.severity - a.severity
    || (a.tasks.length && b.tasks.length ? compareId(a.date ?? "9999", b.date ?? "9999") : compareId(b.date ?? "", a.date ?? "")) || compareId(a.id, b.id));
}
