import { loadAShareAnnouncements } from "./aShareAnnouncementLoader";
import { loadAShareFinancial } from "./aShareFinancialLoader";
import type {
  AShareAnnouncementData,
  AShareAnnouncementDetailItem,
  AShareAnnouncementPreview,
  AShareFinancialData,
  AShareFinancialSummary,
  EarningsVerificationChain,
  EarningsVerificationDifference,
  EarningsVerificationStage,
  FinancialReport,
  ResearchEvent,
  ResearchEventMetric,
  ResearchEventSnapshot,
  ResearchEventType,
  ResearchParseStatus,
  ResearchVerificationStatus,
  Stock,
  WatchlistItem,
} from "../types";

type AnnouncementLike = AShareAnnouncementPreview | AShareAnnouncementDetailItem;

interface StockEventInput {
  financialData?: AShareFinancialData | null;
  announcementData?: AShareAnnouncementData | null;
  financialLoadError?: string | null;
  announcementLoadError?: string | null;
}

interface ResearchEventLoaders {
  financial: (stockId: string) => Promise<AShareFinancialData>;
  announcements: (stockId: string) => Promise<AShareAnnouncementData>;
}

const PERFORMANCE_EVENT_TYPES: ResearchEventType[] = [
  "earnings_preview",
  "earnings_preview_revision",
  "earnings_flash",
  "periodic_report",
  "financial_update",
];

const STAGE_LABELS: Record<EarningsVerificationStage, string> = {
  preview: "业绩预告",
  revision: "预告修正",
  flash: "业绩快报",
  formal: "正式报告",
};

export function announcementToResearchEvent(stock: Stock, item: AnnouncementLike): ResearchEvent {
  const eventType = announcementCategoryToEventType(item.category);
  const announcementId = item.announcementId;
  const reportPeriod = item.reportPeriod ?? forecastPeriod(item);
  const parseStatus = item.parseStatus;
  const status = item.status ?? "success";
  const sourceName = "sourceProvider" in item ? item.sourceProvider : stock.aShareAnnouncementSummary?.provider ?? "CNInfo";
  const metrics = announcementMetrics(item, announcementId, reportPeriod);
  const reviewReasons = eventReviewReasons(eventType, parseStatus, metrics, reportPeriod);
  if (status === "partial") reviewReasons.push("公告记录状态为 partial");
  if (("periodicReportEvent" in item && item.periodicReportEvent?.linkedFinancialStatus === "not_found")) {
    reviewReasons.push("公告与财务报告期无法匹配");
  }

  const relatedIds = [announcementId];
  if ("correctedAnnouncementId" in item && item.correctedAnnouncementId) relatedIds.push(item.correctedAnnouncementId);
  for (const event of item.performanceForecastEvents ?? []) {
    if (event.previousForecastAnnouncementId) relatedIds.push(event.previousForecastAnnouncementId);
  }

  return {
    id: `announcement:${stock.id}:${announcementId}`,
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType,
    eventDate: item.announcementDate ?? null,
    publishedAt: announcementPublishedAt(item),
    reportPeriod,
    title: item.title,
    summary: announcementSummary(item, parseStatus),
    sourceType: "announcement",
    sourceName,
    sourceUrl: item.officialUrl ?? null,
    pdfUrl: item.pdfUrl ?? null,
    verificationStatus: announcementVerificationStatus(parseStatus, status),
    parseStatus,
    materiality: eventType === "announcement" ? "medium" : "high",
    metrics,
    relatedAnnouncementIds: [...new Set(relatedIds)],
    relatedFinancialPeriod:
      "periodicReportEvent" in item ? item.periodicReportEvent?.linkedFinancialReportPeriod ?? null : null,
    reviewStatus: reviewReasons.length > 0 ? "pending" : "not_required",
    reviewReasons,
    isRestated: "isCorrection" in item ? item.isCorrection : item.category === "performance_forecast_revision",
    updatedAt: "sourceUpdatedAt" in item ? item.sourceUpdatedAt ?? item.fetchedAt : stock.aShareAnnouncementSummary?.fetchedAt ?? null,
  };
}

