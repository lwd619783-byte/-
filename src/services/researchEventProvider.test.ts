import { describe, expect, it, vi } from "vitest";
import type { AShareAnnouncementDetailItem, AShareFinancialSummary, FinancialReport, ResearchEvent, Stock } from "../types";
import {
  announcementToResearchEvent,
  associateResearchEvents,
  buildEarningsVerificationChains,
  buildResearchEventSnapshot,
  buildResearchEventsForStock,
  deduplicateResearchEvents,
  financialReportToResearchEvent,
  financialSummaryToResearchEvent,
  loadStockResearchEventSnapshot,
  sortResearchEvents,
} from "./researchEventProvider";
import { buildDashboardDataset } from "./dataProvider";

const stock = {
  id: "demo",
  name: "测试公司",
  code: "300001.SZ",
  market: "A股",
  industryId: "technology",
  dataMode: "mixed",
  financial: { revenue: "999 亿元", netProfit: "99 亿元" },
} as Stock;

function announcement(overrides: Partial<AShareAnnouncementDetailItem> = {}) {
  return {
    announcementId: "ann-1",
    stockId: "demo",
    stockCode: "300001",
    companyName: "测试公司",
    market: "A股",
    title: "2025 年度业绩预告",
    category: "performance_forecast",
    announcementDate: "2026-01-20",
    announcementTime: "18:00:00",
    reportPeriod: "2025-12-31",
    sourceProvider: "CNInfo",
    officialUrl: "https://example.com/announcement",
    pdfUrl: "https://example.com/announcement.pdf",
    fetchedAt: "2026-01-20T12:00:00Z",
    sourceUpdatedAt: "2026-01-20",
    status: "success",
    parseStatus: "parse_success",
    isCorrection: false,
    correctedAnnouncementId: null,
    isDuplicate: false,
    performanceForecastEvents: [{
      forecastPeriod: "2025-12-31",
      profitMetric: "netProfitAttributableToParent",
      lowerBound: 90,
      upperBound: 110,
      derivedMidpoint: 100,
      changeLowerPercent: 0.1,
      changeUpperPercent: 0.2,
      previousForecastAnnouncementId: null,
    }],
    performanceExpressEvent: null,
    periodicReportEvent: null,
    reasonSummary: null,
    ...overrides,
  } as AShareAnnouncementDetailItem;
}

function report(overrides: Partial<FinancialReport> = {}) {
  return {
    stockCode: "300001",
    companyName: "测试公司",
    reportPeriod: "2025-12-31",
    reportType: "FY",
    fiscalYear: 2025,
    fiscalQuarter: 4,
    announcementDate: "2026-03-30",
    provider: "Official finance provider",
    providerVersion: "1",
    sourceDescription: "official source",
    sourceUrl: "https://example.com/financial",
    sourceIdentifier: "demo-2025",
    fetchedAt: "2026-03-30T12:00:00Z",
    sourceUpdatedAt: "2026-03-30",
    generatedAt: "2026-03-30T12:00:00Z",
    status: "success",
    isRestated: false,
    singleQuarter: { operatingRevenue: 40, netProfitAttributableToParent: 30, netProfitExcludingNonRecurring: 28, netOperatingCashFlow: 35 },
    cumulative: { operatingRevenue: 400, netProfitAttributableToParent: 110, netProfitExcludingNonRecurring: 100, netOperatingCashFlow: 120 },
    derived: {},
    fieldStatus: {},
    balanceSheet: {},
    ...overrides,
  } as FinancialReport;
}

function summary(overrides: Partial<AShareFinancialSummary> = {}) {
  return {
    id: "demo",
    stockCode: "300001",
    companyName: "测试公司",
    market: "SZ",
    industryType: "general",
    status: "success",
    provider: "Official finance provider",
    fetchedAt: "2026-03-30T12:00:00Z",
    latestReportPeriod: "2025-12-31",
    latestSingleQuarter: { operatingRevenue: 40, netProfitAttributableToParent: 30, netProfitExcludingNonRecurring: 28, netOperatingCashFlow: 35 },
    latestChanges: {},
    latestRatios: {},
    latestBalanceSheet: {},
    fieldStatus: {},
    quality: { source: "official", status: "real", sourceUrl: "https://example.com/financial" },
    ...overrides,
  } as AShareFinancialSummary;
}

