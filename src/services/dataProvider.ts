import { getMockDashboardData } from "./providers/mockProvider";
import { getAStockData } from "./providers/aStockDataProvider";
import { enrichStocksWithRealData } from "./stockProvider";
import type { DashboardDataMode, GeneratedRealDataBundle } from "../types";

function marketCount(
  map: Partial<Record<"A股" | "港股" | "美股" | "未上市", number>> | undefined,
  market: "A股" | "港股" | "美股" | "未上市",
) {
  return map?.[market] ?? null;
}

export function buildDashboardDataset(mode: DashboardDataMode, realData: GeneratedRealDataBundle = getAStockData()) {
  const mock = getMockDashboardData();
  const stocks = enrichStocksWithRealData(mock.stocks, realData, mode);
  const realQualities = stocks.flatMap((stock) => stock.dataQuality ?? []);
  const hasReal = realQualities.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale");
  const hasMockFallback = stocks.some((stock) => (stock.missingFields?.length ?? 0) > 0) || !hasReal;
  const manifestUniverse = realData.manifest.universe;
  const quoteCoverage = realData.manifest.coverage?.quotes;
  const fallbackAShareCount = stocks.filter((stock) => stock.market === "A股").length;
  const fallbackAShareRealCount = stocks.filter(
    (stock) => stock.market === "A股" && stock.dataQuality?.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale"),
  ).length;
  const fallbackHkCount = stocks.filter((stock) => stock.market === "港股").length;
  const fallbackHkRealCount = stocks.filter(
    (stock) => stock.market === "港股" && stock.dataQuality?.some((item) => item.status === "real" || item.status === "partial" || item.status === "stale"),
  ).length;
  const fallbackHkUnsupportedCount = stocks.filter(
    (stock) => stock.market === "港股" && stock.dataQuality?.some((item) => item.status === "unsupported_market"),
  ).length;
  const aShareCount = quoteCoverage?.total ?? fallbackAShareCount;
  const aShareRealCount = quoteCoverage?.real ?? fallbackAShareRealCount;
  const hkQuoteCoverage = realData.manifest.coverage?.hkQuotes;
  const hkCount = hkQuoteCoverage?.total ?? marketCount(manifestUniverse?.markets, "港股") ?? fallbackHkCount;
  const hkRealCount = hkQuoteCoverage?.real ?? fallbackHkRealCount;
  const hkUnsupportedCount = marketCount(manifestUniverse?.unsupported, "港股") ?? fallbackHkUnsupportedCount;
  const hkMissingCount = Math.max(0, hkCount - hkRealCount);
  const hkQuoteSummary = hkQuoteCoverage
    ? hkMissingCount > 0
      ? `港股行情 ${hkRealCount}/${hkCount}，${hkMissingCount} 只暂缺；港股财务暂未接入`
      : `港股行情 ${hkRealCount}/${hkCount}；港股财务暂未接入`
    : `港股覆盖 ${hkRealCount}/${hkCount}，暂未接入 ${hkUnsupportedCount}/${hkCount}`;
  const coverageSummary = `A股覆盖 ${aShareRealCount}/${aShareCount}；${hkQuoteSummary}`;

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