export function financialReportToResearchEvent(stock: Stock, report: FinancialReport): ResearchEvent {
  const metrics = financialReportMetrics(report);
  const reviewReasons: string[] = [];
  if (report.status !== "success") reviewReasons.push(`财务记录状态为 ${report.status}`);
  if (metrics.some((item) => item.value === null)) reviewReasons.push("核心财务数据值缺失");
  if (!report.sourceUrl) reviewReasons.push("财务记录缺少可打开的来源链接");
  if (report.isRestated) reviewReasons.push("财务数据包含修正或重述");

  return {
    id: `financial:${stock.id}:${report.reportPeriod}`,
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "financial_update",
    eventDate: report.announcementDate,
    publishedAt: report.announcementDate,
    reportPeriod: report.reportPeriod,
    title: `${report.reportPeriod} 财务报告数据更新`,
    summary: report.singleQuarter
      ? "正式财务数据已加载；累计值与单季度值分开记录。"
      : "正式财务数据已加载；当前报告期暂无法可靠计算单季度值。",
    sourceType: "financial_report",
    sourceName: report.provider,
    sourceUrl: report.sourceUrl,
    pdfUrl: null,
    verificationStatus: report.status === "success" ? "verified" : "partial",
    parseStatus: "not_applicable",
    materiality: "high",
    metrics,
    relatedAnnouncementIds: [],
    relatedFinancialPeriod: report.reportPeriod,
    reviewStatus: reviewReasons.length > 0 ? "pending" : "not_required",
    reviewReasons,
    isRestated: report.isRestated,
    updatedAt: report.fetchedAt,
  };
}

export function financialSummaryToResearchEvent(stock: Stock, summary: AShareFinancialSummary): ResearchEvent {
  const reportPeriod = summary.latestReportPeriod;
  const metrics: ResearchEventMetric[] = [
    metric("singleQuarterOperatingRevenue", "单季度营业收入", summary.latestSingleQuarter.operatingRevenue, "CNY", "single_quarter", null, reportPeriod),
    metric("singleQuarterParentNetProfit", "单季度归母净利润", summary.latestSingleQuarter.netProfitAttributableToParent, "CNY", "single_quarter", null, reportPeriod),
    metric("singleQuarterDeductedNetProfit", "单季度扣非净利润", summary.latestSingleQuarter.netProfitExcludingNonRecurring, "CNY", "single_quarter", null, reportPeriod),
    metric("singleQuarterOperatingCashFlow", "单季度经营现金流", summary.latestSingleQuarter.netOperatingCashFlow, "CNY", "single_quarter", null, reportPeriod),
  ];
  const reviewReasons: string[] = [];
  if (summary.status !== "success") reviewReasons.push(`财务摘要状态为 ${summary.status}`);
  if (!reportPeriod) reviewReasons.push("财务报告期缺失");
  if (metrics.some((item) => item.value === null)) reviewReasons.push("核心财务数据值缺失");
  const sourceUrl = summary.quality.sourceUrl ?? null;
  if (!sourceUrl) reviewReasons.push("财务摘要缺少可打开的来源链接");

  return {
    id: `financial:${stock.id}:${reportPeriod ?? "missing"}`,
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "financial_update",
    eventDate: reportPeriod,
    publishedAt: summary.fetchedAt,
    reportPeriod,
    title: `${reportPeriod ?? "报告期缺失"} 财务摘要更新`,
    summary: "真实财务摘要已提交；当前事件仅展示摘要中的最新单季度口径。",
    sourceType: "financial_report",
    sourceName: summary.provider,
    sourceUrl,
    pdfUrl: null,
    verificationStatus: financialVerificationStatus(summary.status),
    parseStatus: summary.status === "stale" ? "stale" : isFinancialError(summary.status) ? "error" : "not_applicable",
    materiality: "high",
    metrics,
    relatedAnnouncementIds: [],
    relatedFinancialPeriod: reportPeriod,
    reviewStatus: reviewReasons.length > 0 ? "pending" : "not_required",
    reviewReasons,
    isRestated: null,
    updatedAt: summary.fetchedAt,
  };
}

