import { describe, expect, it } from "vitest";
import { canApplyFinancialLoad, shouldLoadAShareFinancial } from "./StockDetailDrawer";
import { displayFinancialField, financialStatusLabel, formatFinancialAmount, formatFinancialChangeMetric, formatFinancialRatio } from "../../utils/financialDisplay";

describe("A-share financial display states", () => {
  it("never renders missing values as zero", () => {
    expect(formatFinancialAmount(null)).toBe("暂未获取");
    expect(formatFinancialRatio(undefined)).toBe("暂未获取");
    expect(formatFinancialAmount(0)).toBe("0.00 元");
    expect(formatFinancialRatio(0)).toBe("0.00%");
  });

  it("distinguishes not-applicable, failed, stale, and partial states", () => {
    expect(displayFinancialField(null, "not_applicable")).toBe("不适用");
    expect(financialStatusLabel("fetch_error")).toBe("数据获取失败");
    expect(financialStatusLabel("stale")).toBe("数据已过期");
    expect(financialStatusLabel("partial")).toBe("部分字段可用");
  });

  it("formats normalized yuan and decimal ratios for presentation", () => {
    expect(formatFinancialAmount(123_456_789)).toBe("1.23 亿元");
    expect(formatFinancialRatio(0.1567)).toBe("15.67%");
  });

  it("explains negative, zero, and missing comparison bases", () => {
    expect(formatFinancialChangeMetric({ value: 1.5, changeAmount: 15, reason: null, baseSign: "negative" })).toBe("150.00%（上期为负，需谨慎解读）");
    expect(formatFinancialChangeMetric({ value: -0.5, changeAmount: -5, reason: null, baseSign: "negative" })).toBe("-50.00%（上期为负，需谨慎解读）");
    expect(formatFinancialChangeMetric({ value: null, changeAmount: 10, reason: "denominator_zero", baseSign: "zero" })).toBe("基数为 0，百分比不适用");
    expect(formatFinancialChangeMetric({ value: null, changeAmount: null, reason: "missing_value", baseSign: null })).toBe("暂未获取");
  });

  it("loads only A-share real summaries and rejects stale selections", () => {
    const aShare = { id: "a", market: "A股", dataMode: "mixed", aShareFinancialSummary: { detailPath: "data/a-share-financials/a.json" } } as never;
    const hk = { id: "hk", market: "港股", dataMode: "mixed" } as never;
    expect(shouldLoadAShareFinancial(aShare)).toBe(true);
    expect(shouldLoadAShareFinancial(hk)).toBe(false);
    expect(canApplyFinancialLoad("a", "b", true)).toBe(false);
    expect(canApplyFinancialLoad("a", "a", false)).toBe(false);
    expect(canApplyFinancialLoad("a", "a", true)).toBe(true);
  });
});
