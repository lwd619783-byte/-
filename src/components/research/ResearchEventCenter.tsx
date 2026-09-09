import { useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckSquare, ExternalLink, FileCheck2, Link2 } from "lucide-react";
import type { EarningsVerificationChain, EarningsVerificationStage, Industry, ResearchEvent, ResearchEventSnapshot, ResearchEventType, ReviewTask, Stock, WatchItem } from "../../types";
import { eventTypeLabel, stageLabel } from "../../services/researchEventProvider";
import { sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import { statusDisplayLabel } from "../../utils/displayLabels";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { getCalendarToday, getTemporalCalendarDate, isPreciseInstant, resolveTimeZone } from "../../utils/dateTime";
import { DashboardCard, EmptyState, KpiCard, SectionHeader } from "../common/terminal";

interface ResearchEventCenterProps {
  snapshot: ResearchEventSnapshot;
  stocks: Stock[];
  industries: Industry[];
  onOpenStock: (stock: Stock) => void;
  watchItems?: WatchItem[];
  reviewTasks?: ReviewTask[];
  onStartReview?: (item: WatchItem) => void;
  now?: Date;
  timeZone?: string;
  initialEventId?: string;
  onSelectEvent?: (eventId: string) => void;
}

type DateWindow = "7" | "30" | "all";

export function ResearchEventCenter({ snapshot, stocks, industries, onOpenStock, watchItems = [], reviewTasks = [], onStartReview, now = new Date(), timeZone: requestedTimeZone, initialEventId, onSelectEvent }: ResearchEventCenterProps) {
  const timeZone = resolveTimeZone(requestedTimeZone);
  const [company, setCompany] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [eventType, setEventType] = useState<ResearchEventType | "all">("all");
  const [dateWindow, setDateWindow] = useState<DateWindow>("30");
  const [parseStatus, setParseStatus] = useState("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [activeView, setActiveView] = useState<"events" | "queue" | "chains">("events");
  const [eventLimit, setEventLimit] = useState(80);
  const [queueLimit, setQueueLimit] = useState(30);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialEventId));
  const [eventSelection, setEventSelection] = useState({ sourceId: initialEventId, selectedId: initialEventId });
  const selection = eventSelection.sourceId === initialEventId ? eventSelection : { sourceId: initialEventId, selectedId: initialEventId };
  if (eventSelection.sourceId !== initialEventId) { setEventSelection(selection); setMobileDetail(Boolean(initialEventId)); setActiveView("events"); }
  const tabId = useId();
  const detailsRef = useRef<HTMLDivElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const advancedCount = Number(parseStatus !== "all") + Number(reviewOnly);
  const cutoff = useMemo(() => dateCutoff(now, dateWindow, timeZone), [now, dateWindow, timeZone]);

  const filteredEvents = useMemo(() => snapshot.events.filter((event) => {
    if (company !== "all" && event.stockId !== company) return false;
    if (industry !== "all" && event.industryId !== industry) return false;
    if (eventType !== "all" && event.eventType !== eventType) return false;
    if (parseStatus !== "all" && event.parseStatus !== parseStatus && event.verificationStatus !== parseStatus) return false;
    if (reviewOnly && event.reviewStatus !== "pending") return false;
    if (cutoff && !eventDate(event, timeZone)) return false;
    if (cutoff && (eventDate(event, timeZone) as string) < cutoff) return false;
    return true;
  }), [company, cutoff, eventType, industry, parseStatus, reviewOnly, snapshot.events, timeZone]);

  const visibleChains = useMemo(() => snapshot.chains.filter((chain) => {
    const stock = stocks.find((item) => item.id === chain.stockId);
    return (company === "all" || chain.stockId === company) && (industry === "all" || stock?.industryId === industry);
  }).slice(0, 12), [company, industry, snapshot.chains, stocks]);

  const queue = useMemo(() => snapshot.events.filter(needsDataReview), [snapshot.events]);
  const sevenDayCutoff = dateCutoff(now, "7", timeZone) as string;
  const recentCount = snapshot.events.filter((event) => !["data_warning", "earnings_expectation_data_warning"].includes(event.eventType) && (eventDate(event, timeZone) ?? "") >= sevenDayCutoff).length;
  const pendingCompanies = new Set(snapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
  const performanceCount = snapshot.events.filter((event) => ["earnings_preview", "earnings_flash", "periodic_report"].includes(event.eventType)).length;
  const selectedEvent = selection.selectedId ? snapshot.events.find((event) => event.id === selection.selectedId) : filteredEvents[0];
  const invalidSelection = Boolean(selection.selectedId && !selectedEvent);
  const outsideFilter = selectedEvent && !filteredEvents.some((event) => event.id === selectedEvent.id);

  function selectEvent(eventId: string, trigger: HTMLButtonElement) {
    if (!snapshot.events.some((event) => event.id === eventId)) return;
    selectedTrigger.current = trigger;
    setEventSelection({ sourceId: initialEventId, selectedId: eventId });
    setMobileDetail(true);
    setActiveView("events");
    onSelectEvent?.(eventId);
    requestAnimationFrame(() => detailsRef.current?.focus({ preventScroll: false }));
  }

  return (
    <section className="space-y-4" aria-label="投研事件与业绩验证中心">
        <SectionHeader
          className="page-heading"
          title="投研事件与业绩验证中心"
          description="先选择事件，再核对来源、事前资格与既有比较结果；全量历史和差异明细在打开公司后按需加载。"
        />
        <p className="mt-2 text-xs text-textMuted">工作流时区：{timeZone}</p>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="验证中心指标">
        <KpiCard label="最近 7 天事件" value={recentCount} delta="现有事件摘要" description="按公告日期或财务更新时间统计" tone="info" icon={<CalendarDays className="h-4 w-4" />} />
        <KpiCard label="待复盘公司" value={pendingCompanies} delta="需人工判断" description="至少有一项待复盘或数据缺口" tone={pendingCompanies ? "warning" : "positive"} icon={<CheckSquare className="h-4 w-4" />} />
        <KpiCard label="业绩验证事件" value={performanceCount} delta="预告 / 快报 / 报告" description="不与机构一致预期进行比较" tone="positive" icon={<FileCheck2 className="h-4 w-4" />} />
        <KpiCard label="数据核验" value={queue.length} delta="部分解析或缺失" description="保留仅元数据、过期与错误状态" tone={queue.length ? "warning" : "positive"} icon={<AlertTriangle className="h-4 w-4" />} />
      </section>

      <DashboardCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Filter label="公司" value={company} onChange={setCompany} options={[{ value: "all", label: "全部公司" }, ...stocks.filter((stock) => stock.market === "A股").map((stock) => ({ value: stock.id, label: `${stock.name} ${stock.code}` }))]} />
          <Filter label="行业" value={industry} onChange={setIndustry} options={[{ value: "all", label: "全部行业" }, ...industries.map((item) => ({ value: item.id, label: item.name }))]} />
          <Filter label="事件类型" value={eventType} onChange={(value) => setEventType(value as ResearchEventType | "all")} options={[{ value: "all", label: "全部事件" }, ...(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report", "financial_update", "announcement", "data_warning", "earnings_expectation_added", "earnings_expectation_correction", "earnings_expectation_revision", "earnings_expectation_comparison_available", "earnings_expectation_data_warning"] as ResearchEventType[]).map((value) => ({ value, label: eventTypeLabel(value) }))]} />
          <Filter label="日期" value={dateWindow} onChange={(value) => setDateWindow(value as DateWindow)} options={[{ value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "all", label: "全部日期" }]} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" aria-expanded={moreFilters} aria-controls={`${tabId}-filters`} className="min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={() => setMoreFilters((value) => !value)}>更多筛选{advancedCount ? `（${advancedCount}）` : ""}</button>{advancedCount ? <button type="button" className="min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={() => { setParseStatus("all"); setReviewOnly(false); }}>清除更多筛选</button> : null}</div>
        <div id={`${tabId}-filters`} hidden={!moreFilters} className="mt-3"><div className="grid gap-3 sm:grid-cols-2">
          <Filter label="解析 / 数据状态" value={parseStatus} onChange={setParseStatus} options={[{ value: "all", label: "全部状态" }, ...["parse_success", "parse_partial", "metadata_only", "stale", "missing", "error"].map((value) => ({ value, label: statusDisplayLabel(value) }))]} />
          <label className="flex min-w-0 flex-col gap-1 text-xs text-textMuted">
            复盘状态
            <button type="button" aria-label={reviewOnly ? "仅看待复盘" : "全部复盘状态"} aria-pressed={reviewOnly} onClick={() => setReviewOnly((value) => !value)} className={`min-h-11 rounded-md border px-3 text-left text-sm ${reviewOnly ? "border-warning bg-warning/10 text-warning" : "border-control bg-panel2 text-textStrong"}`}>
              {reviewOnly ? "仅看待复盘" : "全部复盘状态"}
            </button>
          </label>
        </div></div>
      </DashboardCard>

      <div role="tablist" aria-label="验证中心视图" className="flex flex-wrap gap-2">
        {([{ id: "events", label: "事件对账" }, { id: "queue", label: "全局核验队列" }, { id: "chains", label: "业绩验证链" }] as const).map((view, index, views) => <button key={view.id} type="button" role="tab" id={`${tabId}-tab-${view.id}`} aria-controls={`${tabId}-${view.id}`} aria-selected={activeView === view.id} tabIndex={activeView === view.id ? 0 : -1}
          className={`min-h-11 rounded-md border px-3 text-sm font-medium ${activeView === view.id ? "border-accent bg-selected text-accent" : "border-control text-textMuted"}`}
          onClick={() => setActiveView(view.id)} onKeyDown={(event) => { const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0; if (!delta && event.key !== "Home" && event.key !== "End") return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : (index + delta + views.length) % views.length; setActiveView(views[next].id); document.getElementById(`${tabId}-tab-${views[next].id}`)?.focus(); }}>{view.label}</button>)}
      </div>

      <div role="tabpanel" id={`${tabId}-events`} aria-labelledby={`${tabId}-tab-events`} hidden={activeView !== "events"}>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <DashboardCard className={`min-w-0 p-4 ${mobileDetail ? "hidden xl:block" : ""}`}>
            <h2 id={`${tabId}-list-title`} tabIndex={-1} className="text-base font-semibold text-textStrong">最近事件</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">筛选后共 {filteredEvents.length} 条，当前显示 {Math.min(filteredEvents.length, eventLimit)} 条。选择事件查看完整依据。</p>
            <div className="mt-4 space-y-3">
              {filteredEvents.length === 0 ? <EmptyState title={snapshot.events.length ? "没有匹配事件" : "暂无研究事件"} description={snapshot.events.length ? "请调整筛选条件；没有结果不代表没有待核验事项。" : "当前已提交摘要尚未提供研究事件。"} /> : filteredEvents.slice(0, eventLimit).map((event) => <button key={event.id} type="button" data-event-id={event.id} aria-pressed={selectedEvent?.id === event.id} aria-label={`查看事件 ${event.stockName} ${event.title}`} onClick={(click) => selectEvent(event.id, click.currentTarget)}
                className={`block min-h-11 w-full rounded-md border p-3 text-left ${selectedEvent?.id === event.id ? "border-accent bg-selected" : "border-control bg-panel"}`}>
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted"><span>{event.stockName} · {event.stockCode}</span><span>{event.eventDate ?? "日期缺失"}</span></span>
                <strong className="mt-2 block break-words text-sm font-semibold text-textStrong">{event.title}</strong>
                <span className="mt-2 flex flex-wrap items-center gap-2"><ResearchEventStatusBadge event={event} /><span className="text-xs text-textMuted">{eventTypeLabel(event.eventType)}</span></span>
                {event.reviewReasons.length ? <span className="mt-2 block break-words text-xs leading-5 text-warning">{event.reviewReasons.join("；")}</span> : null}
              </button>)}
            </div>
            {eventLimit < filteredEvents.length ? <button type="button" className="mt-3 min-h-11 w-full rounded-md border border-control text-sm text-accent" onClick={() => setEventLimit((limit) => limit + 80)}>显示更多事件（剩余 {filteredEvents.length - eventLimit} 条）</button> : null}
          </DashboardCard>
          <div ref={detailsRef} tabIndex={-1} aria-label="选中事件详情" className={`min-w-0 space-y-3 ${mobileDetail ? "" : "hidden xl:block"}`}>
            <button type="button" className="min-h-11 rounded-md border border-control px-3 text-sm text-accent xl:hidden" onClick={() => { setMobileDetail(false); requestAnimationFrame(() => { if (selectedTrigger.current?.isConnected && selectedTrigger.current.getClientRects().length) selectedTrigger.current.focus(); else document.getElementById(`${tabId}-list-title`)?.focus(); }); }}>返回事件列表</button>
            {invalidSelection ? <EmptyState title="找不到所选事件" description="该事件不在当前有效数据集中，可能已因模式或来源状态变化被关闭；请重新选择列表中的事件。" /> : selectedEvent ? <>
              {outsideFilter ? <p className="rounded-md border border-warning bg-warning/10 p-3 text-xs leading-5 text-warning">所选事件不在当前筛选结果中；以下保留显式选定的事件详情，筛选范围未被修改。</p> : null}
              <EventCard event={selectedEvent} stock={stocks.find((stock) => stock.id === selectedEvent.stockId)} watchItem={watchItems.find((item) => item.stockId === selectedEvent.stockId && !item.archivedAt)} tasks={reviewTasks} onOpenStock={onOpenStock} onStartReview={onStartReview} />
            </> : <EmptyState title="请选择研究事件" description="选择列表中的事件后查看依据、来源和比较条件。" />}
          </div>
        </div>
      </div>

      <div role="tabpanel" id={`${tabId}-queue`} aria-labelledby={`${tabId}-tab-queue`} hidden={activeView !== "queue"}>
        <DashboardCard className="min-w-0 p-4">
          <h2 className="text-base font-semibold text-textStrong">数据核验队列</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">全局范围：从当前 {snapshot.events.length} 条有效事件中按原核验规则产生 {queue.length} 项，显示 {Math.min(queue.length, queueLimit)} 项；不受本页公司、行业、事件、日期、解析或复盘筛选影响。</p>
          <p className="mt-1 text-xs text-textMuted">部分解析、仅元数据、过期、错误、缺值和报告期未匹配。</p>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {queue.length === 0 ? <p className="text-sm text-textMuted">当前没有数据核验项。</p> : queue.slice(0, queueLimit).map((event) => <article key={`queue-${event.id}`} className="rounded-md border border-warning/40 bg-warning/10 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-textStrong">{event.stockName}</span><ResearchEventStatusBadge event={event} /></div>
              <p className="mt-2 break-words text-sm text-textMuted">{event.title}</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-warning">{event.reviewReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
              <button type="button" className="mt-3 min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={(click) => selectEvent(event.id, click.currentTarget)}>查看核验依据</button>
            </article>)}
          </div>
          {queueLimit < queue.length ? <button type="button" className="mt-3 min-h-11 rounded-md border border-control px-3 text-sm text-accent" onClick={() => setQueueLimit((limit) => limit + 30)}>显示更多核验项（剩余 {queue.length - queueLimit} 项）</button> : null}
        </DashboardCard>
      </div>

      <div role="tabpanel" id={`${tabId}-chains`} aria-labelledby={`${tabId}-tab-chains`} hidden={activeView !== "chains"}>
        <DashboardCard className="p-4">
          <h2 className="text-base font-semibold text-textStrong">业绩验证链</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">仅应用公司与行业条件，保留原最多 12 条链的展示范围；事件类型、日期、解析和复盘筛选不作用于此视图。链条缺口表示当前已提交数据中未发现该阶段，不代表公司依法必须发布该类公告。</p>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">{visibleChains.length === 0 ? <p className="text-sm text-textMuted">当前筛选下没有可关联报告期。</p> : visibleChains.map((chain) => <VerificationChainCard key={chain.id} chain={chain} stock={stocks.find((stock) => stock.id === chain.stockId)} onOpenStock={onOpenStock} />)}</div>
        </DashboardCard>
      </div>
    </section>
  );
}

function EventCard({ event, stock, watchItem, tasks, onOpenStock, onStartReview }: { event: ResearchEvent; stock?: Stock; watchItem?: WatchItem; tasks: ReviewTask[]; onOpenStock: (stock: Stock) => void; onStartReview?: (item: WatchItem) => void }) {
  const pendingTaskCount = watchItem ? tasks.filter((task) => task.watchItemId === watchItem.id && task.status === "pending").length : 0;
  return (
    <article className="rounded-lg border border-borderSoft bg-bg2/65 p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
            <span className="font-medium text-textStrong">{event.stockName} · {event.stockCode}</span>
            <span className="rounded border border-borderSoft px-2 py-1">{eventTypeLabel(event.eventType)}</span>
            <ResearchEventStatusBadge event={event} />
            {event.expectation?.ingestionMethod === "provider" ? <span className="rounded border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">公司官方指引 · 数据提供方只读</span> : null}
            {watchItem ? <span className="rounded border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">观察状态：{watchItem.status} · 待复盘 {pendingTaskCount}</span> : null}
          </div>
          <h3 className="mt-2 break-words text-lg font-semibold text-textStrong">{event.title}</h3>
          <p className="mt-1 break-words text-xs text-textMuted">事件来源：{event.sourceName || "未知"}{event.expectation ? ` · ${sourceCategoryLabel(event.expectation.sourceCategory)}` : ""}</p>
          <p className="mt-1 text-xs text-textMuted">公告 / 事件日期：{event.eventDate ?? "缺失"} · 报告期：{event.reportPeriod ?? "缺失"}</p>
          {event.expectation ? <p className="mt-1 break-words text-xs leading-5 text-textMuted">原记录时间：{event.expectation.originalBusinessTime ?? "缺失"}（{statusDisplayLabel(event.expectation.businessTimePrecision ?? "unknown")}） · 当前有效时间：{event.expectation.effectiveBusinessTime ?? event.expectation.originalBusinessTime ?? "缺失"}（{statusDisplayLabel(event.expectation.effectiveBusinessTimePrecision ?? event.expectation.businessTimePrecision ?? "unknown")}）{event.expectation.temporalCorrectionApplied ? ` · 时间字段已纠正：${event.expectation.correctedTemporalFields?.join("、") || "待核验"}` : ""}{event.expectation.correctionRecordedAt ? ` · 纠正记录时间：${event.expectation.correctionRecordedAt}` : ""}{event.expectation.businessOrderStatus === "uncertain" ? " · 业务顺序不确定" : event.expectation.businessOrderStatus === "equal" ? " · 精确时刻相同，不代表先后" : ""}</p> : null}
          {event.expectation?.ingestionMethod === "provider" ? <p className="mt-1 text-xs text-cyan">巨潮官方公告 · 数据版本 {event.expectation.providerVersion ?? "-"} · 更新 {event.expectation.providerGeneratedAt ?? "-"} · 公告标识 {event.expectation.sourceAnnouncementId ?? "-"} · 公司内部形成时间未知，以公开披露时间作为可用时间</p> : null}
          {event.eventType === "earnings_expectation_correction" && event.expectation ? <p className="mt-1 text-xs text-warning">被纠正快照：{event.expectation.correctionDelta?.correctionTargetId ?? event.expectation.correctsSnapshotId ?? "缺失"} · 当前纠正链终点：{event.expectation.effectiveSnapshotId ?? "缺失"} · 变化字段：{event.expectation.correctionDelta?.changedFields.join("、") || "待核验"}</p> : null}
          <p className="mt-3 break-words text-sm leading-6 text-textMuted">{event.summary}</p>
          {event.reviewReasons.length ? <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-3"><p className="text-sm font-medium text-warning">核验限制与待办原因</p><ul className="mt-2 space-y-1 text-xs leading-5 text-warning">{event.reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {event.sourceUrl || event.pdfUrl ? <a href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control px-3 text-sm text-accent hover:bg-selected"><ExternalLink className="h-3.5 w-3.5" />原始来源</a> : <span className="inline-flex min-h-11 items-center rounded-md border border-warning px-3 text-xs text-warning">来源链接缺失</span>}
          {stock ? <button type="button" data-stock-id={stock.id} onClick={() => onOpenStock(stock)} className="min-h-11 rounded-md border border-control px-3 text-sm text-textStrong hover:bg-selected">打开个股详情</button> : null}
          {watchItem && onStartReview ? <button type="button" onClick={() => onStartReview(watchItem)} className="min-h-11 rounded-md border border-control px-3 text-sm text-accent hover:bg-selected">开始复盘</button> : null}
        </div>
      </div>
      <EventQualification event={event} />
      <section className="mt-4" aria-label="事件原始数值">
        <h4 className="text-sm font-semibold text-textStrong">事件原始数值</h4>
        <p className="mt-1 text-xs leading-5 text-textMuted">保留原指标、单位与期间口径；缺失数值不补零，也不由界面推导新的比较结果。</p>
        {event.metrics.length ? <div className="mt-3 max-w-full overflow-x-auto rounded-md border border-borderSoft" tabIndex={0} role="region" aria-label="事件数值表，可横向滚动"><table className="w-full min-w-[440px] text-left text-[13px]"><thead className="bg-panel2 text-xs text-textMuted"><tr><th className="p-2">指标</th><th className="p-2 text-right">值</th><th className="p-2">期间口径</th><th className="p-2">来源期间 / 公告</th></tr></thead><tbody>{event.metrics.map((metric) => <tr key={metric.key} className="border-t border-borderSoft"><td className="p-2">{metric.label}</td><td className="p-2 text-right tabular-nums">{formatMetric(metric)}</td><td className="p-2">{({ single_quarter: "单季度", cumulative: "累计", range: "区间", point: "点值" })[metric.periodBasis]}</td><td className="break-all p-2 text-xs text-textMuted">{metric.sourceFinancialPeriod ?? metric.sourceAnnouncementId ?? "未提供"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-textMuted">本事件未提供结构化数值。仅元数据不等于公司未披露。</p>}
      </section>
    </article>
  );
}

function EventQualification({ event }: { event: ResearchEvent }) {
  const expectation = event.expectation;
  const result = expectation?.comparisonResult;
  const resultText = result ? ({ above: "高于该来源预测", within: "处于区间或与点值基本一致", below: "低于该来源预测", not_comparable: "不可比较", insufficient_data: "实际值不足" })[result] : "尚无比较结果";
  const timing = (value?: "before" | "after" | "same_time" | "unknown") => ({ before: "披露前", after: "披露后", same_time: "同一时刻", unknown: "先后未知" })[value ?? "unknown"];
  return <section className="mt-4" aria-label="来源、时间与数值资格">
    <h4 className="text-sm font-semibold text-textStrong">核验条件</h4>
    <div className="mt-3 grid gap-3 min-[1440px]:grid-cols-3">
      <div className="rounded-md border border-borderSoft bg-panel p-3"><h5 className="text-xs font-medium text-textMuted">来源核验</h5><p className="mt-2 text-sm text-textStrong">{expectation ? statusDisplayLabel(expectation.sourceVerificationStatus) : "未提供独立预期来源结论"}</p><p className="mt-1 break-words text-xs leading-5 text-textMuted">{expectation ? `${sourceCategoryLabel(expectation.sourceCategory)} · ${expectation.sourceName}` : `事件原状态：${statusDisplayLabel(event.verificationStatus)}`}</p></div>
      <div className="rounded-md border border-borderSoft bg-panel p-3"><h5 className="text-xs font-medium text-textMuted">事前时间资格</h5><p className="mt-2 text-sm text-textStrong">{expectation?.isExAnte === true ? "事前有效" : expectation?.isExAnte === false ? "非事前有效" : "未确定"}</p><p className="mt-1 text-xs leading-5 text-textMuted">相对实际值：{timing(expectation?.actualDisclosureTimingStatus)}<br />相对公司业绩信息：{timing(expectation?.performanceDisclosureTimingStatus)}</p>{expectation?.businessOrderStatus === "uncertain" || expectation?.performanceDisclosureUncertain ? <p className="mt-1 text-xs text-warning">披露或业务顺序仍待核验</p> : null}</div>
      <div className="rounded-md border border-borderSoft bg-panel p-3"><h5 className="text-xs font-medium text-textMuted">数值可比性</h5><p className="mt-2 text-sm text-textStrong">{resultText}</p><p className="mt-1 text-xs leading-5 text-textMuted">仅展示已有服务结果；来源核验通过与事前资格不互相替代。</p></div>
    </div>
    {expectation?.nonComparableReasonCodes?.length ? <p className="mt-3 break-words text-xs leading-5 text-warning">比较限制代码：{expectation.nonComparableReasonCodes.join("、")}</p> : null}
  </section>;
}

export function ResearchEventStatusBadge({ event }: { event: ResearchEvent }) {
  const warning = event.reviewStatus === "pending" || ["metadata_only", "parse_partial", "parse_unavailable", "missing", "stale", "error"].includes(event.parseStatus);
  return <span className={`rounded border px-2 py-1 text-xs ${warning ? "border-warning/35 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>{statusDisplayLabel(event.parseStatus)} / {statusDisplayLabel(event.verificationStatus)}</span>;
}

function VerificationChainCard({ chain, stock, onOpenStock }: { chain: EarningsVerificationChain; stock?: Stock; onOpenStock: (stock: Stock) => void }) {
  const stages: Array<{ key: EarningsVerificationStage; count: number }> = [
    { key: "preview", count: chain.preview.length },
    { key: "revision", count: chain.revision.length },
    { key: "flash", count: chain.flash.length },
    { key: "formal", count: chain.formal.length },
  ];
  return (
    <article className="rounded-lg border border-borderSoft bg-bg2/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-textStrong">{chain.stockName} · {chain.reportPeriod}</p>
          <p className="mt-1 text-xs text-textMuted">{chain.stockCode} · 同报告期关联</p>
        </div>
        {chain.hasMaterialDifference ? <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">差异 ≥ 10%</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((stage) => <div key={stage.key} className={`rounded-md border p-2 text-center text-xs ${stage.count ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-borderSoft bg-surface/60 text-textMuted"}`}><p>{stageLabel(stage.key)}</p><p className="mt-1 font-semibold">{stage.count ? `${stage.count} 条` : "未发现"}</p></div>)}
      </div>
      {chain.missingStages.length ? <p className="mt-3 text-xs text-textMuted">缺少阶段：{chain.missingStages.map(stageLabel).join("、")}（仅描述本地数据缺口）</p> : null}
      {chain.differences.length ? <div className="mt-3 space-y-1 text-xs text-warning">{chain.differences.map((item) => <p key={`${item.from}-${item.to}`}>{item.metricLabel} {item.from} → {item.to}：{formatFinancialAmount(item.absoluteDifference)}{item.relativeDifference === null ? "（基数为 0，比例不适用）" : `（${(item.relativeDifference * 100).toFixed(2)}%）`}</p>)}</div> : null}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-textMuted">
        <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />关联公告 {new Set([...chain.preview, ...chain.revision, ...chain.flash, ...chain.formal].flatMap((event) => event.relatedAnnouncementIds)).size} 条</span>
        {stock ? <button type="button" onClick={() => onOpenStock(stock)} className="text-cyan hover:underline">查看完整验证</button> : null}
      </div>
    </article>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-textMuted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 min-w-0 rounded-md border border-control bg-panel2 px-2 text-sm text-textStrong">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function formatMetric(metric: ResearchEvent["metrics"][number]) {
  if (metric.value === null || !Number.isFinite(metric.value)) return "缺失";
  if (metric.unit === "CNY") return formatFinancialAmount(metric.value);
  if (metric.unit === "percent" || metric.unit === "ratio") return `${(metric.value * 100).toFixed(2)}%`;
  return String(metric.value);
}

function eventDate(event: ResearchEvent, timeZone: string) {
  if (event.eventDate) return event.eventDate;
  for (const value of [event.publishedAt, event.updatedAt]) {
    if (!value) continue;
    const calendarDate = getTemporalCalendarDate(value, isPreciseInstant(value) ? "datetime" : "date", timeZone);
    if (calendarDate) return calendarDate;
  }
  return null;
}

function dateCutoff(now: Date, window: DateWindow, timeZone: string) {
  if (window === "all") return null;
  const value = new Date(`${getCalendarToday(now, timeZone)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - (Number(window) - 1));
  return value.toISOString().slice(0, 10);
}

function needsDataReview(event: ResearchEvent) {
  return event.eventType === "data_warning" || event.eventType === "earnings_expectation_data_warning"
    || ["parse_partial", "metadata_only", "parse_unavailable", "missing", "stale", "error"].includes(event.parseStatus)
    || event.metrics.some((metric) => metric.value === null)
    || event.reviewReasons.some((reason) => reason.includes("无法匹配"));
}