export function buildResearchEventsForStock(stock: Stock, input: StockEventInput = {}): ResearchEvent[] {
  if (stock.dataMode === "mock") return [];
  const events: ResearchEvent[] = [];

  if (input.financialData) {
    events.push(...input.financialData.reports.map((report) => financialReportToResearchEvent(stock, report)));
  } else if (stock.aShareFinancialSummary) {
    events.push(financialSummaryToResearchEvent(stock, stock.aShareFinancialSummary));
  } else if (stock.market === "A股") {
    events.push(dataWarning(stock, "financial-missing", "财务数据缺失", "未找到已提交的 A 股财务摘要。", "missing", "missing", ["财务摘要缺失"]));
  }

  if (input.announcementData) {
    events.push(...input.announcementData.announcements.filter((item) => !item.isDuplicate).map((item) => announcementToResearchEvent(stock, item)));
  } else if (stock.aShareAnnouncementSummary) {
    const previews = [...stock.aShareAnnouncementSummary.recentAnnouncements];
    const latest = stock.aShareAnnouncementSummary.latestPerformanceAnnouncement;
    if (latest && !previews.some((item) => item.announcementId === latest.announcementId)) previews.push(latest);
    events.push(...previews.map((item) => announcementToResearchEvent(stock, item)));
    if (stock.aShareAnnouncementSummary.status !== "success") {
      events.push(providerStatusWarning(stock, "announcements", stock.aShareAnnouncementSummary.status, stock.aShareAnnouncementSummary.currentFetchError));
    }
  } else if (stock.market === "A股") {
    events.push(dataWarning(stock, "announcement-missing", "公告数据缺失", "未找到已提交的 A 股公告摘要。", "missing", "missing", ["公告摘要缺失"]));
  }

  if (stock.aShareFinancialSummary && stock.aShareFinancialSummary.status !== "success") {
    events.push(providerStatusWarning(stock, "financials", stock.aShareFinancialSummary.status, stock.aShareFinancialSummary.currentFetchError));
  }
  if (input.financialLoadError) {
    events.push(dataWarning(stock, "financial-load-error", "财务详情加载失败", input.financialLoadError, "error", "error", ["财务详情加载失败"]));
  }
  if (input.announcementLoadError) {
    events.push(dataWarning(stock, "announcement-load-error", "公告详情加载失败", input.announcementLoadError, "error", "error", ["公告详情加载失败"]));
  }

  return associateResearchEvents(deduplicateResearchEvents(events));
}

export function buildResearchEventSnapshot(stocks: Stock[], now: Date = new Date()): ResearchEventSnapshot {
  const events = sortResearchEvents(deduplicateResearchEvents(stocks.flatMap((stock) => buildResearchEventsForStock(stock))));
  const associated = associateResearchEvents(events);
  return {
    events: associated,
    chains: buildEarningsVerificationChains(associated),
    generatedAt: now.toISOString(),
  };
}

export async function loadStockResearchEventSnapshot(
  stock: Stock,
  loaders: ResearchEventLoaders = { financial: loadAShareFinancial, announcements: loadAShareAnnouncements },
): Promise<ResearchEventSnapshot> {
  if (stock.dataMode === "mock" || stock.market !== "A股") return buildResearchEventSnapshot([stock]);
  const financialPromise = stock.aShareFinancialSummary?.detailPath ? loaders.financial(stock.id) : Promise.resolve(null);
  const announcementPromise = stock.aShareAnnouncementSummary?.detailPath ? loaders.announcements(stock.id) : Promise.resolve(null);
  const [financialResult, announcementResult] = await Promise.allSettled([financialPromise, announcementPromise]);
  const events = buildResearchEventsForStock(stock, {
    financialData: financialResult.status === "fulfilled" ? financialResult.value : null,
    announcementData: announcementResult.status === "fulfilled" ? announcementResult.value : null,
    financialLoadError: financialResult.status === "rejected" ? errorMessage(financialResult.reason) : null,
    announcementLoadError: announcementResult.status === "rejected" ? errorMessage(announcementResult.reason) : null,
  });
  return { events: sortResearchEvents(events), chains: buildEarningsVerificationChains(events), generatedAt: new Date().toISOString() };
}

export function deduplicateResearchEvents(events: ResearchEvent[]): ResearchEvent[] {
  const selected = new Map<string, ResearchEvent>();
  for (const event of events) {
    const key = eventDeduplicationKey(event);
    const current = selected.get(key);
    if (!current) {
      selected.set(key, event);
      continue;
    }
    const preferred = eventRichness(event) > eventRichness(current) ? event : current;
    const secondary = preferred === event ? current : event;
    selected.set(key, {
      ...preferred,
      relatedAnnouncementIds: [...new Set([...preferred.relatedAnnouncementIds, ...secondary.relatedAnnouncementIds])],
      reviewReasons: [...new Set([...preferred.reviewReasons, ...secondary.reviewReasons])],
      reviewStatus: preferred.reviewStatus === "pending" || secondary.reviewStatus === "pending" ? "pending" : preferred.reviewStatus,
    });
  }
  return [...selected.values()];
}

