import { describe, expect, it } from "vitest";
import { displayFinancialField, financialStatusLabel, formatFinancialAmount, formatFinancialRatio } from "./StockDetailDrawer";

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
});
