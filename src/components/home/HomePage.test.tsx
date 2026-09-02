import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import type { Stock } from "../../types";

const focusStock = {
  id: "focus-1",
  name: "测试资产",
  code: "000001",
  market: "A股",
  quote: { pctChange: 0.012 },
} as Stock;

function renderHome() {
  return renderToStaticMarkup(
    <HomePage
      dataMode="mixed"
      modeLabel="Mixed Data"
      updatedAt="2026-07-05T17:40:20+08:00"
      sourceNote="缺失字段明确展示。"
      coverageSummary="A股覆盖 56/56"
      industriesCount={4}
      stocksCount={59}
      activeWatchCount={2}
      expectationCount={3}
      macroCount={8}
      stats={{
        segments: 20,
        missingFields: 12,
        highRisk: 4,
        recentEvents: 6,
        verificationChains: 9,
        todayReview: 1,
        overdueReview: 0,
        newEventReminder: 2,
        quoteCoverageReal: 56,
        quoteCoverageTotal: 56,
        pendingExpectationSources: 1,
      }}
      focusStocks={[focusStock]}
      onDataModeChange={vi.fn()}
      onNavigate={vi.fn()}
      onOpenStock={vi.fn()}
    />,
  );
}

describe("HomePage", () => {
  it("renders explainable live metrics without inventing capabilities", () => {
    const html = renderHome();
    expect(html).toContain("全球资产");
    expect(html).toContain("投研系统");
    expect(html).toContain("56 / 56");
    expect(html).toContain("4 行业 / 20 细分");
    expect(html).toContain("缺失字段明确展示。");
    expect(html).toContain("测试资产");
  });
});
