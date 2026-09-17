import { describe, expect, it } from "vitest";
import type { FinancialReport, Stock } from "../types";
import { createReviewFixtures } from "../ui-review/fixtures";
import { financialChartAudit, priceChartAudit, type ChartAuditView } from "./chartAudit";

const UNKNOWN = "未提供 / unknown";
const value = (rows: ChartAuditView["rows"], label: string) => rows.find(item => item.label === label)?.value;

function fixture() {
  const fixtures = createReviewFixtures("full");
  const stock = fixtures.companies[0];
  stock.priceHistorySource = {
    id: stock.id,
    points: stock.priceHistory!,
    quality: { source: "retained test owner", status: "real", updatedAt: "2026-09-09T02:00:00Z", sourceUrl: "https://example.com/price" },
  };
  const detail = fixtures.details[stock.id].financial!;
  const report = detail.reports[0];
  return { stock, detail, report, fixtures };
}

function expectUnproven(audit: ChartAuditView) {
  expect(value(audit.rows, "公开可得时间 releaseAvailableAt")).toBe("未提供 / 未证明");
  expect(value(audit.rows, "严格 PIT")).toBe("未证明 / unknown");
  expect(value(audit.rows, "数据准入")).toBe(UNKNOWN);
  expect(value(audit.rows, "生产准入")).toBe(UNKNOWN);
  expect(value(audit.rows, "Evidence Graph / revision continuity")).toBe("未证明 / unknown");
  expect(audit.linkage).toBeNull();
}

