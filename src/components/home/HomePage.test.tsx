// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import type { DashboardDataMode, Stock } from "../../types";

const focusStock = {
  id: "focus-1",
  name: "测试资产",
  code: "000001",
  market: "A股",
  quote: { pctChange: 0.012 },
} as Stock;

const defaultStats = {
  segments: 20,
  highRisk: 4,
  recentEvents: 6,
  verificationChains: 9,
  todayReview: 1,
  overdueReview: 0,
  quoteCoverageReal: 56,
  quoteCoverageTotal: 56,
  pendingExpectationSources: 1,
};

function renderHome({
  dataMode = "mixed",
  modeLabel = "Mixed Data",
  sourceNote = "数据源：A Stock Data（AKShare、Tencent quote/kline）；当前为 Mixed Data。",
  onDataModeChange = vi.fn(),
  onNavigate = vi.fn(),
  onOpenStock = vi.fn(),
}: {
  dataMode?: DashboardDataMode;
  modeLabel?: string;
  sourceNote?: string;
  onDataModeChange?: (mode: DashboardDataMode) => void;
  onNavigate?: Parameters<typeof HomePage>[0]["onNavigate"];
  onOpenStock?: Parameters<typeof HomePage>[0]["onOpenStock"];
} = {}) {
  return render(
    <HomePage
      dataMode={dataMode}
      modeLabel={modeLabel}
      updatedAt="2026-07-05T17:40:20+08:00"
      sourceNote={sourceNote}
      coverageSummary="A股覆盖 56/56"
      industriesCount={4}
      stocksCount={59}
      activeWatchCount={2}
      expectationCount={3}
      macroCount={8}
      stats={defaultStats}
      focusStocks={[focusStock]}
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

    expect(screen.getAllByText(expectedLabel).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(`数据状态：${expectedLabel}`)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b(?:live|online)\b/i);
  });

  it("明确展示 A 股行情覆盖口径和中文核心区域", () => {
    const { container } = renderHome();

    expect(screen.getAllByText("投研系统").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("全球资产研究中枢")).toBeTruthy();
    expect(screen.getByText("A 股行情覆盖")).toBeTruthy();
    expect(screen.getByText("56 / 56")).toBeTruthy();
    expect(screen.getByText("研究工作台")).toBeTruthy();
    expect(screen.getAllByText("系统脉冲").length).toBeGreaterThan(0);
    expect(screen.getAllByText("重点资产").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "投资研究看板首页" })).toBeNull();
    expect(container.textContent).toContain("数据源：A 股数据");
    expect(container.textContent).not.toContain("A Stock Data");
  });

  it("触发核心导航、数据模式切换和重点资产回调", () => {
    const onNavigate = vi.fn();
    const onDataModeChange = vi.fn();
    const onOpenStock = vi.fn();
    renderHome({ onNavigate, onDataModeChange, onOpenStock });

    fireEvent.click(screen.getByRole("button", { name: /进入研究终端/ }));
    expect(onNavigate).toHaveBeenCalledWith("行业");

    fireEvent.change(screen.getByRole("combobox", { name: "数据模式" }), { target: { value: "real" } });
    expect(onDataModeChange).toHaveBeenCalledWith("real");

    fireEvent.click(screen.getByRole("button", { name: /测试资产/ }));
    expect(onOpenStock).toHaveBeenCalledWith(focusStock);
  });

  it("减少动态效果时探索按钮不使用平滑滚动", () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: /向下探索/ }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
    expect(scrollIntoView).not.toHaveBeenCalledWith({ behavior: "smooth" });
  });
});
