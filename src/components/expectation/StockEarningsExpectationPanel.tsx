import { ExternalLink, Plus } from "lucide-react";
import type { AShareAnnouncementData, AShareFinancialData, EarningsExpectationSnapshot, Stock } from "../../types";
import { buildEarningsExpectationComparisons, comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import { deriveExpectationCorrectionDelta, getExpectationBusinessTime, isExpectationSourcePublishedAtUnresolved, resolveEffectiveBusinessHistory, selectEffectiveEarningsExpectations } from "../../services/earningsExpectationIntegrity";
import { buildResearchEventsForStock } from "../../services/researchEventProvider";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { resolveSafeWorkflowTimeZone } from "../../utils/dateTime";
import { EarningsExpectationTemporalAudit } from "./EarningsExpectationTemporalAudit";

interface StockEarningsExpectationPanelProps {
  stock: Stock;
  snapshots: EarningsExpectationSnapshot[];
  financialData: AShareFinancialData | null;
  announcementData: AShareAnnouncementData | null;
  financialLoadStatus: "idle" | "loading" | "success" | "error";
  announcementLoadStatus: "idle" | "loading" | "success" | "error";
  timeZone?: string;
  onAdd?: (stock: Stock) => void;
  onCorrect?: (snapshot: EarningsExpectationSnapshot) => void;
}

export function StockEarningsExpectationPanel(props: StockEarningsExpectationPanelProps) {
  const timeZone = resolveSafeWorkflowTimeZone(props.timeZone);
  const snapshots = props.snapshots.filter((snapshot) => snapshot.stockId === props.stock.id);
  const selections = selectEffectiveEarningsExpectations(snapshots, timeZone);
  const effective = selections.map((selection) => selection.snapshot).sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod));
  const uncertaintyBySnapshot = new Map(selections.map((selection) => [selection.snapshot.id, selection.businessOrderUncertain]));
  const orderStatusBySnapshot = new Map(selections.map((selection) => [selection.snapshot.id, selection.businessOrderStatus]));
  const selectionBySnapshot = new Map(selections.map((selection) => [selection.snapshot.id, selection]));
  const actualEvents = buildResearchEventsForStock(props.stock, {
    financialData: props.financialData,
    announcementData: props.announcementData,
    financialLoadError: props.financialLoadStatus === "error" ? "财务详情加载失败，未使用 mock 数据。" : null,
    announcementLoadError: props.announcementLoadStatus === "error" ? "公告详情加载失败，未使用 mock 数据。" : null,
  });
  const comparisons = buildEarningsExpectationComparisons(snapshots, actualEvents, { revisionReminderThreshold: 0.1, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9, timeZone });
  const comparisonBySnapshot = new Map(comparisons.map((item) => [item.snapshotId, item]));
  if (!snapshots.length) return <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4"><p className="text-sm text-textMuted">当前公司尚无业绩预期快照。系统不会自动写入示例预测。</p>{props.onAdd ? <button type="button" onClick={() => props.onAdd?.(props.stock)} className={`${buttonClass} mt-3 border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加业绩预期</button> : null}</div>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-textStrong">当前有效预期</p><p className="mt-1 text-xs text-textMuted">公司指引、单家机构、机构一致预期和用户预测分别展示，不合并成单一标签。</p></div>{props.onAdd ? <button type="button" onClick={() => props.onAdd?.(props.stock)} className={`${buttonClass} border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加新快照</button> : null}</div>
    <div className="space-y-3">{effective.map((snapshot) => { const selection = selectionBySnapshot.get(snapshot.id); const comparison = comparisonBySnapshot.get(snapshot.id); const history = snapshots.filter((item) => expectationGroupKey(item) === expectationGroupKey(snapshot)); const businessNodes = resolveEffectiveBusinessHistory(history, timeZone); const currentNode = businessNodes.find((node) => node.effectiveSnapshot.id === snapshot.id); return <article key={snapshot.id} className="rounded-lg border border-borderSoft bg-bg2/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2 text-xs"><Badge value={sourceCategoryLabel(snapshot.sourceCategory)} warning={snapshot.sourceCategory === "user_estimate"} /><Badge value={snapshot.sourceVerificationStatus} warning={snapshot.sourceVerificationStatus !== "verified"} />{snapshot.correctsSnapshotId ? <Badge value={snapshot.correctionScope === "basis" ? "口径纠正" : "数值纠正"} warning /> : null}{comparison?.isExAnte ? <Badge value="事前有效" /> : <Badge value="事后参考 / 待匹配" warning />}</div><p className="mt-2 break-words text-sm font-semibold text-textStrong">{metricLabel(snapshot.metric)} · {snapshot.reportPeriod} · {periodScopeLabel(snapshot.periodScope)}</p><p className="mt-1 break-words text-sm text-cyan">{formatSnapshot(snapshot)}</p></div><div className="flex flex-wrap gap-2">{snapshot.sourceUrl ? <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className={buttonClass}><ExternalLink className="h-4 w-4" />原始来源</a> : null}{props.onCorrect ? <button type="button" onClick={() => props.onCorrect?.(snapshot)} className={buttonClass}>创建纠正快照</button> : null}</div></div>
      {uncertaintyBySnapshot.get(snapshot.id) ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">同日存在多条仅日期精度的预测，无法确认业务先后顺序。当前不生成正式预期差，请补充精确形成时间。</div> : null}
      {orderStatusBySnapshot.get(snapshot.id) === "equal" ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">两条独立预测形成于同一精确时刻；时间关系为 equal，不生成方向性修订或任务。</div> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Field label="来源名称" value={snapshot.sourceName || "缺失"} /><Field label="原记录业务时间" value={`${currentNode?.originalBusinessTime.value ?? getExpectationBusinessTime(snapshot, timeZone).value} (${currentNode?.originalBusinessTime.precision ?? "date"})`} /><Field label="纠正后有效业务时间" value={`${currentNode?.effectiveBusinessTime.value ?? getExpectationBusinessTime(snapshot, timeZone).value} (${currentNode?.effectiveBusinessTime.precision ?? snapshot.formedAtPrecision ?? "date"})`} /><Field label="当前有效来源时间" value={formatSourceTime(snapshot)} /><Field label="分析师 / 机构数量" value={`${snapshot.analystCount ?? "-"} / ${snapshot.institutionCount ?? "-"}`} /><Field label="会计口径" value={snapshot.accountingBasis} /></div>
      <EarningsExpectationTemporalAudit snapshot={snapshot} selection={selection} comparison={comparison} displayTimeZone={timeZone} />
      {currentNode?.temporalCorrectionApplied ? <div role="status" className="mt-2 rounded border border-cyan/35 bg-cyan/10 p-2 text-xs text-cyan">时间字段已纠正：{currentNode.correctedTemporalFields.join("、")}。当前排序与事前判断使用纠正后有效时间。</div> : null}
      {currentNode?.actualSourceInterpretationTimeZone && currentNode.actualSourceInterpretationTimeZone !== timeZone ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">来源时间实际按记录时区 {currentNode.actualSourceInterpretationTimeZone} 解释，而非当前工作流时区 {timeZone}。</div> : null}
      {isExpectationSourcePublishedAtUnresolved(snapshot) ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">历史来源时间缺少原解释时区，已保留原值并等待人工核验；不会据此证明事前有效。</div> : null}
      <div className={`mt-3 rounded border p-3 text-xs ${comparison?.comparabilityStatus === "comparable" ? "border-success/30 bg-success/10 text-textMuted" : "border-warning/30 bg-warning/10 text-warning"}`}><p className="font-semibold text-textStrong">{comparison ? comparisonResultLabel(comparison, snapshot) : "尚未比较"}</p><p className="mt-1">{comparison?.comparisonMethod ?? "等待可靠实际值。"}</p>{comparison ? <p className="mt-1">相对实际值披露：{timingStatusText(comparison.actualDisclosureTimingStatus)} · 相对公司业绩信息披露：{timingStatusText(comparison.performanceDisclosureTimingStatus)}{comparison.performanceDisclosureUncertain ? "（指标覆盖待核验）" : ""}</p> : null}{comparison?.actualDisclosureTimingStatus === "same_time" || comparison?.performanceDisclosureTimingStatus === "same_time" ? <p className="mt-1 font-medium">预测形成时间与披露时间相同，无法认定为披露前预测。</p> : null}<p className="mt-1">公司公开披露边界与本地数值解析状态分别展示；部分解析不等于公司未披露。</p>{comparison?.actualValue !== null && comparison?.actualValue !== undefined ? <p className="mt-1">本地已可靠解析实际值：{formatFinancialAmount(comparison.actualValue)} · 绝对差异：{formatFinancialAmount(comparison.absoluteDifference)}{comparison.relativeDifference === null ? "" : ` · 相对差异 ${(comparison.relativeDifference * 100).toFixed(2)}%`}</p> : null}{comparison?.nonComparableReasons.length ? <p className="mt-1">比较限制 / 原因：{comparison.nonComparableReasons.join("；")}</p> : null}<p className="mt-1">计算方法：{comparison?.comparisonMethod ?? "未计算"}</p></div>
      {history.length > 1 ? <div className="mt-3 rounded border border-borderSoft bg-surface/60 p-3"><p className="text-xs font-semibold text-textStrong">业务节点与纠正链历史（append-only）</p>{businessNodes.map((node) => <div key={node.businessRootSnapshot.id} className="mt-2 border-l border-borderSoft pl-3 text-xs text-textMuted"><p>原记录时间 {node.originalBusinessTime.value} · 当前有效时间 {node.effectiveBusinessTime.value} · 根快照 {node.businessRootSnapshot.id} · 当前终点 {node.effectiveSnapshot.id} · {formatSnapshot(node.effectiveSnapshot)}</p>{node.correctionChain.slice(1).map((correction) => { const target = node.correctionChain.find((item) => item.id === correction.correctsSnapshotId); const delta = deriveExpectationCorrectionDelta(correction, target); return <p key={correction.id} className="mt-1 text-warning">纠正记录 {correction.createdAt} · {correction.correctsSnapshotId} → {correction.id} · 变化字段：{delta?.changedFields.join("、") || "待核验"} · 原因：{correction.notes ?? "缺失"} · 当前有效业务时间 {node.effectiveBusinessTime.value}</p>; })}</div>)}</div> : null}
    </article>; })}</div>
    <p className="rounded border border-borderSoft bg-surface/60 p-3 text-xs leading-5 text-textMuted">经营现金流与利润仅在同报告期、同期间口径下分别比较；单季度与累计值不会混用。实际值缺失、部分解析、币种或会计口径不兼容时保留具体原因，不转换为 0。</p>
  </div>;
}

function metricLabel(value: EarningsExpectationSnapshot["metric"]) { return ({ revenue: "营业收入", attributable_net_profit: "归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益", operating_cash_flow: "经营现金流" })[value]; }
function periodScopeLabel(value: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[value]; }
function formatSnapshot(snapshot: EarningsExpectationSnapshot) { const unit = snapshot.metric === "eps" ? `${snapshot.currency}/股` : ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[snapshot.unit]; return snapshot.estimateShape === "point" ? `${snapshot.value ?? "缺失"} ${unit}` : `${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${unit}`; }
function formatSourceTime(snapshot: EarningsExpectationSnapshot) { return `${snapshot.sourcePublishedAt ?? "缺失"} (${snapshot.sourcePublishedAtPrecision ?? "缺失"}${snapshot.sourcePublishedAtResolution ? ` · ${snapshot.sourcePublishedAtResolution}` : ""}${snapshot.sourcePublishedAtTimeZone ? ` · ${snapshot.sourcePublishedAtTimeZone}` : ""})`; }
function timingStatusText(value?: "before" | "after" | "same_time" | "unknown") { return ({ before: "披露前", after: "披露后", same_time: "同一时刻", unknown: "先后未知" })[value ?? "unknown"]; }
function Badge({ value, warning = false }: { value: string; warning?: boolean }) { return <span className={`rounded border px-2 py-1 ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-cyan/30 bg-cyan/10 text-cyan"}`}>{value}</span>; }
function Field({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded border border-borderSoft bg-surface/60 p-3"><p className="text-xs text-textMuted">{label}</p><p className="mt-1 break-words text-sm text-textStrong">{value}</p></div>; }
const buttonClass = "inline-flex h-9 items-center gap-2 rounded border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan";
