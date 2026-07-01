import { symbolMap } from "../utils/symbol";

export const stockUniverse = symbolMap.map((item) => ({
  id: item.id,
  name: item.name,
  standardSymbol: item.standardSymbol,
  market: item.market,
  aStockDataCode: item.providers.aStockData ?? null,
  aStockDataStatus: item.aStockDataStatus,
}));
