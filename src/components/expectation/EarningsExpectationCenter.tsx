import { DatabaseBackup, ExternalLink, History, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { EarningsExpectationComparison, EarningsExpectationImportRecord, EarningsExpectationSnapshot, Industry, ResearchEvent, Stock, WatchItem } from "../../types";
import { comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import {
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getExpectationBusinessTime,
  compareExpectationBusinessTime,
  isExpectationSourcePublishedAtUnresolved,
  resolveEffectiveBusinessHistory,
  selectEffectiveEarningsExpectations,
} from "../../services/earningsExpectationIntegrity";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { getIndustryName } from "../../utils/filters";
import { resolveSafeWorkflowTimeZone } from "../../utils/dateTime";
import { DashboardCard, EmptyState, KpiCard } from "../common/terminal";

interface EarningsExpectationCenterProps {
  snapshots: EarningsExpectationSnapshot[];
  comparisons: EarningsExpectationComparison[];
  researchEvents?: ResearchEvent[];
  importHistory: EarningsExpectationImportRecord[];
  stocks: Stock[];
  industries: Industry[];
  watchItems: WatchItem[];
  storageError?: string | null;
  timeZone?: string;
  onAdd: () => void;
  onCorrect: (snapshot: EarningsExpectationSnapshot) => void;
  onImport: () => void;
  onOpenStock: (stock: Stock) => void;
}

export function EarningsExpectationCenter(props: EarningsExpectationCenterProps) {
  const timeZone = resolveSafeWorkflowTimeZone(props.timeZone);
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("all");
  const [reportPeriod, setReportPeriod] = useState("all");
  const [metric, setMetric] = useState("all");
  const [sourceCategory, setSourceCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [exAnte, setExAnte] = useState("all");
  const [result, setResult] = useState("all");
  const [revision, setRevision] = useState("all");
  const [watched, setWatched] = useState("all");
  const selections = useMemo(() => selectEffectiveEarningsExpectations(props.snapshots, timeZone), [props.snapshots, timeZone]);
  const effective = useMemo(() => selections.map((selection) => selection.snapshot), [selections]);
  const uncertaintyBySnapshot = useMemo(() => new Map(selections.map((selection) => [selection.snapshot.id, selection.businessOrderUncertain])), [selections]);
  const orderStatusBySnapshot = useMemo(() => new Map(selections.map((selection) => [selection.snapshot.id, selection.businessOrderStatus])), [selections]);
  const comparisonBySnapshot = useMemo(() => new Map(props.comparisons.map((item) => [item.snapshotId, item])), [props.comparisons]);
  const activeWatchStocks = useMemo(() => new Set(props.watchItems.filter((item) => !item.archivedAt).map((item) => item.stockId)), [props.watchItems]);
  const revisionKeys = useMemo(() => new Set(props.snapshots.filter((snapshot) => !snapshot.correctsSnapshotId).reduce<string[]>((keys, snapshot) => {
    const key = expectationGroupKey(snapshot);
    return props.snapshots.filter((item) => !item.correctsSnapshotId && expectationGroupKey(item) === key).length > 1 ? [...keys, key] : keys;
  }, [])), [props.snapshots]);
  const periods = [...new Set(props.snapshots.map((snapshot) => snapshot.reportPeriod))].sort().reverse();
  const filtered = effective.filter((snapshot) => {
    const stock = props.stocks.find((item) => item.id === snapshot.stockId);
    const comparison = comparisonBySnapshot.get(snapshot.id);
    if (!stock) return false;
    if (company && !`${stock.name}${stock.code}`.toLowerCase().includes(company.toLowerCase())) return false;
    if (industry !== "all" && stock.industryId !== industry) return false;
    if (reportPeriod !== "all" && snapshot.reportPeriod !== reportPeriod) return false;
    if (metric !== "all" && snapshot.metric !== metric) return false;
    if (sourceCategory !== "all" && snapshot.sourceCategory !== sourceCategory) return false;
    if (verification !== "all" && snapshot.sourceVerificationStatus !== verification) return false;
    if (exAnte !== "all" && String(Boolean(comparison?.isExAnte)) !== exAnte) return false;
    if (result !== "all" && comparison?.comparisonResult !== result) return false;
    if (revision !== "all" && String(revisionKeys.has(expectationGroupKey(snapshot))) !== revision) return false;
    if (watched !== "all" && String(activeWatchStocks.has(snapshot.stockId)) !== watched) return false;
    return true;
  }).sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || -compareExpectationBusinessTime(left, right, timeZone).order);
  const queueSnapshots = effective.filter((snapshot) => snapshot.sourceVerificationStatus !== "verified" || comparisonBySnapshot.get(snapshot.id)?.comparabilityStatus !== "comparable");
  const importIssues = props.importHistory.flatMap((record) => record.issues.map((issue) => ({ record, issue })));
  const kpis = {
    companies: new Set(effective.map((snapshot) => snapshot.stockId)).size,
    exAntePeriods: new Set(props.comparisons.filter((item) => item.isExAnte).map((item) => `${item.stockId}:${item.reportPeriod}`)).size,
    comparisons: props.comparisons.filter((item) => item.comparabilityStatus === "comparable").length,
    above: props.comparisons.filter((item) => item.comparisonResult === "above").length,
    within: props.comparisons.filter((item) => item.comparisonResult === "within").length,
    below: props.comparisons.filter((item) => item.comparisonResult === "below").length,
    nonComparable: props.comparisons.filter((item) => item.comparabilityStatus !== "comparable").length,
    pendingSources: effective.filter((snapshot) => snapshot.sourceVerificationStatus !== "verified").length,
    businessRevisions: props.researchEvents?.filter((event) => event.eventType === "earnings_expectation_revision" && event.expectation?.businessRevisionDelta).length ?? 0,
    corrections: props.researchEvents?.filter((event) => event.eventType === "earnings_expectation_correction").length ?? props.snapshots.filter((snapshot) => snapshot.correctsSnapshotId).length,
  };

  return (
    <section className="min-w-0 space-y-4" aria-label="业绩预期证据中心">
      {props.storageError ? <div role="alert" className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{props.storageError}</div> : null}
      <DashboardCard className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-cyan">Expectation Evidence V1</p><h1 className="mt-1 text-xl font-semibold text-textStrong">业绩预期证据中心</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-textMuted">区分公司指引、单家机构、机构一致预期和用户预测；“事前有效”严格指快照形成与外部来源发布均早于任何同指标业绩信息披露，来源核验和数值可比性另行展示。</p><p className="mt-1 text-xs text-textMuted">工作流时区：{timeZone}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={props.onImport} className={buttonClass}><DatabaseBackup className="h-4 w-4" />导出 / 快照导入</button><button type="button" onClick={props.onAdd} className={`${buttonClass} border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加业绩预期</button></div></div></DashboardCard>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="预期证据指标">
        <KpiCard label="有快照公司" value={kpis.companies} delta="全部来源" description="不等于机构覆盖" tone="info" />
        <KpiCard label="事前有效报告期" value={kpis.exAntePeriods} delta="严格时间口径" description="早于任何同指标披露" tone="positive" />
        <KpiCard label="可比较结果" value={kpis.comparisons} delta="严格同口径" description="实际值已匹配" tone="info" />
        <KpiCard label="高于对应预测" value={kpis.above} delta="按来源区分" description="不是统一机构标签" tone="positive" />
        <KpiCard label="处于预测区间" value={kpis.within} delta="区间预测" description="含集中舍入容差" tone="info" />
        <KpiCard label="低于对应预测" value={kpis.below} delta="按来源区分" description="需复盘口径" tone={kpis.below ? "warning" : "positive"} />
        <KpiCard label="不可比较" value={kpis.nonComparable} delta="具体原因" description="不强行计算" tone={kpis.nonComparable ? "warning" : "positive"} />
        <KpiCard label="来源待核验" value={kpis.pendingSources} delta="证据队列" description="不参与事前判断" tone={kpis.pendingSources ? "warning" : "positive"} />
        <KpiCard label="业务预测修订" value={kpis.businessRevisions} delta="先后顺序已确认" description="不含数据更正" tone="info" />
        <KpiCard label="数据更正" value={kpis.corrections} delta="追加式纠错" description="不表示业务上调/下调" tone={kpis.corrections ? "warning" : "positive"} />
      </section>

      <DashboardCard className="p-4"><h2 className="text-base font-semibold text-textStrong">筛选</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="公司"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="名称或代码" className={inputClass} /></Field>
        <Select label="行业" value={industry} onChange={setIndustry} options={[["all", "全部行业"], ...props.industries.map((item) => [item.id, item.name] as [string, string])]} />
        <Select label="报告期" value={reportPeriod} onChange={setReportPeriod} options={[["all", "全部报告期"], ...periods.map((value) => [value, value] as [string, string])]} />
        <Select label="指标" value={metric} onChange={setMetric} options={[["all", "全部指标"], ...metricOptions]} />
        <Select label="来源类别" value={sourceCategory} onChange={setSourceCategory} options={[["all", "全部来源"], ...sourceOptions]} />
        <Select label="来源核验" value={verification} onChange={setVerification} options={[["all", "全部状态"], ["verified", "已核验"], ["pending", "待核验"], ["unverified", "无法核验"], ["invalid", "无效"]]} />
        <Select label="事前有效" value={exAnte} onChange={setExAnte} options={[["all", "全部"], ["true", "是"], ["false", "否 / 未匹配"]]} />
        <Select label="比较结果" value={result} onChange={setResult} options={[["all", "全部结果"], ["above", "高于对应预测"], ["within", "区间内 / 基本一致"], ["below", "低于对应预测"], ["not_comparable", "不可比较"], ["insufficient_data", "实际值不足"]]} />
        <Select label="存在修订" value={revision} onChange={setRevision} options={[["all", "全部"], ["true", "有修订"], ["false", "无修订"]]} />
        <Select label="观察清单" value={watched} onChange={setWatched} options={[["all", "全部"], ["true", "已进入观察清单"], ["false", "未进入观察清单"]]} />
      </div></DashboardCard>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <DashboardCard className="min-w-0 p-4"><h2 className="text-base font-semibold text-textStrong">有效快照、业务修订与数据更正时间线</h2><div className="mt-4 space-y-3">{filtered.length ? filtered.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} comparison={comparisonBySnapshot.get(snapshot.id)} history={props.snapshots.filter((item) => expectationGroupKey(item) === expectationGroupKey(snapshot))} stock={props.stocks.find((item) => item.id === snapshot.stockId)} industries={props.industries} watched={activeWatchStocks.has(snapshot.stockId)} businessOrderStatus={orderStatusBySnapshot.get(snapshot.id) ?? (uncertaintyBySnapshot.get(snapshot.id) ? "uncertain" : "confirmed")} timeZone={timeZone} onCorrect={props.onCorrect} onOpenStock={props.onOpenStock} />) : <EmptyState title="没有匹配的业绩预期" description="请调整筛选，或添加一条有明确来源和形成时间的快照。" />}</div></DashboardCard>
        <DashboardCard className="min-w-0 p-4"><h2 className="text-base font-semibold text-textStrong">数据核验队列</h2><p className="mt-1 text-xs text-textMuted">来源、日期、口径、单位、实际值或解析状态不足时明确保留。</p><div className="mt-4 space-y-3">{queueSnapshots.map((snapshot) => { const comparison = comparisonBySnapshot.get(snapshot.id); return <article key={`queue-${snapshot.id}`} className="rounded border border-warning/35 bg-warning/10 p-3"><p className="break-words text-sm font-medium text-textStrong">{props.stocks.find((stock) => stock.id === snapshot.stockId)?.name ?? snapshot.stockId} · {snapshot.reportPeriod}</p><p className="mt-1 text-xs text-warning">{snapshot.sourceVerificationStatus !== "verified" ? `来源状态：${snapshot.sourceVerificationStatus}` : comparison?.nonComparableReasons.join("；") || "无法匹配实际值"}</p></article>; })}{importIssues.map(({ record, issue }, index) => <article key={`${record.id}-${index}`} className="rounded border border-warning/35 bg-warning/10 p-3"><p className="text-sm text-textStrong">{record.ingestionMethod === "csv_import" ? "CSV" : "JSON"} 导入核验 · 第 {issue.row} 行</p><p className="mt-1 break-words text-xs text-warning">{issue.message}</p></article>)}{!queueSnapshots.length && !importIssues.length ? <p className="text-sm text-textMuted">当前没有数据核验项。</p> : null}</div></DashboardCard>
      </div>
    </section>
  );
}

function SnapshotCard({ snapshot, comparison, history, stock, industries, watched, businessOrderStatus, timeZone, onCorrect, onOpenStock }: { snapshot: EarningsExpectationSnapshot; comparison?: EarningsExpectationComparison; history: EarningsExpectationSnapshot[]; stock?: Stock; industries: Industry[]; watched: boolean; businessOrderStatus: "confirmed" | "equal" | "uncertain"; timeZone?: string; onCorrect: (snapshot: EarningsExpectationSnapshot) => void; onOpenStock: (stock: Stock) => void }) {
  const businessNodes = resolveEffectiveBusinessHistory(history, timeZone);
  const currentNode = businessNodes.find((node) => node.effectiveSnapshot.id === snapshot.id);
  return <article className="min-w-0 rounded-lg border border-borderSoft bg-bg2/65 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs text-textMuted">{stock?.name ?? snapshot.stockId} · {stock?.code ?? ""} · {stock ? getIndustryName(industries, stock.industryId) : "行业缺失"}</p><h3 className="mt-1 break-words text-base font-semibold text-textStrong">{metricLabel(snapshot.metric)} · {snapshot.reportPeriod} · {periodScopeLabel(snapshot.periodScope)}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge value={sourceCategoryLabel(snapshot.sourceCategory)} warning={snapshot.sourceCategory === "user_estimate"} /><Badge value={snapshot.sourceVerificationStatus} warning={snapshot.sourceVerificationStatus !== "verified"} />{watched ? <Badge value="观察清单" /> : null}{snapshot.correctsSnapshotId ? <Badge value={snapshot.correctionScope === "basis" ? "口径纠正" : "数值纠正"} warning /> : null}</div></div><div className="flex flex-wrap gap-2">{snapshot.sourceUrl ? <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className={buttonClass}><ExternalLink className="h-4 w-4" />来源</a> : null}{stock ? <button type="button" onClick={() => onOpenStock(stock)} className={buttonClass}>个股详情</button> : null}<button type="button" onClick={() => onCorrect(snapshot)} className={buttonClass}>创建纠正</button></div></div>
    {businessOrderStatus === "uncertain" ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">同日存在多条仅日期精度的预测，或日期与 datetime 混合精度，无法确认业务先后顺序。当前不生成正式预期差，请补充精确形成时间。</div> : null}
    {businessOrderStatus === "equal" ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">存在形成于同一精确时刻的独立预测。时间关系为 equal；稳定 ID 仅用于显示，不代表业务先后，也不生成方向性修订。</div> : null}
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Value label="当前预期" value={formatSnapshot(snapshot)} /><Value label="原记录业务时间" value={`${currentNode?.originalBusinessTime.value ?? getExpectationBusinessTime(snapshot, timeZone).value} (${currentNode?.originalBusinessTime.precision ?? "date"})`} /><Value label="纠正后有效业务时间" value={`${currentNode?.effectiveBusinessTime.value ?? getExpectationBusinessTime(snapshot, timeZone).value} (${currentNode?.effectiveBusinessTime.precision ?? snapshot.formedAtPrecision ?? "date"})`} /><Value label="当前有效来源时间" value={formatSourceTime(snapshot)} /><Value label="来源" value={`${snapshot.sourceName || "缺失"} · ${snapshot.sourceTitle || "标题缺失"}`} /><Value label="分析师 / 机构" value={`${snapshot.analystCount ?? "-"} / ${snapshot.institutionCount ?? "-"}`} /></div>
    {currentNode?.temporalCorrectionApplied ? <div role="status" className="mt-2 rounded border border-cyan/35 bg-cyan/10 p-2 text-xs text-cyan">时间字段已纠正：{currentNode.correctedTemporalFields.join("、")}。排序与事前判断使用纠正后有效时间，原记录时间仅用于审计。</div> : null}
    {currentNode?.actualSourceInterpretationTimeZone && currentNode.actualSourceInterpretationTimeZone !== timeZone ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">来源时间实际按记录时区 {currentNode.actualSourceInterpretationTimeZone} 解释，而非当前工作流时区 {timeZone ?? "缺失"}。</div> : null}
    {isExpectationSourcePublishedAtUnresolved(snapshot) ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">历史来源时间未记录原解释时区，已保留原值并标记待核验；不会据此证明事前有效。</div> : null}
    <div className={`mt-3 rounded border p-3 text-xs ${comparison?.comparabilityStatus === "comparable" ? "border-success/30 bg-success/10 text-textMuted" : "border-warning/30 bg-warning/10 text-warning"}`}><p className="font-semibold text-textStrong">{comparison ? comparisonResultLabel(comparison, snapshot) : "尚未生成比较"}{comparison?.isExAnte ? " · 事前有效" : " · 非事前有效或待匹配"}</p><p className="mt-1 break-words">{comparison?.comparisonMethod ?? "等待同公司、同报告期、同口径的可靠实际值。"}</p>{comparison ? <p className="mt-1">相对实际值披露：{timingStatusText(comparison.actualDisclosureTimingStatus)} · 相对公司业绩信息披露：{timingStatusText(comparison.performanceDisclosureTimingStatus)}{comparison.performanceDisclosureUncertain ? "（指标覆盖待核验）" : ""}</p> : null}{comparison?.actualDisclosureTimingStatus === "same_time" || comparison?.performanceDisclosureTimingStatus === "same_time" ? <p className="mt-1 font-medium">预测形成时间与披露时间相同，无法认定为披露前预测。</p> : null}<p className="mt-1">公司是否公开披露与本地数值是否解析成功分别判断；metadata_only / parse_partial 不会被包装成“未披露”。</p>{comparison?.nonComparableReasons.length ? <p className="mt-1">原因：{comparison.nonComparableReasons.join("；")}</p> : null}{comparison?.actualValue !== null && comparison?.actualValue !== undefined ? <p className="mt-1">本地已可靠解析实际值：{formatFinancialAmount(comparison.actualValue)} · 绝对差异：{formatFinancialAmount(comparison.absoluteDifference)}{comparison.relativeDifference === null ? "" : ` · 相对差异 ${(comparison.relativeDifference * 100).toFixed(2)}%`}</p> : null}</div>
    {history.length > 1 ? <div className="mt-3 rounded border border-borderSoft bg-surface/60 p-3"><p className="inline-flex items-center gap-2 text-xs font-semibold text-textStrong"><History className="h-4 w-4" />业务节点与纠正链时间线</p><div className="mt-2 space-y-3">{businessNodes.map((node, index) => {
      const previous = index > 0 ? businessNodes[index - 1] : undefined;
      const revision = deriveExpectationBusinessRevisionDelta(node.effectiveSnapshot, previous?.effectiveSnapshot, businessOrderStatus, { previousBusinessRootSnapshotId: previous?.businessRootSnapshot.id, currentBusinessRootSnapshotId: node.businessRootSnapshot.id });
      return <div key={node.businessRootSnapshot.id} className="border-l border-borderSoft pl-3 text-xs text-textMuted"><p>原业务节点 {node.businessRootSnapshot.id} · 原记录时间 {node.originalBusinessTime.value} · 当前有效时间 {node.effectiveBusinessTime.value} · 当前有效值 {formatSnapshot(node.effectiveSnapshot)} · 终点 {node.effectiveSnapshot.id}</p><p className="mt-1">{revision ? `业务预测较前值（有效基准 ${revision.previousEffectiveSnapshotId}）${revision.relativeDelta >= 0 ? "+" : ""}${(revision.relativeDelta * 100).toFixed(2)}%` : previous ? businessOrderStatus === "equal" ? "形成时刻相同，不生成方向性修订" : businessOrderStatus === "uncertain" ? "业务顺序不确定，不生成方向性修订" : "口径变化，未计算业务修订率" : "首个业务节点"}</p>{node.correctionChain.slice(1).map((correction) => { const target = node.correctionChain.find((item) => item.id === correction.correctsSnapshotId); const delta = deriveExpectationCorrectionDelta(correction, target); return <p key={correction.id} className="mt-1 text-warning">纠正记录 {correction.createdAt} · {correction.correctsSnapshotId} → {correction.id} · 变化字段：{delta?.changedFields.join("、") || "待核验"}{delta?.valueDelta === null ? " · 不跨口径计算差异" : ""} · 原因：{correction.notes ?? "缺失"} · 当前有效业务时间 {node.effectiveBusinessTime.value}</p>; })}</div>;
    })}</div></div> : null}
  </article>;
}

function formatSnapshot(snapshot: EarningsExpectationSnapshot) { const unit = snapshot.metric === "eps" ? `${snapshot.currency}/股` : ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[snapshot.unit]; return snapshot.estimateShape === "point" ? `${snapshot.value ?? "缺失"} ${unit}` : `${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${unit}`; }
function formatSourceTime(snapshot: EarningsExpectationSnapshot) { return `${snapshot.sourcePublishedAt ?? "缺失"} (${snapshot.sourcePublishedAtPrecision ?? "缺失"}${snapshot.sourcePublishedAtResolution ? ` · ${snapshot.sourcePublishedAtResolution}` : ""}${snapshot.sourcePublishedAtTimeZone ? ` · ${snapshot.sourcePublishedAtTimeZone}` : ""})`; }
function metricLabel(value: EarningsExpectationSnapshot["metric"]) { return Object.fromEntries(metricOptions)[value]; }
function periodScopeLabel(value: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[value]; }
function timingStatusText(value?: EarningsExpectationComparison["performanceDisclosureTimingStatus"]) { return ({ before: "披露前", after: "披露后", same_time: "同一时刻", unknown: "先后未知" } as Record<string, string>)[value ?? "unknown"]; }
function Badge({ value, warning = false }: { value: string; warning?: boolean }) { return <span className={`rounded border px-2 py-1 ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-borderSoft text-textMuted"}`}>{value}</span>; }
function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded border border-borderSoft bg-surface/60 p-3"><p className="text-xs text-textMuted">{label}</p><p className="mt-1 break-words text-sm text-textStrong">{value}</p></div>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([optionValue, labelValue]) => <option key={optionValue} value={optionValue}>{labelValue}</option>)}</select></Field>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
const metricOptions: Array<[string, string]> = [["revenue", "营业收入"], ["attributable_net_profit", "归母净利润"], ["adjusted_net_profit", "扣非净利润"], ["eps", "每股收益"], ["operating_cash_flow", "经营现金流"]];
const sourceOptions: Array<[string, string]> = [["company_guidance", "公司指引"], ["institution_single", "单家机构预测"], ["institution_consensus", "机构一致预期"], ["user_estimate", "用户个人预测"]];
const inputClass = "h-10 w-full min-w-0 rounded border border-borderSoft bg-bg2 px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "inline-flex h-9 items-center gap-2 rounded border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan";
