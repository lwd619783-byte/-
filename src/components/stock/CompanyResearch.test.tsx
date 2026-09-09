// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { industries } from "../../data/industries";
import { stocks } from "../../data/stocks";
import { buildDashboardDataset } from "../../services/dataProvider";
import { loadAShareFinancial } from "../../services/aShareFinancialLoader";
import { loadAShareAnnouncements } from "../../services/aShareAnnouncementLoader";
import type { AShareFinancialData, AShareAnnouncementData, Stock } from "../../types";
import { StockDetailDrawer } from "./StockDetailDrawer";
import { StockPriceHistoryChart } from "./StockPriceHistoryChart";

vi.mock("../../services/aShareFinancialLoader", () => ({ loadAShareFinancial: vi.fn() }));
vi.mock("../../services/aShareAnnouncementLoader", () => ({ loadAShareAnnouncements: vi.fn() }));
// Charts are tested through their accessible original-data tables; layout is a browser gate.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const realStocks = buildDashboardDataset("real").stocks.filter((stock) => stock.aShareFinancialSummary && stock.aShareAnnouncementSummary);
const baseProps = { stocks, industries, onClose: vi.fn(), presentation: "page" as const };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function financial(stock: Stock): AShareFinancialData {
  const summary = stock.aShareFinancialSummary!;
  const metrics = { operatingRevenue: 123, operatingCost: null, operatingProfit: null, totalProfit: null, netProfit: null, netProfitAttributableToParent: 12, netProfitExcludingNonRecurring: null, researchAndDevelopmentExpense: null, sellingExpense: null, administrativeExpense: null, financialExpense: null, netOperatingCashFlow: null, cashReceivedFromSales: null, cashPaidForGoodsAndServices: null, capitalExpenditure: null, netInvestingCashFlow: null, netFinancingCashFlow: null };
  return { ...summary, schemaVersion: "1.0.0", reports: [{
    stockCode: stock.code, market: summary.market, companyName: stock.name, reportPeriod: summary.latestReportPeriod!, reportType: "Q1", fiscalYear: 2026, fiscalQuarter: 1,
    announcementDate: null, statementScope: "consolidated", currency: "CNY", unit: "yuan", sourceUnit: "元", normalizedUnit: "元", normalizationFactor: 1,
    status: "partial", errorCode: null, errorMessage: null, isRestated: null, isDerived: false, derivationMethod: null, sourcePeriods: [], rawFieldCoverage: { available: 2, total: 17 }, coreFieldCoverage: { available: 2, total: 17 }, fieldStatus: {},
    cumulative: metrics, singleQuarter: metrics, balanceSheet: { totalAssets: null, totalLiabilities: null, equityAttributableToParent: null, cashAndCashEquivalents: null, accountsReceivable: null, notesReceivable: null, contractAssets: null, inventory: null, accountsPayable: null, contractLiabilities: null, shortTermBorrowings: null, longTermBorrowings: null, goodwill: null },
    derived: { ...summary.latestChanges, ...summary.latestRatios, operatingCashFlowToNetProfit: null, receivablesToRevenue: null, inventoryToRevenue: null }, auditStatus: null,
    provider: "synthetic UI fixture", providerVersion: "test", sourceDescription: "synthetic UI fixture", sourceUrl: "", sourceIdentifier: "synthetic", fetchedAt: summary.fetchedAt, sourceUpdatedAt: null, generatedAt: summary.generatedAt,
  }] };
}
function announcements(stock: Stock): AShareAnnouncementData {
  const summary = stock.aShareAnnouncementSummary!;
  return { ...summary, schemaVersion: "1.0.0", dateRange: { start: "2026-01-01", end: "2026-01-02" }, announcements: [{
    schemaVersion: "1.0.0", announcementId: `synthetic-${stock.id}`, stockId: stock.id, stockCode: stock.code, companyName: stock.name, market: "A股", title: "当前公司合成公告", rawTitle: "当前公司合成公告", category: "other", subcategory: null, classificationConfidence: "low", classificationEvidence: [], announcementDate: "2026-01-02", announcementTime: null, reportPeriod: null, sourceProvider: "synthetic", sourceDescription: "synthetic UI fixture", officialUrl: null, pdfUrl: null, fetchedAt: summary.fetchedAt, sourceUpdatedAt: null, status: "partial", parseStatus: "metadata_only", parseErrorCode: null, parseErrorMessage: null, isCorrection: false, correctedAnnouncementId: null, isCancelled: false, isDuplicate: false, duplicateOf: null, supersededBy: null, performanceForecastEvents: [], performanceExpressEvent: null, periodicReportEvent: null, reasonSummary: null, reasonItems: [], announcementParsingResult: { status: "metadata_only", method: "synthetic", confidence: "low", evidenceCount: 0 },
  }] };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadAShareFinancial).mockImplementation(() => new Promise(() => undefined)); vi.mocked(loadAShareAnnouncements).mockImplementation(() => new Promise(() => undefined)); });
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

