import { useMemo, useState } from "react";
import { BarChart3, Binoculars, Building2, FlaskConical, House, LineChart, ScrollText } from "lucide-react";
import { pages, useWorkspaceNavigation } from "../hooks/useWorkspaceNavigation";
import { AppearanceControl } from "../components/layout/Appearance";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Sidebar } from "../components/layout/Sidebar";
import { HomePage } from "../components/home/HomePage";
import { MacroTab } from "../components/dashboard/MacroTab";
import { IndustryTab } from "../components/industry/IndustryTab";
import { StockPool } from "../components/stock/StockPool";
import { StockDetailDrawer } from "../components/stock/StockDetailDrawer";
import { StockQuickPreview } from "../components/stock/StockQuickPreview";
import { WatchlistTab } from "../components/watchlist/WatchlistTab";
import { ResearchEventCenter } from "../components/research/ResearchEventCenter";
import { EarningsExpectationCenter } from "../components/expectation/EarningsExpectationCenter";
import { buildEarningsExpectationComparisons } from "../services/earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "../services/earningsExpectationEventProvider";
import { sortResearchEvents } from "../services/researchEventProvider";
import type { Stock } from "../types";
import { createReviewFixtures, REVIEW_AT, REVIEW_NOW } from "./fixtures";
import { UI_REVIEW_LABEL, type UiReviewProfile } from "./config";

