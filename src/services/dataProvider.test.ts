import { describe, expect, it } from "vitest";
import { buildDashboardDataset } from "./dataProvider";
import type { GeneratedRealDataBundle } from "../types/marketData";

const generated: GeneratedRealDataBundle = {
  manifest: {
    updatedAt: "2026-06-30T10:00:00+08:00",
    status: "mixed",
    sourceSummary: ["AKShare"],
    errors: [],
  },
  profiles: {
    sugon: {
      id: "sugon",
      name: "中科曙光",
      code: "603019.SH",
      market: "A股",
      industryName: "计算机设备",
      quality: { source: "AKShare", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  quotes: {
    sugon: {
      id: "sugon",
      latestPrice: 88.12,
      pctChange: 2.34,
      marketCap: 1289.5,
      floatMarketCap: 1200.1,
      pe: 48.2,
      pb: 4.1,
      ps: null,
      dividendYield: null,
      updatedAt: "2026-06-30T10:00:00+08:00",
      quality: { source: "AKShare", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  financials: {},
  priceHistory: {
    sugon: {
      id: "sugon",
      points: [{ date: "2026-06-30", close: 88.12, amount: 100000000, pctChange: 2.34 }],
      quality: { source: "AKShare", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  research: {
    sugon: {
      id: "sugon",
      reports: [{ title: "算力服务器跟踪", org: "测试机构", date: "2026-06-30", rating: "买入", url: "https://example.com" }],
      quality: { source: "Eastmoney reportapi", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  announcements: {
    sugon: {
      id: "sugon",
      announcements: [{ title: "年度报告", date: "2026-06-30", type: "定期报告", url: "https://example.com" }],
      quality: { source: "CNInfo", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  signals: {
    sugon: {
      id: "sugon",
      mainFundFlow20d: 12000,
      dragonTigerCount30d: 1,
      marginBalance: 500000000,
      quality: { source: "Eastmoney signals", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
  sectorMembership: {
    sugon: {
      id: "sugon",
      industry: [{ name: "计算机设备", changePct: 1.2 }],
      concept: [{ name: "算力", changePct: 2.3 }],
      region: [],
      quality: { source: "Baidu Stock", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
    },
  },
};

describe("dashboard data provider", () => {
  it("uses generated real quotes in mixed mode while preserving manual stock logic", () => {
    const dataset = buildDashboardDataset("mixed", generated);
    const stock = dataset.stocks.find((item) => item.id === "sugon");

    expect(dataset.modeLabel).toBe("Mixed Data");
    expect(stock?.quote?.latestPrice).toBe(88.12);
    expect(stock?.valuation.pe).toBe("48.2");
    expect(stock?.leaderPosition).toContain("国产服务器");
    expect(stock?.missingFields).toContain("ps");
    expect(stock?.research?.reports[0].title).toBe("算力服务器跟踪");
    expect(stock?.announcements?.announcements[0].title).toBe("年度报告");
    expect(stock?.signals?.dragonTigerCount30d).toBe(1);
    expect(stock?.sectorMembership?.concept[0].name).toBe("算力");
  });
});
