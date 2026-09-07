import { describe, expect, it } from "vitest";
import type { StockQuote } from "../types";
import { describeDataTime, describeQuote, summarizeDataTimes, summarizeQuotes, summarizeSourceStatuses } from "./dataTrustDisplay";
import { isRecentlyUpdated } from "./dataQuality";

const now = new Date("2026-09-07T12:00:00+08:00");
const quote = (updatedAt?: string, status: StockQuote["quality"]["status"] = "real") => ({
  id: "fixture", latestPrice: 12, pctChange: -2, marketCap: null, pe: null, pb: null,
  updatedAt, quality: { source: "fixture source", status },
} satisfies StockQuote);

describe("data trust presentation", () => {
  it.each([
    ["2026-09-07T12:00:00+08:00", "recent", true],
    ["2026-09-06T12:00:00+08:00", "recent", true],
    ["2026-09-06T11:59:59+08:00", "older", false],
    ["2026-07-05T12:00:00+08:00", "older", false],
    [undefined, "missing", false], ["", "missing", false],
    ["bad date", "invalid", false], ["2026-02-30T12:00:00Z", "invalid", false],
    ["2026-13-01", "invalid", false], ["2026年02月30日", "invalid", false],
    ["2025年05月07日", "date_only", false], ["2027年01月01日", "future", false], ["2026-09-07T12:00:00", "invalid", false],
    ["2026-09-07T12:00:01+08:00", "future", false],
    ["2026-09-08", "future", false], ["2026-09-07", "date_only", false],
  ] as const)("classifies %s without inventing freshness", (value, state, recent) => {
    expect(describeDataTime(value, "collected", now).state).toBe(state);
    expect(describeDataTime(value, "collected", now).text).toContain("时效待核验");
    expect(isRecentlyUpdated(value, now)).toBe(recent);
  });

  it.each(["2026年06月份", "2026年第1季度", "2026-Q2", "2026-08", "2026-06-30"])("keeps %s as a native report period", (value) => {
    const display = describeDataTime(value, "period", now);
    expect(display.state).toBe("period");
    expect(display.text).toContain(`报告期：${value}`);
    expect(display.text).toContain("发布时间未知");
    expect(display.text).not.toMatch(/24 小时|已过/);
  });

  it.each(["2026年13月份", "2026年第5季度", "2026-02-30"])("rejects invalid period %s", (value) => {
    expect(describeDataTime(value, "period", now).state).toBe("invalid");
  });
  it.each(["2026年10月份", "2026年第4季度"])("flags future period %s", (value) => {
    expect(describeDataTime(value, "period", now).state).toBe("future");
  });

  it("preserves real source facts and historic values as time passes", () => {
    const q = quote("2026-07-05T12:00:00+08:00");
    expect(describeQuote(q, now)).toMatchObject({ source: "行情来源：fixture source · 真实数据", coverage: "价格已覆盖", time: { state: "older" } });
    expect(q.latestPrice).toBe(12);
    expect(q.quality.status).toBe("real");
  });

  it("counts missing and mixed records in the full denominator, independent of source status", () => {
    const quotes = [quote(now.toISOString()), quote("2026-07-01T00:00:00Z", "stale"), undefined, quote("bad", "partial"), quote(undefined, "conflicted"), { ...quote(now.toISOString()), latestPrice: null }];
    const summary = summarizeQuotes(quotes, now);
    expect(summary).toMatchObject({ total: 6, covered: 4, real: 2, realCovered: 1, times: { recent: 2, older: 1, missing: 2, invalid: 1 } });
    expect(summary.text).toContain("24 小时内 2/6");
    expect(summarizeSourceStatuses(["real", "partial", "conflicted", undefined])).toBe("真实数据 1/4；部分可用 1/4；冲突 1/4；未知 1/4");
  });

  it("handles empty and entirely missing datasets without a fresh/real aggregate", () => {
    expect(summarizeQuotes([], now)).toMatchObject({ total: 0, covered: 0, real: 0, times: { recent: 0 } });
    expect(summarizeQuotes([undefined, undefined], now)).toMatchObject({ total: 2, covered: 0, real: 0, times: { missing: 2, recent: 0 } });
    expect(summarizeDataTimes([{ kind: "period", value: "2026-Q1" }, { kind: "collected", value: now.toISOString() }, { kind: "observation", value: "2026-09-06" }], now)).toMatchObject({ total: 3, period: 1, recent: 1, dateOnly: 1 });
  });

  it("does not fall back to now or another quality timestamp", () => {
    const q = { ...quote(), quality: { source: "fixture", status: "real" as const, updatedAt: now.toISOString() } };
    expect(describeQuote(q, now).time.state).toBe("missing");
    expect(describeDataTime(now.toISOString(), "collected", new Date("invalid")).state).toBe("unknown");
    expect(describeDataTime(now.toISOString(), "unknown", now).state).toBe("unknown");
  });
});
