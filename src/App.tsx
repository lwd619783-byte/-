import { useDisplayNow } from "./hooks/useDisplayNow";
import { pages, useWorkspaceNavigation, type MainPage, type PageId } from "./hooks/useWorkspaceNavigation";
import { StockQuickPreview } from "./components/stock/StockQuickPreview";
import { QuoteTrustSummary } from "./components/common/QuoteTrust";
import { summarizeQuotes } from "./utils/dataTrustDisplay";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckSquare, FileCheck2, Plus, RefreshCw } from "lucide-react";
import { Header } from "./components/layout/Header";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RightRail } from "./components/layout/RightRail";
import { WorkspaceNavigation, ResearchNavigation, WorkspaceSearch } from './components/layout/WorkspaceNavigation';
import { PortfolioBoundary, WorkspaceSettings } from './components/layout/WorkspaceSettings';
import { ResearchWorkbench, TaskWorkspace } from './components/home/ResearchWorkbench';
import { MacroTab } from "./components/dashboard/MacroTab";
import { IndustryTab } from "./components/industry/IndustryTab";
import { StockPool } from "./components/stock/StockPool";
import { StockDetailDrawer } from "./components/stock/StockDetailDrawer";
import { WatchlistTab } from "./components/watchlist/WatchlistTab";
const ThesisWorkspace = lazy(() => import('./components/research/ThesisWorkspace').then(module => ({ default: module.ThesisWorkspace })));
import { WatchItemFormModal } from "./components/watchlist/WatchItemFormModal";
import { ReviewFormModal } from "./components/watchlist/ReviewFormModal";
import { ResearchEventCenter } from "./components/research/ResearchEventCenter";
import { EarningsExpectationCenter } from "./components/expectation/EarningsExpectationCenter";
import { EarningsExpectationFormModal } from "./components/expectation/EarningsExpectationFormModal";
import { EarningsExpectationImportModal } from "./components/expectation/EarningsExpectationImportModal";
import { HomePage } from "./components/home/HomePage";
import { dataSourceNote, dataUpdatedAt, macroIndicators } from "./data/macroData";
import { watchlistSamples } from "./data/watchlist";
import { buildDashboardDataset } from "./services/dataProvider";
import { buildResearchEventSnapshot, deduplicateResearchEvents, sortResearchEvents } from "./services/researchEventProvider";
import { buildReviewTasks } from "./services/reviewTaskProvider";
import { createBrowserWatchlistRepository } from "./services/watchlistRepository";
import { WatchlistStore, type CreateWatchItemInput, type WatchItemMetadataInput, type WatchlistActionResult } from "./services/watchlistStore";
import { createBrowserEarningsExpectationRepository, earningsExpectationCsvTemplate, exportEarningsExpectationCsv } from "./services/earningsExpectationRepository";
import { EarningsExpectationStore, type CreateEarningsExpectationSnapshotInput, type EarningsExpectationActionResult } from "./services/earningsExpectationStore";
import { buildEarningsExpectationComparisons } from "./services/earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./services/earningsExpectationEventProvider";
import { aggregateEarningsExpectationEvidence, buildProviderContentConflictEvents, companyGuidanceExpectationSummary, createCompanyGuidanceExpectationLoader, selectActiveCompanyGuidanceProviderRecords, selectDefaultCompanyGuidanceStockIds } from "./services/companyGuidanceExpectationProvider";
import { getCalendarToday, getTemporalCalendarDate, isPreciseInstant } from "./utils/dateTime";
import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationLoadStatus, CompanyGuidanceExpectationWorkflowIndex, DashboardDataMode, EarningsExpectationSnapshot, Stock, WatchItem } from "./types";
import { DashboardCard, KpiCard, SectionHeader } from "./components/common/terminal";
import { formatPercent } from "./utils/normalize";
import { loadIndustryMetrics, type IndustryProviderState } from './services/industryMetricProvider';
import { buildIndustryChanges } from './services/industrySignals';
import { ResearchMemoryWorkspace, type KnowledgeReviewState } from './components/research-memory/ResearchMemoryWorkspace';
import { CreatorViewpointWorkspace } from './components/creator/CreatorViewpointWorkspace';

type MainTab = MainPage;

