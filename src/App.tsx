import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, Binoculars, Building2, CheckSquare, FileCheck2, FlaskConical, LineChart, Plus, ScrollText, RefreshCw, type LucideIcon } from "lucide-react";
import { Header } from "./components/layout/Header";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RightRail } from "./components/layout/RightRail";
import { Sidebar } from "./components/layout/Sidebar";
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
import { WatchItemFormModal } from "./components/watchlist/WatchItemFormModal";
import { ReviewFormModal } from "./components/watchlist/ReviewFormModal";
import { ResearchEventCenter } from "./components/research/ResearchEventCenter";
import { EarningsExpectationCenter } from "./components/expectation/EarningsExpectationCenter";
import { EarningsExpectationFormModal } from "./components/expectation/EarningsExpectationFormModal";
import { EarningsExpectationImportModal } from "./components/expectation/EarningsExpectationImportModal";
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { watchlistSamples } from "./data/watchlist";
import { buildDashboardDataset } from "./services/dataProvider";
import { buildResearchEventSnapshot, deduplicateResearchEvents, sortResearchEvents } from "./services/researchEventProvider";
import { buildReviewTasks } from "./services/reviewTaskProvider";
import { createBrowserWatchlistRepository, createEmptyWatchlistEnvelope } from "./services/watchlistRepository";
import { WatchlistStore, type CreateWatchItemInput, type WatchItemMetadataInput, type WatchlistActionResult } from "./services/watchlistStore";
import { createBrowserEarningsExpectationRepository, createEmptyEarningsExpectationEnvelope, earningsExpectationCsvTemplate, exportEarningsExpectationCsv } from "./services/earningsExpectationRepository";
import { EarningsExpectationStore, type CreateEarningsExpectationSnapshotInput, type EarningsExpectationActionResult } from "./services/earningsExpectationStore";
import { buildEarningsExpectationComparisons } from "./services/earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./services/earningsExpectationEventProvider";
import { aggregateEarningsExpectationEvidence, buildProviderContentConflictEvents, companyGuidanceExpectationSummary, createCompanyGuidanceExpectationLoader, selectActiveCompanyGuidanceProviderRecords, selectDefaultCompanyGuidanceStockIds } from "./services/companyGuidanceExpectationProvider";
import { getCalendarToday, getTemporalCalendarDate, isPreciseInstant } from "./utils/dateTime";
import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationLoadStatus, CompanyGuidanceExpectationWorkflowIndex, DashboardDataMode, EarningsExpectationSnapshot, Stock, WatchItem } from "./types";
import { DashboardCard, KpiCard, SectionHeader } from "./components/common/terminal";
import { formatPercent } from "./utils/normalize";

type MainTab = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心" | "预期证据";

