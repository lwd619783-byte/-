import { Archive, BellRing, CalendarClock, DatabaseBackup, Edit3, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { ImportValidationResult } from "../../services/watchlistRepository";
import type { Industry, ResearchEvent, ReviewEntry, ReviewTask, Stock, WatchItem } from "../../types";
import { getIndustryName } from "../../utils/filters";
import { DashboardCard, EmptyState, KpiCard, TextClamp } from "../common/terminal";
import { ReviewTimeline } from "./ReviewTimeline";
import { WatchlistBackupModal } from "./WatchlistBackupModal";

interface WatchlistTabProps {
  watchItems: WatchItem[];
  samples: WatchItem[];
  reviewEntries: ReviewEntry[];
  tasks: ReviewTask[];
  stocks: Stock[];
  industries: Industry[];
  events?: ResearchEvent[];
  storageError?: string | null;
  corruptedRaw?: string | null;
  exportJson: string;
  onValidateImport: (raw: string) => ImportValidationResult;
  onMergeImport: (raw: string) => void;
  onReplaceImport: (raw: string) => void;
  onReset: () => void;
  onAdd: () => void;
  onEdit: (item: WatchItem) => void;
  onStartReview: (item: WatchItem) => void;
  onCorrectReview: (entry: ReviewEntry) => void;
  onArchive: (item: WatchItem) => void;
  onRestore: (item: WatchItem) => void;
  onLoadSample: (sample: WatchItem) => void;
  onLoadAllSamples: () => void;
  onTaskState: (taskId: string, status: "acknowledged" | "dismissed" | "snoozed", snoozedUntil?: string | null) => void;
  onOpenStock: (stock: Stock) => void;
}

type SortMode = "priority" | "review" | "event" | "updated" | "company";

export function WatchlistTab(props: WatchlistTabProps) {
  const { watchItems, samples, reviewEntries, tasks, stocks, industries, events = [] } = props;
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [tag, setTag] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [newEventOnly, setNewEventOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState<SortMode>("priority");
  const [timelineItemId, setTimelineItemId] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const today = todayString();
  const active = watchItems.filter((item) => !item.archivedAt);
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const overdueIds = new Set(active.filter((item) => item.nextReviewAt && item.nextReviewAt < today).map((item) => item.id));
  const newEventIds = new Set(pendingTasks.filter((task) => task.relatedEventIds.length > 0).map((task) => task.watchItemId));
  const archivedCount = watchItems.length - active.length;
  const tags = [...new Set(watchItems.flatMap((item) => item.tags))].sort();

  const rows = useMemo(() => watchItems
    .map((item) => ({ item, stock: stocks.find((stock) => stock.id === item.stockId) }))
    .filter((row): row is { item: WatchItem; stock: Stock } => Boolean(row.stock))
    .filter(({ item, stock }) => {
      if (!includeArchived && item.archivedAt) return false;
      if (company && !`${stock.name}${stock.code}`.toLowerCase().includes(company.toLowerCase())) return false;
      if (industry !== "all" && stock.industryId !== industry) return false;
      if (status !== "all" && item.status !== status) return false;
      if (priority !== "all" && item.priority !== priority) return false;
      if (tag !== "all" && !item.tags.includes(tag)) return false;
      if (overdueOnly && !overdueIds.has(item.id)) return false;
      if (newEventOnly && !newEventIds.has(item.id)) return false;
      return true;
    })
    .sort((left, right) => compareRows(left, right, sort, events)), [company, events, includeArchived, industry, newEventIds, overdueIds, overdueOnly, priority, sort, status, stocks, tag, watchItems, newEventOnly]);

  return (
    <section className="min-w-0 space-y-4" aria-label="观察清单与投研复盘工作流">
      {props.storageError ? <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{props.storageError}</div> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="观察清单指标">
        <KpiCard label="正在观察" value={active.length} delta="用户数据" description="示例模板不计入" tone="info" />
        <KpiCard label="待复盘" value={new Set(pendingTasks.map((task) => task.watchItemId)).size} delta="任务视图" description="不会自动改变用户判断" tone={pendingTasks.length ? "warning" : "positive"} />
        <KpiCard label="已逾期" value={overdueIds.size} delta="复盘日期" description="仅生成提醒" tone={overdueIds.size ? "warning" : "positive"} />
        <KpiCard label="新事件提醒" value={newEventIds.size} delta="ResearchEvent" description="上次复盘后真实事件" tone="info" />
        <KpiCard label="已归档" value={archivedCount} delta="可恢复" description="历史复盘仍保留" tone="positive" />
      </section>

      <DashboardCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-textStrong">个人观察清单</h2><p className="mt-1 text-xs text-textMuted">核心判断变化必须通过“开始复盘”留痕。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setBackupOpen(true)} className={buttonClass}><DatabaseBackup className="h-4 w-4" />备份 / 导入</button><button type="button" onClick={props.onAdd} className={`${buttonClass} border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加观察项</button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="公司"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="名称或代码" className={inputClass} /></Field>
          <Field label="行业"><select value={industry} onChange={(event) => setIndustry(event.target.value)} className={inputClass}><option value="all">全部行业</option>{industries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="状态"><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="all">全部状态</option>{["观察", "已配置", "等回调", "等业绩验证", "剔除观察"].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="优先级"><select value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}><option value="all">全部优先级</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></Field>
          <Field label="标签"><select value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}><option value="all">全部标签</option>{tags.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="排序"><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className={inputClass}><option value="priority">优先级</option><option value="review">下次复盘日期</option><option value="event">最近事件</option><option value="updated">最近更新</option><option value="company">公司名称</option></select></Field>
          <Toggle active={overdueOnly} onClick={() => setOverdueOnly((value) => !value)} label="仅看逾期" />
          <Toggle active={newEventOnly} onClick={() => setNewEventOnly((value) => !value)} label="仅看新事件" />
          <Toggle active={includeArchived} onClick={() => setIncludeArchived((value) => !value)} label="显示归档" />
        </div>
      </DashboardCard>

      {rows.length === 0 ? <EmptyState title="没有匹配的用户观察项" description="可以添加公司，或主动从下方示例模板复制。" /> : <div className="grid min-w-0 gap-4 xl:grid-cols-2">{rows.map(({ item, stock }) => {
        const itemTasks = tasks.filter((task) => task.watchItemId === item.id && task.status === "pending");
        const stockEvents = events.filter((event) => event.stockId === item.stockId);
        const latestEvent = [...stockEvents].sort((left, right) => eventDate(right).localeCompare(eventDate(left)) || left.id.localeCompare(right.id))[0];
        const entries = reviewEntries.filter((entry) => entry.watchItemId === item.id);
        const latestReview = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))[0];
        return <DashboardCard key={item.id} className="min-w-0 p-4" interactive>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs text-textMuted">{stock.market} · {stock.code} · {getIndustryName(industries, stock.industryId)}</p><h3 className="mt-1 break-words text-lg font-semibold text-textStrong">{stock.name}</h3></div><div className="flex flex-wrap gap-2"><Badge value={item.status} /><Badge value={priorityLabel(item.priority)} warning={item.priority === "high"} />{item.archivedAt ? <Badge value="已归档" /> : null}</div></div>
          <p className="mt-3 text-xs text-textMuted">关注理由</p><TextClamp lines={2} title={item.reason} className="mt-1 break-words text-sm text-textStrong">{item.reason || "未填写"}</TextClamp>
          <p className="mt-3 text-xs text-textMuted">当前投资假设</p><TextClamp lines={3} title={item.thesis} className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-textStrong">{item.thesis || "未填写"}</TextClamp>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><ListBlock label="验证条件" values={item.validationCriteria} /><ListBlock label="风险条件" values={item.riskCriteria} /></div>
          <div className="mt-3 rounded border border-borderSoft bg-bg2/70 p-3 text-xs text-textMuted"><p>下一次复盘：<strong className={overdueIds.has(item.id) ? "text-warning" : "text-textStrong"}>{item.nextReviewAt ?? "未设置"}</strong> · 待处理任务：<strong className="text-textStrong">{itemTasks.length}</strong></p><p className="mt-1 break-words">最近事件：{latestEvent ? `${eventDate(latestEvent) || "日期缺失"} · ${latestEvent.title}` : "暂无"}</p><p className="mt-1 break-words">最近复盘：{latestReview ? `${latestReview.createdAt.slice(0, 10)} · ${latestReview.decision}` : "尚无记录"}</p></div>
          {itemTasks.length ? <div className="mt-3 space-y-2 rounded border border-warning/30 bg-warning/10 p-3"><p className="inline-flex items-center gap-2 text-xs font-semibold text-warning"><BellRing className="h-4 w-4" />只读复盘任务</p>{itemTasks.slice(0, 4).map((task) => <div key={task.id} className="rounded border border-warning/20 bg-bg2/60 p-2"><p className="text-sm text-textStrong">{task.title}</p><p className="mt-1 break-words text-xs text-textMuted">{task.description}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => props.onTaskState(task.id, "acknowledged")} className="text-xs text-cyan">确认</button><button type="button" onClick={() => props.onTaskState(task.id, "snoozed", plusDays(7))} className="text-xs text-textMuted">暂缓 7 天</button><button type="button" onClick={() => props.onTaskState(task.id, "dismissed")} className="text-xs text-textMuted">忽略</button></div></div>)}</div> : null}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => props.onOpenStock(stock)} className={buttonClass}>查看个股</button>{!item.archivedAt ? <><button type="button" onClick={() => props.onStartReview(item)} className={`${buttonClass} border-cyan/50 text-cyan`}><RefreshCw className="h-4 w-4" />开始复盘</button><button type="button" onClick={() => props.onEdit(item)} className={buttonClass}><Edit3 className="h-4 w-4" />编辑元数据</button><button type="button" onClick={() => props.onArchive(item)} className={buttonClass}><Archive className="h-4 w-4" />归档</button></> : <button type="button" onClick={() => props.onRestore(item)} className={buttonClass}><RotateCcw className="h-4 w-4" />恢复</button>}<button type="button" onClick={() => setTimelineItemId(timelineItemId === item.id ? null : item.id)} className={buttonClass}><CalendarClock className="h-4 w-4" />复盘时间线</button></div>
          {timelineItemId === item.id ? <div className="mt-4 border-t border-borderSoft pt-4"><ReviewTimeline entries={entries} events={stockEvents} onCorrect={props.onCorrectReview} /></div> : null}
        </DashboardCard>;
      })}</div>}

      <DashboardCard className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-textStrong">示例模板（不计入用户数据）</h2><p className="mt-1 text-xs text-textMuted">仅在主动载入时复制为新的 user 记录；已存在公司不会重复创建。</p></div><button type="button" onClick={props.onLoadAllSamples} className={buttonClass}>载入全部示例</button></div><div className="mt-3 grid gap-3 md:grid-cols-2">{samples.map((sample) => { const stock = stocks.find((item) => item.id === sample.stockId); return <article key={sample.id} className="rounded border border-borderSoft bg-bg2/60 p-3"><p className="text-sm font-semibold text-textStrong">示例 · {stock?.name ?? sample.stockId}</p><p className="mt-1 text-xs text-textMuted">{sample.reason}</p><button type="button" onClick={() => props.onLoadSample(sample)} className="mt-3 text-xs text-cyan hover:underline">载入此示例</button></article>; })}</div></DashboardCard>

      {backupOpen ? <WatchlistBackupModal exportJson={props.exportJson} corruptedRaw={props.corruptedRaw} onValidate={props.onValidateImport} onMerge={props.onMergeImport} onReplace={props.onReplaceImport} onReset={props.onReset} onClose={() => setBackupOpen(false)} /> : null}
    </section>
  );
}

