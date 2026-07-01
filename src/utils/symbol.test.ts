import { describe, expect, it } from "vitest";
import { getSymbolMapping, toProviderSymbol } from "./symbol";

describe("symbol mapping", () => {
  it("keeps a stable internal symbol and converts per provider", () => {
    const mapping = getSymbolMapping("sugon");

    expect(mapping?.standardSymbol).toBe("603019.SH");
    expect(toProviderSymbol("sugon", "akshare")).toBe("603019");
    expect(toProviderSymbol("sugon", "baostock")).toBe("sh.603019");
  });

  it("supports Hong Kong tickers without leaking provider format into components", () => {
    expect(toProviderSymbol("lenovo", "aStockData")).toBeNull();
    expect(getSymbolMapping("lenovo")?.aStockDataStatus).toBe("unsupported_market");
  });

  it("uses the A-share line for dual-listed BeiGene in the first phase", () => {
    const mapping = getSymbolMapping("beigene");

    expect(mapping?.standardSymbol).toBe("688235.SH");
    expect(mapping?.market).toBe("A股");
    expect(toProviderSymbol("beigene", "aStockData")).toBe("688235");
  });
});
