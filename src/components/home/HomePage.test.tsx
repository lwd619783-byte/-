// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { buildDashboardDataset } from "../../services/dataProvider";
import type { GeneratedRealDataBundle } from "../../types";
import type { DashboardDataMode, Stock } from "../../types";

const focusStock = {
  id: "focus-1",
  name: "测试资产",
  code: "000001",
  market: "A股",
  quote: { pctChange: 0.012, latestPrice: 42, updatedAt: "2026-07-05T17:40:20+08:00", quality: { status: "real", source: "fixture quote source" } },
} as Stock;

const defaultStats = {
  segments: 20,
  highRisk: 4,
  recentEvents: 6,
  verificationChains: 9,
  todayReview: 1,
  overdueReview: 0,
  quoteStatusRealCovered: 56,
  quoteCoverageTotal: 56,
  pendingExpectationSources: 1,
};

function renderHome({
  dataMode = "mixed",
  modeLabel = "Mixed Data",
  updatedAt = "2026-09-06T10:00:00+08:00",
  quoteStocks = [focusStock],
  focusStocks = [focusStock],
  sourceNote = "数据源：A Stock Data（AKShare、Tencent quote/kline）；当前为 Mixed Data。",
  onDataModeChange = vi.fn(),
  onNavigate = vi.fn(),
  onOpenStock = vi.fn(),
}: {
  updatedAt?: string;
  quoteStocks?: Stock[];
  focusStocks?: Stock[];
  dataMode?: DashboardDataMode;
  modeLabel?: string;
  sourceNote?: string;
  onDataModeChange?: (mode: DashboardDataMode) => void;
  onNavigate?: Parameters<typeof HomePage>[0]["onNavigate"];
  onOpenStock?: Parameters<typeof HomePage>[0]["onOpenStock"];
} = {}) {
  return render(
    <HomePage
      now={new Date("2026-09-07T12:00:00+08:00")}
      dataMode={dataMode}
      modeLabel={modeLabel}
      updatedAt={updatedAt}
      sourceNote={sourceNote}
      coverageSummary="A股覆盖 56/56"
      industriesCount={4}
      stocksCount={59}
      activeWatchCount={2}
      expectationCount={3}
      macroCount={8}
      stats={defaultStats}
      focusStocks={focusStocks}
      quoteStocks={quoteStocks}
      onDataModeChange={onDataModeChange}
      onNavigate={onNavigate}
      onOpenStock={onOpenStock}
    />,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["mock", "Mock Data", "模拟数据"],
    ["mixed", "Mixed Data", "混合数据"],
    ["real", "Real Data", "真实数据"],
    ["real", "Mixed Data", "混合数据"],
  ] as const)("以中文准确展示 %s 模式且不承诺在线或实时", (dataMode, modeLabel, expectedLabel) => {
    const { container } = renderHome({ dataMode, modeLabel });

    expect(container.textContent).toContain(`当前模式：${expectedLabel}`);
    expect(container.textContent).not.toMatch(/\b(?:live|online)\b/i);
  });

  it("明确展示 A 股行情覆盖口径和中文核心区域", () => {
    const { container } = renderHome();

    expect(screen.getByRole("heading", { name: "首页 / 研究工作台" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "今天先处理什么" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "最近研究事件" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "关注公司" })).toBeTruthy();
    expect(container.textContent).toContain("A 股行情覆盖（质量状态 real 且有价格）：56 / 56");
    expect(container.textContent).toContain("数据源：A 股数据");
    expect(container.textContent).not.toContain("A Stock Data");
    expect(container.textContent).toContain("采集时间：2026-07-05T17:40:20+08:00");
    expect(container.textContent).toContain("超过 24 小时");
    expect(container.textContent).toContain("行情来源：fixture quote source");
    expect(container.textContent).toContain("质量状态：真实数据");
    expect(container.textContent).toContain("数据包更新时间：2026-09-06T10:00:00+08:00");
    expect(container.textContent).not.toContain("数据包采集时间");
    expect(container.textContent).toContain("24 小时内 0/1");
    expect(container.textContent).not.toContain("最近数据更新");
  });

  it("保留六研究入口且不把示例研究池冒充个人观察", () => {
    const onNavigate=vi.fn(); renderHome({onNavigate});
    for(const name of ["宏观","行业","个股池","观察清单","验证中心","预期证据"]) {
      fireEvent.click(screen.getByRole("button",{name})); expect(onNavigate).toHaveBeenCalledWith(name);
    }
    expect(screen.getByText("尚无用户观察项。示例模板不会自动成为个人观察记录。")).toBeTruthy();
    expect(screen.getByText("暂无待处理研究任务。")).toBeTruthy();
  });
  it("没有价格历史时保留任务、来源和空图说明", () => {
    const {container}=renderHome(); expect(screen.getByText("图表数据暂缺")).toBeTruthy();
    expect(container.querySelector(".home-orbit-stage")).toBeNull();
    expect(container.querySelector(".recharts-line-curve")).toBeNull();
    expect(screen.getByRole("heading",{name:"今天先处理什么"})).toBeTruthy();
  });
  it("keeps a real manifest out of the Mock home and missing quote-time summary", () => {
    const realTimestamp = "2026-08-01T10:00:00+08:00";
    const dataset = buildDashboardDataset("mock", { manifest: { updatedAt: realTimestamp, status: "mixed", sourceSummary: [], errors: [] }, profiles: {}, quotes: {}, aShareFinancialSummaries: {}, priceHistory: {}, research: {}, aShareAnnouncementSummaries: {}, signals: {}, sectorMembership: {} } satisfies GeneratedRealDataBundle);
    expect(dataset.dataUpdatedAt).toBe("");
    const { container } = renderHome({ dataMode: "mock", modeLabel: dataset.modeLabel, updatedAt: dataset.dataUpdatedAt, quoteStocks: dataset.stocks, focusStocks: dataset.stocks.slice(0, 1) });
    expect(container.textContent).toContain("数据包更新时间：未知");
    expect(container.textContent).not.toContain(realTimestamp);
    const summary = screen.getByLabelText("行情覆盖与时效汇总").textContent;
    expect(summary).toContain(`缺失 ${dataset.stocks.length}/${dataset.stocks.length}`);
    expect(summary).toContain(`价格覆盖 0/${dataset.stocks.length}`);
  });
  it("also suppresses an accidentally supplied package timestamp in Mock mode", () => {
    const { container } = renderHome({ dataMode: "mock", updatedAt: "2026-08-01T10:00:00+08:00", quoteStocks: [], focusStocks: [] });
    expect(container.textContent).toContain("数据包更新时间：未知");
    expect(container.textContent).not.toContain("2026-08-01T10:00:00+08:00");
  });

});
