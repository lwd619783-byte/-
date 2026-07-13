import { AlertTriangle, ExternalLink } from "lucide-react";
import type { AShareAnnouncementData, AShareFinancialData, EarningsVerificationChain, FinancialReport, ResearchEvent, Stock } from "../../types";
import { buildEarningsVerificationChains, buildResearchEventsForStock, eventTypeLabel } from "../../services/researchEventProvider";
import { financialStatusLabel, formatFinancialAmount, formatFinancialChangeMetric } from "../../utils/financialDisplay";

interface EarningsVerificationPanelProps {
  stock: Stock;
  financialData: AShareFinancialData | null;
  announcementData: AShareAnnouncementData | null;
  financialLoadStatus: "idle" | "loading" | "success" | "error";
  announcementLoadStatus: "idle" | "loading" | "success" | "error";
}

export interface EarningsVerificationView {
  latestReportPeriod: string | null;
  latestReport: FinancialReport | null;
  chain: EarningsVerificationChain | null;
  events: ResearchEvent[];
  loadWarnings: string[];
}

export function buildEarningsVerificationView(
  stock: Stock,
  financialData: AShareFinancialData | null,
  announcementData: AShareAnnouncementData | null,
  financialLoadStatus: EarningsVerificationPanelProps["financialLoadStatus"],
  announcementLoadStatus: EarningsVerificationPanelProps["announcementLoadStatus"],
): EarningsVerificationView {
  const events = buildResearchEventsForStock(stock, {
    financialData,
    announcementData,
    financialLoadError: financialLoadStatus === "error" ? "财务详情加载失败，当前保留真实摘要。" : null,
    announcementLoadError: announcementLoadStatus === "error" ? "公告详情加载失败，当前保留真实摘要。" : null,
  });
  const latestReport = financialData?.reports?.[0] ?? null;
  const latestReportPeriod = latestReport?.reportPeriod ?? stock.aShareFinancialSummary?.latestReportPeriod ?? null;
  const chains = buildEarningsVerificationChains(events);
  const chain = chains.find((item) => item.reportPeriod === latestReportPeriod) ?? chains[0] ?? null;
  const loadWarnings = [
    financialLoadStatus === "loading" ? "正在加载完整财务文件" : null,
    announcementLoadStatus === "loading" ? "正在加载完整公告文件" : null,
    financialLoadStatus === "error" ? "财务详情加载失败，未使用 mock 数据" : null,
    announcementLoadStatus === "error" ? "公告详情加载失败，未使用 mock 数据" : null,
  ].filter((item): item is string => Boolean(item));
  return { latestReportPeriod, latestReport, chain, events, loadWarnings };
}