export function sortResearchEvents(events: ResearchEvent[]): ResearchEvent[] {
  return [...events].sort((left, right) => {
    const byDate = comparableDate(right) - comparableDate(left);
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  });
}

export function associateResearchEvents(events: ResearchEvent[]): ResearchEvent[] {
  const grouped = new Map<string, ResearchEvent[]>();
  for (const event of events) {
    if (!event.reportPeriod) continue;
    const key = `${event.stockId}:${event.reportPeriod}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return events.map((event) => {
    if (!event.reportPeriod) return event;
    const related = grouped.get(`${event.stockId}:${event.reportPeriod}`) ?? [];
    const relatedAnnouncementIds = [...new Set(related.flatMap((item) => item.relatedAnnouncementIds))];
    const hasFinancial = related.some((item) => item.eventType === "financial_update");
    return {
      ...event,
      relatedAnnouncementIds,
      relatedFinancialPeriod: hasFinancial ? event.reportPeriod : event.relatedFinancialPeriod,
      reviewReasons: event.eventType === "periodic_report" && !hasFinancial
        ? [...new Set([...event.reviewReasons, "公告与财务报告期无法匹配"])]
        : event.reviewReasons,
      reviewStatus: event.eventType === "periodic_report" && !hasFinancial ? "pending" : event.reviewStatus,
    };
  });
}

export function buildEarningsVerificationChains(events: ResearchEvent[]): EarningsVerificationChain[] {
  const grouped = new Map<string, ResearchEvent[]>();
  for (const event of events) {
    if (!event.reportPeriod || !PERFORMANCE_EVENT_TYPES.includes(event.eventType)) continue;
    const key = `${event.stockId}:${event.reportPeriod}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return [...grouped.entries()].map(([id, group]) => {
    const preview = sortResearchEvents(group.filter((event) => event.eventType === "earnings_preview"));
    const revision = sortResearchEvents(group.filter((event) => event.eventType === "earnings_preview_revision"));
    const flash = sortResearchEvents(group.filter((event) => event.eventType === "earnings_flash"));
    const formal = sortResearchEvents(group.filter((event) => event.eventType === "periodic_report"));
    const financialUpdates = sortResearchEvents(group.filter((event) => event.eventType === "financial_update"));
    const representative = group[0];
    const missingStages = (Object.keys(STAGE_LABELS) as EarningsVerificationStage[]).filter((stage) => {
      if (stage === "preview") return preview.length === 0;
      if (stage === "revision") return revision.length === 0;
      if (stage === "flash") return flash.length === 0;
      return formal.length === 0;
    });
    const differences = buildVerificationDifferences(preview, revision, flash, financialUpdates);
    return {
      id,
      stockId: representative.stockId,
      stockName: representative.stockName,
      stockCode: representative.stockCode,
      reportPeriod: representative.reportPeriod as string,
      preview,
      revision,
      flash,
      formal,
      financialUpdates,
      missingStages,
      differences,
      hasMaterialDifference: differences.some((item) => item.relativeDifference !== null && Math.abs(item.relativeDifference) >= 0.1),
      needsReview: group.some((event) => event.reviewStatus === "pending"),
    };
  }).sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || left.stockId.localeCompare(right.stockId));
}

export function buildWatchlistEventHints(item: WatchlistItem, stockEvents: ResearchEvent[], now: Date = new Date()): string[] {
  const hints: string[] = [];
  const today = dateOnly(now);
  if (item.nextReviewDate <= today) hints.push(item.nextReviewDate < today ? "复盘日期已逾期" : "复盘日期已到");
  const performanceEvents = stockEvents.filter((event) => ["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report"].includes(event.eventType));
  if (performanceEvents.some((event) => (event.eventDate ?? "") >= item.nextReviewDate)) hints.push("复盘节点后发布了新的业绩公告");
  if (stockEvents.some((event) => event.eventType === "financial_update" && (event.updatedAt ?? event.eventDate ?? "") >= item.nextReviewDate)) {
    hints.push("原有验证指标出现新的财务数据");
  }
  if (stockEvents.some((event) => event.parseStatus === "metadata_only" || event.parseStatus === "parse_partial")) {
    hints.push("公告解析不完整，需要人工核验");
  }
  const chains = buildEarningsVerificationChains(stockEvents);
  if (chains.some((chain) => chain.hasMaterialDifference)) hints.push("业绩预告、快报或正式报告之间存在超过 10% 的数值差异");
  return [...new Set(hints)];
}

