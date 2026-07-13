import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResearchEvent, ResearchEventSnapshot, Stock } from "../../types";
import { ResearchEventCenter } from "./ResearchEventCenter";

const stock = { id: "demo", name: "测试公司", code: "300001.SZ", market: "A股", industryId: "tech" } as Stock;
const event = {
  id: "announcement:demo:1",
  stockId: "demo",
  stockName: "测试公司",
  stockCode: "300001.SZ",
  industryId: "tech",
  market: "A股",
  eventType: "earnings_preview",
  eventDate: "2026-07-12",
  publishedAt: "2026-07-12",
  reportPeriod: "2026-06-30",
  title: "2026 年半年度业绩预告",
  summary: "公告元数据和官方链接已获取，正文未结构化。",
  sourceType: "announcement",
  sourceName: "CNInfo",
  sourceUrl: "https://example.com/1",
  pdfUrl: null,
  verificationStatus: "metadata_only",
  parseStatus: "metadata_only",
  materiality: "high",
  metrics: [],
  relatedAnnouncementIds: ["1"],
  relatedFinancialPeriod: null,
  reviewStatus: "pending",
  reviewReasons: ["公告仅有元数据，需要人工核验正文"],
  isRestated: false,
  updatedAt: "2026-07-12",
} as ResearchEvent;

describe("ResearchEventCenter", () => {
  it("renders KPI, recent events, verification chain, and raw parse states", () => {
    const partialEvent: ResearchEvent = {
      ...event,
      id: "announcement:demo:2",
      title: "2026 年半年度业绩快报",
      eventType: "earnings_flash",
      parseStatus: "parse_partial",
      verificationStatus: "partial",
      relatedAnnouncementIds: ["2"],
      reviewReasons: ["公告正文仅部分解析"],
    };
    const snapshot: ResearchEventSnapshot = {
      events: [event, partialEvent],
      chains: [{
        id: "demo:2026-06-30",
        stockId: "demo",
        stockName: "测试公司",
        stockCode: "300001.SZ",
        reportPeriod: "2026-06-30",
        preview: [event],
        revision: [],
        flash: [],
        formal: [],
        financialUpdates: [],
        missingStages: ["revision", "flash", "formal"],
        differences: [],
        hasMaterialDifference: false,
        needsReview: true,
      }],
      generatedAt: "2026-07-13T00:00:00Z",
    };
    const html = renderToStaticMarkup(<ResearchEventCenter snapshot={snapshot} stocks={[stock]} industries={[{ id: "tech", name: "科技", segments: [] } as never]} onOpenStock={() => undefined} now={new Date("2026-07-13T12:00:00+08:00")} />);
    expect(html).toContain("投研事件与业绩验证中心");
    expect(html).toContain("最近 7 天事件");
    expect(html).toContain("2026 年半年度业绩预告");
    expect(html).toContain("metadata_only / metadata_only");
    expect(html).toContain("parse_partial / partial");
    expect(html).toContain("缺少阶段");
  });
});
