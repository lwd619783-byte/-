import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Stock } from "../../types";
import { buildEarningsVerificationView, EarningsVerificationPanel } from "./EarningsVerificationPanel";

const stock = {
  id: "demo",
  name: "测试公司",
  code: "300001.SZ",
  market: "A股",
  industryId: "tech",
  dataMode: "mixed",
  aShareFinancialSummary: {
    id: "demo",
    stockCode: "300001",
    companyName: "测试公司",
    market: "SZ",
    status: "success",
    provider: "official",
    fetchedAt: "2026-07-12",
    latestReportPeriod: "2026-03-31",
    latestSingleQuarter: { operatingRevenue: null, netProfitAttributableToParent: null, netProfitExcludingNonRecurring: null, netOperatingCashFlow: null },
    latestChanges: {},
    latestRatios: {},
    latestBalanceSheet: {},
    fieldStatus: {},
    quality: { source: "official", status: "real", sourceUrl: "https://example.com/financial" },
  },
} as Stock;

describe("EarningsVerificationPanel", () => {
  it("keeps the latest period, missing values, loading errors, and evidence status explicit", () => {
    const view = buildEarningsVerificationView(stock, null, null, "error", "error");
    expect(view.latestReportPeriod).toBe("2026-03-31");
    expect(view.loadWarnings.join(" ")).toContain("未使用 mock 数据");
    const html = renderToStaticMarkup(<EarningsVerificationPanel stock={stock} financialData={null} announcementData={null} financialLoadStatus="error" announcementLoadStatus="error" />);
    expect(html).toContain("预告 → 修正 → 快报 → 正式报告");
    expect(html).toContain("暂未获取");
    expect(html).toContain("未使用 mock 数据");
    expect(html).not.toContain("超机构预期");
  });
});