export function eventTypeLabel(eventType: ResearchEventType) {
  return ({
    earnings_preview: "业绩预告",
    earnings_preview_revision: "预告修正",
    earnings_flash: "业绩快报",
    periodic_report: "正式报告",
    financial_update: "财务更新",
    announcement: "公告",
    data_warning: "数据警告",
  } as Record<ResearchEventType, string>)[eventType];
}

export function stageLabel(stage: EarningsVerificationStage) {
  return STAGE_LABELS[stage];
}

function announcementCategoryToEventType(category: AnnouncementLike["category"]): ResearchEventType {
  if (category === "performance_forecast") return "earnings_preview";
  if (category === "performance_forecast_revision") return "earnings_preview_revision";
  if (category === "performance_express") return "earnings_flash";
  if (["annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"].includes(category)) return "periodic_report";
  return "announcement";
}

function announcementPublishedAt(item: AnnouncementLike) {
  if (!item.announcementDate) return null;
  if ("announcementTime" in item && item.announcementTime) return `${item.announcementDate}T${item.announcementTime}`;
  return item.announcementDate;
}

function forecastPeriod(item: AnnouncementLike) {
  return item.performanceForecastEvents?.find((event) => event.forecastPeriod)?.forecastPeriod ?? item.performanceExpressEvent?.reportPeriod ?? null;
}

function announcementSummary(item: AnnouncementLike, parseStatus: ResearchParseStatus) {
  if (item.reasonSummary) return item.reasonSummary;
  if (parseStatus === "metadata_only") return "公告元数据和官方链接已获取，正文未结构化。";
  if (parseStatus === "parse_partial") return "公告正文仅部分解析，结构化指标需人工核验。";
  if (parseStatus === "parse_unavailable") return "公告正文当前无法解析，请打开官方来源人工核验。";
  if (item.performanceForecastEvents?.length) return "业绩预告区间已从正式公告规则提取。";
  if (item.performanceExpressEvent) return "业绩快报指标已从正式公告规则提取。";
  return "公告信息已从正式披露记录转换为投研事件。";
}

function announcementMetrics(item: AnnouncementLike, announcementId: string, reportPeriod: string | null): ResearchEventMetric[] {
  const metrics: ResearchEventMetric[] = [];
  const seen = new Set<string>();
  for (const forecast of item.performanceForecastEvents ?? []) {
    const prefix = forecast.profitMetric;
    const values: Array<[string, string, number | null, "CNY" | "percent"]> = [
      [`${prefix}ForecastLower`, `${profitMetricLabel(prefix)}预告下限`, forecast.lowerBound, "CNY"],
      [`${prefix}ForecastUpper`, `${profitMetricLabel(prefix)}预告上限`, forecast.upperBound, "CNY"],
      [`${prefix}ForecastMidpoint`, `${profitMetricLabel(prefix)}预告中值`, forecast.derivedMidpoint, "CNY"],
      [`${prefix}ChangeLower`, `${profitMetricLabel(prefix)}同比下限`, forecast.changeLowerPercent, "percent"],
      [`${prefix}ChangeUpper`, `${profitMetricLabel(prefix)}同比上限`, forecast.changeUpperPercent, "percent"],
    ];
    for (const [key, label, value, unit] of values) {
      if (seen.has(key)) continue;
      seen.add(key);
      metrics.push(metric(key, label, value, unit, "range", announcementId, reportPeriod));
    }
  }
  const express = item.performanceExpressEvent;
  if (express) {
    metrics.push(
      metric("operatingRevenue", "营业收入", express.operatingRevenue, "CNY", "cumulative", announcementId, reportPeriod),
      metric("netProfitAttributableToParent", "归母净利润", express.netProfitAttributableToParent, "CNY", "cumulative", announcementId, reportPeriod),
      metric("netProfitExcludingNonRecurring", "扣非净利润", express.netProfitExcludingNonRecurring, "CNY", "cumulative", announcementId, reportPeriod),
      metric("revenueYoY", "营业收入同比", express.revenueYoY, "percent", "cumulative", announcementId, reportPeriod),
      metric("parentNetProfitYoY", "归母净利润同比", express.parentNetProfitYoY, "percent", "cumulative", announcementId, reportPeriod),
    );
  }
  return metrics;
}

