import { DatabaseBackup, ExternalLink, History, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { CompanyGuidanceExpectationExclusion, CompanyGuidanceExpectationLoadStatus, CompanyGuidanceExpectationSummary, CompanyGuidanceExpectationWarning, EarningsExpectationComparison, EarningsExpectationImportRecord, EarningsExpectationProviderSnapshot, EarningsExpectationSnapshot, Industry, ProviderEvidenceRelationRecord, ResearchEvent, Stock, WatchItem } from "../../types";
import { comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "../../services/earningsExpectationComparisonProvider";
import {
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getExpectationBusinessTime,
  compareExpectationBusinessTime,
  isExpectationSourcePublishedAtUnresolved,
  resolveEffectiveBusinessHistory,
  resolveUniquePreviousBusinessNode,
  selectEffectiveEarningsExpectations,
  type EarningsExpectationSelection,
} from "../../services/earningsExpectationIntegrity";
import { formatFinancialAmount } from "../../utils/financialDisplay";
import { getIndustryName } from "../../utils/filters";
import { resolveSafeWorkflowTimeZone } from "../../utils/dateTime";
import { statusDisplayLabel } from "../../utils/displayLabels";
import { DashboardCard, EmptyState, KpiCard, TabButton } from "../common/terminal";
import { EarningsExpectationTemporalAudit } from "./EarningsExpectationTemporalAudit";
import { EarningsExpectationBusinessOrderWarning } from "./EarningsExpectationBusinessOrderWarning";

interface EarningsExpectationCenterProps {
  snapshots: EarningsExpectationSnapshot[];
  comparisons: EarningsExpectationComparison[];
  researchEvents?: ResearchEvent[];
  importHistory: EarningsExpectationImportRecord[];
  stocks: Stock[];
  industries: Industry[];
  watchItems: WatchItem[];
  storageError?: string | null;
  providerLoadStatus?: CompanyGuidanceExpectationLoadStatus;
  providerLoadError?: string | null;
  providerDetailLoadStatus?: CompanyGuidanceExpectationLoadStatus;
  providerDetailLoadError?: string | null;
  providerFailedStockIds?: string[];
  providerLoadedCompanyCount?: number;
  onRetryProvider?: () => void;
  providerSummary?: CompanyGuidanceExpectationSummary;
  providerSnapshotIds?: Set<string>;
  duplicateOfProviderByLocalId?: Map<string, string>;
  providerRelationByLocalId?: Map<string, ProviderEvidenceRelationRecord>;
  providerRecordBySnapshotId?: Map<string, EarningsExpectationProviderSnapshot>;
  providerExclusions?: CompanyGuidanceExpectationExclusion[];
  providerWarnings?: CompanyGuidanceExpectationWarning[];
  timeZone?: string;
  onAdd: () => void;
  onCorrect: (snapshot: EarningsExpectationSnapshot) => void;
  onImport: () => void;
  onOpenStock: (stock: Stock) => void;
}

export function EarningsExpectationCenter(props: EarningsExpectationCenterProps) {
  const timeZone = resolveSafeWorkflowTimeZone(props.timeZone);
  const [view, setView] = useState<"comparison" | "audit" | "imports">("comparison");
  const [timelineView, setTimelineView] = useState<"effective" | "revisions" | "corrections">("effective");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const selectionBySnapshot = useMemo(() => new Map(selections.map((selection) => [selection.snapshot.id, selection])), [selections]);
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
  const queueSnapshots = effective.filter((snapshot) => {
    const previousStatus = selectionBySnapshot.get(snapshot.id)?.previousResolution.status;
    return snapshot.sourceVerificationStatus !== "verified"
      || comparisonBySnapshot.get(snapshot.id)?.comparabilityStatus !== "comparable"
      || Boolean(previousStatus && ["ambiguous", "equal_time", "unresolved"].includes(previousStatus));
  });
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
    providerSnapshots: props.providerSnapshotIds ? props.providerSnapshotIds.size : 0,
    providerCompanies: new Set([...(props.providerSnapshotIds ?? new Set<string>())].map((id) => props.providerRecordBySnapshotId?.get(id)?.snapshot.stockId).filter(Boolean)).size,
    providerDuplicates: props.duplicateOfProviderByLocalId ? props.duplicateOfProviderByLocalId.size : 0,
    providerConflicts: [...(props.providerRelationByLocalId?.values() ?? [])].filter((record) => record.relation === "content_conflict").length,
  };

  // This grouping is only a presentation boundary. Eligibility and all numerical
  // comparisons remain the supplied service results; no sources are averaged.
  const groups = [...filtered.reduce((result, snapshot) => {
    const key = displayGroupKey(snapshot);
    const group = result.get(key) ?? { key, snapshots: [] as EarningsExpectationSnapshot[] };
    group.snapshots.push(snapshot);
    result.set(key, group);
    return result;
  }, new Map<string, { key: string; snapshots: EarningsExpectationSnapshot[] }>()).values()];
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0];
  const selectedSnapshots = selectedGroup?.snapshots ?? [];
  const historyFor = (snapshot: EarningsExpectationSnapshot) => props.snapshots.filter((item) => expectationGroupKey(item) === expectationGroupKey(snapshot));
  const displayedSnapshots = selectedSnapshots.filter((snapshot) => timelineView === "effective"
    || (timelineView === "revisions" ? revisionKeys.has(expectationGroupKey(snapshot)) : historyFor(snapshot).some((item) => Boolean(item.correctsSnapshotId))));
  const advancedCount = [industry, verification, exAnte, result, revision, watched].filter((value) => value !== "all").length;
  const clearAdvanced = () => { setIndustry("all"); setVerification("all"); setExAnte("all"); setResult("all"); setRevision("all"); setWatched("all"); };
  const relations = [...(props.providerRelationByLocalId?.values() ?? [])].filter((record) => record.relation !== "independent");
  const conflicts = relations.filter((record) => record.relation === "content_conflict");
  const exclusionReasons = [...new Set(props.providerExclusions?.flatMap((item) => item.reasons) ?? [])];
  const showAudit = () => setView("audit");
  const snapshotCard = (snapshot: EarningsExpectationSnapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} selection={selectionBySnapshot.get(snapshot.id)} comparison={comparisonBySnapshot.get(snapshot.id)} history={historyFor(snapshot)} stock={props.stocks.find((item) => item.id === snapshot.stockId)} industries={props.industries} watched={activeWatchStocks.has(snapshot.stockId)} businessOrderStatus={orderStatusBySnapshot.get(snapshot.id) ?? (uncertaintyBySnapshot.get(snapshot.id) ? "uncertain" : "confirmed")} timeZone={timeZone} isProvider={props.providerSnapshotIds?.has(snapshot.id) ?? false} duplicateOfProviderId={props.duplicateOfProviderByLocalId?.get(snapshot.id)} providerRecord={props.providerRecordBySnapshotId?.get(snapshot.id)} onCorrect={props.onCorrect} onOpenStock={props.onOpenStock} auditExpanded={view === "audit"} />;

  return (
    <section className="min-w-0 space-y-4" aria-label="业绩预期证据中心">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs tracking-[0.16em] text-cyan">预期证据 / 同口径对照</p><h1 className="mt-1 text-2xl font-semibold text-textStrong">业绩预期证据中心</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-textMuted">公司指引、单家机构、机构一致预期与用户预测分别比较。来源核验、事前有效与数值可比性独立判断。</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={props.onImport} className={buttonClass}><DatabaseBackup className="h-4 w-4" />导出 / 快照导入</button><button type="button" onClick={props.onAdd} className={`${buttonClass} border-cyan/50 text-cyan`}><Plus className="h-4 w-4" />添加业绩预期</button></div>
      </header>
      {props.storageError ? <div role="alert" className={riskClass}>{props.storageError}</div> : null}
      <DashboardCard className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-semibold text-textStrong">公司官方指引 · 巨潮官方公告</h2><p className="mt-1 text-xs leading-5 text-textMuted">数据提供方记录只读，不写入用户本地存储，也不覆盖人工、JSON 或 CSV 快照。</p></div><div className="min-w-0 text-xs leading-5 text-textMuted"><p>全局状态：{props.providerLoadStatus === "loading" ? "索引校验中" : props.providerLoadStatus === "error" ? "已关闭（校验失败）" : props.providerLoadStatus === "success" ? "已验证并启用" : "未启用"}</p><p>明细状态：{statusDisplayLabel(props.providerDetailLoadStatus ?? "idle")} · 成功 {props.providerLoadedCompanyCount ?? 0} / 失败 {props.providerFailedStockIds?.length ?? 0}</p></div></div>
        {props.providerLoadStatus === "error" || props.providerLoadError ? <p role="alert" className={`${riskClass} mt-3`}>全局索引加载或校验失败：{props.providerLoadError || "索引未通过验证"}。正式数据提供方已全局关闭，本地快照仍可使用。</p> : null}
        {props.providerDetailLoadError ? <p role="alert" className={`${riskClass} mt-3`}>明细部分失败：{props.providerDetailLoadError}。成功公司仍保留，失败结果不缓存。</p> : null}
        {(props.providerLoadStatus === "error" || props.providerLoadError || props.providerDetailLoadError) && props.onRetryProvider ? <button type="button" onClick={props.onRetryProvider} className={`${buttonClass} mt-3`}>重试数据加载</button> : null}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-textMuted"><span>全局数据快照 <strong className="text-textStrong">{kpis.providerSnapshots}</strong></span><span>已加载公司 <strong className="text-textStrong">{kpis.providerCompanies}</strong></span><span>本地重复/元数据差异 <strong className="text-textStrong">{kpis.providerDuplicates}</strong></span><span>内容冲突 <strong className={kpis.providerConflicts ? "text-warning" : "text-textStrong"}>{kpis.providerConflicts}</strong></span><span>排除 / 警告 <strong className="text-textStrong">{props.providerExclusions?.length ?? 0} / {props.providerWarnings?.length ?? 0}</strong></span></div>
        {props.duplicateOfProviderByLocalId?.size ? <p role="status" className={`${riskClass} mt-3`}>与官方数据记录重复 / 元数据不同：保留 {props.duplicateOfProviderByLocalId.size} 条本地记录用于审计；比较、研究事件与复盘任务只计对应官方数据版本。</p> : null}
        {conflicts.length ? <div role="alert" className={`${riskClass} mt-3`}><p className="font-medium">发现 {conflicts.length} 条同一官方证据的财务内容冲突；本地记录保留可见，但不进入比较链，需按冲突字段复核。</p><ul className="mt-2 space-y-1">{conflicts.map((record) => <li key={record.localSnapshotId} className="break-all">{record.localSnapshotId}：{record.conflictingFields.join("、") || "冲突字段待核验"}</li>)}</ul><button type="button" onClick={showAudit} className={`${buttonClass} mt-2`}>查看冲突详情</button></div> : null}
        {props.providerExclusions?.length || props.providerWarnings?.length ? <div className="mt-3 space-y-1 text-xs text-warning"><p>排除与警告仍按原来源判定保留，未形成可靠数值的记录不补 0。</p>{exclusionReasons.length ? <p className="break-words">排除原因：{exclusionReasons.join("；")}</p> : null}{props.providerWarnings?.map((item) => <p key={`${item.sourceAnnouncementId}-${item.code}`} className="break-words">[{item.code}] {item.message}</p>)}<button type="button" onClick={showAudit} className={`${buttonClass} mt-2`}>查看来源排除与核验队列</button></div> : null}
      </DashboardCard>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="预期证据指标">
        <KpiCard label="有快照公司" value={kpis.companies} description="全部来源，不等于机构覆盖" tone="info" />
        <KpiCard label="事前有效报告期" value={kpis.exAntePeriods} description="早于任何同指标披露" tone="info" />
        <KpiCard label="可比较结果" value={kpis.comparisons} description="来源与实际值严格同口径" tone="info" />
        <KpiCard label="不可比较" value={kpis.nonComparable} description="保留具体原因，不强行计算" tone={kpis.nonComparable ? "warning" : "neutral"} />
      </section>
      <details className="min-w-0 rounded border border-borderSoft bg-surface/40 px-3 py-2"><summary className="cursor-pointer text-xs text-textMuted">更多统计与来源版本</summary><div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6"><Value label="高于对应预测" value={String(kpis.above)} /><Value label="处于预测区间" value={String(kpis.within)} /><Value label="低于对应预测" value={String(kpis.below)} /><Value label="来源待核验" value={String(kpis.pendingSources)} /><Value label="业务预测修订" value={String(kpis.businessRevisions)} /><Value label="数据更正" value={String(kpis.corrections)} /></div><p className="mt-3 break-words text-xs text-textMuted">版本：{props.providerSummary?.providerVersion ?? "-"} · 更新：{props.providerSummary?.generatedAt ?? "-"} · 工作流时区：{timeZone}</p><p className="mt-1 text-xs leading-5 text-textMuted">“事前有效”严格指快照形成与外部来源发布均早于任何同指标业绩信息披露；数据更正不表示业务上调/下调。</p></details>

      <DashboardCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-textStrong">筛选</h2><span className="text-xs text-textMuted">{filtered.length} 条有效快照 · {groups.length} 个同口径对照组</span></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="公司"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="名称或代码" className={inputClass} /></Field>
          <Select label="报告期" value={reportPeriod} onChange={setReportPeriod} options={[["all", "全部报告期"], ...periods.map((value) => [value, value] as [string, string])]} />
          <Select label="指标" value={metric} onChange={setMetric} options={[["all", "全部指标"], ...metricOptions]} />
          <Select label="来源类别" value={sourceCategory} onChange={setSourceCategory} options={[["all", "全部来源"], ...sourceOptions]} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" aria-expanded={advancedOpen} aria-controls="expectation-advanced-filters" onClick={() => setAdvancedOpen(!advancedOpen)} className={buttonClass}>更多筛选{advancedCount ? ` · 已启用 ${advancedCount}` : ""}</button>{advancedCount ? <button type="button" onClick={clearAdvanced} className={buttonClass}>清除高级条件</button> : null}{company || reportPeriod !== "all" || metric !== "all" || sourceCategory !== "all" || advancedCount ? <button type="button" onClick={() => { setCompany(""); setReportPeriod("all"); setMetric("all"); setSourceCategory("all"); clearAdvanced(); }} className={buttonClass}>清除全部筛选</button> : null}</div>
        <div id="expectation-advanced-filters" hidden={!advancedOpen}><div className="mt-3 grid gap-3 border-t border-borderSoft pt-3 sm:grid-cols-2 xl:grid-cols-3">
          <Select label="行业" value={industry} onChange={setIndustry} options={[["all", "全部行业"], ...props.industries.map((item) => [item.id, item.name] as [string, string])]} />
          <Select label="来源核验" value={verification} onChange={setVerification} options={[["all", "全部状态"], ["verified", "已核验"], ["pending", "待核验"], ["unverified", "无法核验"], ["invalid", "无效"]]} />
          <Select label="事前有效" value={exAnte} onChange={setExAnte} options={[["all", "全部"], ["true", "是"], ["false", "否 / 未匹配"]]} />
          <Select label="比较结果" value={result} onChange={setResult} options={[["all", "全部结果"], ["above", "高于对应预测"], ["within", "区间内 / 基本一致"], ["below", "低于对应预测"], ["not_comparable", "不可比较"], ["insufficient_data", "实际值不足"]]} />
          <Select label="存在修订" value={revision} onChange={setRevision} options={[["all", "全部"], ["true", "有修订"], ["false", "无修订"]]} />
          <Select label="观察清单" value={watched} onChange={setWatched} options={[["all", "全部"], ["true", "已进入观察清单"], ["false", "未进入观察清单"]]} />
        </div></div>
      </DashboardCard>

      <div className="flex flex-wrap gap-2" role="group" aria-label="预期证据视图"><TabButton active={view === "comparison"} onClick={() => setView("comparison")}>对比</TabButton><TabButton active={view === "audit"} onClick={showAudit}>来源与时间审计</TabButton><TabButton active={view === "imports"} onClick={() => setView("imports")}>导入记录</TabButton></div>
      {view !== "imports" ? <DashboardCard className="p-4"><Select label="同口径对照组" value={selectedGroup?.key ?? ""} onChange={setSelectedGroupKey} options={groups.length ? groups.map((group) => { const first = group.snapshots[0]; return [group.key, `${props.stocks.find((stock) => stock.id === first.stockId)?.name ?? first.stockId} · ${first.reportPeriod} · ${metricLabel(first.metric)} · ${periodScopeLabel(first.periodScope)} · ${first.currency} / ${unitLabel(first)} · ${first.accountingBasis}`]; }) : [["", "暂无可显示的对照组"]]} /><p className="mt-2 text-xs leading-5 text-textMuted">仅对齐公司、报告期、期间口径、指标、币种、单位与会计口径；来源分别展示，不合成机构一致预期。</p></DashboardCard> : null}

      {view === "comparison" ? <section className="min-w-0 space-y-4" aria-label="预期与实际对比">
        {selectedGroup ? <SourceComparison snapshots={selectedSnapshots} comparisons={comparisonBySnapshot} relations={props.providerRelationByLocalId} onAudit={showAudit} /> : <EmptyState title={effective.length ? "没有匹配的业绩预期" : "尚无业绩预期快照"} description={effective.length ? "请调整筛选；清除筛选不会删除记录。" : "添加一条有明确来源和形成时间的本地快照，或查看官方来源状态。"} />}
        <div role="group" aria-label="快照与历史视图" className="flex flex-wrap gap-2"><TabButton active={timelineView === "effective"} onClick={() => setTimelineView("effective")}>有效快照</TabButton><TabButton active={timelineView === "revisions"} onClick={() => setTimelineView("revisions")}>业务修订</TabButton><TabButton active={timelineView === "corrections"} onClick={() => setTimelineView("corrections")}>数据纠错</TabButton></div>
        <DashboardCard className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-textStrong">{timelineView === "effective" ? "有效快照、业务修订与数据更正时间线" : timelineView === "revisions" ? "业务修订时间线" : "数据纠错记录"}</h2><button type="button" onClick={showAudit} className={buttonClass}>查看时间审计</button></div><div className="mt-4 space-y-3">{displayedSnapshots.length ? displayedSnapshots.map(snapshotCard) : <EmptyState title={timelineView === "effective" ? "当前对照组没有有效快照" : timelineView === "revisions" ? "当前对照组没有业务修订" : "当前对照组没有数据纠错"} description="只展示现有记录，不将并列时间或数据纠错解释为预测上修/下修。" />}</div></DashboardCard>
      </section> : null}

      {view === "audit" ? <section className="min-w-0 space-y-4" aria-label="来源与时间审计详情">
        <DashboardCard className="p-4"><h2 className="text-base font-semibold text-textStrong">本地与官方证据关系</h2><p className="mt-1 text-xs leading-5 text-textMuted">以下关系覆盖全局载入记录，不随当前对照组缩小；本地原记录始终保留，内容冲突不进入比较。</p><div className="mt-3 space-y-2">{relations.length ? relations.map((record) => { const local = props.snapshots.find((snapshot) => snapshot.id === record.localSnapshotId); return <article key={record.localSnapshotId} className={`min-w-0 rounded border p-3 text-xs ${record.relation === "content_conflict" ? "border-warning/40 bg-warning/10" : "border-borderSoft bg-surface/50"}`}><p className="font-medium text-textStrong">{statusDisplayLabel(record.relation)}</p><dl className="mt-2 grid gap-2 sm:grid-cols-2"><div><dt className="text-textMuted">本地快照</dt><dd className="break-all text-textStrong">{record.localSnapshotId}</dd></div><div><dt className="text-textMuted">官方数据版本</dt><dd className="break-all text-textStrong">{record.providerSnapshotId ?? "-"}</dd></div><div><dt className="text-textMuted">差异字段</dt><dd className="break-words text-warning">{record.conflictingFields.join("、") || "无"}</dd></div><div><dt className="text-textMuted">保留的本地值</dt><dd className="break-words text-textStrong">{local ? formatSnapshot(local) : "本地记录未载入"}</dd></div></dl></article>; }) : <EmptyState title="没有需要核验的官方与本地关系" description="独立来源不合并；未知关系不会自动创建记录。" />}</div></DashboardCard>
        <DashboardCard className="p-4"><h2 className="text-base font-semibold text-textStrong">所选对照组 · 来源与时间线</h2><p className="mt-1 text-xs leading-5 text-textMuted">原始时间、有效时间、精度和前序候选分别保留。并列或不确定不生成方向性结论。</p><div className="mt-3 space-y-3">{selectedSnapshots.length ? selectedSnapshots.map(snapshotCard) : <EmptyState title="没有匹配的审计对象" description="请选择有快照的公司与报告期。" />}</div></DashboardCard>
        <DashboardCard className="p-4"><h2 className="text-base font-semibold text-textStrong">数据核验队列</h2><p className="mt-1 text-xs leading-5 text-textMuted">全局范围：来源、日期、口径、单位、实际值、业务前序或解析状态不足时明确保留，不随快照筛选缩小。</p><div className="mt-4 space-y-3">{queueSnapshots.map((snapshot) => { const comparison = comparisonBySnapshot.get(snapshot.id); const previousResolution = selectionBySnapshot.get(snapshot.id)?.previousResolution; const businessOrderIssue = previousResolution && ["ambiguous", "equal_time", "unresolved"].includes(previousResolution.status); return <article key={`queue-${snapshot.id}`} className={riskClass}><p className="break-words text-sm font-medium text-textStrong">{props.stocks.find((stock) => stock.id === snapshot.stockId)?.name ?? snapshot.stockId} · {snapshot.reportPeriod}</p><p className="mt-1 break-words text-xs text-warning">{businessOrderIssue ? `上一业务预测无法唯一确认，候选 ${previousResolution.candidateNodes.length} 条；不计算上修或下修。` : snapshot.sourceVerificationStatus !== "verified" ? `来源状态：${statusDisplayLabel(snapshot.sourceVerificationStatus)}` : comparison?.nonComparableReasons.join("；") || "无法匹配实际值"}</p></article>; })}{props.providerExclusions?.map((item) => <article key={`provider-exclusion-${item.sourceAnnouncementId}-${item.metric ?? "none"}`} className={riskClass}><p className="text-sm text-textStrong">Provider 排除 · {item.companyName} · {item.sourceTitle}</p><p className="mt-1 break-words text-xs text-warning">{item.reasons.join("；")} · 不生成数值、不补 0</p></article>)}{props.providerWarnings?.map((item) => <article key={`provider-warning-${item.sourceAnnouncementId}-${item.code}`} className={riskClass}><p className="text-sm text-textStrong">Provider 警告 · [{item.code}]</p><p className="mt-1 break-words text-xs text-warning">{item.message} 候选公告：{item.candidateAnnouncementIds.join("、") || "无"}</p></article>)}{importIssues.map(({ record, issue }, index) => <article key={`${record.id}-${index}`} className={riskClass}><p className="text-sm text-textStrong">{record.ingestionMethod === "csv_import" ? "CSV" : "JSON"} 导入核验 · 第 {issue.row} 行 · [{issue.code}]</p><p className="mt-1 break-words text-xs text-warning">{issue.message}</p></article>)}{!queueSnapshots.length && !importIssues.length && !props.providerExclusions?.length && !props.providerWarnings?.length ? <p className="text-sm text-textMuted">当前没有数据核验项。</p> : null}</div></DashboardCard>
      </section> : null}
      {view === "imports" ? <DashboardCard className="p-4"><h2 className="text-base font-semibold text-textStrong">导入记录</h2><p className="mt-1 text-xs leading-5 text-textMuted">按原记录顺序保留批次、导入模式和校验结果；页面筛选不改变导入历史。</p><div className="mt-4 space-y-3">{props.importHistory.length ? props.importHistory.map((record) => <article key={record.id} className="min-w-0 rounded border border-borderSoft bg-surface/50 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="break-all text-sm font-semibold text-textStrong">{record.fileName || "未记录文件名"} · {record.ingestionMethod === "csv_import" ? "CSV" : "JSON"}</h3><span className="break-words text-xs text-textMuted">{record.importedAt} · {record.mode === "merge" ? "合并" : "替换"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><Value label="输入" value={String(record.totalCount)} /><Value label="新增" value={String(record.addedCount)} /><Value label="重复" value={String(record.duplicateCount)} /><Value label="冲突" value={String(record.conflictCount)} /><Value label="无效" value={String(record.invalidCount)} /></div>{record.issues.length ? <ul className="mt-3 space-y-2">{record.issues.map((issue, index) => <li key={`${issue.row}-${issue.code}-${index}`} className={riskClass}>第 {issue.row} 行 · [{issue.code}] {issue.message}</li>)}</ul> : <p className="mt-3 text-xs text-textMuted">此批次没有记录校验问题。</p>}<p className="mt-2 break-all text-xs text-textMuted">批次标识：{record.id}</p></article>) : <EmptyState title="尚无导入记录" description="手动新增快照不属于导入批次。导入后按原校验流程记录结果。" />}</div></DashboardCard> : null}
    </section>
  );
}

// Intentionally stricter than a source-history key: unlike history, side-by-side
// values must never mix period scope, currency, unit or accounting basis.
function displayGroupKey(snapshot: EarningsExpectationSnapshot) {
  return JSON.stringify([snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, snapshot.currency, snapshot.unit, snapshot.accountingBasis]);
}

function SourceComparison({ snapshots, comparisons, relations, onAudit }: { snapshots: EarningsExpectationSnapshot[]; comparisons: Map<string, EarningsExpectationComparison>; relations?: Map<string, ProviderEvidenceRelationRecord>; onAudit: () => void }) {
  const rows = snapshots.map((snapshot) => {
    const comparison = comparisons.get(snapshot.id);
    const relation = relations?.get(snapshot.id);
    const excluded = relation && relation.relation !== "independent";
    const low = snapshot.estimateShape === "range" ? comparison?.expectedLowerBound : comparison?.expectedValue;
    const high = snapshot.estimateShape === "range" ? comparison?.expectedUpperBound : comparison?.expectedValue;
    const actual = comparison?.actualValue;
    const plot = !excluded && comparison?.comparabilityStatus === "comparable" && typeof low === "number" && Number.isFinite(low) && typeof high === "number" && Number.isFinite(high) && typeof actual === "number" && Number.isFinite(actual) ? { low, high, actual } : null;
    return { snapshot, comparison, relation, plot };
  });
  const values = rows.flatMap((row) => row.plot ? [row.plot.low, row.plot.high, row.plot.actual] : []);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const padding = (max - min || Math.abs(max) || 1) * 0.1;
  const start = min - padding;
  const end = max + padding;
  const x = (value: number) => 18 + (value - start) / (end - start) * 324;
  const first = snapshots[0];
  return <DashboardCard className="p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold text-textStrong">预期与实际 / {metricLabel(first.metric)}</h2><p className="mt-1 break-words text-xs leading-5 text-textMuted">{first.reportPeriod} · {periodScopeLabel(first.periodScope)} · {first.currency} · {first.accountingBasis}</p></div><button type="button" onClick={onAudit} className={buttonClass}>查看来源与时间线</button></div>
    <p className="mt-2 text-xs leading-5 text-textMuted">每种来源独立比较；高于用户预测不等于高于机构一致预期。</p>
    <section aria-label="来源区间对照" className="mt-4 space-y-3">{rows.map(({ snapshot, comparison, relation, plot }) => <article key={snapshot.id} className="min-w-0 rounded border border-borderSoft bg-surface/50 p-3" aria-label={`${sourceCategoryLabel(snapshot.sourceCategory)} ${snapshot.sourceName}`}>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-textStrong">{sourceCategoryLabel(snapshot.sourceCategory)}</h3><p className="mt-1 break-words text-xs text-textMuted">{snapshot.sourceName || "来源缺失"}</p><p className="mt-2 break-words text-sm tabular-nums text-textStrong">{formatSnapshot(snapshot)}</p></div><div className="min-w-0">
        {plot ? <><svg viewBox="0 0 360 50" className="h-12 w-full" role="img" aria-label={`${sourceCategoryLabel(snapshot.sourceCategory)}：${formatSnapshot(snapshot)}；实际值 ${plot.actual} ${first.currency} ${first.metric === "eps" ? "/股" : "元"}`}><line x1="18" x2="342" y1="25" y2="25" stroke="var(--ui-control)" strokeWidth="1" />{snapshot.estimateShape === "range" ? <><line x1={x(plot.low)} x2={x(plot.high)} y1="25" y2="25" stroke="var(--ui-accent)" strokeWidth="8" strokeLinecap="round" /><line x1={x(plot.low)} x2={x(plot.low)} y1="17" y2="33" stroke="var(--ui-accent)" strokeWidth="2" /><line x1={x(plot.high)} x2={x(plot.high)} y1="17" y2="33" stroke="var(--ui-accent)" strokeWidth="2" /></> : <rect x={x(plot.low) - 5} y="20" width="10" height="10" fill="var(--ui-accent)" />}<circle cx={x(plot.actual)} cy="25" r="5" fill="var(--ui-secondary)" stroke="var(--ui-panel)" strokeWidth="2" /></svg><p className="break-words text-xs text-textMuted">已校验实际值：{first.metric === "eps" ? `${plot.actual} ${first.currency}/股` : formatFinancialAmount(plot.actual)}</p></> : <p className="rounded border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">{relation?.relation === "content_conflict" ? `内容冲突 · 不进入比较：${relation.conflictingFields.join("、")}` : relation && relation.relation !== "independent" ? "与官方记录重复 / 元数据差异 · 不重复计入比较" : comparison?.nonComparableReasons.join("；") || "缺少可靠实际值或比较资格，暂不绘制对照。"}</p>}
      </div></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge value={`来源核验：${statusDisplayLabel(snapshot.sourceVerificationStatus)}`} warning={snapshot.sourceVerificationStatus !== "verified"} /><Badge value={`事前有效：${comparison?.isExAnte ? "已证明" : "未认定 / 待匹配"}`} warning={!comparison?.isExAnte} /><Badge value={`数值可比性：${relation && relation.relation !== "independent" ? "排除" : comparison ? statusDisplayLabel(comparison.comparabilityStatus) : "待匹配"}`} warning={!plot} /></div>
      {comparison && (!relation || relation.relation === "independent") ? <p className="mt-2 break-words text-xs text-textStrong">{comparisonResultLabel(comparison, snapshot)}</p> : null}
    </article>)}</section>
    {values.length ? <div className="mt-3 text-xs text-textMuted"><div className="flex justify-between gap-2 tabular-nums"><span>{axisNumber(start)}</span><span>{axisNumber(end)}</span></div><p className="mt-2 leading-5">图形共用数轴 · {first.currency}{first.metric === "eps" ? "/股" : " 元"} · 横段为区间，方块为点预测，圆点为实际值。仅绘制现有引擎确认可比较的记录。</p></div> : <p className="mt-3 text-xs leading-5 text-textMuted">当前没有可绘制的可靠比较；缺值、事后记录与冲突不会补 0 或生成假区间。</p>}
  </DashboardCard>;
}

function axisNumber(value: number) { return value.toLocaleString("zh-CN", { maximumSignificantDigits: 5 }); }
function unitLabel(snapshot: EarningsExpectationSnapshot) { return snapshot.metric === "eps" ? `${snapshot.currency}/股` : ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[snapshot.unit]; }
const riskClass = "min-w-0 break-words rounded border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning";

function SnapshotCard({ snapshot, selection, comparison, history, stock, industries, watched, businessOrderStatus, timeZone, isProvider, duplicateOfProviderId, providerRecord, onCorrect, onOpenStock, auditExpanded = false }: { snapshot: EarningsExpectationSnapshot; selection?: EarningsExpectationSelection; comparison?: EarningsExpectationComparison; history: EarningsExpectationSnapshot[]; stock?: Stock; industries: Industry[]; watched: boolean; businessOrderStatus: "confirmed" | "equal" | "uncertain"; timeZone?: string; isProvider: boolean; duplicateOfProviderId?: string; providerRecord?: EarningsExpectationProviderSnapshot; onCorrect: (snapshot: EarningsExpectationSnapshot) => void; onOpenStock: (stock: Stock) => void; auditExpanded?: boolean }) {
  const businessNodes = resolveEffectiveBusinessHistory(history, timeZone);
  const currentNode = businessNodes.find((node) => node.effectiveSnapshot.id === snapshot.id);
  return <article className="min-w-0 rounded-lg border border-borderSoft bg-bg2/65 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs text-textMuted">{stock?.name ?? snapshot.stockId} · {stock?.code ?? ""} · {stock ? getIndustryName(industries, stock.industryId) : "行业缺失"}</p><h3 className="mt-1 break-words text-base font-semibold text-textStrong">{metricLabel(snapshot.metric)} · {snapshot.reportPeriod} · {periodScopeLabel(snapshot.periodScope)}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge value={isProvider ? "公司官方指引" : sourceCategoryLabel(snapshot.sourceCategory)} warning={snapshot.sourceCategory === "user_estimate"} /><Badge value={snapshot.sourceVerificationStatus} warning={snapshot.sourceVerificationStatus !== "verified"} />{isProvider ? <Badge value="Provider 只读" /> : null}{duplicateOfProviderId ? <Badge value="与官方 Provider 记录重复" warning /> : null}{watched ? <Badge value="观察清单" /> : null}{snapshot.correctsSnapshotId ? <Badge value={snapshot.correctionScope === "basis" ? "口径纠正" : "数值纠正"} warning /> : null}</div></div><div className="flex flex-wrap gap-2">{snapshot.sourceUrl ? <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className={buttonClass}><ExternalLink className="h-4 w-4" />{isProvider ? "巨潮官方公告" : "查看原始来源"}</a> : null}{providerRecord?.officialPdfUrl ? <a href={providerRecord.officialPdfUrl} target="_blank" rel="noreferrer" className={buttonClass}>官方 PDF</a> : null}{stock ? <button type="button" onClick={() => onOpenStock(stock)} className={buttonClass}>个股详情</button> : null}{!isProvider ? <button type="button" onClick={() => onCorrect(snapshot)} className={buttonClass}>创建纠正</button> : null}</div></div>
    {isProvider ? <div role="status" className="mt-3 break-all rounded border border-cyan/35 bg-cyan/10 p-2 text-xs text-cyan">公司内部形成时间未知，以公开披露时间作为可用时间。数据版本 {providerRecord?.providerVersion ?? snapshot.providerVersion ?? "-"} · 更新 {providerRecord?.generatedAt ?? snapshot.providerGeneratedAt ?? "-"} · 公告标识 {providerRecord?.sourceAnnouncementId ?? snapshot.sourceAnnouncementId ?? "-"} · 内容版本 {providerRecord?.providerSnapshotVersionId ?? snapshot.providerSnapshotVersionId ?? "-"}{snapshot.providerCorrectsVersionId ? ` · 抽取纠错 ${snapshot.providerCorrectionChangedFields?.join("、") || "字段未记录"}` : ""}</div> : null}
    <EarningsExpectationBusinessOrderWarning selection={selection} comparison={comparison} />
    {businessOrderStatus === "uncertain" && !selection?.previousResolution.reasonCode ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">当前有效预测之间无法确认业务先后顺序；实际值比较与业务节点选择分别展示。</div> : null}
    {businessOrderStatus === "equal" && !selection?.previousResolution.reasonCode ? <div role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">当前有效预测形成于同一精确时刻；稳定 ID 仅用于显示，不代表业务先后。</div> : null}
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Value label="当前预期" value={formatSnapshot(snapshot)} /><Value label="原记录业务时间 / 可用时间" value={formatBusinessTemporal(currentNode?.originalBusinessTime ?? getExpectationBusinessTime(snapshot, timeZone))} /><Value label="纠正后有效业务时间 / 可用时间" value={formatBusinessTemporal(currentNode?.effectiveBusinessTime ?? getExpectationBusinessTime(snapshot, timeZone))} /><Value label="当前有效来源时间" value={formatSourceTime(snapshot)} /><Value label="来源" value={`${snapshot.sourceName || "缺失"} · ${snapshot.sourceTitle || "标题缺失"}`} /><Value label="分析师 / 机构" value={`${snapshot.analystCount ?? "-"} / ${snapshot.institutionCount ?? "-"}`} /></div>
    <details open={auditExpanded || undefined} className="mt-3 min-w-0"><summary className="cursor-pointer text-xs text-cyan">完整时间与证据审计</summary><EarningsExpectationTemporalAudit snapshot={snapshot} selection={selection} comparison={comparison} displayTimeZone={timeZone ?? "UTC"} /></details>
    {currentNode?.temporalCorrectionApplied ? <div role="status" className="mt-2 rounded border border-cyan/35 bg-cyan/10 p-2 text-xs text-cyan">时间字段已纠正：{currentNode.correctedTemporalFields.join("、")}。排序与事前判断使用纠正后有效时间，原记录时间仅用于审计。</div> : null}
    {currentNode?.actualSourceInterpretationTimeZone && currentNode.actualSourceInterpretationTimeZone !== timeZone ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">来源时间实际按记录时区 {currentNode.actualSourceInterpretationTimeZone} 解释，而非当前工作流时区 {timeZone ?? "缺失"}。</div> : null}
    {isExpectationSourcePublishedAtUnresolved(snapshot) ? <div role="status" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">历史来源时间未记录原解释时区，已保留原值并标记待核验；不会据此证明事前有效。</div> : null}
    <div className={`mt-3 rounded border p-3 text-xs ${comparison?.comparabilityStatus === "comparable" ? "border-success/30 bg-success/10 text-textMuted" : "border-warning/30 bg-warning/10 text-warning"}`}><p className="font-semibold text-textStrong">{comparison ? comparisonResultLabel(comparison, snapshot) : "尚未生成比较"}{comparison?.isExAnte ? " · 事前有效" : " · 非事前有效或待匹配"}</p><p className="mt-1 break-words">{comparison?.comparisonMethod ?? "等待同公司、同报告期、同口径的可靠实际值。"}</p>{comparison ? <p className="mt-1">相对实际值披露：{timingStatusText(comparison.actualDisclosureTimingStatus)} · 相对公司业绩信息披露：{timingStatusText(comparison.performanceDisclosureTimingStatus)}{comparison.performanceDisclosureUncertain ? "（指标覆盖待核验）" : ""}</p> : null}{comparison?.actualDisclosureTimingStatus === "same_time" || comparison?.performanceDisclosureTimingStatus === "same_time" ? <p className="mt-1 font-medium">预测形成时间与披露时间相同，无法认定为披露前预测。</p> : null}<p className="mt-1">公司是否公开披露与本地数值是否解析成功分别判断；metadata_only / parse_partial 不会被包装成“未披露”。</p>{comparison?.nonComparableReasons.length ? <p className="mt-1">原因：{comparison.nonComparableReasons.join("；")}</p> : null}{comparison?.actualValue !== null && comparison?.actualValue !== undefined ? <p className="mt-1">本地已可靠解析实际值：{formatFinancialAmount(comparison.actualValue)} · 绝对差异：{formatFinancialAmount(comparison.absoluteDifference)}{comparison.relativeDifference === null ? "" : ` · 相对差异 ${(comparison.relativeDifference * 100).toFixed(2)}%`}</p> : null}</div>
    {history.length > 1 ? <div className="mt-3 rounded border border-borderSoft bg-surface/60 p-3"><p className="inline-flex items-center gap-2 text-xs font-semibold text-textStrong"><History className="h-4 w-4" />业务节点与纠正链时间线</p><div className="mt-2 space-y-3">{businessNodes.map((node) => {
      const previousResolution = resolveUniquePreviousBusinessNode(node, businessNodes);
      const previous = previousResolution.previousNode ?? undefined;
      const nodeOrderStatus = previousResolution.status === "equal_time" ? "equal" : ["ambiguous", "unresolved"].includes(previousResolution.status) ? "uncertain" : "confirmed";
      const revision = deriveExpectationBusinessRevisionDelta(node.effectiveSnapshot, previous?.effectiveSnapshot, nodeOrderStatus, { previousBusinessRootSnapshotId: previous?.businessRootSnapshot.id, currentBusinessRootSnapshotId: node.businessRootSnapshot.id });
      const candidateText = previousResolution.candidateNodes.map((candidate) => `${candidate.businessRootSnapshot.id}（终点 ${candidate.effectiveSnapshot.id}）`).join("、");
      return <div key={node.businessRootSnapshot.id} className="border-l border-borderSoft pl-3 text-xs text-textMuted"><p>原业务节点 {node.businessRootSnapshot.id} · 原记录可用时间 {formatBusinessTemporal(node.originalBusinessTime)} · 当前有效可用时间 {formatBusinessTemporal(node.effectiveBusinessTime)} · 当前有效值 {formatSnapshot(node.effectiveSnapshot)} · 终点 {node.effectiveSnapshot.id}</p><p className="mt-1">{revision ? `业务预测较前值（唯一可证明的有效基准 ${revision.previousEffectiveSnapshotId}）${revision.relativeDelta >= 0 ? "+" : ""}${(revision.relativeDelta * 100).toFixed(2)}%` : previousResolution.status === "none" ? "首个业务节点" : previousResolution.status === "equal_time" ? `精确同刻候选：${candidateText}；不生成方向性修订` : previousResolution.status === "ambiguous" || previousResolution.status === "unresolved" ? `前序无法唯一证明：${candidateText || "历史时间未解析"}；不生成方向性修订` : "口径变化，未计算业务修订率"}</p>{node.correctionChain.slice(1).map((correction) => { const target = node.correctionChain.find((item) => item.id === correction.correctsSnapshotId); const delta = deriveExpectationCorrectionDelta(correction, target); return <p key={correction.id} className="mt-1 text-warning">纠正记录 {correction.createdAt} · {correction.correctsSnapshotId} → {correction.id} · 变化字段：{delta?.changedFields.join("、") || "待核验"}{delta?.valueDelta === null ? " · 不跨口径计算差异" : ""} · 原因：{correction.notes ?? "缺失"} · 当前有效可用时间 {formatBusinessTemporal(node.effectiveBusinessTime)}</p>; })}</div>;
    })}</div></div> : null}
  </article>;
}

function formatSnapshot(snapshot: EarningsExpectationSnapshot) { const unit = snapshot.metric === "eps" ? `${snapshot.currency}/股` : ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[snapshot.unit]; return snapshot.estimateShape === "point" ? `${snapshot.value ?? "缺失"} ${unit}` : `${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${unit}`; }
function formatSourceTime(snapshot: EarningsExpectationSnapshot) { return `${snapshot.sourcePublishedAt ?? "缺失"} (${statusDisplayLabel(snapshot.sourcePublishedAtPrecision ?? "missing")}${snapshot.sourcePublishedAtResolution ? ` · ${statusDisplayLabel(snapshot.sourcePublishedAtResolution)}` : ""}${snapshot.sourcePublishedAtTimeZone ? ` · ${snapshot.sourcePublishedAtTimeZone}` : ""})`; }
function formatBusinessTemporal(value: ReturnType<typeof getExpectationBusinessTime>) { return value ? `${value.value} (${statusDisplayLabel(value.precision)})` : "不确定（未用形成时间回填）"; }
function metricLabel(value: EarningsExpectationSnapshot["metric"]) { return Object.fromEntries(metricOptions)[value]; }
function periodScopeLabel(value: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[value]; }
function timingStatusText(value?: EarningsExpectationComparison["performanceDisclosureTimingStatus"]) { return ({ before: "披露前", after: "披露后", same_time: "同一时刻", unknown: "先后未知" } as Record<string, string>)[value ?? "unknown"]; }
function Badge({ value, warning = false }: { value: string; warning?: boolean }) { return <span className={`rounded border px-2 py-1 ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-borderSoft text-textMuted"}`}>{statusDisplayLabel(value)}</span>; }
function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded border border-borderSoft bg-surface/60 p-3"><p className="text-xs text-textMuted">{label}</p><p className="mt-1 break-words text-sm text-textStrong">{value}</p></div>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([optionValue, labelValue]) => <option key={optionValue} value={optionValue}>{labelValue}</option>)}</select></Field>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
const metricOptions: Array<[string, string]> = [["revenue", "营业收入"], ["attributable_net_profit", "归母净利润"], ["adjusted_net_profit", "扣非净利润"], ["eps", "每股收益"], ["operating_cash_flow", "经营现金流"]];
const sourceOptions: Array<[string, string]> = [["company_guidance", "公司指引"], ["institution_single", "单家机构预测"], ["institution_consensus", "机构一致预期"], ["user_estimate", "用户个人预测"]];
const inputClass = "h-10 w-full min-w-0 rounded border border-borderSoft bg-bg2 px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded border border-control bg-panel px-3 py-2 text-xs text-textStrong hover:border-cyan";
