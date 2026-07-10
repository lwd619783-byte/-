import { describe, expect, it } from "vitest";
import { financialUnavailableLabel, resolveFinancialDisplayValue } from "./financialDisplay";

describe("financial display fallback policy", () => {
  it("keeps mock values only in mock mode", () => {
    expect(resolveFinancialDisplayValue({ mode: "mock", realValue: null, status: "source_unavailable", mockValue: "123 亿元" })).toBe("123 亿元");
  });

  it("does not fall back to mock values in real or mixed mode", () => {
    expect(resolveFinancialDisplayValue({ mode: "real", realValue: null, status: "source_unavailable", mockValue: "123 亿元" })).toBe("数据获取失败");
    expect(resolveFinancialDisplayValue({ mode: "mixed", realValue: null, status: "partial", mockValue: "123 亿元" })).toBe("暂未获取");
    expect(resolveFinancialDisplayValue({ mode: "mixed", realValue: 0, status: "success", mockValue: "123 亿元" })).toBe("0");
  });

  it("uses the explicit Hong Kong not-implemented message", () => {
    expect(financialUnavailableLabel("港股", "not_implemented")).toBe("港股财务数据暂未接入");
  });
});
