import { describe, expect, it } from "vitest";
import { getAStockData } from "./aStockDataProvider";

describe("synchronous A-stock data provider", () => {
  it("loads only financial summaries, not full report histories", () => {
    const data = getAStockData();
    expect(Object.keys(data.aShareFinancialSummaries)).toHaveLength(56);
    expect(data.aShareFinancialSummaries.innolight.latestReportPeriod).toBe("2026-03-31");
    expect("reports" in data.aShareFinancialSummaries.innolight).toBe(false);
    expect("aShareFinancials" in data).toBe(false);
    expect(Object.keys(data.aShareAnnouncementSummaries)).toHaveLength(56);
    expect("announcements" in data.aShareAnnouncementSummaries.innolight).toBe(false);
    expect("announcements" in data).toBe(false);
  });
});
