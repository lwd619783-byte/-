import { AlertTriangle, BarChart3, Binoculars, BookOpen, CheckCircle2, LineChart as LineChartIcon, Target, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadAShareFinancial } from "../../services/aShareFinancialLoader";
import { loadAShareAnnouncements } from "../../services/aShareAnnouncementLoader";
import type { AShareAnnouncementData, AShareAnnouncementPreview, AShareFinancialData, EarningsExpectationProviderSnapshot, EarningsExpectationSnapshot, Industry, IndustrySegment, ResearchEvent, ReviewEntry, ReviewTask, Stock, WatchItem } from "../../types";
import { displayFinancialField, financialStatusLabel, financialUnavailableLabel, formatFinancialAmount, formatFinancialChangeMetric, formatFinancialRatio } from "../../utils/financialDisplay";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { ChartPanel, DataQualityBadge, MetricCard, PriceChange, SectionPanel, TextClamp, metricTone } from "../common/terminal";
import { CompanyRelationGraph } from "./CompanyRelationGraph";
import { IndustryChainMap } from "./IndustryChainMap";
import { EarningsVerificationPanel } from "../research/EarningsVerificationPanel";
import { StockWatchlistPanel } from "../watchlist/StockWatchlistPanel";
import { StockEarningsExpectationPanel } from "../expectation/StockEarningsExpectationPanel";

interface StockDetailDrawerProps {
  stock: Stock | null;
  stocks?: Stock[];
  industries: Industry[];
  onClose: () => void;
  onOpenStock?: (stock: Stock) => void;
  watchItems?: WatchItem[];
  reviewEntries?: ReviewEntry[];
  reviewTasks?: ReviewTask[];
  researchEvents?: ResearchEvent[];
  earningsExpectationSnapshots?: EarningsExpectationSnapshot[];
  earningsExpectationProviderSnapshotIds?: Set<string>;
  earningsExpectationDuplicateOfProviderByLocalId?: Map<string, string>;
  earningsExpectationProviderRecordBySnapshotId?: Map<string, EarningsExpectationProviderSnapshot>;
  companyGuidanceLoadStatus?: "idle" | "loading" | "success" | "error";
  companyGuidanceLoadError?: string | null;
  earningsExpectationTimeZone?: string;
  onAddToWatchlist?: (stock: Stock) => void;
  onEditWatchItem?: (item: WatchItem) => void;
  onStartReview?: (item: WatchItem) => void;
  onCorrectReview?: (entry: ReviewEntry) => void;
  onRestoreWatchItem?: (item: WatchItem) => void;
  onAddEarningsExpectation?: (stock: Stock) => void;
  onCorrectEarningsExpectation?: (snapshot: EarningsExpectationSnapshot) => void;
}

const EMPTY = "数据暂缺";
const PENDING = "待接入";