describe("research event provider", () => {
  it("converts a real announcement into a traceable ResearchEvent", () => {
    const event = announcementToResearchEvent(stock, announcement());
    expect(event).toMatchObject({
      id: "announcement:demo:ann-1",
      eventType: "earnings_preview",
      reportPeriod: "2025-12-31",
      parseStatus: "parse_success",
      verificationStatus: "verified",
      sourceUrl: "https://example.com/announcement",
    });
    expect(event.metrics.find((metric) => metric.key === "netProfitAttributableToParentForecastMidpoint")?.value).toBe(100);
    expect(event.performanceDisclosureScope).toBe("listed_metrics");
  });

  it("associates periodic announcements with the exact financial report period", () => {
    const periodic = announcementToResearchEvent(stock, announcement({
      announcementId: "annual-1",
      title: "2025 年年度报告",
      category: "annual_report",
      performanceForecastEvents: [],
      periodicReportEvent: { reportPeriod: "2025-12-31", reportType: "FY", summaryUrl: null, linkedFinancialReportPeriod: "2025-12-31", linkedFinancialStatus: "matched", linkedFinancialGeneratedAt: "2026-03-30" },
    }));
    const financial = financialReportToResearchEvent(stock, report());
    const associated = associateResearchEvents([periodic, financial]);
    expect(associated[0].relatedFinancialPeriod).toBe("2025-12-31");
    expect(associated[1].relatedAnnouncementIds).toContain("annual-1");
  });

  it("builds preview-revision-flash-formal chains and marks only observed gaps", () => {
    const preview = announcementToResearchEvent(stock, announcement());
    const revision = announcementToResearchEvent(stock, announcement({ announcementId: "ann-revision", category: "performance_forecast_revision", title: "预告修正" }));
    const flash = announcementToResearchEvent(stock, announcement({
      announcementId: "ann-flash",
      category: "performance_express",
      title: "2025 年业绩快报",
      performanceForecastEvents: [],
      performanceExpressEvent: { reportPeriod: "2025-12-31", operatingRevenue: 400, netProfitAttributableToParent: 120, netProfitExcludingNonRecurring: 108, revenueYoY: 0.2, parentNetProfitYoY: 0.3 } as never,
    }));
    const formal = announcementToResearchEvent(stock, announcement({ announcementId: "annual", category: "annual_report", title: "2025 年年度报告", performanceForecastEvents: [] }));
    const financial = financialReportToResearchEvent(stock, report());
    const chain = buildEarningsVerificationChains([preview, revision, flash, formal, financial])[0];
    expect(chain.missingStages).toEqual([]);
    expect(chain.differences).toHaveLength(2);
    expect(chain.hasMaterialDifference).toBe(true);
  });

  it("deduplicates periodic report summaries, prefers the full report, and sorts newest first", () => {
    const full = announcementToResearchEvent(stock, announcement({ announcementId: "full", category: "annual_report", title: "2025 年年度报告", performanceForecastEvents: [] }));
    const reportSummary = announcementToResearchEvent(stock, announcement({ announcementId: "summary", category: "periodic_report_summary", title: "2025 年年度报告摘要", performanceForecastEvents: [] }));
    const older = { ...full, id: "older", eventDate: "2025-01-01", publishedAt: "2025-01-01", reportPeriod: "2024-12-31" };
    const result = sortResearchEvents(deduplicateResearchEvents([reportSummary, older, full]));
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("2025 年年度报告");
    expect(result[0].relatedAnnouncementIds).toEqual(expect.arrayContaining(["full", "summary"]));
  });

  it("preserves metadata_only and parse_partial instead of reporting success", () => {
    const metadata = announcementToResearchEvent(stock, announcement({ parseStatus: "metadata_only", performanceForecastEvents: [] }));
    const partial = announcementToResearchEvent(stock, announcement({ announcementId: "partial", parseStatus: "parse_partial", status: "partial" }));
    expect(metadata.verificationStatus).toBe("metadata_only");
    expect(metadata.reviewStatus).toBe("pending");
    expect(partial.verificationStatus).toBe("partial");
    expect(partial.reviewReasons.join(" ")).toContain("部分解析");
    expect(metadata.performanceDisclosureScope).toBe("unknown");
  });

  it("marks formal disclosures independently from local parsing and local summary refreshes", () => {
    const metadataFormal = announcementToResearchEvent(stock, announcement({ category: "annual_report", parseStatus: "metadata_only", performanceForecastEvents: [], periodicReportEvent: null }));
    const partialFlash = announcementToResearchEvent(stock, announcement({ category: "performance_express", parseStatus: "parse_partial", status: "partial", performanceForecastEvents: [], performanceExpressEvent: null }));
    expect(metadataFormal.performanceDisclosureScope).toBe("all_metrics");
    expect(partialFlash.performanceDisclosureScope).toBe("all_metrics");
    expect(financialReportToResearchEvent(stock, report()).performanceDisclosureScope).toBe("all_metrics");
    expect(financialSummaryToResearchEvent(stock, summary()).performanceDisclosureScope).toBe("none");
  });

  it("keeps missing financial values null and never converts them to zero", () => {
    const event = financialReportToResearchEvent(stock, report({ cumulative: { operatingRevenue: null, netProfitAttributableToParent: null, netProfitExcludingNonRecurring: null, netOperatingCashFlow: null } as never }));
    expect(event.metrics.map((metric) => metric.value)).toEqual([null, null, null, null, 40, 30, 28, 35]);
    expect(event.metrics.some((metric) => metric.value === 0)).toBe(false);
  });

  it("does not use mock financial or announcement values in Real or Mixed modes", async () => {
    const missingRealStock = { ...stock, dataMode: "real", aShareFinancialSummary: undefined, aShareAnnouncementSummary: undefined } as Stock;
    const events = buildResearchEventsForStock(missingRealStock);
    expect(events.every((event) => event.eventType === "data_warning")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("999 亿元");

    const mockStock = { ...stock, dataMode: "mock" } as Stock;
    const financialLoader = vi.fn();
    const announcementLoader = vi.fn();
    const snapshot = await loadStockResearchEventSnapshot(mockStock, { financial: financialLoader, announcements: announcementLoader });
    expect(snapshot.events).toEqual([]);
    expect(financialLoader).not.toHaveBeenCalled();
    expect(announcementLoader).not.toHaveBeenCalled();
  });

  it("requires provenance for every displayed financial number and avoids prohibited generated judgments", () => {
    const events: ResearchEvent[] = [financialSummaryToResearchEvent(stock, summary()), announcementToResearchEvent(stock, announcement())];
    for (const event of events) {
      if (event.metrics.some((metric) => metric.value !== null)) {
        expect(event.sourceUrl ?? event.pdfUrl).toBeTruthy();
        expect(event.sourceName).toBeTruthy();
      }
    }
    const output = JSON.stringify(events);
    expect(output).not.toContain("超机构预期");
    expect(output).not.toContain("低于一致预期");
  });

  it("builds a traceable snapshot from the committed real summaries", () => {
    const dataset = buildDashboardDataset("mixed");
    const snapshot = buildResearchEventSnapshot(dataset.stocks, new Date("2026-07-13T00:00:00Z"));
    expect(snapshot.events.length).toBeGreaterThan(0);
    expect(snapshot.events.some((event) => event.parseStatus === "metadata_only")).toBe(true);
    for (const event of snapshot.events) {
      if (event.metrics.some((metric) => metric.value !== null)) expect(event.sourceUrl ?? event.pdfUrl).toBeTruthy();
    }
  });
});