const tabs = [{ id: "首页", icon: House }, { id: "宏观", icon: LineChart }, { id: "行业", icon: Building2 }, { id: "个股池", icon: BarChart3 }, { id: "观察清单", icon: Binoculars }, { id: "验证中心", icon: FlaskConical }, { id: "预期证据", icon: ScrollText }] as const;
const BLOCKED = "界面验收模式仅支持浏览、筛选和导航；业务写入、导入、导出与真实数据重试均已隔离。";
export default function UiReviewApp({ initialProfile }: { initialProfile: UiReviewProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Stock | null>(null);
  const navigation = useWorkspaceNavigation();
  const route = navigation.route;
  const fixture = useMemo(()=>createReviewFixtures(profile),[profile]);
  const { companies, industries, watchItems, tasks, reviewEntries, snapshot: baseSnapshot, expectations, macro, details } = fixture;
  // Pure existing comparison engine; no data loader, registry or persistence path.
  const comparisons = useMemo(()=>buildEarningsExpectationComparisons(expectations, baseSnapshot.events, { timeZone: "Asia/Shanghai", revisionReminderThreshold: .1, nearZeroThreshold: 1, roundingTolerance: .01 }),[expectations, baseSnapshot]);
  const snapshot = useMemo(()=>({ ...baseSnapshot, events: sortResearchEvents([...buildEarningsExpectationResearchEvents(expectations, comparisons, companies, .1, "Asia/Shanghai"), ...baseSnapshot.events], "Asia/Shanghai") }),[baseSnapshot, expectations, comparisons, companies]);
  const blocked = () => { setNotice(BLOCKED); document.querySelector(".ui-review-banner")?.scrollIntoView?.({block:"start",behavior:"instant"}); };
  const openCompany = (stock: Stock) => { setPreview(null); navigation.openCompany(stock.id); };
  const company = route.kind === "company" ? companies.find(stock=>stock.id===route.stockId) : null;
  const changeProfile = (next: UiReviewProfile) => {
    setProfile(next); setPreview(null); setNotice(""); setSearch("");
    const url = new URL(window.location.href); url.searchParams.set("profile", next);
    window.history.replaceState(window.history.state, "", url);
  };
  const degraded = profile === "degraded";
  const error = degraded ? "合成退化场景：来源索引失败；公司明细不可用，本地独立样例保留。" : null;
  let content;
  if (route.kind === "invalid" || (route.kind === "company" && !company)) content = <p className="p-5">未找到验收对象。<button className="min-h-11 text-accent" onClick={()=>navigation.navigatePage("首页")}>返回首页</button></p>;
  else if (company) content = <StockDetailDrawer presentation="page" stock={company} stocks={companies} industries={industries} activeTab={route.tab} onTabChange={navigation.changeCompanyTab} onClose={navigation.back} onOpenStock={openCompany} presentationDetails={details[company.id]} watchItems={watchItems} reviewEntries={reviewEntries} reviewTasks={tasks} researchEvents={snapshot.events} earningsExpectationSnapshots={expectations} companyGuidanceLoadStatus={degraded ? "error" : "idle"} companyGuidanceLoadError={error} earningsExpectationTimeZone="Asia/Shanghai" onAddToWatchlist={blocked} onEditWatchItem={blocked} onStartReview={blocked} onCorrectReview={blocked} onRestoreWatchItem={blocked} onAddEarningsExpectation={blocked} onCorrectEarningsExpectation={blocked} />;
  else switch(route.page) {
    case "home": content = <HomePage modeLabel={UI_REVIEW_LABEL} updatedAt={REVIEW_AT} sourceNote={UI_REVIEW_LABEL} coverageSummary={profile==="empty" ? "空场景：尚无价格、待办和事件。" : degraded ? "退化样例：来源失败、时点缺失与价格缺口。" : "完整样例：仅供检查排版、交互与图表，未接入真实数据。"} industriesCount={industries.length} stocksCount={companies.length} activeWatchCount={watchItems.length} expectationCount={expectations.length} macroCount={macro.length} stats={{segments:4,highRisk:0,recentEvents:snapshot.events.filter(event=>(event.eventDate ?? "")>="2026-09-03").length,verificationChains:snapshot.chains.length,todayReview:tasks.length,overdueReview:tasks.length,quoteStatusRealCovered:0,quoteCoverageTotal:companies.filter(stock=>stock.market==="A股").length,pendingExpectationSources:degraded ? expectations.length : 0}} focusStocks={companies} quoteStocks={companies} watchItems={watchItems} tasks={tasks} events={snapshot.events} now={REVIEW_NOW} onDataModeChange={blocked} onNavigate={navigation.navigatePage} onOpenStock={setPreview} onStartReview={blocked} onOpenEvent={event=>navigation.openEvent(event.id)} />; break;
    case "macro": content = <MacroTab indicators={macro} generatedAt={REVIEW_AT} now={REVIEW_NOW} />; break;
    case "industry": content = <IndustryTab industries={industries} stocks={profile==="empty" ? [] : companies} globalSearch={search} onOpenStock={openCompany} initialIndustryId={route.industryId} initialSegmentId={route.segmentId} onSelectionChange={navigation.selectIndustry} />; break;
    case "stocks": content = <StockPool stocks={companies} industries={industries} globalSearch={search} onOpenStock={setPreview} onOpenResearch={openCompany} />; break;
    case "watchlist": content = <WatchlistTab watchItems={watchItems} samples={[]} reviewEntries={reviewEntries} tasks={tasks} stocks={companies} industries={industries} events={snapshot.events} storageError={degraded ? "合成场景：存储读取失败（未读取实际业务存储）。" : null} exportJson="" onRequestBackup={blocked} onValidateImport={()=>{ throw new Error(BLOCKED); }} onMergeImport={blocked} onReplaceImport={blocked} onReset={blocked} onAdd={blocked} onEdit={blocked} onStartReview={blocked} onCorrectReview={blocked} onArchive={blocked} onRestore={blocked} onLoadSample={blocked} onLoadAllSamples={blocked} onTaskState={blocked} onOpenStock={openCompany} />; break;
    case "verification": content = <ResearchEventCenter snapshot={snapshot} stocks={companies} industries={industries} watchItems={watchItems} reviewTasks={tasks} now={REVIEW_NOW} timeZone="Asia/Shanghai" initialEventId={route.eventId} onSelectEvent={navigation.selectEvent} onOpenStock={openCompany} onStartReview={blocked} />; break;
    case "expectations": content = <EarningsExpectationCenter snapshots={expectations} comparisons={comparisons} researchEvents={snapshot.events} importHistory={[]} stocks={companies} industries={industries} watchItems={watchItems} providerLoadStatus={degraded ? "error" : "idle"} providerLoadError={error} onRetryProvider={blocked} timeZone="Asia/Shanghai" onAdd={blocked} onCorrect={blocked} onImport={blocked} onOpenStock={openCompany} />; break;
  }
  return <div className="workspace min-h-screen" data-ui-review={profile}>
    <a href="#workspace-main" className="skip-link">跳至研究正文</a>
    <header className="workspace-header"><div className="workspace-topbar">
      <a href="#/home" className="workspace-brand" onClick={event=>{event.preventDefault();navigation.navigatePage("首页");}}>◈ 投研工作台</a>
      <label className="workspace-search"><span className="sr-only">搜索当前研究池</span><input aria-label="搜索当前研究池" placeholder="合成研究池 · 行业、公司或代码" value={search} onChange={event=>setSearch(event.target.value)}/></label><AppearanceControl/>
    </div></header>
    <aside className="ui-review-banner" aria-label="界面验收模式">
      <div><strong>{UI_REVIEW_LABEL}</strong><p className="mt-1 text-xs">固定样例时点：2026-09-09 10:00（Asia/Shanghai） · 内存场景 · 不读取或保存业务记录</p></div>
      <label className="flex items-center gap-2 text-sm">场景<select aria-label="验收场景" value={profile} onChange={event=>changeProfile(event.target.value as UiReviewProfile)}><option value="full">full · 完整</option><option value="empty">empty · 空状态</option><option value="degraded">degraded · 退化</option></select></label>
      <a className="inline-flex min-h-11 items-center text-sm underline" href={`${window.location.pathname}#/home`}>退出界面验收</a>
      {notice ? <p role="status" className="w-full text-sm">{notice}</p> : null}
    </aside>
    <DashboardLayout sidebar={<Sidebar tabs={[...tabs]} activeTab={pages[route.page]} onChange={page=>{setPreview(null);navigation.navigatePage(page);}}/>} main={<div key={profile} className="min-w-0">{content}</div>}/>
    {preview ? <StockQuickPreview stock={preview} onClose={()=>setPreview(null)} onOpenResearch={openCompany}/> : null}
    <div className="ui-review-watermark" aria-hidden="true">界面验收样例 · 合成数据 · 不用于投资研究</div>
  </div>;
}
