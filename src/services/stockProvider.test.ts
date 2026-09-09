import { describe, expect, it } from "vitest";
import { stocks } from "../data/stocks";
import type { AShareFinancialSummary, GeneratedRealDataBundle, Stock } from "../types";
import { formatStockFieldCoverage, formatStockModuleCoverage } from "../utils/stockCoverage";
import { enrichStocksWithRealData } from "./stockProvider";

const stock = stocks[0];

function emptyBundle(): GeneratedRealDataBundle {
  return {
    manifest: { updatedAt: null, status: "missing", sourceSummary: [], errors: [] },
    profiles: {}, quotes: {}, aShareFinancialSummaries: {}, priceHistory: {}, research: {},
    aShareAnnouncementSummaries: {}, signals: {}, sectorMembership: {},
  };
}

function financialSummary(): AShareFinancialSummary {
  const change = { value: null, changeAmount: null, reason: "missing_value" as const, baseSign: null };
  return {
    id: stock.id, stockCode: stock.code, companyName: stock.name, market: "SH", industryType: "general", status: "success",
    errorCode: null, errorMessage: null, provider: "synthetic fixture", providerVersion: "1", fetchedAt: "2026-01-01T00:00:00Z",
    generatedAt: "2026-01-01T00:00:00Z", lastSuccessfulFetchAt: null, currentFetchError: null,
    quality: { source: "synthetic fixture", status: "real" }, latestReportPeriod: "2025-12-31", latestReportType: "FY",
    latestSingleQuarter: { operatingRevenue: 0, netProfitAttributableToParent: 0, netProfitExcludingNonRecurring: 0, netOperatingCashFlow: 0 },
    latestChanges: { revenueYoY: change, revenueQoQ: change, parentNetProfitYoY: change, parentNetProfitQoQ: change, deductedNetProfitYoY: change, deductedNetProfitQoQ: change },
    latestRatios: { grossMargin: 0, netMargin: 0, debtToAssetRatio: 0, researchExpenseRatio: 0 },
    latestBalanceSheet: { accountsReceivable: 0, inventory: 0 }, fieldStatus: {}, detailPath: "data/synthetic.json",
  };
}

function populatedNumericBundle() {
  const bundle = emptyBundle();
  bundle.quotes[stock.id] = {
    id: stock.id, latestPrice: 0, pctChange: 0, marketCap: 0, floatMarketCap: 0, pe: 0, pb: 0, ps: null,
    quality: { source: "synthetic fixture", status: "real" },
  };
  bundle.aShareFinancialSummaries[stock.id] = financialSummary();
  return bundle;
}

describe("stock coverage truthfulness", () => {
  it("does not call an unsupported market 100 percent covered", () => {
    const bundle = emptyBundle();
    bundle.quotes[stock.id] = {
      id: stock.id, latestPrice: null, pctChange: null, marketCap: null, pe: null, pb: null,
      quality: { source: "unsupported fixture", status: "unsupported_market" },
    };
    const result = enrichStocksWithRealData([{ ...stock, market: "美股" } as Stock], bundle, "real")[0];
    expect(result.dataCoverage).toBeNull();
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 0, denominator: 0, percent: null });
    expect(formatStockFieldCoverage(result.dataCoverageDetails)).toContain("N/A");
  });

  it("records a wholly absent price-history module", () => {
    const result = enrichStocksWithRealData([stock], populatedNumericBundle(), "real")[0];
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "priceHistory", status: "missing" });
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 12, denominator: 12 });
    expect(formatStockModuleCoverage(result.dataCoverageDetails)).toContain("缺失/失败模块 5");
    expect(result.missingFields).not.toContain("priceHistory");
  });

  it("counts missing quote and financial modules as absent eligible fields", () => {
    const result = enrichStocksWithRealData([stock], emptyBundle(), "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 0, denominator: 12, percent: 0 });
    expect(result.missingFields).toHaveLength(12);
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "quotes", status: "missing" });
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "financials", status: "missing" });
  });

  it("preserves real zero and excludes fields with no implemented source", () => {
    const result = enrichStocksWithRealData([stock], populatedNumericBundle(), "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 12, denominator: 12, percent: 100 });
    expect(result.missingFields).toEqual([]);
    expect(result.missingFields).not.toContain("roe");
    expect(result.missingFields).not.toContain("ps");
    expect(formatStockFieldCoverage(result.dataCoverageDetails)).toBe("12/12（100%）");
  });

  it("reports partial fields independently from module state and freshness", () => {
    const bundle = populatedNumericBundle();
    bundle.quotes[stock.id].pctChange = null;
    bundle.quotes[stock.id].quality.status = "partial";
    const result = enrichStocksWithRealData([stock], bundle, "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 11, denominator: 12, percent: 92 });
    expect(result.missingFields).toEqual(["pctChange"]);
    expect(formatStockModuleCoverage(result.dataCoverageDetails)).toContain("部分模块 1");
    bundle.quotes[stock.id].quality.status = "stale";
    const stale = enrichStocksWithRealData([stock], bundle, "real")[0];
    expect(stale.dataCoverage).toBe(result.dataCoverage);
    expect(stale.dataCoverageDetails.modules).toContainEqual({ id: "quotes", status: "stale" });
    expect(stale.isRecentlyUpdated).toBe(false);
  });

  it("excludes not-applicable financial fields from the denominator", () => {
    const bundle = populatedNumericBundle();
    bundle.aShareFinancialSummaries[stock.id].latestRatios.grossMargin = null;
    bundle.aShareFinancialSummaries[stock.id].fieldStatus.grossMargin = "not_applicable";
    const result = enrichStocksWithRealData([stock], bundle, "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 11, denominator: 11 });
    expect(result.dataCoverageDetails.excludedFields).toContain("grossMargin");
    expect(result.missingFields).not.toContain("grossMargin");
  });

  it("does not let an unsupported non-numeric module erase other missing fields", () => {
    const bundle = populatedNumericBundle();
    bundle.quotes[stock.id].latestPrice = null;
    bundle.research[stock.id] = { id: stock.id, reports: [], quality: { source: "synthetic fixture", status: "unsupported_market" } };
    const result = enrichStocksWithRealData([stock], bundle, "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 11, denominator: 12 });
    expect(result.missingFields).toContain("latestPrice");
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "research", status: "unsupported_market" });
  });

  it("uses the implemented HK quote fields without inventing HK financial coverage", () => {
    const bundle = populatedNumericBundle();
    bundle.aShareFinancialSummaries = {};
    bundle.quotes[stock.id].ps = 0;
    bundle.quotes[stock.id].dividendYield = 0;
    const result = enrichStocksWithRealData([{ ...stock, market: "港股" }], bundle, "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 7, denominator: 7 });
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "financials", status: "not_implemented" });
    expect(result.missingFields).not.toContain("floatMarketCap");
  });

  it("reports N/A for mock mode even when generated numeric values exist", () => {
    const result = enrichStocksWithRealData([stock], populatedNumericBundle(), "mock")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 0, denominator: 0, percent: null });
    expect(formatStockFieldCoverage(result.dataCoverageDetails)).toContain("N/A");
  });

  it("does not count numeric values from a failed financial summary", () => {
    const bundle = populatedNumericBundle();
    bundle.aShareFinancialSummaries[stock.id].status = "validation_error";
    const result = enrichStocksWithRealData([stock], bundle, "real")[0];
    expect(result.dataCoverageDetails).toMatchObject({ numerator: 6, denominator: 12 });
    expect(result.dataCoverageDetails.modules).toContainEqual({ id: "financials", status: "error" });
  });
});