export function EarningsVerificationPanel(props: EarningsVerificationPanelProps) {
  const view = buildEarningsVerificationView(props.stock, props.financialData, props.announcementData, props.financialLoadStatus, props.announcementLoadStatus);
  const summary = props.stock.aShareFinancialSummary;
  if (props.stock.dataMode === "mock") return <p className="text-sm text-textMuted">Mock 模式不生成业绩验证结论；切换至 Real 或 Mixed 查看真实披露。</p>;
  if (props.stock.market !== "A股") return <p className="text-sm text-textMuted">当前市场的财务与公告验证链尚未接入。</p>;
  if (!summary && !view.latestReport) return <p className="text-sm text-warning">未找到真实财务摘要，无法建立业绩验证链。</p>;

  const report = view.latestReport;
  const latestSingle = report?.singleQuarter ?? summary?.latestSingleQuarter;
  const changes = report?.derived ?? summary?.latestChanges;
  const singleQuarterReliable = report ? report.singleQuarter !== null : Boolean(summary?.latestReportPeriod);
  const cumulative = report?.cumulative;
  const chain = view.chain;
  const performanceEvents = chain ? [...chain.preview, ...chain.revision, ...chain.flash, ...chain.formal] : [];
  const sourceEvents = [...performanceEvents, ...(chain?.financialUpdates ?? [])];
  const uniqueLinks = sourceEvents.filter((event) => event.sourceUrl || event.pdfUrl).filter((event, index, items) => items.findIndex((item) => (item.sourceUrl ?? item.pdfUrl) === (event.sourceUrl ?? event.pdfUrl)) === index);

  return (
    <div className="space-y-4">
      {view.loadWarnings.length ? <div className="rounded-md border border-warning/35 bg-warning/10 p-3 text-xs text-warning">{view.loadWarnings.join("；")}</div> : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="当前最新报告期" value={view.latestReportPeriod ?? "报告期缺失"} />
        <Field label="财务状态" value={summary ? financialStatusLabel(summary.status) : report?.status ?? "缺失"} />
        <Field label="财务更新时间" value={report?.fetchedAt ?? summary?.fetchedAt ?? "缺失"} />
        <Field label="证据状态" value={report?.status === "success" || summary?.status === "success" ? "正式财务来源可追溯" : "需人工核验"} />
      </div>

      <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-textStrong">正式报告财务值</h4>
          {report?.isRestated ? <span className="rounded border border-warning/35 bg-warning/10 px-2 py-1 text-xs text-warning">修正 / 重述数据</span> : null}
        </div>
        <p className="mt-1 text-xs text-textMuted">累计值与单季度值严格分列；经营现金流与利润比较均为同报告期累计口径。</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="累计营业收入" value={report ? formatFinancialAmount(cumulative?.operatingRevenue) : "完整文件加载后显示"} />
          <Field label="累计归母净利润" value={report ? formatFinancialAmount(cumulative?.netProfitAttributableToParent) : "完整文件加载后显示"} />
          <Field label="累计扣非净利润" value={report ? formatFinancialAmount(cumulative?.netProfitExcludingNonRecurring) : "完整文件加载后显示"} />
          <Field label="累计经营现金流" value={report ? formatFinancialAmount(cumulative?.netOperatingCashFlow) : "完整文件加载后显示"} />
          <Field label="单季度营业收入" value={singleQuarterReliable ? formatFinancialAmount(latestSingle?.operatingRevenue) : "暂无法可靠计算"} />
          <Field label="单季度归母净利润" value={singleQuarterReliable ? formatFinancialAmount(latestSingle?.netProfitAttributableToParent) : "暂无法可靠计算"} />
          <Field label="单季度扣非净利润" value={singleQuarterReliable ? formatFinancialAmount(latestSingle?.netProfitExcludingNonRecurring) : "暂无法可靠计算"} />
          <Field label="单季度经营现金流" value={singleQuarterReliable ? formatFinancialAmount(latestSingle?.netOperatingCashFlow) : "暂无法可靠计算"} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="单季度收入同比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.revenueYoY) : "暂无法可靠计算"} />
          <Field label="单季度收入环比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.revenueQoQ) : "暂无法可靠计算"} />
          <Field label="单季度归母净利润同比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.parentNetProfitYoY) : "暂无法可靠计算"} />
          <Field label="单季度归母净利润环比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.parentNetProfitQoQ) : "暂无法可靠计算"} />
          <Field label="单季度扣非净利润同比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.deductedNetProfitYoY) : "暂无法可靠计算"} />
          <Field label="单季度扣非净利润环比" value={singleQuarterReliable ? formatFinancialChangeMetric(changes?.deductedNetProfitQoQ) : "暂无法可靠计算"} />
        </div>
      </div>

      <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
        <h4 className="text-sm font-semibold text-textStrong">预告 → 修正 → 快报 → 正式报告</h4>
        <p className="mt-1 text-xs text-textMuted">未发现某阶段只表示本地已提交公告中没有对应记录，不推断公司必须发布。</p>
        {chain ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Stage title="业绩预告" events={chain.preview} />
              <Stage title="预告修正" events={chain.revision} />
              <Stage title="业绩快报" events={chain.flash} />
              <Stage title="正式报告" events={chain.formal} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Field label="预告归母净利润区间" value={forecastRange(chain)} />
              <Field label="快报归母净利润" value={chain.flash[0] ? metricAmount(chain.flash[0], "netProfitAttributableToParent") : "未发现可用数值"} />
              <Field label="正式报告累计归母净利润" value={report ? formatFinancialAmount(report.cumulative.netProfitAttributableToParent) : "完整财务文件加载后显示"} />
            </div>
            {chain.differences.length ? (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-semibold text-warning">披露数值差异（绝对值与相对值）</p>
                {chain.differences.map((difference) => <p key={`${difference.from}-${difference.to}`} className="mt-1 text-xs text-textMuted">{difference.metricLabel} {difference.from} → {difference.to}：{formatFinancialAmount(difference.absoluteDifference)}{difference.relativeDifference === null ? "；基数为 0，比例不适用" : `；${(difference.relativeDifference * 100).toFixed(2)}%`}</p>)}
              </div>
            ) : <p className="mt-3 text-xs text-textMuted">当前链条缺少可直接比较的同口径归母净利润数值。</p>}
          </>
        ) : <p className="mt-3 text-sm text-textMuted">当前没有可关联的报告期事件。</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
          <h4 className="text-sm font-semibold text-textStrong">解析与人工核验状态</h4>
          <div className="mt-3 space-y-2">
            {performanceEvents.length ? performanceEvents.map((event) => <div key={event.id} className="rounded border border-borderSoft bg-surface/60 p-2 text-xs"><p className="text-textStrong">{eventTypeLabel(event.eventType)} · {event.eventDate ?? "日期缺失"}</p><p className="mt-1 text-textMuted">{event.parseStatus} / {event.verificationStatus}{event.isRestated ? " · 修正或重述" : ""}</p>{event.reviewReasons.length ? <p className="mt-1 text-warning">{event.reviewReasons.join("；")}</p> : null}</div>) : <p className="text-sm text-textMuted">未发现业绩公告。</p>}
          </div>
        </div>
        <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
          <h4 className="text-sm font-semibold text-textStrong">官方来源</h4>
          <p className="mt-1 text-xs text-textMuted">只列出事件或财务文件中保留的正式来源链接。</p>
          <div className="mt-3 space-y-2">
            {uniqueLinks.length ? uniqueLinks.map((event) => <a key={`${event.id}-source`} href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded border border-borderSoft bg-surface/60 p-2 text-xs text-cyan hover:border-cyan"><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{event.title}</span></a>) : <p className="inline-flex items-center gap-2 text-sm text-warning"><AlertTriangle className="h-4 w-4" />当前事件缺少可打开的官方链接</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-borderSoft bg-surface/65 p-3"><p className="text-xs text-textMuted">{label}</p><p className="mt-1 break-words text-sm font-medium text-textStrong">{value}</p></div>;
}

function Stage({ title, events }: { title: string; events: ResearchEvent[] }) {
  return <div className={`rounded-md border p-3 ${events.length ? "border-cyan/30 bg-cyan/10" : "border-borderSoft bg-surface/60"}`}><p className="text-xs text-textMuted">{title}</p><p className={`mt-1 text-sm font-semibold ${events.length ? "text-cyan" : "text-textMuted"}`}>{events.length ? `${events.length} 条` : "未发现"}</p>{events[0] ? <p className="mt-1 text-xs text-textMuted">{events[0].eventDate ?? "日期缺失"}</p> : null}</div>;
}

function forecastRange(chain: EarningsVerificationChain) {
  const event = chain.revision[0] ?? chain.preview[0];
  if (!event) return "未发现业绩预告";
  const lower = event.metrics.find((metric) => metric.key === "netProfitAttributableToParentForecastLower")?.value ?? null;
  const upper = event.metrics.find((metric) => metric.key === "netProfitAttributableToParentForecastUpper")?.value ?? null;
  return lower === null || upper === null ? "预告区间缺失，需要人工核验" : `${formatFinancialAmount(lower)} 至 ${formatFinancialAmount(upper)}`;
}

function metricAmount(event: ResearchEvent, key: string) {
  const value = event.metrics.find((metric) => metric.key === key)?.value ?? null;
  return value === null ? "缺失" : formatFinancialAmount(value);
}