describe("chart audit owner projection", () => {
  it("projects deterministic metadata despite input report, point, field, and source-period ordering", () => {
    const { stock, detail } = fixture();
    const report = detail.reports[0];
    report.fieldStatus = { netOperatingCashFlow: "missing", operatingRevenue: "available" };
    report.sourcePeriods = ["2026-03-31", null, "2025-12-31"];
    const before = financialChartAudit(stock, detail, detail.reports, "cumulative", "consolidated");
    const price = priceChartAudit(stock, stock.priceHistory!);
    report.fieldStatus = { operatingRevenue: "available", netOperatingCashFlow: "missing" };
    report.sourcePeriods.reverse();
    detail.reports.reverse();
    expect(financialChartAudit(stock, detail, detail.reports, "cumulative", "consolidated")).toEqual(before);
    expect(priceChartAudit(stock, [...stock.priceHistory!].reverse())).toEqual(price);
  });

  it("does not mutate owners or create ResearchEvent/Evidence records", () => {
    const { stock, detail, fixtures } = fixture();
    const before = JSON.stringify({ stock, detail, events: fixtures.snapshot.events });
    const first = financialChartAudit(stock, detail, detail.reports, "singleQuarter", "consolidated");
    expect(financialChartAudit(stock, detail, detail.reports, "singleQuarter", "consolidated")).toEqual(first);
    priceChartAudit(stock, stock.priceHistory!);
    expect(JSON.stringify({ stock, detail, events: fixtures.snapshot.events })).toBe(before);
    expect(first.linkage).toBeNull();
  });

  it("counts price zero as finite while null, NaN, and Infinity remain unavailable", () => {
    const { stock } = fixture();
    stock.priceHistory = [0, null, Number.NaN, Number.POSITIVE_INFINITY].map((close, index) => ({ date: `2026-09-0${index + 1}`, close, amount: null, pctChange: null }));
    stock.priceHistorySource!.points = stock.priceHistory;
    const audit = priceChartAudit(stock, stock.priceHistory);
    expect(value(audit.rows, "数值完整性")).toBe("1/4 个有限数值；仅当前观察范围，不证明交易日覆盖");
    expect(audit.quality).toContain("partial");
  });

  it("preserves financial zero, false, and coverage zero independently of missing values", () => {
    const { stock, detail, report } = fixture();
    report.cumulative.operatingRevenue = 0;
    report.cumulative.netProfitAttributableToParent = null;
    report.cumulative.netOperatingCashFlow = Number.NaN;
    report.rawFieldCoverage = { available: 0, total: 17 };
    const audit = financialChartAudit(stock, detail, [report], "cumulative", "consolidated");
    const rows = audit.records[0].rows;
    expect(value(rows, "operatingRevenue（cumulative）")).toBe("0");
    expect(value(rows, "netProfitAttributableToParent（cumulative）")).toBe(UNKNOWN);
    expect(value(rows, "netOperatingCashFlow（cumulative）")).toBe(UNKNOWN);
    expect(value(rows, "图表数值完整性")).toBe("1/3");
    expect(value(rows, "owner 原始字段覆盖")).toBe("0/17");
    expect(value(rows, "修订 isRestated")).toBe("false");
    expect(audit.quality).toContain("partial");
  });

  it("keeps price observation dates separate from update time and publication", () => {
    const { stock } = fixture();
    const points = stock.priceHistory!.slice(0, 2);
    const audit = priceChartAudit(stock, points);
    expect(value(audit.rows, "观测日期范围")).toBe(`${points[0].date} → ${points[1].date}`);
    expect(value(audit.rows, "数据更新时间（非发布）")).toBe("2026-09-09T02:00:00Z");
    expect(value(audit.rows, "发布时间")).toBe(UNKNOWN);
    expectUnproven(audit);
  });

  it("keeps report, publication, acquisition, generation, and source-update times separate", () => {
    const { stock, detail, report } = fixture();
    Object.assign(report, { reportPeriod: "2026-03-31", announcementDate: "2026-04-29", fetchedAt: "2026-09-01T01:00:00Z", generatedAt: "2026-09-02T02:00:00Z", sourceUpdatedAt: "2026-08-31" });
    const audit = financialChartAudit(stock, detail, [report], "cumulative", "consolidated");
    const rows = audit.records[0].rows;
    expect(value(rows, "报告期（非发布时间）")).toBe("2026-03-31");
    expect(value(rows, "发布时间 announcementDate")).toBe("2026-04-29");
    expect(value(rows, "采集 fetchedAt")).toBe("2026-09-01T01:00:00Z");
    expect(value(rows, "生成 generatedAt")).toBe("2026-09-02T02:00:00Z");
    expect(value(rows, "来源更新 sourceUpdatedAt")).toBe("2026-08-31");
    expectUnproven(audit);
    report.announcementDate = null;
    expect(value(financialChartAudit(stock, detail, [report], "cumulative", "consolidated").records[0].rows, "发布时间 announcementDate")).toBe(UNKNOWN);
  });

  it.each(["missing", "partial", "stale", "conflicted"] as const)("preserves price owner state %s without upgrading proof", status => {
    const { stock } = fixture();
    stock.priceHistorySource!.quality.status = status;
    const audit = priceChartAudit(stock, stock.priceHistory!);
    expect(audit.quality).toContain(status);
    expect(value(audit.rows, "freshness")).toBe(status === "stale" ? "stale" : UNKNOWN);
    expectUnproven(audit);
  });

  it("unions financial partial, stale, and conflicted states and excludes conflict values", () => {
    const { stock, detail, report } = fixture();
    detail.status = "stale";
    detail.quality = { ...detail.quality, status: "partial" };
    report.status = "conflicted";
    const audit = financialChartAudit(stock, detail, [report], "singleQuarter", "consolidated");
    expect(audit.quality).toEqual(["conflicted", "partial", "stale"]);
    expect(value(audit.rows, "freshness")).toBe("stale");
    expect(value(audit.rows, "数值完整性")).toBe("0/3；冲突值不绘制");
    expect(value(audit.records[0].rows, "operatingRevenue（singleQuarter）")).toBe(UNKNOWN);
    expectUnproven(audit);
  });

  it("fails closed for absent price and financial owners", () => {
    const { stock } = fixture();
    stock.priceHistorySource = undefined;
    const price = priceChartAudit(stock, []);
    const finance = financialChartAudit(stock, null, [], "cumulative", "consolidated");
    for (const audit of [price, finance]) {
      expect(audit.quality).toEqual(["missing", "unknown"]);
      expect(audit.records).toEqual([]);
      expectUnproven(audit);
    }
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "file:///c:/report", "//example.com/report", "https://user:secret@example.com/report", "https://"])("omits unsafe source link %s", sourceUrl => {
    const { stock, detail, report } = fixture();
    stock.priceHistorySource!.quality.sourceUrl = sourceUrl;
    report.sourceUrl = sourceUrl;
    const price = priceChartAudit(stock, stock.priceHistory!);
    const finance = financialChartAudit(stock, detail, [report], "cumulative", "consolidated");
    for (const rows of [price.rows, finance.records[0].rows]) {
      expect(rows.find(item => item.label === "来源 HTTP(S)")).toEqual({ label: "来源 HTTP(S)", value: "不可安全打开" });
    }
  });

  it.each(["https://example.com/report", "http://example.com/report"])("preserves explicit safe link %s without treating it as proof", sourceUrl => {
    const { stock, detail, report } = fixture();
    stock.priceHistorySource!.quality.sourceUrl = sourceUrl;
    report.sourceUrl = sourceUrl;
    const price = priceChartAudit(stock, stock.priceHistory!);
    const finance = financialChartAudit(stock, detail, [report], "cumulative", "consolidated");
    expect(price.rows.find(item => item.label === "来源 HTTP(S)")?.href).toBe(sourceUrl);
    expect(finance.records[0].rows.find(item => item.label === "来源 HTTP(S)")?.href).toBe(sourceUrl);
    expectUnproven(price);
    expectUnproven(finance);
  });

  it("rejects wrong price entity and copied point-array provenance even when values match", () => {
    const { stock } = fixture();
    stock.priceHistorySource!.id = "another-company";
    expect(value(priceChartAudit(stock, stock.priceHistory!).rows, "来源身份")).toBe(UNKNOWN);
    stock.priceHistorySource!.id = stock.id;
    stock.priceHistorySource!.points = [...stock.priceHistory!];
    expect(value(priceChartAudit(stock, stock.priceHistory!).rows, "序列 owner")).toBe(UNKNOWN);
    stock.priceHistorySource!.points = stock.priceHistory!;
    expect(value(priceChartAudit(stock, stock.priceHistory!).rows, "序列 owner")).toBe(stock.id);
  });

  it("rejects a foreign observation window even when another company's points have equal values", () => {
    const { stock } = fixture();
    const foreignPoints = stock.priceHistory!.slice(0, 2).map(point => ({ ...point }));
    for (const points of [foreignPoints, [stock.priceHistory![0], foreignPoints[1]]]) {
      const audit = priceChartAudit(stock, points);
      expect(value(audit.rows, "序列 owner")).toBe(UNKNOWN);
      expect(value(audit.rows, "来源身份")).toBe(UNKNOWN);
      expect(audit.rows.some(item => item.href)).toBe(false);
      expectUnproven(audit);
    }
    expect(value(priceChartAudit(stock, stock.priceHistory!.slice(0, 2)).rows, "序列 owner")).toBe(stock.id);
  });

  it.each(["id", "stockCode"] as const)("rejects wrong financial owner %s", field => {
    const { stock, detail, report } = fixture();
    detail[field] = "another-company";
    const audit = financialChartAudit(stock, detail, [report], "cumulative", "consolidated");
    expect(audit.records).toEqual([]);
    expect(value(audit.rows, "owner")).toBe(UNKNOWN);
    expect(audit.quality).toContain("missing");
    expectUnproven(audit);
  });

  it("rejects reports outside the owner, including an equal-valued clone or wrong entity, market, or scope", () => {
    const { stock, detail, report } = fixture();
    const clone = { ...report };
    expect(financialChartAudit(stock, detail, [clone], "cumulative", "consolidated").records).toEqual([]);
    for (const override of [{ stockCode: "another-company" }, { market: "BJ" as const }, { statementScope: "parent" as const }]) {
      const wrong: FinancialReport = { ...report, ...override };
      detail.reports.push(wrong);
      expect(financialChartAudit(stock, detail, [wrong], "cumulative", "consolidated").records).toEqual([]);
    }
  });

  it("does not treat providerVersion, restatement, common URL, or adjacent report as an exact revision/evidence link", () => {
    const { stock, detail, report } = fixture();
    report.providerVersion = "provider-v99";
    report.isRestated = true;
    report.sourceUrl = "https://example.com/shared";
    const adjacent = { ...report, sourceIdentifier: "adjacent-record", providerVersion: "provider-v100", cumulative: { ...report.cumulative, operatingRevenue: 999 } };
    detail.reports.push(adjacent);
    stock.priceHistorySource!.quality.sourceUrl = report.sourceUrl;
    for (const period of ["cumulative", "singleQuarter"] as const) {
      const audit = financialChartAudit(stock, detail, [report, adjacent], period, "consolidated");
      expect(audit.records).toHaveLength(2);
      for (const record of audit.records) expect(value(record.rows, "report revision")).toBe(UNKNOWN);
      expect(audit.records.map(record => value(record.rows, "Provider 版本（非 report revision）"))).toEqual(expect.arrayContaining(["provider-v99", "provider-v100"]));
      expectUnproven(audit);
    }
    expectUnproven(priceChartAudit(stock, stock.priceHistory!));
  });

  it("cannot borrow unrelated stock quality to identify price provenance", () => {
    const { stock } = fixture();
    const noOwner: Stock = { ...stock, priceHistorySource: undefined, dataQuality: [{ source: "official-history-kline", sourceEndpoint: "price", sourceUrl: "https://example.com/shared", status: "real" }] };
    const audit = priceChartAudit(noOwner, noOwner.priceHistory!);
    expect(value(audit.rows, "来源身份")).toBe(UNKNOWN);
    expect(audit.rows.some(item => item.href)).toBe(false);
    expectUnproven(audit);
  });
});
