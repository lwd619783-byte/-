import { getMockDashboardData } from "./providers/mockProvider";
import { getAStockData } from "./providers/aStockDataProvider";
import { enrichStocksWithRealData } from "./stockProvider";
import type { DashboardDataMode, GeneratedRealDataBundle } from "../types";

export function buildDashboardDataset(mode: DashboardDataMode, realData: GeneratedRealDataBundle = getAStockData()) {
  const mock = getMockDashboardData();
  const useReal = mode !== "mock";
  const stocks = enrichStocksWithRealData(mock.stocks, realData, useReal);
  const realQualities = stocks.flatMap((stock) => stock.dataQuality ?? []);
  const hasReal = realQualities.some((item) => item.status === "real" || item.status === "stale");
  const hasMockFallback = stocks.some((stock) => (stock.missingFields?.length ?? 0) > 0) || !hasReal;
  const aShareCount = stocks.filter((stock) => stock.market === "A股").length;
  const aShareRealCount = stocks.filter(
    (stock) => stock.market === "A股" && stock.dataQuality?.some((item) => item.status === "real" || item.status === "stale"),
  ).length;
  const unsupportedCount = stocks.filter((stock) => stock.dataQuality?.some((item) => item.status === "unsupported_market")).length;
  const coverageSummary = `A股真实覆盖 ${aShareRealCount}/${aShareCount}，暂不支持市场 ${unsupportedCount}/${stocks.length}`;

  const modeLabel =
    mode === "mock" ? "Mock Data" : hasReal && !hasMockFallback && mode === "real" ? "Real Data" : hasReal ? "Mixed Data" : "Mock Data";

  return {
    ...mock,
    stocks,
    mode,
    modeLabel,
    coverageSummary,
    realManifest: realData.manifest,
    dataUpdatedAt: realData.manifest.updatedAt ?? mock.dataUpdatedAt,
    dataSourceNote:
      mode === "mock"
        ? mock.dataSourceNote
        : `${modeLabel}；数据源：A Stock Data（${realData.manifest.sourceSummary.join("、") || "本地缓存"}）；${coverageSummary}；缺失字段显示“数据暂缺”。`,
  };
}

export const MergedDataProvider = { buildDashboardDataset };
