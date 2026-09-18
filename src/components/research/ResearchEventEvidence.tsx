import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { safeEvidenceUrl } from "../../utils/evidenceUrl";
import { ExternalLink } from "lucide-react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import { eventTypeLabel } from "../../services/researchEventProvider";
import { sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import { auditDisplayText, statusDisplayLabel, financialMetricLabel, unitDisplayLabel } from "../../utils/displayLabels";
import { formatFinancialAmount } from "../../utils/financialDisplay";

export function ResearchEventEvidence({ event, expectationSnapshot, stock, watchItem, tasks, onOpenStock, onStartReview }: { event: ResearchEvent; expectationSnapshot?: EarningsExpectationSnapshot; stock?: Stock; watchItem?: WatchItem; tasks: ReviewTask[]; onOpenStock: (stock: Stock) => void; onStartReview?: (item: WatchItem) => void }) {
  const sourceUrl = safeEvidenceUrl(event.sourceUrl) ?? safeEvidenceUrl(event.pdfUrl);
  const pendingTaskCount = watchItem ? tasks.filter((task) => task.watchItemId === watchItem.id && task.status === "pending").length : 0;
  return (
    <article className="rounded-lg border border-borderSoft bg-bg2/65 p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
            <span className="font-medium text-textStrong">{event.stockName} · {event.stockCode}</span>
            <span className="rounded border border-borderSoft px-2 py-1">{eventTypeLabel(event.eventType)}</span>
            <ResearchEventStatusBadge event={event} />
            {event.expectation?.ingestionMethod === "provider" ? <span className="rounded border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">数据提供方只读</span> : null}
            {watchItem ? <span className="rounded border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">观察状态：{watchItem.status} · 待复盘 {pendingTaskCount}</span> : null}
          </div>
          <h3 className="mt-2 break-words text-lg font-semibold text-textStrong">{event.title}</h3>
          <p className="mt-1 break-words text-xs text-textMuted">事件来源：{event.sourceName || "未知"}{event.expectation ? ` · ${sourceCategoryLabel(event.expectation.sourceCategory)}` : ""}</p>
          <p className="mt-1 text-xs text-textMuted">记录事件日期：{event.eventDate ?? "缺失"} · 报告期：{event.reportPeriod ?? "缺失"}</p>
          {event.expectation ? <p className="mt-1 break-words text-xs leading-5 text-textMuted">原记录时间：{event.expectation.originalBusinessTime ?? "缺失"}（{statusDisplayLabel(event.expectation.businessTimePrecision ?? "unknown")}） · 当前有效时间：{event.expectation.effectiveBusinessTime ?? "缺失"}（{statusDisplayLabel(event.expectation.effectiveBusinessTimePrecision ?? "unknown")}）{event.expectation.temporalCorrectionApplied ? ` · 时间字段已纠正：${event.expectation.correctedTemporalFields?.map(auditDisplayText).join("、") || "待核验"}` : ""}{event.expectation.correctionRecordedAt ? ` · 纠正记录时间：${event.expectation.correctionRecordedAt}` : ""}{event.expectation.businessOrderStatus === "uncertain" ? " · 业务顺序不确定" : event.expectation.businessOrderStatus === "equal" ? " · 精确时刻相同，不代表先后" : ""}</p> : null}
          {event.expectation?.ingestionMethod === "provider" ? <AdvancedAuditDetails><p className="mt-1 text-xs text-cyan">来源记录 · 数据版本 {event.expectation.providerVersion ?? "-"} · 更新 {event.expectation.providerGeneratedAt ?? "-"} · 公告标识 {event.expectation.sourceAnnouncementId ?? "-"} · 公司内部形成时间未提供；公开可得性须独立核验</p></AdvancedAuditDetails> : null}
          {event.eventType === "earnings_expectation_correction" && event.expectation ? <AdvancedAuditDetails><p className="mt-1 text-xs text-warning">被纠正快照：{event.expectation.correctionDelta?.correctionTargetId ?? event.expectation.correctsSnapshotId ?? "缺失"} · 当前纠正链终点：{event.expectation.effectiveSnapshotId ?? "缺失"} · 变化字段：{event.expectation.correctionDelta?.changedFields.join("、") || "待核验"}</p></AdvancedAuditDetails> : null}
          <p className="mt-3 break-words text-sm leading-6 text-textMuted">{auditDisplayText(event.summary)}</p>
          {event.reviewReasons.length ? <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-3"><p className="text-sm font-medium text-warning">核验限制与待办原因</p><ul className="mt-2 space-y-1 text-xs leading-5 text-warning">{event.reviewReasons.map((reason) => <li key={reason}>{auditDisplayText(reason)}</li>)}</ul></div> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control px-3 text-sm text-accent hover:bg-selected"><ExternalLink className="h-3.5 w-3.5" />原始来源</a> : <span className="inline-flex min-h-11 items-center rounded-md border border-warning px-3 text-xs text-warning">来源链接缺失或不可安全打开</span>}
          {stock ? <button type="button" data-stock-id={stock.id} onClick={() => onOpenStock(stock)} className="min-h-11 rounded-md border border-control px-3 text-sm text-textStrong hover:bg-selected">打开个股详情</button> : null}
          {watchItem && onStartReview ? <button type="button" onClick={() => onStartReview(watchItem)} className="min-h-11 rounded-md border border-control px-3 text-sm text-accent hover:bg-selected">开始复盘</button> : null}
        </div>
      </div>
      <EvidenceProvenance event={event} />
      <EventQualification event={event} />
      {event.expectation ? <section className="mt-4 text-sm leading-6" aria-label="预期原始快照数值"><h4 className="font-semibold">预期证据原始数值</h4>{expectationSnapshot ? <><p>{financialMetricLabel(expectationSnapshot.metric)} · {expectationSnapshot.reportPeriod} · {statusDisplayLabel(expectationSnapshot.periodScope)}</p><p>{expectationSnapshot.estimateShape === "point" ? expectationSnapshot.value ?? "缺失" : `${expectationSnapshot.lowerBound ?? "缺失"} 至 ${expectationSnapshot.upperBound ?? "缺失"}`} · {unitDisplayLabel(expectationSnapshot.currency)} · {unitDisplayLabel(expectationSnapshot.unit)}</p><p className="text-xs text-textMuted">会计口径：{statusDisplayLabel(expectationSnapshot.accountingBasis)}</p><AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all">{JSON.stringify(expectationSnapshot, null, 2)}</pre></AdvancedAuditDetails></> : <p className="text-warning">当前未提供可唯一匹配的原始快照，数值单位与完整口径未证明。请进入公司预期证据核对。</p>}</section> : null}
      <section className="mt-4" aria-label="事件原始数值">
        <h4 className="text-sm font-semibold text-textStrong">事件原始数值</h4>
        <p className="mt-1 text-xs leading-5 text-textMuted">保留原指标、单位与期间口径；缺失数值不补零，也不由界面推导新的比较结果。</p>
        {event.metrics.length ? <div className="mt-3 max-w-full overflow-x-auto rounded-md border border-borderSoft" tabIndex={0} role="region" aria-label="事件数值表，可横向滚动"><table className="w-full min-w-[440px] text-left text-[13px]"><thead className="bg-panel2 text-xs text-textMuted"><tr><th className="p-2">指标</th><th className="p-2 text-right">值</th><th className="p-2">期间口径</th><th className="p-2">来源期间 / 公告</th></tr></thead><tbody>{event.metrics.map((metric) => <tr key={metric.key} className="border-t border-borderSoft"><td className="p-2">{metric.label}</td><td className="p-2 text-right tabular-nums">{formatMetric(metric)}</td><td className="p-2">{({ single_quarter: "单季度", cumulative: "累计", range: "区间", point: "点值" })[metric.periodBasis]}</td><td className="break-all p-2 text-xs text-textMuted">{metric.sourceFinancialPeriod ?? "未提供期间；公告标识见高级审计信息"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-textMuted">本事件未提供结构化数值。仅元数据不等于公司未披露。</p>}
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
    {expectation?.nonComparableReasonCodes?.length ? <AdvancedAuditDetails><p className="mt-3 break-words text-xs leading-5 text-warning">比较限制代码：{expectation.nonComparableReasonCodes.join("、")}</p></AdvancedAuditDetails> : null}
  </section>;
}

export function ResearchEventStatusBadge({ event }: { event: ResearchEvent }) {
  const missingMetrics = event.metrics.filter(metric => metric.value === null || !Number.isFinite(metric.value)).length;
  const warning = missingMetrics > 0 || event.reviewStatus === "pending" || !["parse_success", "not_applicable"].includes(event.parseStatus) || event.verificationStatus !== "verified";
  return <span className={`rounded border px-2 py-1 text-xs ${warning ? "border-warning/35 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>{statusDisplayLabel(event.parseStatus)} / {statusDisplayLabel(event.verificationStatus)}{missingMetrics ? ` · 数值缺失 ${missingMetrics}` : ""}</span>;
}

function formatMetric(metric: ResearchEvent["metrics"][number]) {
  if (metric.value === null || !Number.isFinite(metric.value)) return "缺失";
  if (metric.unit === "CNY") return formatFinancialAmount(metric.value);
  if (metric.unit === "percent" || metric.unit === "ratio") return `${(metric.value * 100).toFixed(2)}%`;
  return String(metric.value);
}


export { safeEvidenceUrl } from "../../utils/evidenceUrl";

function EvidenceProvenance({ event }: { event: ResearchEvent }) {
  const expectation = event.expectation;
  const fields: Array<[string, string | null | undefined]> = [
    ["事件标识", event.id],
    ["业务发生时间", event.eventOccurredAt],
    ["记录标注发布时间", event.publishedAt],
    ["数据更新时间", event.updatedAt],
    ["警告检测时间", event.detectedAt],
    ["本地记录时间", event.recordedAt],
    ["预期来源发布时间", expectation?.sourcePublishedAt],
    ["预期来源时间精度", expectation?.sourcePublishedAtPrecision],
    ["预期快照", expectation?.snapshotId],
    ["业务根快照", expectation?.businessRootSnapshotId],
    ["当前有效快照", expectation?.effectiveSnapshotId],
    ["纠正链引用", expectation?.correctionChainSnapshotIds?.join("、")],
    ["被纠正版本", expectation?.providerCorrectsVersionId],
    ["内容版本", expectation?.providerSnapshotVersionId],
    ["内容校验和（原记录）", expectation?.providerContentChecksum],
    ["关联公告", event.relatedAnnouncementIds.join("、")],
    ["关联财务期间", event.relatedFinancialPeriod],
    ["重述标记（原记录）", event.isRestated === true ? "是" : event.isRestated === false ? "否" : null],
  ];
  return <section className="mt-4 space-y-3" aria-label="证据来源与时间明细">
    <h4 className="text-sm font-semibold">来源与时间</h4>
    <p className="text-xs leading-5 text-warning">日期均为原记录字段。财务摘要的事件日期可能是报告期，标注发布时间可能是采集时间；更新、检测与记录时间不证明公开发布时间或历史可得性。</p>
    <dl className="grid gap-3 sm:grid-cols-2">{fields.filter(([label]) => ["业务发生时间", "记录标注发布时间", "数据更新时间", "预期来源发布时间", "重述标记（原记录）"].includes(label)).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-textMuted">{label}</dt><dd className="mt-1 break-all text-sm">{value || "未提供"}</dd></div>)}</dl>
    <AdvancedAuditDetails><dl className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="break-all">{value || "未提供"}</dd></div>)}</dl><pre className="whitespace-pre-wrap break-all">{JSON.stringify(event, null, 2)}</pre></AdvancedAuditDetails>
    <div className="space-y-2 text-xs">{([["来源 URL", event.sourceUrl], ["PDF URL", event.pdfUrl], ["预期官方 PDF", expectation?.officialPdfUrl]] as const).map(([label, value]) => <p key={label} className="break-all">{label}：{safeEvidenceUrl(value) ? <a className="text-accent underline" href={safeEvidenceUrl(value)!} target="_blank" rel="noreferrer">{value}</a> : value ? "未提供可安全打开的 HTTP(S) 链接" : "未提供"}</p>)}</div>
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-6 text-warning" aria-label="证据证明边界">
      <p>历史时点可得性（PIT）：未证明 · 公开可得时间：未提供</p>
      <p>生产 / 数据准入：未证明（未确认） · 正式修订连续性：未证明</p>
      <p>证据关联闭合性：未证明 · 保留原文与定位证据：未提供</p>
      <p>来源链接、解析成功、快照或版本引用均不能替代以上证明。预期事前资格仅展示已有比较服务结果。</p>
    </div>
  </section>;
}
