import type { DataQualityMeta, GeneratedRealDataBundle, Stock } from "../types";
import { countMissingFields, isRecentlyUpdated, mergeQuality } from "../utils/dataQuality";
import { formatNumber, formatPercent, formatYi } from "../utils/normalize";

export function enrichStocksWithRealData(stocks: Stock[], real: GeneratedRealDataBundle, useReal: boolean) {
  return stocks.map((stock) => {
    const profile = real.profiles[stock.id];
    const quote = real.quotes[stock.id];
    const realFinancial = real.financials[stock.id];
    const history = real.priceHistory[stock.id];
    const research = real.research[stock.id];
    const announcements = real.announcements[stock.id];
    const signals = real.signals[stock.id];
    const sectorMembership = real.sectorMembership[stock.id];
    const dataQuality = useReal
      ? mergeQuality(
          profile?.quality,
          quote?.quality,
          realFinancial?.quality,
          history?.quality,
          research?.quality,
          announcements?.quality,
          signals?.quality,
          sectorMembership?.quality,
        )
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
            revenue: realFinancial?.revenue ?? null,
            netProfit: realFinancial?.netProfit ?? null,
            roe: realFinancial?.roe ?? null,
            operatingCashFlow: realFinancial?.operatingCashFlow ?? null,
          });
          const moduleQualities: Array<[string, DataQualityMeta | undefined]> = [
            ["quotes", quote?.quality],
            ["priceHistory", history?.quality],
            ["financials", realFinancial?.quality],
            ["profiles", profile?.quality],
            ["research", research?.quality],
            ["announcements", announcements?.quality],
            ["signals", signals?.quality],
            ["sectorMembership", sectorMembership?.quality],
          ];
          const moduleMissingFields = moduleQualities
            .filter(([, quality]) => quality?.status === "missing" || quality?.status === "error")
            .map(([module]) => module as string);
          return [...new Set([...valueMissingFields, ...moduleMissingFields])];
        })()
      : [];
    const dataCoverage = useReal ? Math.max(0, Math.round(((19 - missingFields.length) / 19) * 100)) : 0;

    if (!useReal) {
      return {
        ...stock,
        dataQuality,
        missingFields,
        dataCoverage,
        isRecentlyUpdated: false,
      };
    }

    return {
      ...stock,
      profile,
      quote,
      realFinancial,
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
        ...stock.financial,
        revenue: realFinancial ? formatYi(realFinancial.revenue) : stock.financial.revenue,
        netProfit: realFinancial ? formatYi(realFinancial.netProfit) : stock.financial.netProfit,
        grossMargin: realFinancial ? formatPercent(realFinancial.grossMargin) : stock.financial.grossMargin,
        netMargin: realFinancial ? formatPercent(realFinancial.netMargin) : stock.financial.netMargin,
        roe: realFinancial ? formatPercent(realFinancial.roe) : stock.financial.roe,
        debtRatio: realFinancial ? formatPercent(realFinancial.debtRatio) : stock.financial.debtRatio,
        operatingCashFlow: realFinancial ? formatYi(realFinancial.operatingCashFlow) : stock.financial.operatingCashFlow,
        revenueGrowth: realFinancial ? formatPercent(realFinancial.revenueGrowth) : stock.financial.revenueGrowth,
        profitGrowth: realFinancial ? formatPercent(realFinancial.profitGrowth) : stock.financial.profitGrowth,
        marketCap: quote ? formatYi(quote.marketCap) : stock.financial.marketCap,
      },
      valuation: {
        ...stock.valuation,
        pe: quote ? formatNumber(quote.pe) : stock.valuation.pe,
        pb: quote ? formatNumber(quote.pb) : stock.valuation.pb,
        ps: quote ? formatNumber(quote.ps) : stock.valuation.ps,
        dividendYield: quote ? formatPercent(quote.dividendYield) : stock.valuation.dividendYield,
      },
    };
  });
}