function financialReportMetrics(report: FinancialReport): ResearchEventMetric[] {
  const period = report.reportPeriod;
  const metrics = [
    metric("operatingRevenue", "累计营业收入", report.cumulative.operatingRevenue, "CNY", "cumulative", null, period),
    metric("netProfitAttributableToParent", "累计归母净利润", report.cumulative.netProfitAttributableToParent, "CNY", "cumulative", null, period),
    metric("netProfitExcludingNonRecurring", "累计扣非净利润", report.cumulative.netProfitExcludingNonRecurring, "CNY", "cumulative", null, period),
    metric("netOperatingCashFlow", "累计经营现金流", report.cumulative.netOperatingCashFlow, "CNY", "cumulative", null, period),
  ];
  if (report.singleQuarter) {
    metrics.push(
      metric("singleQuarterOperatingRevenue", "单季度营业收入", report.singleQuarter.operatingRevenue, "CNY", "single_quarter", null, period),
      metric("singleQuarterParentNetProfit", "单季度归母净利润", report.singleQuarter.netProfitAttributableToParent, "CNY", "single_quarter", null, period),
      metric("singleQuarterDeductedNetProfit", "单季度扣非净利润", report.singleQuarter.netProfitExcludingNonRecurring, "CNY", "single_quarter", null, period),
      metric("singleQuarterOperatingCashFlow", "单季度经营现金流", report.singleQuarter.netOperatingCashFlow, "CNY", "single_quarter", null, period),
    );
  }
  return metrics;
}

function eventReviewReasons(eventType: ResearchEventType, parseStatus: ResearchParseStatus, metrics: ResearchEventMetric[], reportPeriod: string | null) {
  const reasons: string[] = [];
  if (parseStatus === "metadata_only") reasons.push("公告仅有元数据，需要人工核验正文");
  if (parseStatus === "parse_partial") reasons.push("公告正文仅部分解析");
  if (parseStatus === "parse_unavailable") reasons.push("公告正文无法解析");
  if (PERFORMANCE_EVENT_TYPES.includes(eventType) && !reportPeriod) reasons.push("公告报告期缺失");
  if (["earnings_preview", "earnings_preview_revision", "earnings_flash"].includes(eventType) && (metrics.length === 0 || metrics.every((item) => item.value === null))) {
    reasons.push("业绩事件缺少可用结构化数值");
  }
  return reasons;
}

function announcementVerificationStatus(parseStatus: ResearchParseStatus, status: "success" | "partial"): ResearchVerificationStatus {
  if (parseStatus === "metadata_only") return "metadata_only";
  if (parseStatus === "parse_partial" || parseStatus === "parse_unavailable" || status === "partial") return "partial";
  return "verified";
}

function financialVerificationStatus(status: AShareFinancialSummary["status"]): ResearchVerificationStatus {
  if (status === "success" || status === "not_applicable") return "verified";
  if (status === "partial") return "partial";
  if (status === "stale") return "stale";
  if (status === "source_unavailable") return "missing";
  return "error";
}

function isFinancialError(status: AShareFinancialSummary["status"]) {
  return ["fetch_error", "validation_error", "source_unavailable"].includes(status);
}

function providerStatusWarning(stock: Stock, providerKind: "financials" | "announcements", status: string, error: string | null) {
  const verificationStatus: ResearchVerificationStatus = status === "stale" ? "stale" : status === "source_unavailable" || status === "empty" ? "missing" : status === "partial" ? "partial" : "error";
  const parseStatus: ResearchParseStatus = status === "stale" ? "stale" : verificationStatus === "missing" ? "missing" : verificationStatus === "partial" ? "parse_partial" : "error";
  const label = providerKind === "financials" ? "财务" : "公告";
  return dataWarning(stock, `${providerKind}-${status}`, `${label}数据状态：${status}`, error ?? `${label} Provider 当前状态为 ${status}。`, verificationStatus, parseStatus, [`${label} Provider 状态不是 success`]);
}

