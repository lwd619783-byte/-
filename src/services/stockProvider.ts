import type { DashboardDataMode, DataQualityMeta, FinancialFetchStatus, GeneratedRealDataBundle, Stock } from "../types";
import { countMissingFields, isRecentlyUpdated, mergeQuality } from "../utils/dataQuality";
import { formatFinancialChangeMetric, resolveFinancialDisplayValue } from "../utils/financialDisplay";
import { formatNumber, formatPercent, formatYi } from "../utils/normalize";

export function enrichStocksWithRealData(stocks: Stock[], real: GeneratedRealDataBundle, mode: DashboardDataMode) {
  const useReal = mode !== "mock";
  return stocks.map((stock) => {
    const profile = real.profiles[stock.id];
    const quote = real.quotes[stock.id];
    const summary = real.aShareFinancialSummaries[stock.id];
    const financialStatus: FinancialFetchStatus | "not_implemented" = summary?.status ?? (stock.market === "港股" ? "not_implemented" : "source_unavailable");
    const financialQuality: DataQualityMeta = summary?.quality ?? {
      source: stock.market === "港股" ? "HK financial provider" : "A-share financial summary",
      status: financialStatus,
      errorMessage: stock.market === "港股" ? "港股财务数据暂未接入" : "A 股财务摘要暂未获取",
    };
    const latestSingle = summary?.latestSingleQuarter;
    const latestRatios = summary?.latestRatios;
    const latestChanges = summary?.latestChanges;
    const history = real.priceHistory[stock.id];
    const research = real.research[stock.id];
    const announcements = real.announcements[stock.id];
    const signals = real.signals[stock.id];
    const sectorMembership = real.sectorMembership[stock.id];
    const dataQuality = useReal
      ? mergeQuality(profile?.quality, quote?.quality, financialQuality, history?.quality, research?.quality, announcements?.quality, signals?.quality, sectorMembership?.quality)
      : [{ source: "mock", status: "mock" as const }];

    const missingFields = useReal
      ? (() => {
          const isUnsupportedMarket = dataQuality.some((item) => item.status === "unsupported_market");
          if (isUnsupportedMarket) return [];
          const valueMissingFields = countMissingFields({
            latestPrice: quote?.latestPrice ?? null,
            pctChange: quote?.pctChange ?? null,
            marketCap: quote?.marketCap ?? null,
            floatMarketCap: quote?.floatMarketCap ?? null,
            pe: quote?.pe ?? null,
            pb: quote?.pb ?? null,
            ps: quote?.ps ?? null,
            revenue: latestSingle?.operatingRevenue ?? null,
            netProfit: latestSingle?.netProfitAttributableToParent ?? null,
            roe: null,
            operatingCashFlow: latestSingle?.netOperatingCashFlow ?? null,
          });
          const moduleQualities: Array<[string, DataQualityMeta | undefined]> = [
            ["quotes", quote?.quality], ["priceHistory", history?.quality], ["financials", financialQuality], ["profiles", profile?.quality],
            ["research", research?.quality], ["announcements", announcements?.quality], ["signals", signals?.quality], ["sectorMembership", sectorMembership?.quality],
          ];
          const moduleMissingFields = moduleQualities
            .filter(([, quality]) => quality && ["missing", "error", "not_implemented", "source_unavailable"].includes(String(quality.status)))
            .map(([module]) => module);
          return [...new Set([...valueMissingFields, ...moduleMissingFields])];
        })()
      : [];
    const dataCoverage = useReal ? Math.max(0, Math.round(((19 - missingFields.length) / 19) * 100)) : 0;

    if (!useReal) {
      return { ...stock, dataMode: mode, dataQuality, missingFields, dataCoverage, isRecentlyUpdated: false };
    }

    const amountInYi = (value: number) => formatYi(value / 100_000_000);
    const decimalPercent = (value: number) => formatPercent(value * 100);
    return {
      ...stock,
      dataMode: mode,
      profile,
      quote,
      realFinancial: undefined,
      aShareFinancialSummary: summary,
      priceHistory: history?.points ?? [],
      research,
      announcements,
      signals,
      sectorMembership,
      dataQuality,
      missingFields,
      dataCoverage,
      isRecentlyUpdated: dataQuality.some((item) => isRecentlyUpdated(item.updatedAt)),
      financial: {
        revenue: resolveFinancialDisplayValue({ mode, realValue: latestSingle?.operatingRevenue, status: financialStatus, mockValue: stock.financial.revenue, formatter: amountInYi }),
        netProfit: resolveFinancialDisplayValue({ mode, realValue: latestSingle?.netProfitAttributableToParent, status: financialStatus, mockValue: stock.financial.netProfit, formatter: amountInYi }),
        grossMargin: resolveFinancialDisplayValue({ mode, realValue: latestRatios?.grossMargin, status: summary?.fieldStatus.grossMargin === "not_applicable" ? "not_applicable" : financialStatus, mockValue: stock.financial.grossMargin, formatter: decimalPercent }),
        netMargin: resolveFinancialDisplayValue({ mode, realValue: latestRatios?.netMargin, status: financialStatus, mockValue: stock.financial.netMargin, formatter: decimalPercent }),
        roe: resolveFinancialDisplayValue({ mode, realValue: null, status: financialStatus, mockValue: stock.financial.roe, formatter: decimalPercent }),
        debtRatio: resolveFinancialDisplayValue({ mode, realValue: latestRatios?.debtToAssetRatio, status: financialStatus, mockValue: stock.financial.debtRatio, formatter: decimalPercent }),
        operatingCashFlow: resolveFinancialDisplayValue({ mode, realValue: latestSingle?.netOperatingCashFlow, status: financialStatus, mockValue: stock.financial.operatingCashFlow, formatter: amountInYi }),
        revenueGrowth: formatFinancialChangeMetric(latestChanges?.revenueYoY),
        profitGrowth: formatFinancialChangeMetric(latestChanges?.parentNetProfitYoY),
        marketCap: quote ? formatYi(quote.marketCap) : "暂未获取",
      },
      valuation: {
        ...stock.valuation,
        pe: quote ? formatNumber(quote.pe) : "暂未获取",
        pb: quote ? formatNumber(quote.pb) : "暂未获取",
        ps: quote ? formatNumber(quote.ps) : "暂未获取",
        dividendYield: quote ? formatPercent(quote.dividendYield) : "暂未获取",
      },
    };
  });
}