const tabs: Array<{ id: MainTab; icon: LucideIcon }> = [
  { id: "宏观", icon: LineChart },
  { id: "行业", icon: Building2 },
  { id: "个股池", icon: BarChart3 },
  { id: "观察清单", icon: Binoculars },
  { id: "验证中心", icon: FlaskConical },
  { id: "预期证据", icon: ScrollText },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("行业");
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [dataMode, setDataMode] = useState<DashboardDataMode>("mixed");
  const repository = useMemo(() => createBrowserWatchlistRepository(), []);
  const watchlistStore = useMemo(() => new WatchlistStore(repository), [repository]);
  const initialWatchlistLoad = useMemo(() => repository.load(), [repository]);
  const [watchlistData, setWatchlistData] = useState(initialWatchlistLoad.data);
  const [storageError, setStorageError] = useState<string | null>(initialWatchlistLoad.error);
  const [corruptedRaw, setCorruptedRaw] = useState<string | null>(initialWatchlistLoad.corruptedRaw);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [watchForm, setWatchForm] = useState<{ itemId?: string; stockId?: string } | null>(null);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [correctionReviewId, setCorrectionReviewId] = useState<string | null>(null);
  const expectationRepository = useMemo(() => createBrowserEarningsExpectationRepository(), []);
  const expectationStore = useMemo(() => new EarningsExpectationStore(expectationRepository), [expectationRepository]);
  const initialExpectationLoad = useMemo(() => expectationRepository.load(), [expectationRepository]);
  const [expectationData, setExpectationData] = useState(initialExpectationLoad.data);
  const [expectationStorageError, setExpectationStorageError] = useState<string | null>(initialExpectationLoad.error);
  const [expectationCorruptedRaw, setExpectationCorruptedRaw] = useState<string | null>(initialExpectationLoad.corruptedRaw);
  const [expectationForm, setExpectationForm] = useState<{ stockId?: string; correctionId?: string } | null>(null);
  const [expectationImportOpen, setExpectationImportOpen] = useState(false);
  const companyGuidanceLoader = useMemo(() => createCompanyGuidanceExpectationLoader(), []);
  const companyGuidanceRequestGeneration = useRef(0);
  const [companyGuidanceWorkflow, setCompanyGuidanceWorkflow] = useState<CompanyGuidanceExpectationWorkflowIndex | null>(null);
  const [companyGuidanceWorkflowStatus, setCompanyGuidanceWorkflowStatus] = useState<CompanyGuidanceExpectationLoadStatus>("idle");
  const [companyGuidanceWorkflowError, setCompanyGuidanceWorkflowError] = useState<string | null>(null);
  const [companyGuidanceDetails, setCompanyGuidanceDetails] = useState<Record<string, CompanyGuidanceExpectationDetail>>({});
  const [companyGuidanceLoadStatus, setCompanyGuidanceLoadStatus] = useState<CompanyGuidanceExpectationLoadStatus>("idle");
  const [companyGuidanceLoadError, setCompanyGuidanceLoadError] = useState<string | null>(null);
  const [companyGuidanceFailedStockIds, setCompanyGuidanceFailedStockIds] = useState<string[]>([]);
  const [companyGuidanceRetryToken, setCompanyGuidanceRetryToken] = useState(0);
  const dataset = useMemo(() => buildDashboardDataset(dataMode), [dataMode]);
  const providerRecords = useMemo(() => selectActiveCompanyGuidanceProviderRecords(dataMode, companyGuidanceWorkflowStatus, companyGuidanceWorkflow), [companyGuidanceWorkflow, companyGuidanceWorkflowStatus, dataMode]);
  const aggregatedExpectationEvidence = useMemo(() => aggregateEarningsExpectationEvidence({ providerSnapshots: providerRecords, localSnapshots: expectationData.snapshots }), [expectationData.snapshots, providerRecords]);
  const baseResearchSnapshot = useMemo(() => buildResearchEventSnapshot(dataset.stocks), [dataset.stocks]);
  const expectationComparisons = useMemo(() => buildEarningsExpectationComparisons(aggregatedExpectationEvidence.comparisonSnapshots, baseResearchSnapshot.events, expectationData.settings), [aggregatedExpectationEvidence.comparisonSnapshots, baseResearchSnapshot.events, expectationData.settings]);
  const expectationEvents = useMemo(() => buildEarningsExpectationResearchEvents(aggregatedExpectationEvidence.comparisonSnapshots, expectationComparisons, dataset.stocks, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone), [aggregatedExpectationEvidence.comparisonSnapshots, dataset.stocks, expectationComparisons, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone]);
  const providerConflictEvents = useMemo(() => buildProviderContentConflictEvents(aggregatedExpectationEvidence, expectationData.snapshots, dataset.stocks), [aggregatedExpectationEvidence, dataset.stocks, expectationData.snapshots]);
  const researchSnapshot = useMemo(() => ({ ...baseResearchSnapshot, events: sortResearchEvents(deduplicateResearchEvents([...baseResearchSnapshot.events, ...expectationEvents, ...providerConflictEvents]), expectationData.settings.timeZone) }), [baseResearchSnapshot, expectationData.settings.timeZone, expectationEvents, providerConflictEvents]);
  const reviewTasks = useMemo(() => buildReviewTasks({
    watchItems: watchlistData.watchItems,
    events: researchSnapshot.events,
    chains: researchSnapshot.chains,
    taskStates: watchlistData.reviewTaskStates,
    longUnreviewedDays: watchlistData.settings.longUnreviewedDays,
    expectationRevisionThreshold: expectationData.settings.revisionReminderThreshold,
    timeZone: expectationData.settings.timeZone,
  }), [expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone, researchSnapshot, watchlistData]);
  const exportJson = useMemo(() => repository.export(watchlistData), [repository, watchlistData]);
  const expectationExportJson = useMemo(() => expectationRepository.export(expectationData), [expectationData, expectationRepository]);
  const expectationExportCsv = useMemo(() => exportEarningsExpectationCsv(expectationData.snapshots), [expectationData.snapshots]);
  const activeSelectedStock = selectedStock ? dataset.stocks.find((stock) => stock.id === selectedStock.id) ?? null : null;

  useEffect(() => {
    const generation = ++companyGuidanceRequestGeneration.current;
    if (dataMode === "mock") {
      setCompanyGuidanceWorkflow(null);
      setCompanyGuidanceWorkflowStatus("idle");
      setCompanyGuidanceWorkflowError(null);
      setCompanyGuidanceDetails({});
      setCompanyGuidanceLoadStatus("idle");
      setCompanyGuidanceLoadError(null);
      setCompanyGuidanceFailedStockIds([]);
      return;
    }
    setCompanyGuidanceWorkflow(null);
    setCompanyGuidanceWorkflowStatus("loading");
    setCompanyGuidanceWorkflowError(null);
    companyGuidanceLoader.loadWorkflow()
      .then((workflow) => {
        if (generation !== companyGuidanceRequestGeneration.current) return;
        setCompanyGuidanceWorkflow(workflow);
        setCompanyGuidanceWorkflowStatus("success");
      })
      .catch((error) => {
        if (generation !== companyGuidanceRequestGeneration.current) return;
        setCompanyGuidanceWorkflow(null);
        setCompanyGuidanceWorkflowStatus("error");
        setCompanyGuidanceWorkflowError(error instanceof Error ? error.message : String(error));
      });
  }, [companyGuidanceLoader, companyGuidanceRetryToken, dataMode]);

  useEffect(() => {
    if (dataMode === "mock") return;
    const generation = companyGuidanceRequestGeneration.current;
    const requestedIds = activeSelectedStock?.market === "A股"
      ? [activeSelectedStock.id]
      : activeTab === "预期证据" || activeTab === "验证中心"
        ? selectDefaultCompanyGuidanceStockIds(companyGuidanceExpectationSummary.items)
        : [];
    const missingIds = requestedIds.filter((stockId) => !companyGuidanceDetails[stockId] && !companyGuidanceFailedStockIds.includes(stockId));
    if (!missingIds.length) {
      if (requestedIds.length && !companyGuidanceFailedStockIds.some((stockId) => requestedIds.includes(stockId))) setCompanyGuidanceLoadStatus("success");
      return;
    }
    setCompanyGuidanceLoadStatus("loading");
    setCompanyGuidanceLoadError(null);
    companyGuidanceLoader.loadMany(missingIds).then((result) => {
      if (generation !== companyGuidanceRequestGeneration.current) return;
      if (Object.keys(result.successes).length) setCompanyGuidanceDetails((current) => ({ ...current, ...result.successes }));
      setCompanyGuidanceLoadStatus(result.status);
      setCompanyGuidanceFailedStockIds(result.failures.map((failure) => failure.stockId));
      setCompanyGuidanceLoadError(result.failures.length ? result.failures.map((failure) => `${failure.stockId} [${failure.code}] ${failure.message}`).join("；") : null);
    });
  }, [activeSelectedStock?.id, activeSelectedStock?.market, activeTab, companyGuidanceDetails, companyGuidanceFailedStockIds, companyGuidanceLoader, companyGuidanceRetryToken, dataMode]);

  const retryCompanyGuidance = () => {
    companyGuidanceLoader.clearCache();
    setCompanyGuidanceFailedStockIds([]);
    setCompanyGuidanceRetryToken((value) => value + 1);
  };

  const dashboardStats = useMemo(() => {
    const quoteCoverage = dataset.realManifest.coverage?.quotes;
    const hkQuoteCoverage = dataset.realManifest.coverage?.hkQuotes;
    const hkRealCount = hkQuoteCoverage?.real ?? 0;
    const hkQuoteTotal = hkQuoteCoverage?.total ?? quoteCoverage?.unsupportedTotal ?? dataset.realManifest.universe?.markets?.["港股"];
    const stocksWithReal = dataset.stocks.filter((stock) =>
      stock.dataQuality?.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale"),
    ).length;
    const missingFields = dataset.stocks.reduce((sum, stock) => sum + (stock.missingFields?.length ?? 0), 0);
    const pctValues = dataset.stocks
      .map((stock) => stock.quote?.pctChange)
      .filter((value): value is number => typeof value === "number");
    const averagePct = pctValues.length ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length : null;
    const recentlyUpdated = dataset.stocks.filter((stock) => stock.isRecentlyUpdated).length;
    const highRisk = dataset.stocks.filter((stock) => stock.riskLevel === "高").length;
    const segments = dataset.industries.reduce((sum, industry) => sum + industry.segments.length, 0);
    const focusStocks = [...dataset.stocks]
      .sort((a, b) => Math.abs(b.quote?.pctChange ?? 0) - Math.abs(a.quote?.pctChange ?? 0))
      .slice(0, 4);
    const missingStocks = dataset.stocks.filter((stock) => (stock.missingFields?.length ?? 0) > 0).slice(0, 6);
    const quoteCoverageReal = quoteCoverage?.real ?? stocksWithReal;
    const quoteCoverageTotal = quoteCoverage?.total ?? dataset.stocks.filter((stock) => stock.market === "A股").length;
    const hkCoverageSummary =
      hkQuoteCoverage
        ? `港股行情 ${hkQuoteCoverage.real}/${hkQuoteCoverage.total}`
        : hkQuoteTotal === undefined
          ? "港股暂未接入"
          : `港股 ${hkRealCount}/${hkQuoteTotal} 暂未接入`;
    const cutoff = shiftCalendarDate(getCalendarToday(new Date(), expectationData.settings.timeZone), -6);
    const recentEvents = researchSnapshot.events.filter((event) => event.eventType !== "data_warning" && eventCalendarDate(event, expectationData.settings.timeZone) >= cutoff).length;
    const pendingReviewCompanies = new Set(researchSnapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
    const verificationChains = researchSnapshot.chains.length;
    const dataReviewItems = researchSnapshot.events.filter((event) => event.eventType === "data_warning" || event.reviewStatus === "pending").length;
    const today = getCalendarToday(new Date(), expectationData.settings.timeZone);
    const pendingTasks = reviewTasks.filter((task) => task.status === "pending");
    const todayReview = new Set(pendingTasks.filter((task) => task.ruleType === "due_review" || task.dueAt === today).map((task) => task.watchItemId)).size;
    const overdueReview = new Set(pendingTasks.filter((task) => task.ruleType === "overdue_review").map((task) => task.watchItemId)).size;
    const newEventReminder = new Set(pendingTasks.filter((task) => task.relatedEventIds.length > 0).map((task) => task.watchItemId)).size;
    const highPriorityWatch = watchlistData.watchItems.filter((item) => !item.archivedAt && item.priority === "high").length;
    const recentExpectationSnapshots = expectationEvents.filter((event) => event.eventType === "earnings_expectation_added" && event.eventDate && event.eventDate >= cutoff).length;
    const expectationCorrections = expectationEvents.filter((event) => event.eventType === "earnings_expectation_correction" && event.eventDate && event.eventDate >= cutoff).length;
    const latestExpectationRevisions = expectationEvents.filter((event) => event.eventType === "earnings_expectation_revision" && event.eventDate && event.eventDate >= cutoff);
    const expectationRevisionUp = latestExpectationRevisions.filter((event) => event.expectation?.businessOrderStatus === "confirmed" && event.expectation.businessRevisionDelta?.direction === "up" && Math.abs(event.expectation.businessRevisionDelta.relativeDelta) >= expectationData.settings.revisionReminderThreshold).length;
    const expectationRevisionDown = latestExpectationRevisions.filter((event) => event.expectation?.businessOrderStatus === "confirmed" && event.expectation.businessRevisionDelta?.direction === "down" && Math.abs(event.expectation.businessRevisionDelta.relativeDelta) >= expectationData.settings.revisionReminderThreshold).length;
    const reviewableExpectationActuals = expectationComparisons.filter((comparison) => comparison.comparabilityStatus === "comparable").length;
    const pendingExpectationSources = aggregatedExpectationEvidence.snapshots.filter((snapshot) => snapshot.sourceVerificationStatus !== "verified").length;

    return {
      stocksWithReal,
      missingFields,
      averagePct,
      recentlyUpdated,
      highRisk,
      segments,
      focusStocks,
      missingStocks,
      quoteCoverageReal,
      quoteCoverageTotal,
      hkCoverageSummary,
      recentEvents,
      pendingReviewCompanies,
      verificationChains,
      dataReviewItems,
      todayReview,
      overdueReview,
      newEventReminder,
      highPriorityWatch,
      recentExpectationSnapshots,
      expectationCorrections,
      expectationRevisionUp,
      expectationRevisionDown,
      reviewableExpectationActuals,
      pendingExpectationSources,
    };
  }, [aggregatedExpectationEvidence.snapshots, dataset, expectationComparisons, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone, expectationEvents, researchSnapshot, reviewTasks, watchlistData.watchItems]);

  const applyAction = (result: WatchlistActionResult, successMessage: string) => {
    if (result.ok) {
      setWatchlistData(result.data);
      setStorageError(null);
      setWorkflowMessage(successMessage);
    } else {
      setStorageError(result.error);
      setWorkflowMessage(null);
    }
    return result.ok;
  };

  const createWatchItem = (input: CreateWatchItemInput) => {
    if (applyAction(watchlistStore.createWatchItem(watchlistData, input), "观察项已保存。")) setWatchForm(null);
  };
  const updateWatchItem = (input: WatchItemMetadataInput) => {
    if (!watchForm?.itemId) return;
    if (applyAction(watchlistStore.updateWatchItemMetadata(watchlistData, watchForm.itemId, input), "观察项元数据已更新。")) setWatchForm(null);
  };
  const restoreWatchItem = (item: WatchItem) => applyAction(watchlistStore.restoreWatchItem(watchlistData, item.id), "归档观察项已恢复。");
  const startReview = (item: WatchItem) => { setCorrectionReviewId(null); setReviewItemId(item.id); };
  const applyExpectationAction = (result: EarningsExpectationActionResult, message: string) => {
    if (result.ok) {
      setExpectationData(result.data);
      setExpectationStorageError(null);
      setWorkflowMessage(message);
      setExpectationForm(null);
    } else {
      setExpectationStorageError(result.error);
      setWorkflowMessage(null);
    }
  };
  const saveExpectation = (input: CreateEarningsExpectationSnapshotInput, correctsSnapshotId?: string) => {
    const result = correctsSnapshotId
      ? expectationStore.appendCorrection(expectationData, correctsSnapshotId, input)
      : expectationStore.appendSnapshot(expectationData, input);
    applyExpectationAction(result, correctsSnapshotId ? "纠正快照已追加，原快照保持不变。" : "业绩预期不可变快照已保存。");
  };

  return (
    <div className="terminal-grid min-h-screen bg-bg text-text">
      <Header
        search={globalSearch}
        onSearchChange={setGlobalSearch}
        updatedAt={dataset.dataUpdatedAt}
        sourceNote={dataMode === "mock" ? dataSourceNote : dataset.dataSourceNote}
        dataMode={dataMode}
        modeLabel={dataset.modeLabel}
        coverageSummary={dataset.coverageSummary}
        onDataModeChange={setDataMode}
      />

      <DashboardLayout
        sidebar={<Sidebar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />}
        main={
          <section className="min-w-0 space-y-4">
          <DashboardCard className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" aria-label="全局公司指引 Provider 状态">
            <div className="min-w-0 text-xs"><span className="font-semibold text-textStrong">公司指引 Provider</span><span className="ml-2 text-textMuted">{dataMode === "mock" ? "Mock 模式已严格隔离真实 Provider" : companyGuidanceWorkflowStatus === "loading" ? "全局索引校验中" : companyGuidanceWorkflowStatus === "success" ? `已验证 ${providerRecords.length} 条当前版本，导航切换不改变工作流` : companyGuidanceWorkflowStatus === "error" ? "全局索引失败，正式 Provider 已关闭" : "等待加载"}</span></div>
            {companyGuidanceWorkflowError ? <div className="flex min-w-0 items-center gap-2"><span role="alert" className="max-w-xl truncate text-xs text-warning" title={companyGuidanceWorkflowError}>{companyGuidanceWorkflowError}</span><button type="button" onClick={retryCompanyGuidance} className="rounded border border-warning/50 px-2 py-1 text-xs text-warning">重试</button></div> : null}
          </DashboardCard>
          <DashboardCard className="overflow-hidden p-5">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
              <div className="min-w-0">
                <SectionHeader
                  eyebrow="Research Command Center"
                  title="事件验证、风险核验与核心资产跟踪"
                  description="优先展示真实公告和财务数据触发的投研动作；数据健康与缺失覆盖保留为底层证据状态。"
                />
                <button type="button" onClick={() => setExpectationForm({})} className="mt-4 inline-flex h-9 items-center gap-2 rounded border border-cyan/50 px-3 text-xs text-cyan hover:border-cyan"><Plus className="h-4 w-4" />添加业绩预期</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">行业 / 细分</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">
                    {dataset.industries.length} / {dashboardStats.segments}
                  </p>
                </div>
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">个股池</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">{dataset.stocks.length}</p>
                </div>
                <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
                  <p className="text-xs text-textMuted">观察项</p>
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">{watchlistData.watchItems.filter((item) => !item.archivedAt).length}</p>
                </div>
              </div>
            </div>
          </DashboardCard>

          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              label="今日待复盘"
              value={dashboardStats.todayReview}
              delta="用户观察项"
              description="复盘日期已到或任务今日到期"
              tone="info"
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <KpiCard
              label="已逾期复盘"
              value={dashboardStats.overdueReview}
              delta="只读提醒"
              description="不会自动改变观察状态"
              tone={dashboardStats.overdueReview ? "warning" : "positive"}
              icon={<CheckSquare className="h-4 w-4" />}
            />
            <KpiCard
              label="新事件提醒"
              value={dashboardStats.newEventReminder}
              delta="ResearchEvent"
              description="上次复盘后新增真实事件"
              tone="info"
              icon={<FileCheck2 className="h-4 w-4" />}
            />
            <KpiCard
              label="高优先级观察"
              value={dashboardStats.highPriorityWatch}
              delta="用户数据"
              description="示例模板不计入"
              tone={dashboardStats.highPriorityWatch ? "warning" : "positive"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </section>

          <DashboardCard className="p-3">
            <div className="grid gap-2 text-xs text-textMuted sm:grid-cols-2 xl:grid-cols-6" aria-label="业绩预期行动指标">
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">新增业绩预期：<strong className="text-textStrong">{dashboardStats.recentExpectationSnapshots}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">数据更正：<strong className="text-cyan">{dashboardStats.expectationCorrections}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">最新预期上修：<strong className="text-success">{dashboardStats.expectationRevisionUp}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">最新预期下修：<strong className="text-warning">{dashboardStats.expectationRevisionDown}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">新增可复盘实际结果：<strong className="text-textStrong">{dashboardStats.reviewableExpectationActuals}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">来源待核验：<strong className="text-warning">{dashboardStats.pendingExpectationSources}</strong></button>
            </div>
          </DashboardCard>

          <DashboardCard className="p-3">
            <div className="grid gap-2 text-xs text-textMuted sm:grid-cols-2 xl:grid-cols-4" aria-label="数据健康信息">
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">真实行情覆盖：<strong className="text-textStrong">{dashboardStats.quoteCoverageReal}/{dashboardStats.quoteCoverageTotal}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">平均涨跌幅：<strong className="text-textStrong">{formatPercent(dashboardStats.averagePct)}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">缺失字段：<strong className="text-warning">{dashboardStats.missingFields}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">最近更新样本：<strong className="text-textStrong">{dashboardStats.recentlyUpdated}</strong> · {dashboardStats.hkCoverageSummary}</span>
            </div>
          </DashboardCard>

          {workflowMessage ? <div role="status" className="rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">{workflowMessage}</div> : null}

          {activeTab === "宏观" && <MacroTab indicators={macroIndicators} />}
          {activeTab === "行业" && (
            <IndustryTab
              industries={dataset.industries}
              stocks={dataset.stocks}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "个股池" && (
            <StockPool
              stocks={dataset.stocks}
              industries={dataset.industries}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "观察清单" && (
            <WatchlistTab
              watchItems={watchlistData.watchItems}
              samples={watchlistSamples}
              reviewEntries={watchlistData.reviewEntries}
              tasks={reviewTasks}
              stocks={dataset.stocks}
              industries={dataset.industries}
              events={researchSnapshot.events}
              storageError={storageError}
              corruptedRaw={corruptedRaw}
              exportJson={exportJson}
              onValidateImport={(raw) => repository.validateImport(raw, watchlistData)}
              onMergeImport={(raw) => {
                const result = repository.mergeImport(raw, watchlistData);
                if (result.ok && result.data) { setWatchlistData(result.data); setStorageError(null); setWorkflowMessage(`合并完成：新增 ${result.preview.addCount}，跳过 ${result.preview.skipCount}。`); }
                else setStorageError(result.error);
              }}
              onReplaceImport={(raw) => {
                const result = repository.replaceImport(raw, watchlistData);
                if (result.ok && result.data) { setWatchlistData(result.data); setStorageError(null); setCorruptedRaw(null); setWorkflowMessage(`替换完成，备份键：${result.backupKey ?? "已创建"}`); }
                else setStorageError(result.error);
              }}
              onReset={() => {
                const result = repository.reset();
                if (result.ok) { setWatchlistData(createEmptyWatchlistEnvelope()); setStorageError(null); setCorruptedRaw(null); setWorkflowMessage("本地观察清单已重置为空状态。"); }
                else setStorageError(result.error);
              }}
              onAdd={() => setWatchForm({})}
              onEdit={(item) => setWatchForm({ itemId: item.id })}
              onStartReview={startReview}
              onCorrectReview={(entry) => { setReviewItemId(entry.watchItemId); setCorrectionReviewId(entry.id); }}
              onArchive={(item) => { if (window.confirm(`确认归档 ${dataset.stocks.find((stock) => stock.id === item.stockId)?.name ?? item.stockId}？`)) applyAction(watchlistStore.archiveWatchItem(watchlistData, item.id), "观察项已归档。"); }}
              onRestore={restoreWatchItem}
              onLoadSample={(sample) => applyAction(watchlistStore.loadSample(watchlistData, sample), "示例已复制为用户观察项。")}
              onLoadAllSamples={() => {
                let next = watchlistData;
                let loaded = 0;
                let loadError: string | null = null;
                for (const sample of watchlistSamples) {
                  const result = watchlistStore.loadSample(next, sample);
                  if (result.ok) { next = result.data; loaded += 1; }
                  else if (!result.error?.includes("已经存在")) loadError = result.error;
                }
                setWatchlistData(next);
                if (loadError) setStorageError(loadError);
                setWorkflowMessage(`已载入 ${loaded} 个示例；重复公司已跳过。`);
              }}
              onTaskState={(taskId, status, snoozedUntil) => applyAction(watchlistStore.setTaskState(watchlistData, taskId, status, snoozedUntil), status === "snoozed" ? "任务已暂缓。" : status === "dismissed" ? "任务已忽略。" : "任务已确认。")}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "验证中心" && (
            <ResearchEventCenter
              snapshot={researchSnapshot}
              stocks={dataset.stocks}
              industries={dataset.industries}
              watchItems={watchlistData.watchItems}
              reviewTasks={reviewTasks}
              timeZone={expectationData.settings.timeZone}
              onStartReview={startReview}
              onOpenStock={setSelectedStock}
            />
          )}
          {activeTab === "预期证据" && (
            <EarningsExpectationCenter
              snapshots={aggregatedExpectationEvidence.snapshots}
              comparisons={expectationComparisons}
              researchEvents={expectationEvents}
              importHistory={expectationData.importHistory}
              stocks={dataset.stocks}
              industries={dataset.industries}
              watchItems={watchlistData.watchItems}
              storageError={expectationStorageError}
              providerLoadStatus={companyGuidanceWorkflowStatus}
              providerLoadError={companyGuidanceWorkflowError}
              providerDetailLoadStatus={companyGuidanceLoadStatus}
              providerDetailLoadError={companyGuidanceLoadError}
              providerFailedStockIds={companyGuidanceFailedStockIds}
              providerLoadedCompanyCount={Object.keys(companyGuidanceDetails).length}
              onRetryProvider={retryCompanyGuidance}
              providerSummary={companyGuidanceExpectationSummary}
              providerSnapshotIds={aggregatedExpectationEvidence.providerSnapshotIds}
              duplicateOfProviderByLocalId={aggregatedExpectationEvidence.duplicateOfProviderByLocalId}
              providerRelationByLocalId={aggregatedExpectationEvidence.relationByLocalId}
              providerRecordBySnapshotId={aggregatedExpectationEvidence.providerRecordBySnapshotId}
              providerExclusions={Object.values(companyGuidanceDetails).flatMap((detail) => detail.exclusions)}
              providerWarnings={Object.values(companyGuidanceDetails).flatMap((detail) => detail.warnings)}
              timeZone={expectationData.settings.timeZone}
              onAdd={() => setExpectationForm({})}
              onCorrect={(snapshot) => { if (!aggregatedExpectationEvidence.providerSnapshotIds.has(snapshot.id)) setExpectationForm({ stockId: snapshot.stockId, correctionId: snapshot.id }); }}
              onImport={() => setExpectationImportOpen(true)}
              onOpenStock={setSelectedStock}
            />
          )}
        </section>
        }
        rightRail={
          <RightRail
            mode={dataset.mode}
            modeLabel={dataset.modeLabel}
            coverageSummary={dataset.coverageSummary}
            highRisk={dashboardStats.highRisk}
            missingFields={dashboardStats.missingFields}
            focusStocks={dashboardStats.focusStocks}
            missingStocks={dashboardStats.missingStocks}
            onOpenStock={setSelectedStock}
          />
        }
      />

      <StockDetailDrawer
        stock={activeSelectedStock}
        stocks={dataset.stocks}
        industries={dataset.industries}
        watchItems={watchlistData.watchItems}
        reviewEntries={watchlistData.reviewEntries}
        reviewTasks={reviewTasks}
        researchEvents={researchSnapshot.events}
        earningsExpectationSnapshots={aggregatedExpectationEvidence.snapshots}
        earningsExpectationProviderSnapshotIds={aggregatedExpectationEvidence.providerSnapshotIds}
        earningsExpectationDuplicateOfProviderByLocalId={aggregatedExpectationEvidence.duplicateOfProviderByLocalId}
        earningsExpectationProviderRecordBySnapshotId={aggregatedExpectationEvidence.providerRecordBySnapshotId}
        companyGuidanceLoadStatus={companyGuidanceLoadStatus}
        companyGuidanceLoadError={companyGuidanceLoadError}
        earningsExpectationTimeZone={expectationData.settings.timeZone}
        onAddToWatchlist={(stock) => setWatchForm({ stockId: stock.id })}
        onEditWatchItem={(item) => setWatchForm({ itemId: item.id })}
        onStartReview={startReview}
        onCorrectReview={(entry) => { setReviewItemId(entry.watchItemId); setCorrectionReviewId(entry.id); }}
        onRestoreWatchItem={restoreWatchItem}
        onAddEarningsExpectation={(stock) => setExpectationForm({ stockId: stock.id })}
        onCorrectEarningsExpectation={(snapshot) => { if (!aggregatedExpectationEvidence.providerSnapshotIds.has(snapshot.id)) setExpectationForm({ stockId: snapshot.stockId, correctionId: snapshot.id }); }}
        onClose={() => setSelectedStock(null)}
        onOpenStock={setSelectedStock}
      />

      {watchForm ? <WatchItemFormModal
        stocks={dataset.stocks}
        item={watchForm.itemId ? watchlistData.watchItems.find((item) => item.id === watchForm.itemId) : null}
        initialStockId={watchForm.stockId}
        onClose={() => setWatchForm(null)}
        onCreate={createWatchItem}
        onUpdate={updateWatchItem}
      /> : null}

      {reviewItemId && watchlistData.watchItems.some((item) => item.id === reviewItemId) ? <ReviewFormModal
        watchItem={watchlistData.watchItems.find((item) => item.id === reviewItemId) as WatchItem}
        events={researchSnapshot.events}
        tasks={reviewTasks.filter((task) => task.watchItemId === reviewItemId)}
        correctionTarget={correctionReviewId ? watchlistData.reviewEntries.find((entry) => entry.id === correctionReviewId) : null}
        onClose={() => { setReviewItemId(null); setCorrectionReviewId(null); }}
        onSubmit={(input) => {
          if (applyAction(watchlistStore.completeReview(watchlistData, reviewItemId, input), "复盘已提交，当前判断与历史记录已原子保存。")) { setReviewItemId(null); setCorrectionReviewId(null); }
        }}
      /> : null}

      {expectationForm ? <EarningsExpectationFormModal
        stocks={dataset.stocks}
        initialStockId={expectationForm.stockId}
        correctionTarget={expectationForm.correctionId ? expectationData.snapshots.find((snapshot) => snapshot.id === expectationForm.correctionId) : null}
        timeZone={expectationData.settings.timeZone}
        onClose={() => setExpectationForm(null)}
        onSubmit={saveExpectation}
      /> : null}

      {expectationImportOpen ? <EarningsExpectationImportModal
        exportJson={expectationExportJson}
        exportCsv={expectationExportCsv}
        csvTemplate={earningsExpectationCsvTemplate()}
        corruptedRaw={expectationCorruptedRaw}
        onPreviewJson={(raw) => expectationRepository.previewJson(raw, expectationData, { timeZone: expectationData.settings.timeZone, validStocks: dataset.stocks.map((stock) => ({ id: stock.id, code: stock.code, market: stock.market })) })}
        onPreviewCsv={(raw, fileName) => expectationRepository.previewCsv(raw, expectationData, { timeZone: expectationData.settings.timeZone, fileName, validStocks: dataset.stocks.map((stock) => ({ id: stock.id, code: stock.code, market: stock.market })) })}
        onImport={(preview, method, mode, fileName, partialConfirmed) => {
          const result = expectationRepository.importPreview(preview, expectationData, method, mode, fileName, partialConfirmed);
          if (result.ok && result.data) {
            setExpectationData(result.data);
            setExpectationStorageError(null);
            setExpectationCorruptedRaw(null);
            setWorkflowMessage(`${mode === "replace" ? "替换" : "合并"}导入完成：新增 ${result.preview.addCount}，重复 ${result.preview.duplicateCount}。`);
            setExpectationImportOpen(false);
          } else setExpectationStorageError(result.error);
        }}
        onReset={() => {
          const result = expectationRepository.reset();
          if (result.ok) {
            setExpectationData(createEmptyEarningsExpectationEnvelope());
            setExpectationStorageError(null);
            setExpectationCorruptedRaw(null);
            setWorkflowMessage("本地业绩预期已重置为空状态。");
            setExpectationImportOpen(false);
          } else setExpectationStorageError(result.error);
        }}
        onClose={() => setExpectationImportOpen(false)}
      /> : null}
    </div>
  );
}

function shiftCalendarDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventCalendarDate(event: { eventDate: string | null; publishedAt: string | null; updatedAt: string | null }, timeZone: string) {
  if (event.eventDate) return event.eventDate;
  for (const value of [event.publishedAt, event.updatedAt]) {
    if (!value) continue;
    const calendarDate = getTemporalCalendarDate(value, isPreciseInstant(value) ? "datetime" : "date", timeZone);
    if (calendarDate) return calendarDate;
  }
  return "";
}