const inputClass = "h-10 w-full min-w-0 rounded-md border border-borderSoft bg-bg2 px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "inline-flex h-9 items-center gap-2 rounded-md border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <label className="text-xs text-textMuted"><span className="mb-1 block">筛选</span><button type="button" aria-pressed={active} onClick={onClick} className={`${inputClass} text-left ${active ? "border-cyan text-cyan" : ""}`}>{label}</button></label>; }
function Badge({ value, warning = false }: { value: string; warning?: boolean }) { return <span className={`rounded border px-2 py-1 text-xs ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-borderSoft text-textMuted"}`}>{value}</span>; }
function ListBlock({ label, values }: { label: string; values: string[] }) { return <div className="min-w-0 rounded border border-borderSoft bg-bg2/60 p-3"><p className="text-xs font-semibold text-textMuted">{label}</p>{values.length ? <ul className="mt-2 space-y-1 text-xs text-textMuted">{values.map((value) => <li key={value} className="break-words">• {value}</li>)}</ul> : <p className="mt-2 text-xs text-textMuted">未设置</p>}</div>; }
function priorityLabel(value: WatchItem["priority"]) { return ({ high: "高优先级", medium: "中优先级", low: "低优先级" })[value]; }
function eventDate(event: ResearchEvent) { return event.publishedAt ?? event.eventDate ?? event.updatedAt ?? ""; }
function priorityRank(value: WatchItem["priority"]) { return ({ high: 3, medium: 2, low: 1 })[value]; }
function compareRows(left: { item: WatchItem; stock: Stock }, right: { item: WatchItem; stock: Stock }, sort: SortMode, events: ResearchEvent[]) {
  if (sort === "priority") return priorityRank(right.item.priority) - priorityRank(left.item.priority) || left.stock.name.localeCompare(right.stock.name);
  if (sort === "review") return (left.item.nextReviewAt ?? "9999").localeCompare(right.item.nextReviewAt ?? "9999") || left.item.id.localeCompare(right.item.id);
  if (sort === "updated") return right.item.updatedAt.localeCompare(left.item.updatedAt) || left.item.id.localeCompare(right.item.id);
  if (sort === "company") return left.stock.name.localeCompare(right.stock.name) || left.item.id.localeCompare(right.item.id);
  const latest = (stockId: string) => events.filter((event) => event.stockId === stockId).map(eventDate).sort().pop() ?? "";
  return latest(right.item.stockId).localeCompare(latest(left.item.stockId)) || left.item.id.localeCompare(right.item.id);
}
function todayString() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function plusDays(days: number) { const now = new Date(); now.setDate(now.getDate() + days); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