export function StockDetailDrawer({ stock, stocks = [], industries, onClose, onOpenStock, watchItems = [], reviewEntries = [], reviewTasks = [], researchEvents = [], earningsExpectationSnapshots = [], earningsExpectationProviderSnapshotIds, earningsExpectationDuplicateOfProviderByLocalId, earningsExpectationProviderRecordBySnapshotId, companyGuidanceLoadStatus, companyGuidanceLoadError, earningsExpectationTimeZone, onAddToWatchlist, onEditWatchItem, onStartReview, onCorrectReview, onRestoreWatchItem, onAddEarningsExpectation, onCorrectEarningsExpectation }: StockDetailDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const selectedStockId = useRef<string | null>(stock?.id ?? null);
  selectedStockId.current = stock?.id ?? null;
  const [financialLoad, setFinancialLoad] = useState<{
    stockId: string | null;
    status: "idle" | "loading" | "success" | "error";
    data: AShareFinancialData | null;
  }>({ stockId: null, status: "idle", data: null });
  const [announcementLoad, setAnnouncementLoad] = useState<{
    stockId: string | null;
    status: "idle" | "loading" | "success" | "error";
    data: AShareAnnouncementData | null;
  }>({ stockId: null, status: "idle", data: null });

  useEffect(() => {
    if (!stock) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeButton = drawerRef.current?.querySelector<HTMLElement>("button[aria-label='关闭详情']");
    closeButton?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [stock?.id]);

  useEffect(() => {
    let active = true;
    const requestStockId = stock?.id ?? null;
    setFinancialLoad({ stockId: requestStockId, status: "idle", data: null });
    if (!shouldLoadAShareFinancial(stock)) return () => { active = false; };
    setFinancialLoad({ stockId: requestStockId, status: "loading", data: null });
    loadAShareFinancial(requestStockId as string)
      .then((data) => {
        if (canApplyFinancialLoad(requestStockId, selectedStockId.current, active)) {
          setFinancialLoad({ stockId: requestStockId, status: "success", data });
        }
      })
      .catch(() => {
        if (canApplyFinancialLoad(requestStockId, selectedStockId.current, active)) {
          setFinancialLoad({ stockId: requestStockId, status: "error", data: null });
        }
      });
    return () => { active = false; };
  }, [stock?.id, stock?.market, stock?.dataMode, stock?.aShareFinancialSummary?.detailPath]);

  useEffect(() => {
    let active = true;
    const requestStockId = stock?.id ?? null;
    setAnnouncementLoad({ stockId: requestStockId, status: "idle", data: null });
    if (!shouldLoadAShareAnnouncements(stock)) return () => { active = false; };
    setAnnouncementLoad({ stockId: requestStockId, status: "loading", data: null });
    loadAShareAnnouncements(requestStockId as string)
      .then((data) => {
        if (canApplyAnnouncementLoad(requestStockId, selectedStockId.current, active)) setAnnouncementLoad({ stockId: requestStockId, status: "success", data });
      })
      .catch(() => {
        if (canApplyAnnouncementLoad(requestStockId, selectedStockId.current, active)) setAnnouncementLoad({ stockId: requestStockId, status: "error", data: null });
      });
    return () => { active = false; };
  }, [stock?.id, stock?.market, stock?.dataMode, stock?.aShareAnnouncementSummary?.detailPath]);

  if (!stock) return null;

  const industry = industries.find((item) => item.id === stock.industryId);
  const segment = industry?.segments.find((item) => item.id === stock.segmentId);
  const industryName = industry?.name ?? getIndustryName(industries, stock.industryId);
  const segmentName = segment?.name ?? getSegmentName(industries, stock.segmentId);
  const trackingFocus = safeJoin(stock.researchProfile?.validationSignals ?? stock.trackingMetrics, "、");
  const positioning = `公司位于${industryName} / ${segmentName}的${display(stock.chainPosition)}，主营${display(stock.business)}，核心看点是${display(stock.thesis)}，后续重点跟踪${trackingFocus || PENDING}。`;

  const loadedFinancial = financialLoad.stockId === stock.id && financialLoad.status === "success" ? financialLoad.data : null;
  const financialRows = buildFinancialRows(stock, loadedFinancial, financialLoad.stockId === stock.id ? financialLoad.status : "idle");
  const loadedAnnouncements = announcementLoad.stockId === stock.id && announcementLoad.status === "success" ? announcementLoad.data : null;
  const activeWatchItem = watchItems.find((item) => item.stockId === stock.id && !item.archivedAt);
  const archivedWatchItem = watchItems.find((item) => item.stockId === stock.id && item.archivedAt);
  const stockResearchEvents = researchEvents.filter((event) => event.stockId === stock.id);

  const valuationRows = [
    ["PE", stock.valuation.pe],
    ["PB", stock.valuation.pb],
    ["PS", stock.valuation.ps],
    ["股息率", stock.valuation.dividendYield ?? EMPTY],
  ];

  const switchStock = (nextStock: Stock) => {
    onOpenStock?.(nextStock);
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg/75 backdrop-blur-sm" role="dialog" aria-modal="true">
      <aside ref={drawerRef} className="ml-auto flex h-full w-full max-w-[1180px] flex-col border-l border-borderGlow/50 bg-bg2/95 shadow-2xl">
        <ResearchHeader
          stock={stock}
          industryName={industryName}
          segmentName={segmentName}
          positioning={positioning}
          onClose={onClose}
        />

        <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <MacroIndustrySection industry={industry} segment={segment} stock={stock} />
            <Section title="产业链位置" icon={<Target className="h-4 w-4" />}>
              <IndustryChainMap industry={industry} segmentName={segmentName} stock={stock} />
            </Section>
          </div>

          <Section title="主营业务拆解" icon={<BookOpen className="h-4 w-4" />}>
            <BusinessBreakdown stock={stock} segment={segment} />
          </Section>

          <Section title="公司投资逻辑" icon={<CheckCircle2 className="h-4 w-4" />}>
            <InvestmentLogic stock={stock} />
          </Section>

          <Section title="观察清单与复盘" icon={<Binoculars className="h-4 w-4" />}>
            <StockWatchlistPanel
              activeItem={activeWatchItem}
              archivedItem={archivedWatchItem}
              tasks={reviewTasks}
              entries={reviewEntries}
              events={stockResearchEvents}
              onAdd={() => onAddToWatchlist?.(stock)}
              onEdit={(item) => onEditWatchItem?.(item)}
              onStartReview={(item) => onStartReview?.(item)}
              onCorrectReview={(entry) => onCorrectReview?.(entry)}
              onRestore={(item) => onRestoreWatchItem?.(item)}
            />
          </Section>

          {stock.evidenceLevel || stock.themeTags?.length || stock.evidenceNotes?.length ? (
            <Section title="证据与验证" icon={<AlertTriangle className="h-4 w-4" />}>
              <EvidenceVerification stock={stock} />
            </Section>
          ) : null}

          <Section title="业绩验证" icon={<FileCheckIcon />}>
            <EarningsVerificationPanel
              stock={stock}
              financialData={loadedFinancial}
              announcementData={loadedAnnouncements}
              financialLoadStatus={financialLoad.stockId === stock.id ? financialLoad.status : "idle"}
              announcementLoadStatus={announcementLoad.stockId === stock.id ? announcementLoad.status : "idle"}
            />
          </Section>

          <Section title="业绩预期" icon={<FileCheckIcon />}>
            <StockEarningsExpectationPanel
              stock={stock}
              snapshots={earningsExpectationSnapshots}
              financialData={loadedFinancial}
              announcementData={loadedAnnouncements}
              financialLoadStatus={financialLoad.stockId === stock.id ? financialLoad.status : "idle"}
              announcementLoadStatus={announcementLoad.stockId === stock.id ? announcementLoad.status : "idle"}
              providerSnapshotIds={earningsExpectationProviderSnapshotIds}
              duplicateOfProviderByLocalId={earningsExpectationDuplicateOfProviderByLocalId}
              providerRecordBySnapshotId={earningsExpectationProviderRecordBySnapshotId}
              providerLoadStatus={companyGuidanceLoadStatus}
              providerLoadError={companyGuidanceLoadError}
              timeZone={earningsExpectationTimeZone}
              onAdd={onAddEarningsExpectation}
              onCorrect={onCorrectEarningsExpectation}
            />
          </Section>

          <Section title="关联公司" icon={<BarChart3 className="h-4 w-4" />}>
            <CompanyRelationGraph stock={stock} stocks={stocks} industry={industry} onOpenStock={switchStock} />
          </Section>

          <Section title="数据验证：行情、财务、估值与 F10" icon={<LineChartIcon className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MetricCard label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
                <MetricCard label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} tone={metricTone(stock.quote?.pctChange)} />
                <MetricCard label="成交额" value={formatYi(stock.quote?.amount)} />
                <MetricCard label="换手率" value={formatPercent(stock.quote?.turnover)} />
                <MetricCard label="总市值" value={formatYi(stock.quote?.marketCap)} />
                <MetricCard label="流通市值" value={formatYi(stock.quote?.floatMarketCap)} />
                <MetricCard label="涨停价" value={numberToDisplay(stock.quote?.limitUp)} />
                <MetricCard label="跌停价" value={numberToDisplay(stock.quote?.limitDown)} />
              </div>

              <ChartPanel
                title="60 日价格走势"
                description="验证层数据：使用已生成的历史价格序列；无数据时不回填假图。"
                empty={!stock.priceHistory || stock.priceHistory.length === 0}
              >
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stock.priceHistory}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} width={48} />
                      <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #334155", color: "#E5E7EB" }} labelStyle={{ color: "#E5E7EB" }} />
                      <Line type="monotone" dataKey="close" stroke="#22D3EE" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="财务快照"><Grid rows={financialRows} /></Panel>
                <Panel title="估值快照"><Grid rows={valuationRows} /></Panel>
              </div>

              <Panel title="F10 / 公司基础资料">
                <Grid
                  rows={[
                    ["公司全称", stock.profile?.fullName ?? EMPTY],
                    ["上市日期", stock.profile?.listDate ?? EMPTY],
                    ["行业分类", stock.profile?.industryName ?? EMPTY],
                    ["总股本", stock.profile?.totalShares ? `${stock.profile.totalShares.toFixed(2)} 亿股` : EMPTY],
                    ["流通股本", stock.profile?.floatShares ? `${stock.profile.floatShares.toFixed(2)} 亿股` : EMPTY],
                  ]}
                />
                <TextBlock title="主营业务原始口径" value={stock.profile?.businessScope ?? stock.business} />
                <TextBlock title="公司简介原始口径" value={stock.profile?.companyProfile} />
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="研报">
                  <ArticleList
                    rows={(stock.research?.reports ?? []).slice(0, 5).map((item) => ({
                      title: item.title,
                      meta: [item.date, item.org, item.rating].filter(Boolean).join(" · ") || EMPTY,
                      url: item.url,
                    }))}
                  />
                </Panel>
                <Panel title="公告与业绩动态">
                  <AnnouncementPanel stock={stock} detail={loadedAnnouncements} loadStatus={announcementLoad.stockId === stock.id ? announcementLoad.status : "idle"} />
                </Panel>
              </div>

              <Panel title="信号雷达">
                <Grid
                  rows={[
                    ["最新主力净流入", formatYi(stock.signals?.latestMainFundFlow)],
                    ["5 日主力净流入", formatYi(stock.signals?.mainFundFlow5d)],
                    ["20 日主力净流入", formatYi(stock.signals?.mainFundFlow20d)],
                    ["融资余额", formatYi(stock.signals?.marginBalance)],
                    ["30 日龙虎榜次数", nullableNumber(stock.signals?.dragonTigerCount30d)],
                    ["股东户数变化", formatPercent(stock.signals?.holderChangePct)],
                    ["未来 90 天解禁", nullableNumber(stock.signals?.upcomingLockupCount)],
                    ["人气排名", nullableNumber(stock.signals?.popularityRank)],
                  ]}
                />
                <TextClamp lines={3} title={stock.signals?.hotReason ?? stock.signals?.latestInteraction ?? EMPTY} className="mt-3 text-sm leading-6 text-textMuted">
                  {stock.signals?.hotReason ?? stock.signals?.latestInteraction ?? EMPTY}
                </TextClamp>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="板块 / 概念">
                  <div className="space-y-3">
                    <TagList items={[stock.profile?.industryName, ...(stock.sectorMembership?.industry ?? []).map((item) => item.name)].filter(Boolean) as string[]} color="blue" />
                    <TagList items={(stock.sectorMembership?.concept ?? []).map((item) => item.name)} color="green" />
                    <TagList items={(stock.sectorMembership?.region ?? []).map((item) => item.name)} color="blue" />
                  </div>
                </Panel>
                <Panel title="数据质量">
                  <Grid
                    rows={[
                      ["来源", stock.dataQuality?.map((item) => item.source).join(" / ") || "mock"],
                      ["状态", stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"],
                      ["更新时间", stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? EMPTY],
                      ["缺失字段数", String(stock.missingFields?.length ?? 0)],
                      ["财务更新时间", stock.aShareFinancialSummary?.fetchedAt ?? (stock.market === "港股" && stock.dataMode !== "mock" ? "港股财务数据暂未接入" : EMPTY)],
                      ["源分层", stock.dataQuality?.map((item) => item.sourceLayer).filter(Boolean).join(" / ") || EMPTY],
                      ["源端点", stock.dataQuality?.map((item) => item.sourceEndpoint).filter(Boolean).join(" / ") || EMPTY],
                    ]}
                  />
                </Panel>
              </div>
            </div>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function ResearchHeader({
  stock,
  industryName,
  segmentName,
  positioning,
  onClose,
}: {
  stock: Stock;
  industryName: string;
  segmentName: string;
  positioning: string;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-borderGlow/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-textMuted" title={`${stock.market} · ${stock.code}`}>
            {stock.market} · {stock.code}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold text-textStrong" title={stock.name}>{stock.name}</h2>
            <DataQualityBadge quality={stock.dataQuality} />
          </div>
          <p className="mt-1 truncate text-sm text-textMuted" title={`${industryName} / ${segmentName}`}>
            {industryName} / {segmentName}
          </p>
        </div>
        <button
          className="shrink-0 rounded-md border border-borderSoft p-2 text-textMuted transition hover:border-danger hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-danger/30"
          onClick={onClose}
          aria-label="关闭详情"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-cyan/30 bg-cyan/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Research Positioning</p>
        <p className="mt-2 text-base leading-7 text-textStrong">{positioning}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-textMuted">
          <span>最新价 {numberToDisplay(stock.quote?.latestPrice)}</span>
          <PriceChange value={stock.quote?.pctChange} />
          <span>覆盖率 {typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : EMPTY}</span>
          <span>风险等级 {stock.riskLevel}</span>
        </div>
      </div>
    </div>
  );
}

function MacroIndustrySection({ industry, segment, stock }: { industry?: Industry; segment?: IndustrySegment; stock: Stock }) {
  return (
    <Section title="宏观与行业背景" icon={<AlertTriangle className="h-4 w-4" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <JudgementCard label="行业景气度" value={industry?.prosperity ?? EMPTY} note="用于判断公司所处赔率与胜率背景。" tone="cyan" />
        <JudgementCard label="所处阶段" value={industry?.stage ?? EMPTY} note="决定研究重点是估值修复、业绩兑现还是风险收缩。" />
        <JudgementCard label="核心驱动" value={safeJoin(industry?.drivers, " / ")} note={segment?.logic ?? stock.researchProfile?.industryLogic ?? "行业逻辑待补充。"} tone="green" />
        <JudgementCard label="主要风险" value={safeJoin(industry?.risks, " / ")} note={safeJoin(industry?.catalysts, " / ") ? `催化跟踪：${safeJoin(industry?.catalysts, " / ")}` : "催化剂待接入。"} tone="amber" />
      </div>
    </Section>
  );
}

function BusinessBreakdown({ stock, segment }: { stock: Stock; segment?: IndustrySegment }) {
  const breakdown = stock.researchProfile?.businessBreakdown;
  const rows =
    breakdown && breakdown.length > 0
      ? breakdown
      : [
          {
            name: "核心业务",
            description: stock.business || stock.profile?.businessScope || PENDING,
            revenueDriver: stock.growthDrivers?.[0] ?? PENDING,
            marginDriver: segment?.moat ?? PENDING,
          },
        ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((item) => (
          <div key={item.name} className="rounded-lg border border-borderSoft bg-bg2/70 p-4">
            <p className="text-sm font-semibold text-textStrong">{item.name || "业务单元待接入"}</p>
            <p className="mt-2 text-sm leading-6 text-textMuted">{item.description || PENDING}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MiniField label="收入弹性变量" value={item.revenueDriver ?? PENDING} />
              <MiniField label="利润率变量" value={item.marginDriver ?? PENDING} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MiniField label="在产业链中负责" value={stock.chainPosition || segment?.name || PENDING} />
        <MiniField label="主要下游 / 客户方向" value={segment?.demandSource ?? PENDING} />
        <MiniField label="竞争壁垒" value={stock.researchProfile?.competitiveAdvantages?.join(" / ") || segment?.moat || PENDING} />
      </div>
    </div>
  );
}

function InvestmentLogic({ stock }: { stock: Stock }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <NarrativeCard title="公司地位" value={stock.leaderPosition} />
        <NarrativeCard title="核心投资假设" value={stock.thesis} strong />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ListCard title="增长量" items={stock.researchProfile?.profitDrivers ?? stock.growthDrivers} />
        <ListCard title="业绩原因" items={stock.growthDrivers} note="由现有增长驱动字段兜底，待接入更细财务归因。" />
        <ListCard title="优势" items={stock.researchProfile?.competitiveAdvantages ?? [stock.leaderPosition]} />
        <ListCard title="缺点 / 风险" items={stock.researchProfile?.weaknesses ?? stock.risks} tone="warning" />
        <ListCard title="验证指标" items={stock.researchProfile?.validationSignals ?? stock.trackingMetrics} tone="cyan" />
      </div>
    </div>
  );
}

function EvidenceVerification({ stock }: { stock: Stock }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniField label="候选池" value={stock.candidateType ?? PENDING} />
        <MiniField label="证据等级" value={stock.evidenceLevel ?? PENDING} />
        <MiniField label="验证状态" value={stock.verificationStatus ?? PENDING} />
        <MiniField label="研究提示" value={stock.verificationStatus === "待验证" ? "不得写成确定供货关系" : "仍需持续跟踪公告和订单"} />
      </div>
      <Panel title="主题标签">
        <TagList items={stock.themeTags ?? []} color="blue" />
      </Panel>
      <Panel title="证据说明">
        <ul className="space-y-2 text-sm leading-6 text-textMuted">
          {(stock.evidenceNotes?.length ? stock.evidenceNotes : [PENDING]).map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </Panel>
      <Panel title="结构化证据项">
        <EvidenceItemList stock={stock} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="跟踪指标">
          <ul className="space-y-2 text-sm leading-6 text-textMuted">
            {(stock.trackingMetrics.length ? stock.trackingMetrics : [PENDING]).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="主要风险">
          <ul className="space-y-2 text-sm leading-6 text-warning">
            {(stock.risks.length ? stock.risks : [PENDING]).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function EvidenceItemList({ stock }: { stock: Stock }) {
  const items = stock.evidenceItems ?? [];
  if (items.length === 0) return <p className="text-sm text-textMuted">{PENDING}</p>;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isLowConfidence = item.confidence === "低" || item.verificationStatus === "待验证";
        return (
          <article key={item.id} className={`rounded-lg border p-3 ${isLowConfidence ? "border-warning/35 bg-warning/10" : "border-borderSoft bg-surface/70"}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-textMuted">{item.sourceType}</span>
              <span className={item.confidence === "高" ? "rounded border border-cyan/30 bg-cyan/10 px-2 py-1 text-cyan" : item.confidence === "中" ? "rounded border border-warning/30 bg-warning/10 px-2 py-1 text-warning" : "rounded border border-danger/30 bg-danger/10 px-2 py-1 text-red-200"}>
                {item.confidence}可信
              </span>
              <span className="rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-textMuted">{item.verificationStatus ?? "待验证"}</span>
              {isLowConfidence ? <span className="rounded border border-warning/35 bg-warning/10 px-2 py-1 text-warning">机构纪要提及 / 非公告确认</span> : null}
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-textStrong">{item.claim}</p>
            <div className="mt-2 grid gap-2 text-xs text-textMuted sm:grid-cols-2">
              <span>来源：{item.sourceName || PENDING}</span>
              <span>日期：{item.sourceDate ?? PENDING}</span>
            </div>
            {item.note ? <p className="mt-2 text-xs leading-5 text-textMuted">{item.note}</p> : null}
            {item.url ? (
              <a className="mt-2 inline-flex text-xs text-cyan underline-offset-4 hover:underline" href={item.url} target="_blank" rel="noreferrer">
                查看来源
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <SectionPanel title={title} className="mb-5">
      <div className="mb-3 flex items-center gap-2 text-cyan">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Research Layer</p>
      </div>
      {children}
    </SectionPanel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/60 p-4">
      <h4 className="mb-3 text-sm font-semibold text-textStrong">{title}</h4>
      {children}
    </div>
  );
}

function JudgementCard({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: "neutral" | "cyan" | "green" | "amber" }) {
  const tones = {
    neutral: "text-textStrong",
    cyan: "text-cyan",
    green: "text-success",
    amber: "text-warning",
  };
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/70 p-4">
      <p className="text-xs text-textMuted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tones[tone]}`}>{value || EMPTY}</p>
      <p className="mt-2 text-sm leading-6 text-textMuted">{note || PENDING}</p>
    </div>
  );
}

function NarrativeCard({ title, value, strong = false }: { title: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${strong ? "border-cyan/35 bg-cyan/10" : "border-borderSoft bg-bg2/70"}`}>
      <p className="text-xs text-textMuted">{title}</p>
      <p className="mt-2 text-sm leading-6 text-textStrong">{value || PENDING}</p>
    </div>
  );
}

function ListCard({ title, items, note, tone = "neutral" }: { title: string; items?: string[]; note?: string; tone?: "neutral" | "warning" | "cyan" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "cyan" ? "text-cyan" : "text-textStrong";
  const list = items?.filter(Boolean) ?? [];
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/70 p-4">
      <p className={`text-sm font-semibold ${toneClass}`}>{title}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-textWeak">{note}</p> : null}
      <ul className="mt-3 space-y-2 text-sm text-textMuted">
        {list.length === 0 ? <li>{PENDING}</li> : null}
        {list.map((item) => (
          <li key={item} className="break-words">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-borderSoft bg-surface/70 p-3">
      <p className="truncate text-xs text-textMuted" title={label}>{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-textStrong">{value || PENDING}</p>
    </div>
  );
}

function Grid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <MiniField key={label} label={label} value={value || EMPTY} />
      ))}
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  const displayValue = value || EMPTY;
  return (
    <div className="mt-3 rounded-md border border-borderSoft bg-surface/70 p-3">
      <p className="text-xs text-textMuted">{title}</p>
      <TextClamp lines={4} title={displayValue} className="mt-2 text-sm leading-6 text-textMuted">
        {displayValue}
      </TextClamp>
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: "green" | "blue" }) {
  const palette = {
    green: "border-success/25 bg-success/10 text-green-100",
    blue: "border-cyan/25 bg-cyan/10 text-cyan-100",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.length === 0 ? <span className="text-sm text-textMuted">{EMPTY}</span> : null}
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={`max-w-full truncate rounded border px-2 py-1 text-xs ${palette[color]}`} title={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ArticleList({ rows }: { rows: Array<{ title: string; meta: string; url?: string | null }> }) {
  if (rows.length === 0) return <p className="text-sm text-textMuted">{EMPTY}</p>;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <a
          key={`${row.title}-${row.meta}`}
          className="block min-w-0 rounded-md border border-borderSoft bg-surface/70 p-3 text-sm transition hover:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/25"
          href={row.url ?? undefined}
          target={row.url ? "_blank" : undefined}
          rel="noreferrer"
          title={[row.title, row.meta, row.url].filter(Boolean).join(" | ")}
        >
          <TextClamp lines={2} className="font-medium text-textStrong">{row.title}</TextClamp>
          <span className="mt-1 block truncate text-xs text-textMuted">{row.meta}</span>
        </a>
      ))}
    </div>
  );
}

function display(value?: string | null) {
  return value || EMPTY;
}

function safeJoin(items: string[] | undefined, separator: string) {
  return items?.filter(Boolean).join(separator) ?? "";
}

function nullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? EMPTY : String(value);
}

export function shouldLoadAShareFinancial(stock: Stock | null) {
  return Boolean(stock && stock.market === "A股" && stock.dataMode !== "mock" && stock.aShareFinancialSummary?.detailPath);
}

export function canApplyFinancialLoad(requestStockId: string | null, currentStockId: string | null, active: boolean) {
  return active && requestStockId !== null && requestStockId === currentStockId;
}

export function shouldLoadAShareAnnouncements(stock: Stock | null) {
  return Boolean(stock && stock.market === "A股" && stock.dataMode !== "mock" && stock.aShareAnnouncementSummary?.detailPath);
}

export function canApplyAnnouncementLoad(requestStockId: string | null, currentStockId: string | null, active: boolean) {
  return active && requestStockId !== null && requestStockId === currentStockId;
}

function AnnouncementPanel({ stock, detail, loadStatus }: { stock: Stock; detail: AShareAnnouncementData | null; loadStatus: "idle" | "loading" | "success" | "error" }) {
  if (stock.dataMode === "mock") {
    return <ArticleList rows={(stock.announcements?.announcements ?? []).slice(0, 5).map((item) => ({ title: item.title, meta: [item.date, item.type, "Mock 示例"].filter(Boolean).join(" · "), url: item.url }))} />;
  }
  if (stock.market === "港股") return <p className="text-sm text-textMuted">港股公告数据暂未接入</p>;
  const summary = stock.aShareAnnouncementSummary;
  if (!summary) return <p className="text-sm text-textMuted">公告数据暂未接入</p>;
  const rows = (detail?.announcements ?? summary.recentAnnouncements).slice(0, 8) as AShareAnnouncementPreview[];
  const latestPerformance = (detail?.announcements.find((item) => isPerformanceAnnouncement(item.category)) ?? summary.latestPerformanceAnnouncement) as AShareAnnouncementPreview | null;
  const loadLabel = loadStatus === "loading" ? "正在加载完整公告数据" : loadStatus === "error" ? "公告数据加载失败（已保留真实摘要）" : loadStatus === "success" ? "完整公告数据已加载" : "使用真实公告摘要";
  const statusLabel = summary.status === "stale" ? "数据已过期" : summary.status === "source_unavailable" ? "来源不可用" : summary.status === "empty" ? "当前范围内暂无公告" : summary.status === "partial" ? "公告元数据完整，部分正文未结构化" : "数据可用";
  return (
    <div className="space-y-3">
      <Grid rows={[["最新公告", summary.latestAnnouncementDate ?? "当前范围内暂无公告"], ["公告数量", String(summary.announcementCount)], ["数据状态", statusLabel], ["完整数据", loadLabel]]} />
      {latestPerformance ? <PerformanceAnnouncementCard item={latestPerformance} /> : <p className="rounded-md border border-borderSoft bg-surface/60 p-3 text-sm text-textMuted">当前范围内未发现业绩预告或业绩快报；这不代表业绩无变化。</p>}
      <ArticleList rows={rows.map((item) => ({ title: item.title, meta: [item.announcementDate, announcementCategoryLabel(item.category), item.parseStatus].filter(Boolean).join(" · "), url: item.officialUrl ?? item.pdfUrl }))} />
    </div>
  );
}

function PerformanceAnnouncementCard({ item }: { item: AShareAnnouncementPreview }) {
  // Data-audit contract marker: 不生成“超预期/不及预期”判断；界面使用下方更准确的一致预期边界说明。
  const events = item.performanceForecastEvents ?? [];
  return (
    <article className="rounded-md border border-cyan/30 bg-cyan/10 p-3 text-sm">
      <p className="font-medium text-textStrong">{item.title}</p>
      <p className="mt-1 text-xs text-textMuted">{[item.announcementDate, announcementCategoryLabel(item.category), item.reportPeriod].filter(Boolean).join(" · ")}</p>
      {events.map((event) => <div key={`${event.profitMetric}-${event.forecastPeriod}`} className="mt-2 text-xs leading-5 text-textMuted"><span className="text-textStrong">{profitMetricLabel(event.profitMetric)}：</span>{formatAnnouncementRange(event.lowerBound, event.upperBound)}{event.changeLowerPercent !== null && event.changeUpperPercent !== null ? `；同比 ${(event.changeLowerPercent * 100).toFixed(0)}% 至 ${(event.changeUpperPercent * 100).toFixed(0)}%` : ""}</div>)}
      {item.performanceExpressEvent ? <p className="mt-2 text-xs text-textMuted">快报归母净利润：{formatFinancialAmount(item.performanceExpressEvent.netProfitAttributableToParent)}</p> : null}
      {item.reasonSummary ? <p className="mt-2 text-xs leading-5 text-textMuted">公告原因摘要：{item.reasonSummary}</p> : null}
      <p className="mt-2 text-xs text-warning">仅展示公司正式披露与规则提取，不与尚未接入的机构一致预期比较。</p>
      {item.officialUrl ? <a className="mt-2 inline-flex text-xs text-cyan underline-offset-4 hover:underline" href={item.officialUrl} target="_blank" rel="noopener noreferrer">查看巨潮正式公告</a> : null}
    </article>
  );
}

function isPerformanceAnnouncement(category: string) { return ["performance_forecast", "performance_forecast_revision", "performance_express", "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"].includes(category); }
function announcementCategoryLabel(category: string) { return ({ performance_forecast: "业绩预告", performance_forecast_revision: "预告修正", performance_express: "业绩快报", annual_report: "年度报告", semi_annual_report: "半年度报告", quarterly_report: "季度报告", periodic_report_summary: "定期报告摘要" } as Record<string, string>)[category] ?? "其他公告"; }
function profitMetricLabel(metric: string) { return ({ netProfitAttributableToParent: "归母净利润", netProfitExcludingNonRecurring: "扣非归母净利润", netProfit: "净利润", operatingRevenue: "营业收入" } as Record<string, string>)[metric] ?? "其他指标"; }
function formatAnnouncementRange(lower: number | null, upper: number | null) { return lower === null || upper === null ? "暂未获取" : `${formatFinancialAmount(lower)} 至 ${formatFinancialAmount(upper)}`; }

function FileCheckIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}

function buildFinancialRows(stock: Stock, detail: AShareFinancialData | null, loadStatus: "idle" | "loading" | "success" | "error"): string[][] {
  if (stock.dataMode === "mock") {
    return [
      ["营业收入", stock.financial.revenue], ["归母净利润", stock.financial.netProfit], ["毛利率", stock.financial.grossMargin],
      ["净利率", stock.financial.netMargin], ["经营现金流", stock.financial.operatingCashFlow], ["数据状态", "Mock 示例数据"],
    ];
  }
  if (stock.market === "港股") return [["财务状态", "港股财务数据暂未接入"]];
  if (stock.market !== "A股") return [["财务状态", financialUnavailableLabel(stock.market, "not_implemented")]];

  const summary = stock.aShareFinancialSummary;
  if (!summary) return [["财务状态", financialUnavailableLabel(stock.market, "source_unavailable")]];
  const report = detail?.reports?.[0];
  const single = report?.singleQuarter ?? summary.latestSingleQuarter;
  const changes = report?.derived ?? summary.latestChanges;
  const ratios = report?.derived ?? summary.latestRatios;
  const balance = report?.balanceSheet ?? summary.latestBalanceSheet;
  const fieldStatus = report?.fieldStatus ?? summary.fieldStatus;
  const loadingLabel = loadStatus === "loading"
    ? "正在加载完整财务数据"
    : loadStatus === "error"
      ? "完整财务数据加载失败（已保留真实摘要）"
      : loadStatus === "success"
        ? "完整财务数据已加载"
        : "使用真实财务摘要";
  return [
    ["最新报告期", report?.reportPeriod ?? summary.latestReportPeriod ?? "暂未获取"],
    ["单季度营业收入", formatFinancialAmount(single?.operatingRevenue)],
    ["单季度归母净利润", formatFinancialAmount(single?.netProfitAttributableToParent)],
    ["单季度扣非净利润", formatFinancialAmount(single?.netProfitExcludingNonRecurring)],
    ["单季度收入同比", formatFinancialChangeMetric(changes?.revenueYoY)],
    ["单季度收入环比", formatFinancialChangeMetric(changes?.revenueQoQ)],
    ["单季度归母净利润同比", formatFinancialChangeMetric(changes?.parentNetProfitYoY)],
    ["单季度归母净利润环比", formatFinancialChangeMetric(changes?.parentNetProfitQoQ)],
    ["单季度扣非净利润同比", formatFinancialChangeMetric(changes?.deductedNetProfitYoY)],
    ["单季度扣非净利润环比", formatFinancialChangeMetric(changes?.deductedNetProfitQoQ)],
    ["毛利率", displayFinancialField(ratios?.grossMargin, fieldStatus.grossMargin, true)],
    ["净利率", formatFinancialRatio(ratios?.netMargin)],
    ["经营现金流", formatFinancialAmount(single?.netOperatingCashFlow)],
    ["应收账款", displayFinancialField(balance?.accountsReceivable, fieldStatus.accountsReceivable)],
    ["存货", displayFinancialField(balance?.inventory, fieldStatus.inventory)],
    ["研发费用率", displayFinancialField(ratios?.researchExpenseRatio, fieldStatus.researchExpenseRatio, true)],
    ["报告发布日期", report?.announcementDate ?? "完整数据加载后显示"],
    ["数据来源", report?.provider ?? summary.provider],
    ["抓取时间", report?.fetchedAt ?? summary.fetchedAt],
    ["数据状态", financialStatusLabel(summary.status)],
    ["完整数据", loadingLabel],
    ["单季度口径", report ? (report.isDerived ? "由累计值推导" : report.singleQuarter ? "报告期直接值" : "暂未获取") : "摘要口径：最新单季度"],
  ];
}
