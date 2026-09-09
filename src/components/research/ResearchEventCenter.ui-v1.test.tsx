// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarningsVerificationChain, ResearchEvent, ResearchEventSnapshot, ReviewTask, WatchItem } from "../../types";
import { getMockDashboardData } from "../../services/providers/mockProvider";
import { ResearchEventCenter } from "./ResearchEventCenter";

const now = new Date("2026-09-09T12:00:00+08:00");
beforeEach(() => vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0)));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; });

function fixture(count = 2) {
  const data = getMockDashboardData();
  const stocks = data.stocks.slice(0, 2).map((stock, index) => ({ ...stock, id: `synthetic-company-${index}`, name: `合成公司${index}`, market: "A股" as const }));
  const events: ResearchEvent[] = Array.from({ length: count }, (_, index) => ({
    id: `synthetic-event-${index}`, stockId: stocks[index % 2].id, stockName: stocks[index % 2].name, stockCode: stocks[index % 2].code,
    industryId: stocks[index % 2].industryId, market: "A股", eventType: "earnings_preview", eventDate: "2026-09-08", publishedAt: "2026-09-08",
    reportPeriod: "2026-06-30", title: `合成事件标题${index}`, summary: `原始事件摘要${index}`, sourceType: "announcement", sourceName: "synthetic 公告源",
    sourceUrl: "https://example.com/synthetic-announcement", pdfUrl: null, verificationStatus: "metadata_only", parseStatus: "metadata_only", materiality: "high",
    metrics: [], relatedAnnouncementIds: [`synthetic-announcement-${index}`], relatedFinancialPeriod: null, reviewStatus: "pending", reviewReasons: [`仅有元数据，待核验正文${index}`], isRestated: null, updatedAt: "2026-09-08",
  }));
  const snapshot: ResearchEventSnapshot = { events, chains: [], generatedAt: "2026-09-09" };
  return { snapshot, stocks, industries: data.industries, now, onOpenStock: vi.fn() };
}

