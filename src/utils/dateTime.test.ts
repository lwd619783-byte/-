import { describe, expect, it } from "vitest";
import type { EarningsExpectationSnapshot, ResearchEvent } from "../types";
import { compareEarningsExpectation } from "../services/earningsExpectationComparisonProvider";
import { validateEarningsExpectationSnapshot } from "../services/earningsExpectationRepository";
import {
  compareBusinessTemporal,
  getCalendarDateInTimeZone,
  getCalendarToday,
  isoToZonedLocalDateTime,
  isCalendarDate,
  isPreciseInstant,
  isValidTimeZone,
  laterBusinessTemporal,
  resolveTimeZone,
  resolveWorkflowTemporalInput,
  resolveZonedLocalDateTime,
  toBusinessTemporal,
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
  it("rejects the New York spring DST gap instead of normalizing it", () => {
    expect(resolveZonedLocalDateTime("2026-03-08T02:30", "America/New_York")).toEqual({ status: "nonexistent", candidates: [] });
    expect(zonedLocalDateTimeToIso("2026-03-08T02:30", "America/New_York")).toBeNull();
  });
  it("reports both New York fall DST overlap instants instead of guessing", () => {
    const result = resolveZonedLocalDateTime("2026-11-01T01:30", "America/New_York");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") expect(result.candidates).toEqual([{ instant: "2026-11-01T05:30:00.000Z", offsetMinutes: -240 }, { instant: "2026-11-01T06:30:00.000Z", offsetMinutes: -300 }]);
  });
  it("round-trips a normal New York time immediately after the spring transition", () => {
    const result = resolveZonedLocalDateTime("2026-03-08T03:30", "America/New_York");
    expect(result).toMatchObject({ status: "valid", instant: "2026-03-08T07:30:00.000Z" });
    if (result.status === "valid") expect(isoToZonedLocalDateTime(result.instant, "America/New_York")).toBe("2026-03-08T03:30");
  });
  it("resolves fixed clocks and London DST transitions without false ambiguity", () => {
    expect(resolveZonedLocalDateTime("2026-07-14T00:30", "Asia/Shanghai")).toMatchObject({ status: "valid", instant: "2026-07-13T16:30:00.000Z" });
    expect(resolveZonedLocalDateTime("2026-07-14T00:30", "Asia/Tokyo")).toMatchObject({ status: "valid", instant: "2026-07-13T15:30:00.000Z" });
    expect(resolveZonedLocalDateTime("2026-03-29T01:30", "Europe/London").status).toBe("nonexistent");
    expect(resolveZonedLocalDateTime("2026-10-25T01:30", "Europe/London").status).toBe("ambiguous");
  });
  it("rejects invalid zones instead of silently using the host zone", () => {
    expect(resolveZonedLocalDateTime("2026-07-14T00:30", "Not/AZone").status).toBe("invalid");
  });
  it("stays stable across repeated resolution and ignores the host zone when a workflow zone is explicit", () => {
    const first = resolveZonedLocalDateTime("2026-07-14T00:30", "Asia/Tokyo");
    const second = resolveZonedLocalDateTime("2026-07-14T00:30", "Asia/Tokyo");
    expect(second).toEqual(first);
    expect(first).toMatchObject({ status: "valid", instant: "2026-07-13T15:30:00.000Z" });
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
    const value = snapshot({ asOfDate: "2026-07-13", formedAt: "2026-07-13T15:30:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute", formedAtTimeZone: "Asia/Tokyo" });
    expect(validateEarningsExpectationSnapshot(value, { now: new Date("2026-07-14T12:00:00.000Z"), timeZone: "Asia/Tokyo" }).some((item) => item.includes("业务日期"))).toBe(true);
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
    expect(result.performanceDisclosureTimingStatus).toBe("unknown");
    expect(result.nonComparableReasons.some((item) => item.includes("同日") && item.includes("先后顺序"))).toBe(true);
  });
  it("resolves an unzoned source time with the explicit workflow zone rather than a browser zone", () => {
    const shanghai = resolveWorkflowTemporalInput("2026-07-15T15:00", "Asia/Shanghai");
    const tokyo = resolveWorkflowTemporalInput("2026-07-15T15:00", "Asia/Tokyo");
    expect(shanghai).toMatchObject({ status: "local", value: "2026-07-15T07:00:00.000Z", interpretedTimeZone: "Asia/Shanghai" });
    expect(tokyo).toMatchObject({ status: "local", value: "2026-07-15T06:00:00.000Z", interpretedTimeZone: "Asia/Tokyo" });
  });
  it("keeps dates as dates and offset/Z source times as absolute instants", () => {
    expect(resolveWorkflowTemporalInput("2026-07-15", "Asia/Shanghai")).toMatchObject({ status: "date", value: "2026-07-15", precision: "date" });
    expect(resolveWorkflowTemporalInput("2026-07-15T15:00:00+08:00", "Asia/Tokyo")).toMatchObject({ status: "absolute", value: "2026-07-15T07:00:00.000Z" });
    expect(resolveWorkflowTemporalInput("2026-07-15T07:00:00Z", "Asia/Tokyo")).toMatchObject({ status: "absolute", value: "2026-07-15T07:00:00.000Z" });
  });
  it("rejects source-time DST gaps and overlaps without guessing", () => {
    expect(resolveWorkflowTemporalInput("2026-03-08T02:30", "America/New_York").status).toBe("nonexistent");
    expect(resolveWorkflowTemporalInput("2026-11-01T01:30", "America/New_York").status).toBe("ambiguous");
  });
  it("distinguishes an exact equal instant from date or mixed-precision uncertainty", () => {
    const exact = toBusinessTemporal("2026-07-15T07:00:00.000Z", "datetime", "Asia/Shanghai")!;
    const same = toBusinessTemporal("2026-07-15T15:00:00+08:00", "datetime", "Asia/Shanghai")!;
    const date = toBusinessTemporal("2026-07-15", "date", "Asia/Shanghai")!;
    expect(compareBusinessTemporal(exact, same)).toMatchObject({ order: 0, uncertain: false, status: "equal", reason: null });
    expect(compareBusinessTemporal(date, date)).toMatchObject({ order: 0, uncertain: true, status: "uncertain", reason: "date_precision" });
    expect(compareBusinessTemporal(date, exact)).toMatchObject({ order: 0, uncertain: true, status: "uncertain", reason: "mixed_precision" });
    expect(laterBusinessTemporal(exact, same, "left")).toEqual(exact);
  });
  it("marks an exact prediction/disclosure tie as same_time and never ex-ante", () => {
    const tied = compareEarningsExpectation(snapshot({ formedAt: "2026-07-15T15:00:00+08:00", formedAtPrecision: "datetime", asOfDate: "2026-07-15" }), [actual("2026-07-15T07:00:00Z")], { ...comparisonSettings(), timeZone: "Asia/Shanghai" });
    expect(tied.actualDisclosureTimingStatus).toBe("same_time");
    expect(tied.performanceDisclosureTimingStatus).toBe("same_time");
    expect(tied.isExAnte).toBe(false);
    expect(tied.nonComparableReasons.some((reason) => reason.includes("相同"))).toBe(true);
  });
});

function snapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  const value: EarningsExpectationSnapshot = {
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
    sourcePublishedAtResolution: null,
    sourcePublishedAtTimeZone: null,
    sourcePublishedAtCalendarDate: null,
    asOfDate: "2026-07-14",
    formedAt: null,
    formedAtPrecision: "date",
    formedAtResolution: "date",
    formedAtTimeZone: null,
    formedAtCalendarDate: "2026-07-14",
    analystCount: null,
    institutionCount: null,
    ingestionMethod: "manual",
    createdAt: "2026-07-13T15:30:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId: null,
    correctionScope: null,
    schemaVersion: 2,
    ...overrides,
  };
  if (!("formedAtCalendarDate" in overrides)) value.formedAtCalendarDate = value.asOfDate;
  if (!("sourcePublishedAtCalendarDate" in overrides)) value.sourcePublishedAtCalendarDate = isCalendarDate(value.sourcePublishedAt)
    ? value.sourcePublishedAt
    : isPreciseInstant(value.sourcePublishedAt) && isValidTimeZone(value.sourcePublishedAtTimeZone)
      ? getCalendarDateInTimeZone(value.sourcePublishedAt, value.sourcePublishedAtTimeZone)
      : value.sourcePublishedAt ? String(value.sourcePublishedAt).slice(0, 10) : null;
  return value;
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
