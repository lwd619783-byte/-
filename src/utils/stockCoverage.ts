import type { DashboardDataMode, GeneratedRealDataBundle, Stock, StockDataCoverage } from "../types";

const availableStatuses = new Set(["real", "generated_real", "partial", "stale"]);
const excludedStatuses = new Set(["unsupported_market", "not_implemented", "not_applicable", "mock"]);
const missingStatuses = new Set(["missing", "error", "source_unavailable", "conflicted"]);

/** Only fields mapped by the current quote and A-share summary adapters enter this denominator. */
export function calculateStockCoverage(stock: Stock, real: GeneratedRealDataBundle, mode: DashboardDataMode) {
  const quote = real.quotes[stock.id];
  const financial = real.aShareFinancialSummaries[stock.id];
  const isSupportedMarket = stock.market === "A股" || stock.market === "港股";
  const moduleStatus = (qualityStatus: StockDataCoverage["modules"][number]["status"] | undefined, implemented = true) =>
    mode === "mock" ? "mock" : !isSupportedMarket ? "unsupported_market" : qualityStatus ?? (implemented ? "missing" : "not_implemented");
  const financialState = financial?.status === "not_applicable" ? "not_applicable"
    : financial?.status === "fetch_error" || financial?.status === "validation_error" ? "error"
    : financial?.status === "source_unavailable" ? "source_unavailable"
    : financial?.status === "partial" || financial?.status === "stale" ? financial.status : financial?.quality.status;
  const modules: StockDataCoverage["modules"] = [
    { id: "quotes", status: moduleStatus(quote?.quality.status) },
    { id: "financials", status: moduleStatus(financialState, stock.market === "A股") },
    { id: "profiles", status: moduleStatus(real.profiles[stock.id]?.quality.status) },
    { id: "priceHistory", status: moduleStatus(real.priceHistory[stock.id]?.quality.status) },
    { id: "research", status: moduleStatus(real.research[stock.id]?.quality.status, false) },
    { id: "announcements", status: moduleStatus(real.aShareAnnouncementSummaries[stock.id]?.quality.status, stock.market === "A股") },
    { id: "signals", status: moduleStatus(real.signals[stock.id]?.quality.status, stock.market === "A股") },
    { id: "sectorMembership", status: moduleStatus(real.sectorMembership[stock.id]?.quality.status, stock.market === "A股") },
  ];
  const missingFields: string[] = [];
  const excludedFields: string[] = [];
  let numerator = 0;
  let denominator = 0;
  function field(name: string, value: number | null | undefined, status: string, fieldStatus?: string) {
    if (excludedStatuses.has(status) || fieldStatus === "not_applicable") {
      excludedFields.push(name);
      return;
    }
    denominator += 1;
    if (availableStatuses.has(status) && fieldStatus !== "missing" && typeof value === "number" && Number.isFinite(value)) numerator += 1;
    else missingFields.push(name);
  }
  const quoteStatus = modules[0].status;
  field("latestPrice", quote?.latestPrice, quoteStatus);
  field("pctChange", quote?.pctChange, quoteStatus);
  field("marketCap", quote?.marketCap, quoteStatus);
  field("pe", quote?.peTtm ?? quote?.pe, quoteStatus);
  field("pb", quote?.pb, quoteStatus);
  // Tencent has no PS/dividend source; yfinance has no float-market-cap source.
  if (stock.market === "A股") field("floatMarketCap", quote?.floatMarketCap, quoteStatus);
  if (stock.market === "港股") {
    field("ps", quote?.ps, quoteStatus);
    field("dividendYield", quote?.dividendYield, quoteStatus);
  }
  const financialStatus = modules[1].status;
  const financialFields = [
    ["revenue", "operatingRevenue", financial?.latestSingleQuarter.operatingRevenue],
    ["netProfit", "netProfitAttributableToParent", financial?.latestSingleQuarter.netProfitAttributableToParent],
    ["operatingCashFlow", "netOperatingCashFlow", financial?.latestSingleQuarter.netOperatingCashFlow],
    ["grossMargin", "grossMargin", financial?.latestRatios.grossMargin],
    ["netMargin", "netMargin", financial?.latestRatios.netMargin],
    ["debtRatio", "debtToAssetRatio", financial?.latestRatios.debtToAssetRatio],
  ] as const;
  for (const [name, sourceField, value] of financialFields) field(name, value, financialStatus, financial?.fieldStatus[sourceField]);
  const details: StockDataCoverage = {
    scope: "mapped_numeric_fields", numerator, denominator,
    percent: denominator === 0 ? null : Math.round(numerator / denominator * 100),
    excludedFields, modules,
  };
  return { details, missingFields };
}

export function formatStockFieldCoverage(coverage: StockDataCoverage | undefined) {
  if (!coverage || coverage.denominator === 0) return "N/A（暂无适用字段）";
  return `${coverage.numerator}/${coverage.denominator}（${coverage.percent}%）`;
}

export function formatStockModuleCoverage(coverage: StockDataCoverage | undefined) {
  if (!coverage) return "模块状态未评估";
  const count = (statuses: Set<string>) => coverage.modules.filter((module) => statuses.has(module.status)).length;
  return `缺失/失败模块 ${count(missingStatuses)} · 部分模块 ${count(new Set(["partial"]))} · 不适用/未接入模块 ${count(excludedStatuses)}`;
}
