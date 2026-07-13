import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Binoculars, Building2, CheckSquare, FileCheck2, FlaskConical, LineChart, RefreshCw, type LucideIcon } from "lucide-react";
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
import { dataSourceNote, macroIndicators } from "./data/macroData";
import { watchlistSamples } from "./data/watchlist";
import { buildDashboardDataset } from "./services/dataProvider";
import { buildResearchEventSnapshot } from "./services/researchEventProvider";
import { buildReviewTasks } from "./services/reviewTaskProvider";
import { createBrowserWatchlistRepository, createEmptyWatchlistEnvelope } from "./services/watchlistRepository";
import { WatchlistStore, type CreateWatchItemInput, type WatchItemMetadataInput, type WatchlistActionResult } from "./services/watchlistStore";
import type { DashboardDataMode, Stock, WatchItem } from "./types";
import { DashboardCard, KpiCard, SectionHeader } from "./components/common/terminal";
import { formatPercent } from "./utils/normalize";

type MainTab = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心";

const tabs: Array<{ id: MainTab; icon: LucideIcon }> = [
  { id: "宏观", icon: LineChart },
  { id: "行业", icon: Building2 },
  { id: "个股池", icon: BarChart3 },
  { id: "观察清单", icon: Binoculars },
  { id: "验证中心", icon: FlaskConical },
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
  const dataset = useMemo(() => buildDashboardDataset(dataMode), [dataMode]);
  const researchSnapshot = useMemo(() => buildResearchEventSnapshot(dataset.stocks), [dataset.stocks]);
  const reviewTasks = useMemo(() => buildReviewTasks({
    watchItems: watchlistData.watchItems,
    events: researchSnapshot.events,
    chains: researchSnapshot.chains,
    taskStates: watchlistData.reviewTaskStates,
    longUnreviewedDays: watchlistData.settings.longUnreviewedDays,
  }), [researchSnapshot, watchlistData]);
  const exportJson = useMemo(() => repository.export(watchlistData), [repository, watchlistData]);
  const activeSelectedStock = selectedStock ? dataset.stocks.find((stock) => stock.id === selectedStock.id) ?? null : null;

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
    const sevenDayCutoff = new Date();
    sevenDayCutoff.setDate(sevenDayCutoff.getDate() - 6);
    const cutoff = `${sevenDayCutoff.getFullYear()}-${String(sevenDayCutoff.getMonth() + 1).padStart(2, "0")}-${String(sevenDayCutoff.getDate()).padStart(2, "0")}`;
    const recentEvents = researchSnapshot.events.filter((event) => event.eventType !== "data_warning" && (event.eventDate ?? event.publishedAt?.slice(0, 10) ?? event.updatedAt?.slice(0, 10) ?? "") >= cutoff).length;
    const pendingReviewCompanies = new Set(researchSnapshot.events.filter((event) => event.reviewStatus === "pending").map((event) => event.stockId)).size;
    const verificationChains = researchSnapshot.chains.length;
    const dataReviewItems = researchSnapshot.events.filter((event) => event.eventType === "data_warning" || event.reviewStatus === "pending").length;
    const today = localDate(new Date());
    const pendingTasks = reviewTasks.filter((task) => task.status === "pending");
    const todayReview = new Set(pendingTasks.filter((task) => task.ruleType === "due_review" || task.dueAt === today).map((task) => task.watchItemId)).size;
    const overdueReview = new Set(pendingTasks.filter((task) => task.ruleType === "overdue_review").map((task) => task.watchItemId)).size;
    const newEventReminder = new Set(pendingTasks.filter((task) => task.relatedEventIds.length > 0).map((task) => task.watchItemId)).size;
    const highPriorityWatch = watchlistData.watchItems.filter((item) => !item.archivedAt && item.priority === "high").length;

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
    };
  }, [dataset, researchSnapshot, reviewTasks, watchlistData.watchItems]);

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
          <DashboardCard className="overflow-hidden p-5">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
              <SectionHeader
                eyebrow="Research Command Center"
                title="事件验证、风险核验与核心资产跟踪"
                description="优先展示真实公告和财务数据触发的投研动作；数据健康与缺失覆盖保留为底层证据状态。"
              />
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
              onStartReview={startReview}
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
        onAddToWatchlist={(stock) => setWatchForm({ stockId: stock.id })}
        onEditWatchItem={(item) => setWatchForm({ itemId: item.id })}
        onStartReview={startReview}
        onCorrectReview={(entry) => { setReviewItemId(entry.watchItemId); setCorrectionReviewId(entry.id); }}
        onRestoreWatchItem={restoreWatchItem}
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
    </div>
  );
}

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
