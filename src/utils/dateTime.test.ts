import { describe, expect, it } from "vitest";
import type { EarningsExpectationSnapshot, ResearchEvent } from "../types";
import { compareEarningsExpectation } from "../services/earningsExpectationComparisonProvider";
import { validateEarningsExpectationSnapshot } from "../services/earningsExpectationRepository";
import {
  getCalendarDateInTimeZone,
  getCalendarToday,
  isoToZonedLocalDateTime,
  isValidTimeZone,
  resolveTimeZone,
  zonedLocalDateTimeToIso,
} from "./dateTime";

describe("workflow calendar date and IANA time-zone contract", () => {
  it("maps Tokyo 00:30 to the new local calendar day before UTC crosses", () => {
    expect(getCalendarDateInTimeZone("2026-07-13T15:30:00.000Z", "Asia/Tokyo")).toBe("2026-07-14");
  });
  it("maps Tokyo 08:59 without borrowing the UTC calendar date", () => {
    expect(getCalendarDateInTimeZone("2026-07-13T23:59:00.000Z", "Asia/Tokyo")).toBe("2026-07-14");
  });
  it("maps Tokyo 09:01 deterministically", () => {
    expect(getCalendarDateInTimeZone("2026-07-14T00:01:00.000Z", "Asia/Tokyo")).toBe("2026-07-14");
  });
  it("keeps New York on the prior day after UTC has crossed", () => {
    expect(getCalendarDateInTimeZone("2026-07-14T01:00:00.000Z", "America/New_York")).toBe("2026-07-13");
  });
  it("handles a DST-zone calendar date on both sides of the spring transition", () => {
    expect(getCalendarDateInTimeZone("2026-03-08T06:30:00.000Z", "America/New_York")).toBe("2026-03-08");
    expect(getCalendarDateInTimeZone("2026-03-08T07:30:00.000Z", "America/New_York")).toBe("2026-03-08");
  });
  it("falls back safely when the requested zone is absent or invalid", () => {
    expect(isValidTimeZone(resolveTimeZone())).toBe(true);
    expect(isValidTimeZone(resolveTimeZone("Not/AZone"))).toBe(true);
  });
  it("round-trips a Tokyo datetime-local wall clock as a precise instant", () => {
    const instant = zonedLocalDateTimeToIso("2026-07-14T00:30", "Asia/Tokyo");
    expect(instant).toBe("2026-07-13T15:30:00.000Z");
    expect(isoToZonedLocalDateTime(instant, "Asia/Tokyo")).toBe("2026-07-14T00:30");
  });
  it("allows a Tokyo-today date-only prediction at 00:30 local time", () => {
    const now = new Date("2026-07-13T15:30:00.000Z");
    expect(getCalendarToday(now, "Asia/Tokyo")).toBe("2026-07-14");
    expect(validateEarningsExpectationSnapshot(snapshot(), { now, timeZone: "Asia/Tokyo" })).toEqual([]);
  });
  it("allows a Tokyo-today source publication date", () => {
    const value = snapshot({ sourceCategory: "institution_single", sourceName: "ABC Securities", sourceTitle: "预测", sourceUrl: "https://example.com/report", sourcePublishedAt: "2026-07-14", sourcePublishedAtPrecision: "date" });
    expect(validateEarningsExpectationSnapshot(value, { now: new Date("2026-07-13T15:30:00.000Z"), timeZone: "Asia/Tokyo" })).toEqual([]);
  });
  it("rejects a precise formation time later than the injected clock", () => {
    const value = snapshot({ formedAt: "2026-07-14T00:31:00+09:00", formedAtPrecision: "datetime" });
    expect(validateEarningsExpectationSnapshot(value, { now: new Date("2026-07-13T15:30:00.000Z"), timeZone: "Asia/Tokyo" }).some((item) => item.includes("当前时刻"))).toBe(true);
  });
  it("rejects a precise formation whose workflow calendar day disagrees with asOfDate", () => {
    const value = snapshot({ asOfDate: "2026-07-13", formedAt: "2026-07-13T15:30:00.000Z", formedAtPrecision: "datetime" });
    expect(validateEarningsExpectationSnapshot(value, { now: new Date("2026-07-14T12:00:00.000Z"), timeZone: "Asia/Tokyo" }).some((item) => item.includes("asOfDate"))).toBe(true);
  });
  it("confirms same-day ex-ante status only with two exact instants", () => {
    const early = compareEarningsExpectation(snapshot({ formedAt: "2026-07-14T08:59:00+09:00", formedAtPrecision: "datetime" }), [actual("2026-07-14T09:01:00+09:00")], comparisonSettings());
    const late = compareEarningsExpectation(snapshot({ formedAt: "2026-07-14T09:02:00+09:00", formedAtPrecision: "datetime" }), [actual("2026-07-14T09:01:00+09:00")], comparisonSettings());
    expect(early.isExAnte).toBe(true);
    expect(late.isExAnte).toBe(false);
  });
  it("keeps same-day date precision conservative and explains unknown order", () => {
    const result = compareEarningsExpectation(snapshot(), [actual("2026-07-14T09:01:00+09:00")], comparisonSettings());
    expect(result.isExAnte).toBe(false);
    expect(result.nonComparableReasons.some((item) => item.includes("无法确认先后顺序"))).toBe(true);
  });
});

function snapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  return {
    id: "snapshot",
    stockId: "demo",
    market: "A股",
    reportPeriod: "2026-06-30",
    periodScope: "half_year",
    metric: "revenue",
    estimateShape: "point",
    value: 100,
    lowerBound: null,
    upperBound: null,
    currency: "CNY",
    unit: "yuan",
    accountingBasis: "PRC_GAAP",
    sourceCategory: "user_estimate",
    sourceName: "用户个人预测",
    sourceTitle: "",
    sourceUrl: null,
    sourcePublishedAt: null,
    sourcePublishedAtPrecision: null,
    asOfDate: "2026-07-14",
    formedAt: null,
    formedAtPrecision: "date",
    analystCount: null,
    institutionCount: null,
    ingestionMethod: "manual",
    createdAt: "2026-07-13T15:30:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId: null,
    correctionScope: null,
    schemaVersion: 1,
    ...overrides,
  };
}

function actual(publishedAt: string): ResearchEvent {
  return {
    id: "actual",
    stockId: "demo",
    stockName: "测试公司",
    stockCode: "000001.SZ",
    industryId: "tech",
    market: "A股",
    eventType: "financial_update",
    eventDate: "2026-07-14",
    publishedAt,
    reportPeriod: "2026-06-30",
    title: "财务更新",
    summary: "正式财务",
    sourceType: "financial_report",
    sourceName: "正式来源",
    sourceUrl: "https://example.com/actual",
    pdfUrl: null,
    verificationStatus: "verified",
    parseStatus: "not_applicable",
    materiality: "high",
    metrics: [{ key: "operatingRevenue", label: "营业收入", value: 120, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: null, sourceFinancialPeriod: "2026-06-30" }],
    relatedAnnouncementIds: [],
    relatedFinancialPeriod: "2026-06-30",
    reviewStatus: "not_required",
    reviewReasons: [],
    isRestated: false,
    updatedAt: publishedAt,
  };
}

function comparisonSettings() { return { revisionReminderThreshold: 0.1, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9, timeZone: "Asia/Tokyo" }; }
