import { Archive, ArrowLeft, BellRing, CalendarClock, DatabaseBackup, Edit3, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImportValidationResult } from "../../services/watchlistRepository";
import type { Industry, ResearchEvent, ReviewEntry, ReviewTask, Stock, WatchItem } from "../../types";
import { getIndustryName } from "../../utils/filters";
import { DashboardCard, EmptyState, SectionHeader } from "../common/terminal";
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

  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => rows[0]?.item.id ?? null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const returnScrollRef = useRef(0);
  const selected = rows.find(({ item }) => item.id === selectedItemId);
  const unmatched = watchItems.filter((item) => !stocks.some((stock) => stock.id === item.stockId));
  const advancedCount = [industry !== "all", priority !== "all", tag !== "all"].filter(Boolean).length;
  const hasFilters = Boolean(company || status !== "all" || advancedCount || overdueOnly || newEventOnly || includeArchived);
  useEffect(() => {
    if (selectedItemId && !selected) {
      const needsFocusReturn = mobileDetailOpen && (document.activeElement === document.body || detailRef.current?.contains(document.activeElement));
      setSelectedItemId(null); setMobileDetailOpen(false);
      if (needsFocusReturn) window.requestAnimationFrame(() => (listHeadingRef.current ?? companyInputRef.current)?.focus({ preventScroll: true }));
    }
  }, [selected, selectedItemId, mobileDetailOpen]);
  useEffect(() => { if (mobileDetailOpen && selected) detailRef.current?.focus({ preventScroll: false }); }, [mobileDetailOpen, selectedItemId]);
  const clearAdvanced = () => { setIndustry("all"); setPriority("all"); setTag("all"); };
  const clearFilters = () => { setCompany(""); setStatus("all"); clearAdvanced(); setOverdueOnly(false); setNewEventOnly(false); setIncludeArchived(false); };
  const returnToList = () => {
    setMobileDetailOpen(false);
    window.requestAnimationFrame(() => { if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true }); window.scrollTo({ top: returnScrollRef.current, behavior: "auto" }); });
  };

  return <section className="min-w-0 space-y-4" aria-label="观察清单与投研复盘工作流">
    <SectionHeader className="page-heading" title="观察清单 / 待办与复盘" description="提醒、判断和复盘分开；确认提醒不会改变当前投资假设。"
      action={<><button type="button" onClick={() => setBackupOpen(true)} className={buttonClass}><DatabaseBackup className="h-4 w-4" />备份 / 导入</button><button type="button" onClick={props.onAdd} className={`${buttonClass} bg-selected text-accent`}><Plus className="h-4 w-4" />添加观察项</button></>} />
    {props.storageError ? <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{props.storageError}<button type="button" className="ml-3 min-h-11 underline" onClick={() => setBackupOpen(true)}>打开备份与恢复</button></div> : null}
    {props.corruptedRaw && !props.storageError ? <div role="status" className="rounded-md border border-warning/40 p-3 text-sm text-warning">存在待恢复的原始存储内容。<button type="button" className="ml-3 min-h-11 underline" onClick={() => setBackupOpen(true)}>导出损坏原始数据</button></div> : null}
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="观察清单指标">
      <WatchStat label="正在观察" value={active.length} note="用户数据；示例模板不计入" />
      <WatchStat label="待复盘" value={new Set(pendingTasks.map((task) => task.watchItemId)).size} note="按观察项去重；仅为任务提醒" warning={pendingTasks.length > 0} />
      <WatchStat label="已逾期" value={overdueIds.size} note="按下次复盘日期" warning={overdueIds.size > 0} />
      <WatchStat label="新事件提醒" value={newEventIds.size} note="上次复盘后的关联事件" />
      <WatchStat label="已归档" value={archivedCount} note="可恢复，历史仍保留" />
    </section>
    {unmatched.length ? <div role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{unmatched.length} 条观察记录无法匹配当前研究池公司；原记录仍保留并计入用户统计。
      <details className="mt-2"><summary className="cursor-pointer py-2">查看未匹配记录</summary><div className="space-y-3">{unmatched.map((item) => <div key={item.id} className="rounded border border-borderSoft bg-bg2 p-3 text-xs text-textMuted"><p className="break-all">公司 ID：{item.stockId} · 观察项 ID：{item.id}</p><p className="mt-1">{item.status} · {item.archivedAt ? "已归档" : "活跃记录"}</p><p className="mt-2 whitespace-pre-wrap break-words">关注理由：{item.reason || "未填写"}</p><p className="mt-2 whitespace-pre-wrap break-words">投资假设：{item.thesis || "未填写"}</p></div>)}</div></details>
      <button type="button" onClick={() => setBackupOpen(true)} className="min-h-11 text-sm underline">打开备份 / 导出完整记录</button>
    </div> : null}

    <DashboardCard className="min-w-0 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="公司"><input ref={companyInputRef} aria-label="观察公司" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="名称或代码" className={inputClass} /></Field>
        <Field label="状态"><select aria-label="观察状态" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="all">全部状态</option>{["观察", "已配置", "等回调", "等业绩验证", "剔除观察"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="排序"><select aria-label="观察排序" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className={inputClass}><option value="priority">优先级</option><option value="review">下次复盘日期</option><option value="event">最近事件</option><option value="updated">最近更新</option><option value="company">公司名称</option></select></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Toggle active={overdueOnly} onClick={() => setOverdueOnly((value) => !value)} label="仅看逾期" /><Toggle active={newEventOnly} onClick={() => setNewEventOnly((value) => !value)} label="仅看新事件" /><Toggle active={includeArchived} onClick={() => setIncludeArchived((value) => !value)} label="显示归档" />{hasFilters ? <button type="button" onClick={clearFilters} className={`${buttonClass} text-accent`}>清除全部筛选</button> : null}</div>
      <details className="mt-3 rounded-md border border-control"><summary className="cursor-pointer px-3 py-3 text-sm text-accent">更多筛选{advancedCount ? `（${advancedCount} 项已启用）` : ""}</summary><div className="grid gap-3 border-t border-borderSoft p-3 sm:grid-cols-3">
        <Field label="行业"><select aria-label="观察行业" value={industry} onChange={(event) => setIndustry(event.target.value)} className={inputClass}><option value="all">全部行业</option>{industries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="优先级"><select aria-label="观察优先级" value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}><option value="all">全部优先级</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></Field>
        <Field label="标签"><select aria-label="观察标签" value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}><option value="all">全部标签</option>{tags.map((value) => <option key={value}>{value}</option>)}</select></Field>
      </div></details>
      {advancedCount ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-textMuted">{industry !== "all" ? <span>行业：{getIndustryName(industries, industry)}</span> : null}{priority !== "all" ? <span>优先级：{priorityLabel(priority as WatchItem["priority"])}</span> : null}{tag !== "all" ? <span>标签：{tag}</span> : null}<button type="button" onClick={clearAdvanced} className="min-h-11 text-accent underline">清除更多筛选</button></div> : null}
    </DashboardCard>

    {rows.length === 0 ? <EmptyState title="没有匹配的用户观察项" description={hasFilters ? "当前条件下没有匹配记录，可清除筛选后继续查看。" : unmatched.length ? "原观察记录仍在，但当前研究池没有可匹配公司；可从上方导出备份。" : "尚未添加用户观察项。可以添加公司，或主动载入下方示例模板。"} /> : <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <DashboardCard className={`min-w-0 overflow-hidden ${mobileDetailOpen && selected ? "hidden xl:block" : ""}`}>
        <div className="border-b border-borderSoft p-4"><h2 ref={listHeadingRef} tabIndex={-1} className="rounded text-base font-semibold text-textStrong">个人观察清单 <span className="ml-2 text-sm font-normal text-textMuted">{rows.length} 项</span></h2><p className="mt-1 text-xs text-textMuted">选择公司查看完整判断、提醒与复盘历史。</p></div>
        <ul aria-label="用户观察项列表" className="divide-y divide-borderSoft">{rows.map(({ item, stock }) => <li key={item.id} className={`min-w-0 p-3 ${selected?.item.id === item.id ? "bg-selected" : "hover:bg-bg2"}`}>
          <div className="flex min-w-0 flex-wrap items-center gap-2"><button type="button" aria-pressed={selected?.item.id === item.id} aria-label={`查看观察项 ${stock.name}`} className="min-h-11 min-w-0 flex-1 rounded text-left" onClick={(event) => { returnFocusRef.current = event.currentTarget; returnScrollRef.current = window.scrollY; setSelectedItemId(item.id); setMobileDetailOpen(true); }}><span className="block break-words text-sm font-semibold text-textStrong">{stock.name}</span><span className="mt-1 block break-words text-xs text-textMuted">{stock.code} · {stock.market}</span></button>{!item.archivedAt ? <button type="button" onClick={() => props.onStartReview(item)} aria-label={`开始复盘 ${stock.name}`} className={`${buttonClass} text-accent`}>开始复盘</button> : <button type="button" onClick={() => props.onRestore(item)} aria-label={`恢复 ${stock.name}`} className={`${buttonClass} text-accent`}>恢复</button>}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-xs"><Badge value={item.archivedAt ? "已归档" : item.status} /><span className={item.priority === "high" ? "text-warning" : "text-textMuted"}>{priorityLabel(item.priority)}</span><span className={overdueIds.has(item.id) ? "text-warning" : "text-textMuted"}>复盘：{item.nextReviewAt ?? "未设置"}{overdueIds.has(item.id) ? " · 已逾期" : ""}</span><span className="text-textMuted">待处理 {tasks.filter((task) => task.watchItemId === item.id && task.status === "pending").length}</span></div>
        </li>)}</ul>
      </DashboardCard>
      <div ref={detailRef} tabIndex={-1} role="region" aria-label="观察项详情" className={`min-w-0 rounded-lg ${mobileDetailOpen && selected ? "" : "hidden xl:block"}`}>
        {selected ? <><button type="button" onClick={returnToList} className={`${buttonClass} mb-3 xl:hidden`}><ArrowLeft className="h-4 w-4" />返回观察列表</button><WatchDetail key={selected.item.id} item={selected.item} stock={selected.stock} props={props} overdue={overdueIds.has(selected.item.id)} /></> : <DashboardCard className="p-5"><p className="text-sm text-textMuted">请选择一个观察项查看详情。</p></DashboardCard>}
      </div>
    </div>}

    <details className="min-w-0 rounded-lg border border-control bg-bg2 p-4"><summary className="cursor-pointer text-sm font-semibold text-accent">示例模板（不计入用户数据）</summary><div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-textMuted">仅主动载入后才成为用户观察项；已有公司不会重复创建。</p><button type="button" onClick={props.onLoadAllSamples} className={buttonClass}>载入全部示例</button></div><div className="mt-3 grid gap-3 md:grid-cols-2">{samples.map((sample) => { const stock = stocks.find((item) => item.id === sample.stockId); return <article key={sample.id} className="min-w-0 rounded border border-borderSoft p-3"><p className="break-words text-sm font-semibold text-textStrong">示例 · {stock?.name ?? sample.stockId}</p><p className="mt-1 break-words text-xs leading-5 text-textMuted">{sample.reason}</p><button type="button" onClick={() => props.onLoadSample(sample)} className="mt-3 min-h-11 text-sm text-accent underline">载入此示例</button></article>; })}</div></div></details>
    {backupOpen ? <WatchlistBackupModal exportJson={props.exportJson} corruptedRaw={props.corruptedRaw} error={props.storageError} onValidate={props.onValidateImport} onMerge={props.onMergeImport} onReplace={props.onReplaceImport} onReset={props.onReset} onClose={() => setBackupOpen(false)} /> : null}
  </section>;
}

function WatchStat({ label, value, note, warning = false }: { label: string; value: number; note: string; warning?: boolean }) {
  return <DashboardCard className="min-w-0 p-3"><p className="text-xs text-textMuted">{label}</p><p className={`mt-1 text-[28px] font-semibold tabular-nums ${warning ? "text-warning" : "text-textStrong"}`}>{value}</p><p className="mt-1 text-xs leading-5 text-textMuted">{note}</p></DashboardCard>;
}

function WatchDetail({ item, stock, props, overdue }: { item: WatchItem; stock: Stock; props: WatchlistTabProps; overdue: boolean }) {
  const [allTasks, setAllTasks] = useState(false);
  const itemTasks = props.tasks.filter((task) => task.watchItemId === item.id && task.status === "pending");
  const stockEvents = (props.events ?? []).filter((event) => event.stockId === item.stockId);
  const latestEvent = [...stockEvents].sort((left, right) => eventDate(right).localeCompare(eventDate(left)) || left.id.localeCompare(right.id))[0];
  const entries = props.reviewEntries.filter((entry) => entry.watchItemId === item.id);
  const latestReview = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))[0];
  return <DashboardCard className="min-w-0 space-y-4 p-4">
    <div className="min-w-0"><p className="break-words text-xs text-textMuted">{stock.market} · {stock.code} · {getIndustryName(props.industries, stock.industryId)}</p><h3 className="mt-1 break-words text-lg font-semibold text-textStrong">{stock.name} / 当前观察</h3><div className="mt-2 flex flex-wrap gap-2"><Badge value={item.status} /><Badge value={priorityLabel(item.priority)} warning={item.priority === "high"} />{item.archivedAt ? <Badge value="已归档" /> : null}{item.tags.map((tag) => <Badge key={tag} value={tag} />)}</div></div>
    <div className="flex flex-wrap items-start gap-2">{!item.archivedAt ? <button type="button" onClick={() => props.onStartReview(item)} className={`${buttonClass} bg-selected text-accent`}><RefreshCw className="h-4 w-4" />开始复盘</button> : <button type="button" onClick={() => props.onRestore(item)} className={`${buttonClass} text-accent`}><RotateCcw className="h-4 w-4" />恢复</button>}<button type="button" onClick={() => props.onOpenStock(stock)} className={buttonClass}>查看个股</button><details className="min-w-0 rounded border border-control"><summary className="cursor-pointer px-3 py-3 text-sm text-textMuted">更多操作</summary><div className="flex flex-wrap gap-2 p-2">{!item.archivedAt ? <><button type="button" onClick={() => props.onEdit(item)} className={buttonClass}><Edit3 className="h-4 w-4" />编辑元数据</button><button type="button" onClick={() => props.onArchive(item)} className={`${buttonClass} text-warning`}><Archive className="h-4 w-4" />归档</button></> : <p className="p-2 text-xs text-textMuted">归档项恢复后可以继续编辑或复盘。</p>}</div></details></div>
    <div><p className="text-xs text-textMuted">关注理由</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-textStrong">{item.reason || "未填写"}</p></div>
    <div><p className="text-xs text-textMuted">当前投资假设</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-textStrong">{item.thesis || "未填写"}</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><ListBlock label="验证条件" values={item.validationCriteria} /><ListBlock label="风险条件" values={item.riskCriteria} /></div>
    <div className="rounded border border-borderSoft bg-bg2 p-3 text-xs leading-5 text-textMuted"><p>下一次复盘：<strong className={overdue ? "text-warning" : "text-textStrong"}>{item.nextReviewAt ?? "未设置"}</strong> · 待处理任务：{itemTasks.length}</p><p className="mt-1 break-words">最近事件：{latestEvent ? `${eventDate(latestEvent) || "日期缺失"} · ${latestEvent.title}` : "暂无"}</p><p className="mt-1 break-words">最近复盘：{latestReview ? `${latestReview.createdAt.slice(0, 10)} · ${latestReview.decision}` : "尚无记录"}</p></div>
    {itemTasks.length ? <div className="space-y-3 rounded border border-warning/30 bg-warning/10 p-3"><p className="inline-flex items-center gap-2 text-sm font-semibold text-warning"><BellRing className="h-4 w-4" />复盘提醒</p><p className="text-xs leading-5 text-textMuted">确认、暂缓或忽略仅处理提醒，不会完成复盘或修改投资假设。</p>{(allTasks ? itemTasks : itemTasks.slice(0, 4)).map((task) => <article key={task.id} aria-label={`提醒 ${task.title}`} className="rounded border border-warning/25 bg-bg2 p-3"><p className="break-words text-sm text-textStrong">{task.title}</p><p className="mt-1 break-words text-xs leading-5 text-textMuted">{task.description}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => props.onTaskState(task.id, "acknowledged")} className={`${buttonClass} text-accent`}>确认</button><button type="button" onClick={() => props.onTaskState(task.id, "snoozed", plusDays(7))} className={buttonClass}>暂缓 7 天</button><button type="button" onClick={() => props.onTaskState(task.id, "dismissed")} className={buttonClass}>忽略</button></div></article>)}{itemTasks.length > 4 ? <button type="button" aria-expanded={allTasks} onClick={() => setAllTasks((value) => !value)} className="min-h-11 text-sm text-accent underline">{allTasks ? "收起其他提醒" : `展开全部 ${itemTasks.length} 条提醒`}</button> : null}</div> : <p className="text-xs text-textMuted">当前没有待处理提醒；仍可主动开始复盘。</p>}
    <details className="rounded border border-control"><summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm text-accent"><CalendarClock className="h-4 w-4" />复盘时间线（{entries.length}）</summary><div className="border-t border-borderSoft p-3"><ReviewTimeline entries={entries} events={stockEvents} onCorrect={props.onCorrectReview} /></div></details>
  </DashboardCard>;
}

const inputClass = "min-h-11 w-full min-w-0 rounded-md border border-control bg-bg2 px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-control px-3 text-xs text-textStrong hover:border-cyan";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`${buttonClass} ${active ? "border-control bg-selected font-semibold text-accent" : "text-textMuted"}`}>{label}</button>; }

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
