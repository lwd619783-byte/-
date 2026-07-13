import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckSquare, ExternalLink, FileCheck2, Link2 } from "lucide-react";
import type { EarningsVerificationChain, EarningsVerificationStage, Industry, ResearchEvent, ResearchEventSnapshot, ResearchEventType, ReviewTask, Stock, WatchItem } from "../../types";
import { eventTypeLabel, stageLabel } from "../../services/researchEventProvider";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { DashboardCard, EmptyState, KpiCard, SectionHeader, TextClamp } from "../common/terminal";

interface ResearchEventCenterProps {
  snapshot: ResearchEventSnapshot;
  stocks: Stock[];
  industries: Industry[];
  onOpenStock: (stock: Stock) => void;
  watchItems?: WatchItem[];
  reviewTasks?: ReviewTask[];
  onStartReview?: (item: WatchItem) => void;
  now?: Date;
}

type DateWindow = "7" | "30" | "all";

export function ResearchEventCenter({ snapshot, stocks, industries, onOpenStock, watchItems = [], reviewTasks = [], onStartReview, now = new Date() }: ResearchEventCenterProps) {
  const [company, setCompany] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [eventType, setEventType] = useState<ResearchEventType | "all">("all");
  const [dateWindow, setDateWindow] = useState<DateWindow>("30");
  const [parseStatus, setParseStatus] = useState("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const cutoff = useMemo(() => dateCutoff(now, dateWindow), [now, dateWindow]);

  const filteredEvents = useMemo(() => snapshot.events.filter((event) => {
    if (company !== "all" && event.stockId !== company) return false;
    if (industry !== "all" && event.industryId !== industry) return false;
    if (eventType !== "all" && event.eventType !== eventType) return false;
    if (parseStatus !== "all" && event.parseStatus !== parseStatus && event.verificationStatus !== parseStatus) return false;
    if (reviewOnly && event.reviewStatus !== "pending") return false;
    if (cutoff && !eventDate(event)) return false;
    if (cutoff && (eventDate(event) as string) < cutoff) return false;
    return true;
  }), [company, cutoff, eventType, industry, parseStatus, reviewOnly, snapshot.events]);

  const visibleChains = useMemo(() => snapshot.chains.filter((chain) => {
    const stock = stocks.find((item) => item.id === chain.stockId);
    return (company === "all" || chain.stockId === company) && (industry === "all" || stock?.industryId === industry);
  }).slice(0, 12), [company, industry, snapshot.chains, stocks]);

  const queue = useMemo(() => snapshot.events.filter(needsDataReview), [snapshot.events]);
  const sevenDayCutoff = dateCutoff(now, "7") as string;
  const recentCount = snapshot.events.filter((event) => !["data_warning", "earnings_expectation_data_warning"].includes(event.eventType) && (eventDate(event) ?? "") >= sevenDayCutoff).length;
  const pendingCompanies = new Set(snapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
  const performanceCount = snapshot.events.filter((event) => ["earnings_preview", "earnings_flash", "periodic_report"].includes(event.eventType)).length;

  return (
    <section className="space-y-4" aria-label="投研事件与业绩验证中心">
      <DashboardCard className="p-5">
        <SectionHeader
          eyebrow="Research Verification"
          title="投研事件与业绩验证中心"
          description="把已提交的真实公告与财务摘要统一为可追溯事件；全量历史和差异明细在打开个股后按需加载。"
        />
      </DashboardCard>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="验证中心指标">
        <KpiCard label="最近 7 天事件" value={recentCount} delta="真实摘要" description="按公告日期或财务更新时间统计" tone="info" icon={<CalendarDays className="h-4 w-4" />} />
        <KpiCard label="待复盘公司" value={pendingCompanies} delta="需人工判断" description="至少有一项待复盘或数据缺口" tone={pendingCompanies ? "warning" : "positive"} icon={<CheckSquare className="h-4 w-4" />} />
        <KpiCard label="业绩验证事件" value={performanceCount} delta="预告 / 快报 / 报告" description="不与机构一致预期进行比较" tone="positive" icon={<FileCheck2 className="h-4 w-4" />} />
        <KpiCard label="数据核验" value={queue.length} delta="部分解析或缺失" description="保留 metadata_only、stale 与 error" tone={queue.length ? "warning" : "positive"} icon={<AlertTriangle className="h-4 w-4" />} />
      </section>

      <DashboardCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Filter label="公司" value={company} onChange={setCompany} options={[{ value: "all", label: "全部公司" }, ...stocks.filter((stock) => stock.market === "A股").map((stock) => ({ value: stock.id, label: `${stock.name} ${stock.code}` }))]} />
          <Filter label="行业" value={industry} onChange={setIndustry} options={[{ value: "all", label: "全部行业" }, ...industries.map((item) => ({ value: item.id, label: item.name }))]} />
          <Filter label="事件类型" value={eventType} onChange={(value) => setEventType(value as ResearchEventType | "all")} options={[{ value: "all", label: "全部事件" }, ...(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report", "financial_update", "announcement", "data_warning", "earnings_expectation_added", "earnings_expectation_revision", "earnings_expectation_comparison_available", "earnings_expectation_data_warning"] as ResearchEventType[]).map((value) => ({ value, label: eventTypeLabel(value) }))]} />
          <Filter label="日期" value={dateWindow} onChange={(value) => setDateWindow(value as DateWindow)} options={[{ value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "all", label: "全部日期" }]} />
          <Filter label="解析 / 数据状态" value={parseStatus} onChange={setParseStatus} options={[{ value: "all", label: "全部状态" }, { value: "parse_success", label: "parse_success" }, { value: "parse_partial", label: "parse_partial" }, { value: "metadata_only", label: "metadata_only" }, { value: "stale", label: "stale" }, { value: "missing", label: "missing" }, { value: "error", label: "error" }]} />
          <label className="flex min-w-0 flex-col gap-1 text-xs text-textMuted">
            复盘状态
            <button type="button" aria-pressed={reviewOnly} onClick={() => setReviewOnly((value) => !value)} className={`h-10 rounded-md border px-3 text-left text-sm ${reviewOnly ? "border-warning/60 bg-warning/10 text-warning" : "border-borderSoft bg-bg2/80 text-textStrong"}`}>
              {reviewOnly ? "仅看待复盘" : "全部复盘状态"}
            </button>
          </label>
        </div>
      </DashboardCard>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <DashboardCard className="min-w-0 p-4">
          <h2 className="text-base font-semibold text-textStrong">最近事件</h2>
          <p className="mt-1 text-xs text-textMuted">共 {filteredEvents.length} 条；无来源数字不会进入事件指标。</p>
          <div className="mt-4 space-y-3">
            {filteredEvents.length === 0 ? <EmptyState title="没有匹配事件" description="请调整筛选条件，或检查摘要数据状态。" /> : filteredEvents.slice(0, 80).map((event) => (
              <EventCard key={event.id} event={event} stock={stocks.find((stock) => stock.id === event.stockId)} watchItem={watchItems.find((item) => item.stockId === event.stockId && !item.archivedAt)} tasks={reviewTasks} onOpenStock={onOpenStock} onStartReview={onStartReview} />
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="min-w-0 p-4">
          <h2 className="text-base font-semibold text-textStrong">数据核验队列</h2>
          <p className="mt-1 text-xs text-textMuted">部分解析、仅元数据、过期、错误、缺值和报告期未匹配。</p>
          <div className="mt-4 space-y-3">
            {queue.length === 0 ? <p className="text-sm text-textMuted">当前没有数据核验项。</p> : queue.slice(0, 30).map((event) => (
              <article key={`queue-${event.id}`} className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-textStrong">{event.stockName}</span>
                  <ResearchEventStatusBadge event={event} />
                </div>
                <p className="mt-2 text-sm text-textMuted">{event.title}</p>
                <ul className="mt-2 space-y-1 text-xs text-warning">
                  {event.reviewReasons.map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="p-4">
        <h2 className="text-base font-semibold text-textStrong">业绩验证链</h2>
        <p className="mt-1 text-xs text-textMuted">链条缺口表示当前已提交数据中未发现该阶段，不代表公司依法必须发布该类公告。</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {visibleChains.length === 0 ? <p className="text-sm text-textMuted">当前筛选下没有可关联报告期。</p> : visibleChains.map((chain) => (
            <VerificationChainCard key={chain.id} chain={chain} stock={stocks.find((stock) => stock.id === chain.stockId)} onOpenStock={onOpenStock} />
          ))}
        </div>
      </DashboardCard>
    </section>
  );
}

function EventCard({ event, stock, watchItem, tasks, onOpenStock, onStartReview }: { event: ResearchEvent; stock?: Stock; watchItem?: WatchItem; tasks: ReviewTask[]; onOpenStock: (stock: Stock) => void; onStartReview?: (item: WatchItem) => void }) {
  const pendingTaskCount = watchItem ? tasks.filter((task) => task.watchItemId === watchItem.id && task.status === "pending").length : 0;
  return (
    <article className="rounded-lg border border-borderSoft bg-bg2/65 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
            <span className="font-medium text-textStrong">{event.stockName} · {event.stockCode}</span>
            <span className="rounded border border-borderSoft px-2 py-1">{eventTypeLabel(event.eventType)}</span>
            <ResearchEventStatusBadge event={event} />
            {watchItem ? <span className="rounded border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">观察状态：{watchItem.status} · 待复盘 {pendingTaskCount}</span> : null}
          </div>
          <p className="mt-2 text-sm font-semibold text-textStrong">{event.title}</p>
          <p className="mt-1 text-xs text-textMuted">公告 / 事件日期：{event.eventDate ?? "缺失"} · 报告期：{event.reportPeriod ?? "缺失"}</p>
          <TextClamp lines={3} title={event.summary} className="mt-2 text-sm leading-6 text-textMuted">{event.summary}</TextClamp>
          {event.metrics.some((metric) => metric.value !== null) ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-textMuted">
              {event.metrics.filter((metric) => metric.value !== null).slice(0, 4).map((metric) => (
                <span key={metric.key} className="rounded border border-borderSoft bg-surface/70 px-2 py-1">
                  {metric.label}：{formatMetric(metric)} · {metric.periodBasis === "single_quarter" ? "单季度" : metric.periodBasis === "cumulative" ? "累计" : "区间"}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {event.sourceUrl || event.pdfUrl ? <a href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan/40 px-3 text-xs text-cyan hover:border-cyan"><ExternalLink className="h-3.5 w-3.5" />官方来源</a> : <span className="inline-flex h-9 items-center rounded-md border border-warning/35 px-3 text-xs text-warning">来源链接缺失</span>}
          {stock ? <button type="button" onClick={() => onOpenStock(stock)} className="h-9 rounded-md border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan">打开个股详情</button> : null}
          {watchItem && onStartReview ? <button type="button" onClick={() => onStartReview(watchItem)} className="h-9 rounded-md border border-cyan/50 px-3 text-xs text-cyan hover:border-cyan">开始复盘</button> : null}
        </div>
      </div>
    </article>
  );
}

export function ResearchEventStatusBadge({ event }: { event: ResearchEvent }) {
  const warning = event.reviewStatus === "pending" || ["metadata_only", "parse_partial", "parse_unavailable", "missing", "stale", "error"].includes(event.parseStatus);
  return <span className={`rounded border px-2 py-1 text-xs ${warning ? "border-warning/35 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>{event.parseStatus} / {event.verificationStatus}</span>;
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
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-textMuted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-md border border-borderSoft bg-bg2/80 px-2 text-sm text-textStrong outline-none focus:border-cyan">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function formatMetric(metric: ResearchEvent["metrics"][number]) {
  if (metric.value === null) return "缺失";
  if (metric.unit === "CNY") return formatFinancialAmount(metric.value);
  if (metric.unit === "percent" || metric.unit === "ratio") return `${(metric.value * 100).toFixed(2)}%`;
  return String(metric.value);
}

function eventDate(event: ResearchEvent) {
  return event.eventDate ?? event.publishedAt?.slice(0, 10) ?? event.updatedAt?.slice(0, 10) ?? null;
}

function dateCutoff(now: Date, window: DateWindow) {
  if (window === "all") return null;
  const value = new Date(now);
  value.setDate(value.getDate() - (Number(window) - 1));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function needsDataReview(event: ResearchEvent) {
  return event.eventType === "data_warning" || event.eventType === "earnings_expectation_data_warning"
    || ["parse_partial", "metadata_only", "parse_unavailable", "missing", "stale", "error"].includes(event.parseStatus)
    || event.metrics.some((metric) => metric.value === null)
    || event.reviewReasons.some((reason) => reason.includes("无法匹配"));
}