describe("ResearchEventCenter UI V1", () => {
  it("selects original event identity and keeps all three qualification questions independent", () => {
    const data = fixture();
    data.snapshot.events[0].expectation = { snapshotId: "synthetic-expectation", sourceCategory: "company_guidance", sourceName: "synthetic 官方指引", ingestionMethod: "provider", reportPeriod: "2026-06-30", metric: "revenue", expectedValue: null, expectedLowerBound: 10, expectedUpperBound: 20, isExAnte: false, comparisonResult: "not_comparable", sourceVerificationStatus: "verified", actualDisclosureTimingStatus: "same_time", performanceDisclosureTimingStatus: "unknown", businessOrderStatus: "uncertain", originalBusinessTime: "2026-09-08", businessTimePrecision: "date", nonComparableReasonCodes: ["source_verification_pending"] };
    const onSelectEvent = vi.fn();
    render(<ResearchEventCenter {...data} onSelectEvent={onSelectEvent} />);
    fireEvent.click(screen.getByRole("button", { name: "查看事件 合成公司0 合成事件标题0" }));
    expect(onSelectEvent).toHaveBeenCalledWith("synthetic-event-0");
    const qualification = screen.getByRole("region", { name: "来源、时间与数值资格" });
    expect(within(qualification).getByText("已核验")).toBeTruthy();
    expect(within(qualification).getByText("非事前有效")).toBeTruthy();
    expect(within(qualification).getByText("不可比较")).toBeTruthy();
    expect(qualification.textContent).toContain("同一时刻");
    expect(screen.getByLabelText("选中事件详情").textContent).toContain("公司官方指引 · 数据提供方只读");
    expect(screen.queryByRole("button", { name: /编辑官方|纠正官方|删除官方/ })).toBeNull();
  });

  it("retains six filters and keeps the global queue independent of every local filter", () => {
    const data = fixture();
    render(<ResearchEventCenter {...data} />);
    fireEvent.change(screen.getByRole("combobox", { name: "公司" }), { target: { value: data.stocks[0].id } });
    fireEvent.change(screen.getByRole("combobox", { name: "日期" }), { target: { value: "7" } });
    fireEvent.change(screen.getByRole("combobox", { name: "事件类型" }), { target: { value: "financial_update" } });
    fireEvent.click(screen.getByRole("button", { name: "更多筛选" }));
    fireEvent.change(screen.getByRole("combobox", { name: "解析 / 数据状态" }), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "全部复盘状态" }));
    fireEvent.click(screen.getByRole("button", { name: "更多筛选（2）" }));
    expect(screen.getByText("没有匹配事件")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "全局核验队列" }));
    const queue = screen.getByRole("tabpanel", { name: "全局核验队列" });
    expect(queue.textContent).toContain("当前 2 条有效事件中按原核验规则产生 2 项");
    expect(within(queue).getByText("合成事件标题1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除更多筛选" }));
    expect((screen.getByRole("combobox", { name: "公司" }) as HTMLSelectElement).value).toBe(data.stocks[0].id);
  });

  it("restores a valid deep link outside the date window without changing filters and fails closed when removed", () => {
    const data = fixture();
    data.snapshot.events[1].eventDate = "2020-01-01";
    const { rerender } = render(<ResearchEventCenter {...data} initialEventId="synthetic-event-1" />);
    expect(screen.getByLabelText("选中事件详情").textContent).toContain("合成事件标题1");
    expect(screen.getByText(/所选事件不在当前筛选结果中/)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "日期" }) as HTMLSelectElement).value).toBe("30");
    rerender(<ResearchEventCenter {...data} snapshot={{ ...data.snapshot, events: [data.snapshot.events[0]] }} initialEventId="synthetic-event-1" />);
    expect(screen.getByText("找不到所选事件")).toBeTruthy();
    expect(screen.getByLabelText("选中事件详情").textContent).not.toContain("合成事件标题1");
    rerender(<ResearchEventCenter {...data} initialEventId="invalid-id" />);
    expect(screen.getByText("找不到所选事件")).toBeTruthy();
  });

  it("shows every original metric including missing and zero values with original precision", () => {
    const data = fixture(1);
    data.snapshot.events[0].metrics = Array.from({ length: 6 }, (_, index) => ({ key: `metric-${index}`, label: `原始指标${index}`, value: index === 0 ? null : index === 1 ? 0 : index, unit: "count", periodBasis: index === 0 ? "point" : "cumulative", sourceAnnouncementId: "synthetic-announcement-0", sourceFinancialPeriod: null }));
    render(<ResearchEventCenter {...data} initialEventId="synthetic-event-0" />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(within(table).getByText("原始指标5")).toBeTruthy();
    expect(within(table).getByText("缺失")).toBeTruthy();
    expect(within(table).getByText("0", { exact: true })).toBeTruthy();
    expect(within(table).getByText("点值")).toBeTruthy();
    expect(screen.getByLabelText("选中事件详情").textContent).toContain("公告 / 事件日期：2026-09-08");
    expect(screen.getByLabelText("选中事件详情").textContent).not.toContain("2026-09-08T00:00");
  });

  it("exposes further loaded events and queue items without changing their denominators", () => {
    const data = fixture(81);
    const { container } = render(<ResearchEventCenter {...data} />);
    expect(container.querySelectorAll("[data-event-id]")).toHaveLength(80);
    fireEvent.click(screen.getByRole("button", { name: "显示更多事件（剩余 1 条）" }));
    expect(container.querySelectorAll("[data-event-id]")).toHaveLength(81);
    fireEvent.click(screen.getByRole("tab", { name: "全局核验队列" }));
    const queue = screen.getByRole("tabpanel", { name: "全局核验队列" });
    expect(queue.querySelectorAll("article")).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "显示更多核验项（剩余 51 项）" }));
    expect(queue.querySelectorAll("article")).toHaveLength(60);
    expect(queue.textContent).toContain("产生 81 项");
  });

  it("keeps chains capped at twelve and affected only by company and industry", () => {
    const data = fixture();
    data.snapshot.chains = Array.from({ length: 14 }, (_, index): EarningsVerificationChain => ({ id: `chain-${index}`, stockId: index === 13 ? data.stocks[1].id : data.stocks[0].id, stockName: `链公司${index}`, stockCode: "synthetic", reportPeriod: "2026-06-30", preview: [], revision: [], flash: [], formal: [], financialUpdates: [], missingStages: ["preview"], differences: [], hasMaterialDifference: false, needsReview: true }));
    render(<ResearchEventCenter {...data} />);
    fireEvent.change(screen.getByRole("combobox", { name: "事件类型" }), { target: { value: "data_warning" } });
    fireEvent.click(screen.getByRole("tab", { name: "业绩验证链" }));
    const chains = screen.getByRole("tabpanel", { name: "业绩验证链" });
    expect(chains.querySelectorAll("article")).toHaveLength(12);
    fireEvent.change(screen.getByRole("combobox", { name: "公司" }), { target: { value: data.stocks[1].id } });
    expect(chains.querySelectorAll("article")).toHaveLength(1);
    expect(chains.textContent).toContain("链公司13");
    expect(chains.textContent).toContain("不代表公司依法必须发布");
  });

  it("preserves selection across themes and invokes original company and review actions once", () => {
    const data = fixture(1);
    const watchItem = { id: "watch", stockId: data.stocks[0].id, archivedAt: null, status: "观察" } as WatchItem;
    const task = { id: "task", watchItemId: watchItem.id, status: "pending" } as ReviewTask;
    const onStartReview = vi.fn();
    const props = { ...data, initialEventId: "synthetic-event-0", watchItems: [watchItem], reviewTasks: [task], onStartReview };
    const { rerender } = render(<ResearchEventCenter {...props} />);
    document.documentElement.dataset.theme = "light";
    rerender(<ResearchEventCenter {...props} />);
    const details = screen.getByLabelText("选中事件详情");
    expect(details.textContent).toContain("观察状态：观察 · 待复盘 1");
    fireEvent.click(within(details).getByRole("button", { name: "开始复盘" }));
    fireEvent.click(within(details).getByRole("button", { name: "打开个股详情" }));
    expect(onStartReview).toHaveBeenCalledTimes(1);
    expect(onStartReview).toHaveBeenCalledWith(watchItem);
    expect(data.onOpenStock).toHaveBeenCalledTimes(1);
    expect(data.onOpenStock).toHaveBeenCalledWith(data.stocks[0]);
  });
});