export default function App() {
  const displayNow = useDisplayNow();
  const navigation = useWorkspaceNavigation();
  const activeTab = pages[navigation.route.page];
  const navigatePageId = (page: PageId) => navigation.navigatePage(pages[page]);
  const taskQueue = navigation.route.view === 'review' ? 'knowledge' : navigation.route.view === 'verify' ? 'verification' : 'review';
  const memoryActive = ['memory', 'knowledge', 'sources'].includes(navigation.route.page) || (navigation.route.page === 'tasks' && taskQueue === 'knowledge');
  const memoryView = navigation.route.view === 'bridge' ? '研究桥' : navigation.route.view === 'organize' ? 'AI 整理' : navigation.route.view === 'review' ? '待审核' : navigation.route.view === 'wiki' || navigation.route.page === 'knowledge' ? '我的知识库' : navigation.route.page === 'tasks' ? '待审核' : '原始资料';
  const [knowledgeReviewState, setKnowledgeReviewState] = useState<KnowledgeReviewState>({ status: 'loading' });
  const industryLocation = useRef<{ industryId?: string; segmentId?: string }>({});
  if (navigation.route.kind === "page" && navigation.route.page === "industry") industryLocation.current = navigation.route;
  const eventLocation = useRef<{ eventId?: string }>({});
  if (navigation.route.kind === "page" && navigation.route.page === "verification") eventLocation.current = navigation.route;
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set([activeTab]));
  useEffect(() => { setVisitedTabs(previous => previous.has(activeTab) ? previous : new Set([...previous, activeTab])); }, [activeTab]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [previewStock, setSelectedStock] = useState<Stock | null>(null);
  const [dataMode, setDataMode] = useState<DashboardDataMode>("mixed");
  const [industryMetricState, setIndustryMetricState] = useState<IndustryProviderState | null>(null);
  useEffect(() => { let active = true; if (dataMode !== 'mock') void loadIndustryMetrics().then(state => { if (active) setIndustryMetricState(state); }); return () => { active = false; }; }, [dataMode]);
  const repository = useMemo(() => createBrowserWatchlistRepository(), []);
  const watchlistStore = useMemo(() => new WatchlistStore(repository), [repository]);
  const initialWatchlistLoad = useMemo(() => repository.load(), [repository]);
  const [watchlistData, setWatchlistData] = useState(initialWatchlistLoad.data);
  const [storageError, setStorageError] = useState<string | null>(initialWatchlistLoad.error);
  const [watchActionError, setWatchActionError] = useState<string | null>(null);
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
  const [expectationActionError, setExpectationActionError] = useState<string | null>(null);
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
  const thesisDataset = useMemo(() => ({ industries: dataset.industries, stocks: dataset.stocks, macroIndicators }), [dataset]);
  const industryEvents = useMemo(() => dataMode !== 'mock' && industryMetricState?.status === 'available'
    ? dataset.industries.flatMap(industry => buildIndustryChanges(industryMetricState.provider, industry.id).events) : [], [dataMode, dataset.industries, industryMetricState]);
  const providerRecords = useMemo(() => selectActiveCompanyGuidanceProviderRecords(dataMode, companyGuidanceWorkflowStatus, companyGuidanceWorkflow), [companyGuidanceWorkflow, companyGuidanceWorkflowStatus, dataMode]);
  const readableLocalExpectations = useMemo(() => expectationStorageError ? [] : expectationData.snapshots, [expectationStorageError, expectationData.snapshots]);
  const readableWatchItems = useMemo(() => storageError ? [] : watchlistData.watchItems, [storageError, watchlistData.watchItems]);
  const aggregatedExpectationEvidence = useMemo(() => aggregateEarningsExpectationEvidence({ providerSnapshots: providerRecords, localSnapshots: readableLocalExpectations }), [readableLocalExpectations, providerRecords]);
  const baseResearchSnapshot = useMemo(() => buildResearchEventSnapshot(dataset.stocks), [dataset.stocks]);
  const expectationComparisons = useMemo(() => buildEarningsExpectationComparisons(aggregatedExpectationEvidence.comparisonSnapshots, baseResearchSnapshot.events, expectationData.settings), [aggregatedExpectationEvidence.comparisonSnapshots, baseResearchSnapshot.events, expectationData.settings]);
  const expectationEvents = useMemo(() => buildEarningsExpectationResearchEvents(aggregatedExpectationEvidence.comparisonSnapshots, expectationComparisons, dataset.stocks, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone), [aggregatedExpectationEvidence.comparisonSnapshots, dataset.stocks, expectationComparisons, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone]);
  const providerConflictEvents = useMemo(() => buildProviderContentConflictEvents(aggregatedExpectationEvidence, readableLocalExpectations, dataset.stocks), [aggregatedExpectationEvidence, dataset.stocks, readableLocalExpectations]);
  const researchSnapshot = useMemo(() => ({ ...baseResearchSnapshot, events: sortResearchEvents(deduplicateResearchEvents([...baseResearchSnapshot.events, ...expectationEvents, ...providerConflictEvents]), expectationData.settings.timeZone) }), [baseResearchSnapshot, expectationData.settings.timeZone, expectationEvents, providerConflictEvents]);
  const reviewTasks = useMemo(() => buildReviewTasks({
    now: displayNow,
    watchItems: readableWatchItems,
    events: researchSnapshot.events,
    chains: researchSnapshot.chains,
    taskStates: watchlistData.reviewTaskStates,
    longUnreviewedDays: watchlistData.settings.longUnreviewedDays,
    expectationRevisionThreshold: expectationData.settings.revisionReminderThreshold,
    timeZone: expectationData.settings.timeZone,
  }), [displayNow, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone, researchSnapshot, watchlistData, readableWatchItems]);
  const exportJson = useMemo(() => repository.export(watchlistData), [repository, watchlistData]);
  const expectationExportJson = useMemo(() => expectationRepository.export(expectationData), [expectationData, expectationRepository]);
  const expectationExportCsv = useMemo(() => exportEarningsExpectationCsv(expectationData.snapshots), [expectationData.snapshots]);
  const activeSelectedStock = navigation.route.kind === "company" ? dataset.stocks.find((stock) => stock.id === navigation.route.stockId) ?? null : null;
  useEffect(() => { setSelectedStock(null); }, [navigation.route]);
  const activePreviewStock = previewStock ? dataset.stocks.find(stock => stock.id === previewStock.id) ?? null : null;
  const openResearch = (stock: Stock) => { setSelectedStock(null); navigation.openCompany(stock.id); };

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

  const navigateToTab = navigation.navigatePage;
  const setActiveTab = navigateToTab;

  const dashboardStats = useMemo(() => {
    const stocksWithReal = dataset.stocks.filter((stock) =>
      stock.dataQuality?.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale"),
    ).length;
    const missingFields = dataset.stocks.reduce((sum, stock) => sum + (stock.missingFields?.length ?? 0), 0);
    const pctValues = dataset.stocks
      .map((stock) => stock.quote?.pctChange)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const averagePct = pctValues.length ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length : null;
    const highRisk = dataset.stocks.filter((stock) => stock.riskLevel === "高").length;
    const segments = dataset.industries.reduce((sum, industry) => sum + industry.segments.length, 0);
    const focusStocks = [...dataset.stocks]
      .sort((a, b) => Math.abs(b.quote?.pctChange ?? 0) - Math.abs(a.quote?.pctChange ?? 0))
      .slice(0, 4);
    const missingStocks = dataset.stocks.filter((stock) => (stock.missingFields?.length ?? 0) > 0).slice(0, 6);
    const aShareQuotes = summarizeQuotes(dataset.stocks.filter((stock) => stock.market === "A股").map((stock) => stock.quote));
    const quoteStatusRealCovered = aShareQuotes.statusRealCovered;
    const quoteCoverageTotal = aShareQuotes.total;
    const hkQuotes = summarizeQuotes(dataset.stocks.filter((stock) => stock.market === "港股").map((stock) => stock.quote));
    const hkCoverageSummary = `港股行情质量状态 real 且有价格 ${hkQuotes.statusRealCovered}/${hkQuotes.total}`;
    const cutoff = shiftCalendarDate(getCalendarToday(displayNow, expectationData.settings.timeZone), -6);
    const recentEvents = researchSnapshot.events.filter((event) => event.eventType !== "data_warning" && eventCalendarDate(event, expectationData.settings.timeZone) >= cutoff).length;
    const pendingReviewCompanies = new Set(researchSnapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
    const verificationChains = researchSnapshot.chains.length;
    const dataReviewItems = researchSnapshot.events.filter((event) => event.eventType === "data_warning" || event.reviewStatus === "pending").length;
    const today = getCalendarToday(displayNow, expectationData.settings.timeZone);
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
      pctSampleCount: pctValues.length,
      highRisk,
      segments,
      focusStocks,
      missingStocks,
      quoteStatusRealCovered,
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
  }, [displayNow, aggregatedExpectationEvidence.snapshots, dataset, expectationComparisons, expectationData.settings.revisionReminderThreshold, expectationData.settings.timeZone, expectationEvents, researchSnapshot, reviewTasks, watchlistData.watchItems]);

  // Mutation results do not classify owner health. Re-read through the existing
  // repository and verify its captured base without replacing the UI snapshot.
  // Quota/write rejection can leave reads healthy; corruption, access denial and
  // changed/missing bases remain locked. No error-message keyword classification.
  const reportWatchFailure = (error: string | null, base = watchlistData) => {
    const loaded = repository.load();
    setStorageError(loaded.error ?? repository.currentBaseError(base));
    setCorruptedRaw(loaded.corruptedRaw);
    setWatchActionError(error);
    setWorkflowMessage(null);
  };
  const reportExpectationFailure = (error: string | null) => {
    const loaded = expectationRepository.load();
    setExpectationStorageError(loaded.error ?? expectationRepository.currentBaseError(expectationData));
    setExpectationCorruptedRaw(loaded.corruptedRaw);
    setExpectationActionError(error);
    setWorkflowMessage(null);
  };

  const applyAction = (result: WatchlistActionResult, successMessage: string) => {
    if (result.ok) {
      setWatchlistData(result.data);
      setStorageError(null); setWatchActionError(null);
      setWorkflowMessage(successMessage);
    } else {
      reportWatchFailure(result.error);
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
      setExpectationStorageError(null); setExpectationActionError(null);
      setWorkflowMessage(message);
      setExpectationForm(null);
    } else {
      reportExpectationFailure(result.error);
      setWorkflowMessage(null);
    }
  };
  const saveExpectation = (input: CreateEarningsExpectationSnapshotInput, correctsSnapshotId?: string) => {
    const result = correctsSnapshotId
      ? expectationStore.appendCorrection(expectationData, correctsSnapshotId, input)
      : expectationStore.appendSnapshot(expectationData, input);
    applyExpectationAction(result, correctsSnapshotId ? "纠正快照已追加，原快照保持不变。" : "业绩预期不可变快照已保存。");
  };

  const observationState = storageError ? 'locked' as const : 'ready' as const;
  const researchDataState = storageError || expectationStorageError ? 'partial' as const : 'ready' as const;
  const researchDataMessage = [storageError ? `观察与复盘记录已锁定：${storageError}` : null, expectationStorageError ? `本地业绩预期已锁定：${expectationStorageError}` : null].filter(Boolean).join('；') || undefined;
  const researchSourceNotice = [dataMode !== 'mock' && industryMetricState?.status !== 'available' ? `正式行业指标：${industryMetricState?.status === 'blocked' ? industryMetricState.reason : '校验中'}；行业变化范围尚不完整。` : null, researchDataMessage ? `当前范围不完整；仅显示可读取来源。${researchDataMessage}` : null, companyGuidanceWorkflowStatus !== 'success' && dataMode !== 'mock' ? `公司指引索引：${companyGuidanceWorkflowStatus}。${companyGuidanceWorkflowError ?? '载入完成前，预期事件范围尚不完整。'}` : null].filter(Boolean).join('；');

  return (
    <div className="workspace min-h-screen text-text">
      <a className="skip-link" href="#workspace-main" onClick={event => { event.preventDefault(); document.getElementById("workspace-main")?.focus(); }}>跳到主要内容</a>
      <Header
        onHome={() => navigateToTab("首页")}
        search={globalSearch}
        onSearchChange={setGlobalSearch}
        onStartResearch={activeTab === '首页' ? undefined : () => navigatePageId('stocks')}
        workspaceSearch={<WorkspaceSearch navigate={navigatePageId} onCompanySearch={query => { setGlobalSearch(query); navigatePageId('stocks'); }} />}
        updatedAt={dataset.dataUpdatedAt}
        sourceNote={dataMode === "mock" ? dataSourceNote : dataset.dataSourceNote}
        dataMode={dataMode}
        modeLabel={dataset.modeLabel}
        coverageSummary={dataset.coverageSummary}
        onDataModeChange={setDataMode}
      />

      <DashboardLayout
        sidebar={<WorkspaceNavigation page={navigation.route.page} navigate={navigatePageId} />}
        main={
          <section className="min-w-0 space-y-4">
          <ResearchNavigation page={navigation.route.page} navigate={navigatePageId} />
          {companyGuidanceWorkflowError && <DashboardCard className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" aria-label="全局公司指引数据状态">
            <div className="min-w-0 text-xs"><span className="font-semibold text-textStrong">公司指引数据</span><span className="ml-2 text-textMuted">{dataMode === "mock" ? "模拟数据模式已严格隔离真实数据提供方" : companyGuidanceWorkflowStatus === "loading" ? "全局索引校验中" : companyGuidanceWorkflowStatus === "success" ? `已验证 ${providerRecords.length} 条当前版本，导航切换不改变工作流` : companyGuidanceWorkflowStatus === "error" ? "全局索引失败，正式数据提供方已关闭" : "等待加载"}</span></div>
            {companyGuidanceWorkflowError ? <div className="flex min-w-0 items-center gap-2"><span role="alert" className="max-w-xl break-words text-xs text-warning" title={companyGuidanceWorkflowError}>{companyGuidanceWorkflowError}</span><button type="button" onClick={retryCompanyGuidance} className="rounded border border-warning/50 px-2 py-1 text-xs text-warning">重试</button></div> : null}
          </DashboardCard>}
          {navigation.route.kind === "invalid" || (navigation.route.kind === "company" && !activeSelectedStock) ? <section className="ui-panel rounded-lg border border-warning p-6" role="status"><h1 className="text-2xl font-semibold">找不到研究对象或页面</h1><p className="my-4 text-textMuted">链接中的对象不存在于当前研究池，请返回入口重新选择。</p><button type="button" onClick={() => navigateToTab("个股池")} className="rounded-md border border-control px-4 py-2">返回个股池</button></section> : null}
                <StockDetailDrawer
        presentation="page"
        activeTab={navigation.route.tab}
        onTabChange={navigation.changeCompanyTab}
        stock={activeSelectedStock}
        stocks={dataset.stocks}
        industries={dataset.industries}
        watchlistReadError={storageError}
        earningsExpectationReadError={expectationStorageError}
        watchItems={readableWatchItems}
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
        onClose={navigation.back}
        onOpenStock={openResearch}
      />
          <div hidden={navigation.route.kind !== "page"} className="space-y-4">


          {activeTab === '首页' && <ResearchWorkbench stocks={dataset.stocks} watchItems={readableWatchItems} tasks={reviewTasks} events={researchSnapshot.events} expectationSnapshots={aggregatedExpectationEvidence.snapshots} industryEvents={industryEvents} now={displayNow} timeZone={expectationData.settings.timeZone} inboxSourceNotice={researchSourceNotice} dataState={researchDataState} dataMessage={researchDataMessage} observationState={observationState} observationMessage={storageError ?? undefined} onNavigate={navigateToTab} onOpenStock={openResearch} onStartReview={startReview} onOpenEvent={event => navigation.openEvent(event.id)} onOpenKnowledge={() => navigatePageId('knowledge')} onOpenTasks={() => navigatePageId('tasks')} onOpenSources={() => navigation.navigateHash('#/sources?view=add')} onOpenResearch={() => navigatePageId('research')} onResearchQuery={query => { setGlobalSearch(query); navigatePageId('stocks'); }} />}
          {activeTab === '任务' && <TaskWorkspace stocks={dataset.stocks} watchItems={readableWatchItems} tasks={reviewTasks} events={researchSnapshot.events} expectationSnapshots={aggregatedExpectationEvidence.snapshots} industryEvents={industryEvents} now={displayNow} timeZone={expectationData.settings.timeZone} inboxSourceNotice={researchSourceNotice} dataState={researchDataState} dataMessage={researchDataMessage} observationState={observationState} observationMessage={storageError ?? undefined} onOpenStock={openResearch} onStartReview={startReview} onOpenEvent={event => navigation.openEvent(event.id)} activeQueue={taskQueue} onQueueChange={queue => navigation.navigateHash(queue === 'knowledge' ? '#/tasks?view=review' : queue === 'verification' ? '#/tasks?view=verify' : '#/tasks?view=replay')} knowledgeState={knowledgeReviewState} onOpenReview={() => navigation.navigateHash('#/tasks?view=review')} />}
          {activeTab === '组合' && <PortfolioBoundary />}
          {activeTab === '设置与帮助' && <WorkspaceSettings openKnowledge={() => navigation.navigateHash('#/knowledge?view=maintenance')} openSources={() => navigatePageId('sources')} />}
          {visitedTabs.has("研究") && (<div hidden={activeTab !== "研究"}>
        <HomePage
          industryEvents={industryEvents}
          now={displayNow}
          expectationSnapshots={aggregatedExpectationEvidence.snapshots}
          timeZone={expectationData.settings.timeZone}
          inboxSourceNotice={researchSourceNotice} dataState={researchDataState} dataMessage={researchDataMessage} observationState={observationState} observationMessage={storageError ?? undefined}
          watchItems={readableWatchItems}
          tasks={reviewTasks}
          events={researchSnapshot.events}
          onStartReview={startReview}
          onOpenEvent={event => navigation.openEvent(event.id)}
          dataMode={dataMode}
          modeLabel={dataset.modeLabel}
          updatedAt={dataset.dataUpdatedAt}
          sourceNote={dataMode === "mock" ? dataSourceNote : dataset.dataSourceNote}
          coverageSummary={dataset.coverageSummary}
          industriesCount={dataset.industries.length}
          stocksCount={dataset.stocks.length}
          activeWatchCount={watchlistData.watchItems.filter((item) => !item.archivedAt).length}
          expectationCount={aggregatedExpectationEvidence.snapshots.length}
          macroCount={macroIndicators.reduce((sum, indicator) => sum + indicator.metrics.length, 0)}
          stats={dashboardStats}
          focusStocks={dashboardStats.focusStocks}
          quoteStocks={dataset.stocks}
          onDataModeChange={setDataMode}
          onNavigate={navigateToTab}
          onOpenStock={openResearch}
        />
          </div>)}


          {workflowMessage ? <div role="status" className="rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">{workflowMessage}</div> : null}

          {['研究记忆', '知识库', '资料与连接', '任务'].some(tab => visitedTabs.has(tab as MainTab)) && <div id="task-panel-knowledge" role={navigation.route.page === "tasks" ? "tabpanel" : undefined} aria-labelledby={navigation.route.page === "tasks" ? "task-tab-knowledge" : undefined} hidden={!memoryActive}><ResearchMemoryWorkspace active={memoryActive} requestedView={memoryView} routeKey={`${navigation.route.page}:${navigation.route.view ?? ''}`} selectedWikiId={navigation.route.wikiId} onReviewStateChange={setKnowledgeReviewState} maintenanceOpen={navigation.route.view === 'maintenance'} requestedAddMaterial={navigation.route.page === 'sources' && navigation.route.view === 'add'} onBackToLibrary={() => navigation.navigateHash('#/knowledge')} onAddMaterial={() => navigation.navigateHash('#/sources?view=add')} onSelectWiki={wikiId => navigation.navigateHash(`#/knowledge?wiki=${encodeURIComponent(wikiId)}`)} onViewChange={view => navigation.navigateHash(view === '我的知识库' ? '#/knowledge' : view === '待审核' ? '#/tasks?view=review' : view === 'AI 整理' ? '#/sources?view=organize' : view === '研究桥' ? '#/sources?view=bridge' : '#/sources')} /></div>}
          {visitedTabs.has("观点追踪") && <div hidden={activeTab !== "观点追踪"}><CreatorViewpointWorkspace /></div>}
          {visitedTabs.has("宏观") && <div hidden={activeTab !== "宏观"}><MacroTab indicators={macroIndicators} generatedAt={dataUpdatedAt} /></div>}
          {visitedTabs.has("行业") && (<div hidden={activeTab !== "行业"}>
            <IndustryTab
              initialIndustryId={industryLocation.current.industryId}
              initialSegmentId={industryLocation.current.segmentId}
              onSelectionChange={navigation.selectIndustry}
              industries={dataset.industries}
              stocks={dataset.stocks}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          </div>)}
          {visitedTabs.has("个股池") && (<div hidden={activeTab !== "个股池"}>
            <StockPool
              onOpenResearch={openResearch}
              stocks={dataset.stocks}
              industries={dataset.industries}
              globalSearch={globalSearch}
              onOpenStock={setSelectedStock}
            />
          </div>)}
          {visitedTabs.has("观察清单") && (<div hidden={activeTab !== "观察清单"}>
            <Suspense fallback={<p className="text-sm text-textMuted">正在载入研究论点…</p>}><ThesisWorkspace dataset={thesisDataset} /></Suspense>
            <WatchlistTab
              watchItems={readableWatchItems}
              samples={watchlistSamples}
              reviewEntries={watchlistData.reviewEntries}
              tasks={reviewTasks}
              stocks={dataset.stocks}
              industries={dataset.industries}
              events={researchSnapshot.events}
              storageError={storageError}
              operationError={watchForm || reviewItemId ? null : watchActionError}
              corruptedRaw={corruptedRaw}
              exportJson={exportJson}
              onValidateImport={(raw) => repository.validateImport(raw, watchlistData)}
              onMergeImport={(raw) => {
                const result = repository.mergeImport(raw, watchlistData);
                if (result.ok && result.data) { setWatchlistData(result.data); setStorageError(null); setWatchActionError(null); setWorkflowMessage(`合并完成：新增 ${result.preview.addCount}，跳过 ${result.preview.skipCount}。`); }
                else reportWatchFailure(result.error);
                return result.ok;
              }}
              onReplaceImport={(raw) => {
                const result = repository.replaceImport(raw, watchlistData);
                if (result.ok && result.data) { setWatchlistData(result.data); setStorageError(null); setWatchActionError(null); setCorruptedRaw(null); setWorkflowMessage(`替换完成，备份键：${result.backupKey ?? "已创建"}`); }
                else reportWatchFailure(result.error);
                return result.ok;
              }}
              onReset={() => {
                const result = repository.reset();
                if (result.ok) { const loaded = repository.load(); setWatchlistData(loaded.data); setStorageError(loaded.error); setWatchActionError(null); setCorruptedRaw(loaded.corruptedRaw); setWorkflowMessage("本地观察清单已重置为空状态。"); }
                else reportWatchFailure(result.error);
                return result.ok;
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
                  if (next.watchItems.some(item => item.stockId === sample.stockId && !item.archivedAt)) continue;
                  const result = watchlistStore.loadSample(next, sample);
                  if (result.ok) { next = result.data; loaded += 1; }
                  else { loadError = result.error; break; }
                }
                setWatchlistData(next);
                if (loadError) reportWatchFailure(loadError, next);
                else { setWatchActionError(null); setWorkflowMessage(`已载入 ${loaded} 个示例；重复公司已跳过。`); }
              }}
              onTaskState={(taskId, status, snoozedUntil) => applyAction(watchlistStore.setTaskState(watchlistData, taskId, status, snoozedUntil), status === "snoozed" ? "任务已暂缓。" : status === "dismissed" ? "任务已忽略。" : "任务已确认。")}
              onOpenStock={setSelectedStock}
            />
          </div>)}
          {visitedTabs.has("验证中心") && (<div hidden={activeTab !== "验证中心"}>
            <ResearchEventCenter
              initialEventId={eventLocation.current.eventId}
              onSelectEvent={navigation.selectEvent}
              snapshot={researchSnapshot}
              stocks={dataset.stocks}
              industries={dataset.industries}
              watchItems={readableWatchItems}
              reviewTasks={reviewTasks}
              timeZone={expectationData.settings.timeZone}
              onStartReview={startReview}
              onOpenStock={setSelectedStock}
            />
          </div>)}
          {visitedTabs.has("预期证据") && (<div hidden={activeTab !== "预期证据"}>
            <EarningsExpectationCenter
              snapshots={aggregatedExpectationEvidence.snapshots}
              comparisons={expectationComparisons}
              researchEvents={expectationEvents}
              importHistory={expectationData.importHistory}
              stocks={dataset.stocks}
              industries={dataset.industries}
              watchItems={readableWatchItems}
              storageError={expectationStorageError}
              operationError={expectationForm || expectationImportOpen ? null : expectationActionError}
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
          </div>)}
          <details hidden={!["研究", "设置与帮助"].includes(activeTab)} className="workspace-context"><summary>工作台概况与数据健康</summary>
          {researchDataMessage ? <p role="alert" className="text-sm text-warning">范围不完整：{researchDataMessage}</p> : null}
          <DashboardCard className="overflow-hidden p-5">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
              <div className="min-w-0">
                <SectionHeader
                  eyebrow="研究指挥台"
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
                  <p className="mt-1 text-xl font-semibold text-textStrong tabular-nums">{storageError ? "已锁定" : watchlistData.watchItems.filter((item) => !item.archivedAt).length}</p>
                </div>
              </div>
            </div>
          </DashboardCard>

          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              label="今日待复盘"
              value={storageError ? "已锁定" : expectationStorageError ? `当前可读 ${dashboardStats.todayReview}` : dashboardStats.todayReview}
              delta="用户观察项"
              description="复盘日期已到或任务今日到期"
              tone="info"
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <KpiCard
              label="已逾期复盘"
              value={storageError ? "已锁定" : expectationStorageError ? `当前可读 ${dashboardStats.overdueReview}` : dashboardStats.overdueReview}
              delta="只读提醒"
              description="不会自动改变观察状态"
              tone={dashboardStats.overdueReview ? "warning" : "positive"}
              icon={<CheckSquare className="h-4 w-4" />}
            />
            <KpiCard
              label="新事件提醒"
              value={storageError ? "已锁定" : expectationStorageError ? `当前可读 ${dashboardStats.newEventReminder}` : dashboardStats.newEventReminder}
              delta="研究事件"
              description="上次复盘后新增真实事件"
              tone="info"
              icon={<FileCheck2 className="h-4 w-4" />}
            />
            <KpiCard
              label="高优先级观察"
              value={storageError ? "已锁定" : dashboardStats.highPriorityWatch}
              delta="用户数据"
              description="示例模板不计入"
              tone={dashboardStats.highPriorityWatch ? "warning" : "positive"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </section>

          <DashboardCard className="p-3">
            <div className="grid gap-2 text-xs text-textMuted sm:grid-cols-2 xl:grid-cols-6" aria-label="业绩预期行动指标">
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">新增业绩预期：<strong className="text-textStrong">{expectationStorageError ? `当前可读 ${dashboardStats.recentExpectationSnapshots}` : dashboardStats.recentExpectationSnapshots}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">数据更正：<strong className="text-cyan">{expectationStorageError ? `当前可读 ${dashboardStats.expectationCorrections}` : dashboardStats.expectationCorrections}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">最新预期上修：<strong className="text-success">{expectationStorageError ? `当前可读 ${dashboardStats.expectationRevisionUp}` : dashboardStats.expectationRevisionUp}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">最新预期下修：<strong className="text-warning">{expectationStorageError ? `当前可读 ${dashboardStats.expectationRevisionDown}` : dashboardStats.expectationRevisionDown}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">新增可复盘实际结果：<strong className="text-textStrong">{expectationStorageError ? `当前可读 ${dashboardStats.reviewableExpectationActuals}` : dashboardStats.reviewableExpectationActuals}</strong></button>
              <button type="button" onClick={() => setActiveTab("预期证据")} className="rounded border border-borderSoft bg-bg2/60 px-3 py-2 text-left hover:border-cyan">来源待核验：<strong className="text-warning">{expectationStorageError ? `当前可读 ${dashboardStats.pendingExpectationSources}` : dashboardStats.pendingExpectationSources}</strong></button>
            </div>
          </DashboardCard>

          <DashboardCard className="p-3">
            <div className="grid gap-2 text-xs text-textMuted sm:grid-cols-2 xl:grid-cols-4" aria-label="数据健康信息">
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">A股行情质量状态 real 且有价格：<strong className="text-textStrong">{dashboardStats.quoteStatusRealCovered}/{dashboardStats.quoteCoverageTotal}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">已载入快照平均涨跌幅：<strong className="text-textStrong">{typeof dashboardStats.averagePct === "number" && dashboardStats.averagePct > 0 ? "+" : ""}{formatPercent(dashboardStats.averagePct)}</strong>（有值 {dashboardStats.pctSampleCount}/{dataset.stocks.length}）</span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">缺失字段：<strong className="text-warning">{dashboardStats.missingFields}</strong></span>
              <span className="rounded border border-borderSoft bg-bg2/60 px-3 py-2">{dashboardStats.hkCoverageSummary}</span>
            </div>
          </DashboardCard>

          <QuoteTrustSummary stocks={dataset.stocks} />
          <RightRail
            mode={dataset.mode}
            coverageSummary={dataset.coverageSummary}
            highRisk={dashboardStats.highRisk}
            missingFields={dashboardStats.missingFields}
            focusStocks={dashboardStats.focusStocks}
            missingStocks={dashboardStats.missingStocks}
            onOpenStock={setSelectedStock}
          />
          </details>
          </div>
        </section>
        }

      />



      {activePreviewStock ? <StockQuickPreview stock={activePreviewStock} onClose={() => setSelectedStock(null)} onOpenResearch={openResearch} /> : null}

      {watchForm ? <WatchItemFormModal
        error={storageError ?? watchActionError}
        stocks={dataset.stocks}
        item={watchForm.itemId ? watchlistData.watchItems.find((item) => item.id === watchForm.itemId) : null}
        initialStockId={watchForm.stockId}
        onClose={() => setWatchForm(null)}
        onCreate={createWatchItem}
        onUpdate={updateWatchItem}
      /> : null}

      {reviewItemId && watchlistData.watchItems.some((item) => item.id === reviewItemId) ? <ReviewFormModal
        error={storageError ?? watchActionError}
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
        error={expectationStorageError ?? expectationActionError}
        stocks={dataset.stocks}
        initialStockId={expectationForm.stockId}
        correctionTarget={expectationForm.correctionId ? expectationData.snapshots.find((snapshot) => snapshot.id === expectationForm.correctionId) : null}
        timeZone={expectationData.settings.timeZone}
        onClose={() => setExpectationForm(null)}
        onSubmit={saveExpectation}
      /> : null}

      {expectationImportOpen ? <EarningsExpectationImportModal
        error={expectationStorageError ?? expectationActionError}
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
            setExpectationStorageError(null); setExpectationActionError(null);
            setExpectationCorruptedRaw(null);
            setWorkflowMessage(`${mode === "replace" ? "替换" : "合并"}导入完成：新增 ${result.preview.addCount}，重复 ${result.preview.duplicateCount}。`);
            setExpectationImportOpen(false);
          } else reportExpectationFailure(result.error);
        }}
        onReset={() => {
          const result = expectationRepository.reset();
          if (result.ok) {
            const loaded = expectationRepository.load();
            setExpectationData(loaded.data);
            setExpectationStorageError(loaded.error); setExpectationActionError(null);
            setExpectationCorruptedRaw(loaded.corruptedRaw);
            setWorkflowMessage("本地业绩预期已重置为空状态。");
            setExpectationImportOpen(false);
          } else reportExpectationFailure(result.error);
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