describe("complete company research navigation and identity", () => {
  it("reaches all five chapters, preserves original sections and never installs page modal behavior", () => {
    const close = vi.fn(); const add = vi.fn();
    render(<StockDetailDrawer {...baseProps} stock={{ ...stocks[0], dataMode: "mock" }} onClose={close} onAddToWatchlist={add} />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    fireEvent.keyDown(document, { key: "Escape" }); expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "加入观察清单" })); expect(add).toHaveBeenCalledWith(expect.objectContaining({ id: stocks[0].id }));
    const cases = [
      ["经营与财务", ["主营业务拆解", "F10 / 公司基础资料", "经营与财务快照"]],
      ["价格与估值", ["60 日价格走势", "估值快照", "信号雷达", "涨停价", "跌停价"]],
      ["预期与验证", ["业绩验证", "业绩预期"]],
      ["证据与复盘", ["观察清单与复盘", "研报", "公告与业绩动态", "来源与核验详细层"]],
      ["研究概览", ["公司研究摘要", "产业链位置与关联公司", "板块 / 概念", "研究定位与投资逻辑全文"]],
    ] as const;
    for (const [name, labels] of cases) { fireEvent.click(screen.getByRole("tab", { name })); const panel = screen.getByRole("tabpanel"); for (const label of labels) expect(panel.textContent).toContain(label); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(stocks[0].name); }
    expect(loadAShareFinancial).not.toHaveBeenCalled(); expect(loadAShareAnnouncements).not.toHaveBeenCalled();
  });

  it("supports controlled deep-link tabs and keyboard tab movement", () => {
    const changed = vi.fn(); const view = render(<StockDetailDrawer {...baseProps} stock={stocks[0]} activeTab="valuation" onTabChange={changed} />);
    const priceTab = screen.getByRole("tab", { name: "价格与估值" }); priceTab.focus(); fireEvent.keyDown(priceTab, { key: "ArrowRight" });
    expect(changed).toHaveBeenCalledWith("expectations");
    view.rerender(<StockDetailDrawer {...baseProps} stock={stocks[0]} activeTab="expectations" onTabChange={changed} />);
    expect(screen.getByRole("tab", { name: "预期与验证" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("company-tab-expectations");
  });

  it("isolates delayed financial and announcement responses after switching companies", async () => {
    const a = realStocks[0]; const b = realStocks[1];
    const oldFinancial = deferred<AShareFinancialData>(); const newFinancial = deferred<AShareFinancialData>();
    const oldAnnouncements = deferred<AShareAnnouncementData>(); const newAnnouncements = deferred<AShareAnnouncementData>();
    vi.mocked(loadAShareFinancial).mockImplementation((id) => id === a.id ? oldFinancial.promise : newFinancial.promise);
    vi.mocked(loadAShareAnnouncements).mockImplementation((id) => id === a.id ? oldAnnouncements.promise : newAnnouncements.promise);
    const view = render(<StockDetailDrawer {...baseProps} stock={a} activeTab="financials" />);
    view.rerender(<StockDetailDrawer {...baseProps} stock={b} activeTab="financials" />);
    const oldData = financial(a); oldData.reports[0].provider = "旧公司迟到财务标记";
    const oldNews = announcements(a); if (oldNews.announcements[0]) oldNews.announcements[0].title = "旧公司迟到公告标记";
    await act(async () => { oldFinancial.resolve(oldData); oldAnnouncements.resolve(oldNews); });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(b.name);
    expect(screen.queryByText("旧公司迟到财务标记", { exact: false })).toBeNull();
    expect(screen.getByRole("tabpanel").textContent).toContain("正在加载完整财务数据");
    await act(async () => { newFinancial.resolve(financial(b)); newAnnouncements.resolve(announcements(b)); });
    expect(screen.getByRole("tabpanel").textContent).toContain("完整财务数据已加载");
    view.rerender(<StockDetailDrawer {...baseProps} stock={b} activeTab="evidence" />);
    expect(screen.queryByText("旧公司迟到公告标记", { exact: false })).toBeNull();
    expect(screen.getByRole("tabpanel").textContent).toContain("完整公告数据已加载");
    expect(loadAShareFinancial).toHaveBeenCalledTimes(2); expect(loadAShareAnnouncements).toHaveBeenCalledTimes(2);
  });

  it("retains truthful summary fallback after detail errors and does not refetch on tab or theme changes", async () => {
    const stock = realStocks[0]; const financialRequest = deferred<AShareFinancialData>(); const announcementRequest = deferred<AShareAnnouncementData>();
    vi.mocked(loadAShareFinancial).mockReturnValue(financialRequest.promise); vi.mocked(loadAShareAnnouncements).mockReturnValue(announcementRequest.promise);
    const view = render(<StockDetailDrawer {...baseProps} stock={stock} activeTab="financials" />);
    await act(async () => { financialRequest.reject(new Error("fixture failure")); announcementRequest.reject(new Error("fixture failure")); });
    expect(screen.getByRole("tabpanel").textContent).toContain("完整财务数据加载失败（已保留真实摘要）");
    expect(screen.getByRole("tabpanel").textContent).toContain(stock.aShareFinancialSummary!.latestReportPeriod);
    for (const theme of ["light", "pro", "neon"]) { document.documentElement.dataset.theme = theme; view.rerender(<StockDetailDrawer {...baseProps} stock={stock} activeTab="evidence" />); expect(screen.getByRole("tabpanel").textContent).toContain("公告数据加载失败（已保留真实摘要）"); }
    expect(loadAShareFinancial).toHaveBeenCalledTimes(1); expect(loadAShareAnnouncements).toHaveBeenCalledTimes(1);
  });

  it("retains the financial presentation selection when visiting another chapter", async () => {
    const stock = realStocks[0]; vi.mocked(loadAShareFinancial).mockResolvedValue(financial(stock));
    render(<StockDetailDrawer {...baseProps} stock={stock} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("tab", { name: "经营与财务" }));
    fireEvent.change(screen.getByLabelText("财务趋势期间口径"), { target: { value: "cumulative" } });
    fireEvent.click(screen.getByRole("tab", { name: "价格与估值" })); fireEvent.click(screen.getByRole("tab", { name: "经营与财务" }));
    expect((screen.getByLabelText("财务趋势期间口径") as HTMLSelectElement).value).toBe("cumulative");
    expect(screen.getByText(/三表完整历史与原始报告/)).toBeTruthy();
  });

  it("keeps legacy drawer close and focus restoration without closing a newer modal", () => {
    const trigger = document.createElement("button"); document.body.appendChild(trigger); trigger.focus(); const close = vi.fn();
    const view = render(<StockDetailDrawer {...baseProps} presentation="drawer" stock={stocks[0]} onClose={close} />);
    expect(document.body.style.overflow).toBe("hidden");
    const newer = document.createElement("div"); newer.setAttribute("role", "dialog"); newer.setAttribute("aria-modal", "true"); document.body.appendChild(newer);
    fireEvent.keyDown(document, { key: "Escape" }); expect(close).not.toHaveBeenCalled(); newer.remove();
    fireEvent.keyDown(document, { key: "Escape" }); expect(close).toHaveBeenCalledTimes(1); view.unmount();
    expect(document.activeElement).toBe(trigger); trigger.remove();
  });
});

describe("existing price observations", () => {
  it("keeps missing, zero and single valid observations readable without inventing currency", () => {
    const stock: Stock = { ...stocks[0], priceHistory: [{ date: "2026-01-01", close: null, amount: null, pctChange: null }, { date: "2026-01-02", close: 0, amount: null, pctChange: null }, { date: "2026-01-03", close: null, amount: null, pctChange: null }] };
    render(<StockPriceHistoryChart stock={stock} />);
    const table = screen.getByRole("table"); expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByRole("cell", { name: "0", exact: true })).toBeTruthy(); expect(table.textContent).toContain("币种：源字段未提供");
    expect(screen.queryByText("图表数据暂缺")).toBeNull();
  });
  it("shows empty data instead of generating a series", () => { render(<StockPriceHistoryChart stock={{ ...stocks[0], priceHistory: [] }} />); expect(screen.getByText("图表数据暂缺")).toBeTruthy(); });
});