function dataWarning(
  stock: Stock,
  suffix: string,
  title: string,
  summary: string,
  verificationStatus: ResearchVerificationStatus,
  parseStatus: ResearchParseStatus,
  reviewReasons: string[],
): ResearchEvent {
  return {
    id: `warning:${stock.id}:${suffix}`,
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "data_warning",
    eventDate: null,
    publishedAt: null,
    reportPeriod: null,
    title,
    summary,
    sourceType: "provider_status",
    sourceName: "Research Event Provider",
    sourceUrl: null,
    pdfUrl: null,
    verificationStatus,
    parseStatus,
    materiality: "high",
    metrics: [],
    relatedAnnouncementIds: [],
    relatedFinancialPeriod: null,
    reviewStatus: "pending",
    reviewReasons,
    isRestated: null,
    updatedAt: null,
  };
}

function eventDeduplicationKey(event: ResearchEvent) {
  if (event.eventType === "periodic_report" && event.reportPeriod) return `${event.stockId}:periodic:${event.reportPeriod}:${event.eventDate ?? "missing"}`;
  if (event.eventType === "financial_update") return `${event.stockId}:financial:${event.reportPeriod ?? "missing"}`;
  if (event.relatedAnnouncementIds[0]) return `${event.stockId}:announcement:${event.relatedAnnouncementIds[0]}`;
  return `${event.stockId}:${event.eventType}:${event.reportPeriod ?? "missing"}:${event.eventDate ?? "missing"}:${event.title}`;
}

function eventRichness(event: ResearchEvent) {
  const parseScore = ({ parse_success: 4, parse_partial: 3, metadata_only: 2, parse_unavailable: 1, not_applicable: 2, missing: 0, stale: 0, error: 0 } as Record<ResearchParseStatus, number>)[event.parseStatus];
  const fullReportBonus = event.eventType === "periodic_report" && !event.title.includes("摘要") ? 3 : 0;
  return parseScore * 10 + event.metrics.filter((item) => item.value !== null).length + fullReportBonus;
}

function comparableDate(event: ResearchEvent) {
  const value = event.publishedAt ?? event.eventDate ?? event.updatedAt;
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function buildVerificationDifferences(
  preview: ResearchEvent[],
  revision: ResearchEvent[],
  flash: ResearchEvent[],
  financial: ResearchEvent[],
): EarningsVerificationDifference[] {
  const latestPreview = revision[0] ?? preview[0];
  const latestFlash = flash[0];
  const latestFormal = financial[0];
  const differences: EarningsVerificationDifference[] = [];
  const previewValue = latestPreview ? metricValue(latestPreview, "netProfitAttributableToParentForecastMidpoint") : null;
  const flashValue = latestFlash ? metricValue(latestFlash, "netProfitAttributableToParent") : null;
  const formalValue = latestFormal ? metricValue(latestFormal, "netProfitAttributableToParent") : null;
  if (previewValue !== null && flashValue !== null) differences.push(difference("preview", "flash", previewValue, flashValue));
  if (flashValue !== null && formalValue !== null) differences.push(difference("flash", "formal", flashValue, formalValue));
  else if (previewValue !== null && formalValue !== null) differences.push(difference("preview", "formal", previewValue, formalValue));
  return differences;
}

function difference(from: "preview" | "flash", to: "flash" | "formal", fromValue: number, toValue: number): EarningsVerificationDifference {
  return {
    from,
    to,
    metricKey: "netProfitAttributableToParent",
    metricLabel: "归母净利润",
    fromValue,
    toValue,
    absoluteDifference: toValue - fromValue,
    relativeDifference: fromValue === 0 ? null : (toValue - fromValue) / Math.abs(fromValue),
  };
}

function metricValue(event: ResearchEvent, key: string) {
  return event.metrics.find((item) => item.key === key)?.value ?? null;
}

function metric(
  key: string,
  label: string,
  value: number | null | undefined,
  unit: ResearchEventMetric["unit"],
  periodBasis: ResearchEventMetric["periodBasis"],
  sourceAnnouncementId: string | null,
  sourceFinancialPeriod: string | null,
): ResearchEventMetric {
  return { key, label, value: value === undefined ? null : value, unit, periodBasis, sourceAnnouncementId, sourceFinancialPeriod };
}

function profitMetricLabel(metricKey: string) {
  return ({
    netProfitAttributableToParent: "归母净利润",
    netProfitExcludingNonRecurring: "扣非净利润",
    netProfit: "净利润",
    operatingRevenue: "营业收入",
  } as Record<string, string>)[metricKey] ?? "其他指标";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知加载错误";
}

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
