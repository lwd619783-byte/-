import { DatabaseBackup, ExternalLink, History, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { EarningsExpectationComparison, EarningsExpectationImportRecord, EarningsExpectationSnapshot, Industry, Stock, WatchItem } from "../../types";
import { comparisonResultLabel, expectationGroupKey, expectationRevision, sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import { effectiveEarningsExpectationSnapshots } from "../../services/earningsExpectationRepository";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { getIndustryName } from "../../utils/filters";
import { DashboardCard, EmptyState, KpiCard } from "../common/terminal";

interface EarningsExpectationCenterProps {
  snapshots: EarningsExpectationSnapshot[];
  comparisons: EarningsExpectationComparison[];
  importHistory: EarningsExpectationImportRecord[];
  stocks: Stock[];
  industries: Industry[];
  watchItems: WatchItem[];
  storageError?: string | null;
  onAdd: () => void;
  onCorrect: (snapshot: EarningsExpectationSnapshot) => void;
  onImport: () => void;
  onOpenStock: (stock: Stock) => void;
}

export function EarningsExpectationCenter(props: EarningsExpectationCenterProps) {
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
  const effective = useMemo(() => effectiveEarningsExpectationSnapshots(props.snapshots), [props.snapshots]);
  const comparisonBySnapshot = useMemo(() => new Map(props.comparisons.map((item) => [item.snapshotId, item])), [props.comparisons]);
  const activeWatchStocks = useMemo(() => new Set(props.watchItems.filter((item) => !item.archivedAt).map((item) => item.stockId)), [props.watchItems]);
  const revisionKeys = useMemo(() => new Set(props.snapshots.reduce<string[]>((keys, snapshot) => {
    const key = expectationGroupKey(snapshot);
    return props.snapshots.filter((item) => expectationGroupKey(item) === key).length > 1 ? [...keys, key] : keys;
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
  }).sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || right.asOfDate.localeCompare(left.asOfDate) || left.id.localeCompare(right.id));
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
  };

  return (
    <section className="min-w-0 space-y-4" aria-label="业绩预期证据中心">
      {props.storageError ? <div role="alert" className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{props.storageError}</div> : null}
      <DashboardCard className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-cyan">Expectation Evidence V1</p><h1 className="mt-1 text-xl font-semibold text-textStrong">业绩预期证据中心</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-textMuted">区分公司指引、单家机构、机构一致预期和用户预测；只有实际披露前形成且来源已核验的快照才属于事前有效。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={props.onImport} className={buttonClass}><DatabaseBackup className="h-4 w-4" />导入 / 备份</button><button type="button" onClick={props.onAdd} className={`${buttonClass} border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加业绩预期</button></div></div></DashboardCard>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8" aria-label="预期证据指标">
        <KpiCard label="有快照公司" value={kpis.companies} delta="全部来源" description="不等于机构覆盖" tone="info" />
        <KpiCard label="事前有效报告期" value={kpis.exAntePeriods} delta="已核验" description="披露前形成" tone="positive" />
        <KpiCard label="可比较结果" value={kpis.comparisons} delta="严格同口径" description="实际值已匹配" tone="info" />
        <KpiCard label="高于对应预测" value={kpis.above} delta="按来源区分" description="不是统一机构标签" tone="positive" />
        <KpiCard label="处于预测区间" value={kpis.within} delta="区间预测" description="含集中舍入容差" tone="info" />
        <KpiCard label="低于对应预测" value={kpis.below} delta="按来源区分" description="需复盘口径" tone={kpis.below ? "warning" : "positive"} />
        <KpiCard label="不可比较" value={kpis.nonComparable} delta="具体原因" description="不强行计算" tone={kpis.nonComparable ? "warning" : "positive"} />
        <KpiCard label="来源待核验" value={kpis.pendingSources} delta="证据队列" description="不参与事前判断" tone={kpis.pendingSources ? "warning" : "positive"} />
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
        <DashboardCard className="min-w-0 p-4"><h2 className="text-base font-semibold text-textStrong">有效快照与修订时间线</h2><div className="mt-4 space-y-3">{filtered.length ? filtered.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} comparison={comparisonBySnapshot.get(snapshot.id)} history={props.snapshots.filter((item) => expectationGroupKey(item) === expectationGroupKey(snapshot))} stock={props.stocks.find((item) => item.id === snapshot.stockId)} industries={props.industries} watched={activeWatchStocks.has(snapshot.stockId)} onCorrect={props.onCorrect} onOpenStock={props.onOpenStock} />) : <EmptyState title="没有匹配的业绩预期" description="请调整筛选，或添加一条有明确来源和形成时间的快照。" />}</div></DashboardCard>
        <DashboardCard className="min-w-0 p-4"><h2 className="text-base font-semibold text-textStrong">数据核验队列</h2><p className="mt-1 text-xs text-textMuted">来源、日期、口径、单位、实际值或解析状态不足时明确保留。</p><div className="mt-4 space-y-3">{queueSnapshots.map((snapshot) => { const comparison = comparisonBySnapshot.get(snapshot.id); return <article key={`queue-${snapshot.id}`} className="rounded border border-warning/35 bg-warning/10 p-3"><p className="break-words text-sm font-medium text-textStrong">{props.stocks.find((stock) => stock.id === snapshot.stockId)?.name ?? snapshot.stockId} · {snapshot.reportPeriod}</p><p className="mt-1 text-xs text-warning">{snapshot.sourceVerificationStatus !== "verified" ? `来源状态：${snapshot.sourceVerificationStatus}` : comparison?.nonComparableReasons.join("；") || "无法匹配实际值"}</p></article>; })}{importIssues.map(({ record, issue }, index) => <article key={`${record.id}-${index}`} className="rounded border border-warning/35 bg-warning/10 p-3"><p className="text-sm text-textStrong">{record.ingestionMethod === "csv_import" ? "CSV" : "JSON"} 导入核验 · 第 {issue.row} 行</p><p className="mt-1 break-words text-xs text-warning">{issue.message}</p></article>)}{!queueSnapshots.length && !importIssues.length ? <p className="text-sm text-textMuted">当前没有数据核验项。</p> : null}</div></DashboardCard>
      </div>
    </section>
  );
}

function SnapshotCard({ snapshot, comparison, history, stock, industries, watched, onCorrect, onOpenStock }: { snapshot: EarningsExpectationSnapshot; comparison?: EarningsExpectationComparison; history: EarningsExpectationSnapshot[]; stock?: Stock; industries: Industry[]; watched: boolean; onCorrect: (snapshot: EarningsExpectationSnapshot) => void; onOpenStock: (stock: Stock) => void }) {
  const ordered = [...history].sort((left, right) => left.asOfDate.localeCompare(right.asOfDate) || left.createdAt.localeCompare(right.createdAt));
  const correctedIds = new Set(history.map((item) => item.correctsSnapshotId).filter(Boolean));
  return <article className="min-w-0 rounded-lg border border-borderSoft bg-bg2/65 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs text-textMuted">{stock?.name ?? snapshot.stockId} · {stock?.code ?? ""} · {stock ? getIndustryName(industries, stock.industryId) : "行业缺失"}</p><h3 className="mt-1 break-words text-base font-semibold text-textStrong">{metricLabel(snapshot.metric)} · {snapshot.reportPeriod} · {periodScopeLabel(snapshot.periodScope)}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge value={sourceCategoryLabel(snapshot.sourceCategory)} warning={snapshot.sourceCategory === "user_estimate"} /><Badge value={snapshot.sourceVerificationStatus} warning={snapshot.sourceVerificationStatus !== "verified"} />{watched ? <Badge value="观察清单" /> : null}{snapshot.correctsSnapshotId ? <Badge value="纠正快照" warning /> : null}</div></div><div className="flex flex-wrap gap-2">{snapshot.sourceUrl ? <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className={buttonClass}><ExternalLink className="h-4 w-4" />来源</a> : null}{stock ? <button type="button" onClick={() => onOpenStock(stock)} className={buttonClass}>个股详情</button> : null}<button type="button" onClick={() => onCorrect(snapshot)} className={buttonClass}>创建纠正</button></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Value label="当前预期" value={formatSnapshot(snapshot)} /><Value label="形成 / 来源日期" value={`${snapshot.asOfDate} / ${snapshot.sourcePublishedAt ?? "缺失"}`} /><Value label="来源" value={`${snapshot.sourceName || "缺失"} · ${snapshot.sourceTitle || "标题缺失"}`} /><Value label="分析师 / 机构" value={`${snapshot.analystCount ?? "-"} / ${snapshot.institutionCount ?? "-"}`} /></div>
    <div className={`mt-3 rounded border p-3 text-xs ${comparison?.comparabilityStatus === "comparable" ? "border-success/30 bg-success/10 text-textMuted" : "border-warning/30 bg-warning/10 text-warning"}`}><p className="font-semibold text-textStrong">{comparison ? comparisonResultLabel(comparison, snapshot) : "尚未生成比较"}{comparison?.isExAnte ? " · 事前有效" : " · 非事前有效或待匹配"}</p><p className="mt-1 break-words">{comparison?.comparisonMethod ?? "等待同公司、同报告期、同口径的可靠实际值。"}</p>{comparison?.nonComparableReasons.length ? <p className="mt-1">原因：{comparison.nonComparableReasons.join("；")}</p> : null}{comparison?.actualValue !== null && comparison?.actualValue !== undefined ? <p className="mt-1">实际值：{formatFinancialAmount(comparison.actualValue)} · 绝对差异：{formatFinancialAmount(comparison.absoluteDifference)}{comparison.relativeDifference === null ? "" : ` · 相对差异 ${(comparison.relativeDifference * 100).toFixed(2)}%`}</p> : null}</div>
    {ordered.length > 1 ? <div className="mt-3 rounded border border-borderSoft bg-surface/60 p-3"><p className="inline-flex items-center gap-2 text-xs font-semibold text-textStrong"><History className="h-4 w-4" />修订时间线</p><div className="mt-2 space-y-2">{ordered.map((item, index) => { const change = expectationRevision(item, ordered[index - 1]); return <div key={item.id} className="flex flex-col gap-1 border-l border-borderSoft pl-3 text-xs text-textMuted sm:flex-row sm:items-center sm:justify-between"><span>{item.asOfDate} · {formatSnapshot(item)} · {item.sourceName || sourceCategoryLabel(item.sourceCategory)}</span><span>{correctedIds.has(item.id) ? "已被纠正" : change.magnitude === null ? index ? "口径变化，未计算修订率" : "首个快照" : `较前值 ${change.magnitude >= 0 ? "+" : ""}${(change.magnitude * 100).toFixed(2)}%`}</span></div>; })}</div></div> : null}
  </article>;
}

function formatSnapshot(snapshot: EarningsExpectationSnapshot) { const unit = snapshot.metric === "eps" ? `${snapshot.currency}/股` : ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[snapshot.unit]; return snapshot.estimateShape === "point" ? `${snapshot.value ?? "缺失"} ${unit}` : `${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${unit}`; }
function metricLabel(value: EarningsExpectationSnapshot["metric"]) { return Object.fromEntries(metricOptions)[value]; }
function periodScopeLabel(value: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[value]; }
function Badge({ value, warning = false }: { value: string; warning?: boolean }) { return <span className={`rounded border px-2 py-1 ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-borderSoft text-textMuted"}`}>{value}</span>; }
function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded border border-borderSoft bg-surface/60 p-3"><p className="text-xs text-textMuted">{label}</p><p className="mt-1 break-words text-sm text-textStrong">{value}</p></div>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([optionValue, labelValue]) => <option key={optionValue} value={optionValue}>{labelValue}</option>)}</select></Field>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
const metricOptions: Array<[string, string]> = [["revenue", "营业收入"], ["attributable_net_profit", "归母净利润"], ["adjusted_net_profit", "扣非净利润"], ["eps", "每股收益"], ["operating_cash_flow", "经营现金流"]];
const sourceOptions: Array<[string, string]> = [["company_guidance", "公司指引"], ["institution_single", "单家机构预测"], ["institution_consensus", "机构一致预期"], ["user_estimate", "用户个人预测"]];
const inputClass = "h-10 w-full min-w-0 rounded border border-borderSoft bg-bg2 px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "inline-flex h-9 items-center gap-2 rounded border border-borderSoft px-3 text-xs text-textStrong hover:border-cyan";
