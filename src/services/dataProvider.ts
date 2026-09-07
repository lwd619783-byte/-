import { summarizeQuotes } from "../utils/dataTrustDisplay";
import { getMockDashboardData } from "./providers/mockProvider";
import { getAStockData } from "./providers/aStockDataProvider";
import { enrichStocksWithRealData } from "./stockProvider";
import type { DashboardDataMode, GeneratedRealDataBundle } from "../types";

export function buildDashboardDataset(mode: DashboardDataMode, realData: GeneratedRealDataBundle = getAStockData()) {
  const mock = getMockDashboardData();
  const stocks = enrichStocksWithRealData(mock.stocks, realData, mode);
  const realQualities = stocks.flatMap((stock) => stock.dataQuality ?? []);
  const hasReal = realQualities.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale");
  const hasMockFallback = stocks.some((stock) => (stock.missingFields?.length ?? 0) > 0) || !hasReal;
  const aShareQuotes = summarizeQuotes(stocks.filter((stock) => stock.market === "A股").map((stock) => stock.quote));
  const hkQuotes = summarizeQuotes(stocks.filter((stock) => stock.market === "港股").map((stock) => stock.quote));
  const coverageSummary = `A股行情真实来源且有价格 ${aShareQuotes.realCovered}/${aShareQuotes.total}；港股行情真实来源且有价格 ${hkQuotes.realCovered}/${hkQuotes.total}；覆盖不代表时效；港股财务暂未接入`;

  const modeLabel =
    mode === "mock" ? "Mock Data" : hasReal && !hasMockFallback && mode === "real" ? "Real Data" : "Mixed Data";

  return {
    ...mock,
    stocks,
    mode,
    modeLabel,
    coverageSummary,
    realManifest: realData.manifest,
    dataUpdatedAt: realData.manifest.updatedAt ?? "",
    dataSourceNote:
      mode === "mock"
        ? mock.dataSourceNote
        : `${modeLabel}；数据源：A Stock Data（${realData.manifest.sourceSummary.join("、") || "本地缓存"}）；${coverageSummary}；缺失字段显示“数据暂缺”。`,
  };
}

export const MergedDataProvider = { buildDashboardDataset };
