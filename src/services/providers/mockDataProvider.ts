import { industries } from "../../data/industries";
import { dataSourceNote, dataUpdatedAt, macroIndicators } from "../../data/macroData";
import { stocks } from "../../data/stocks";

export function getMockDashboardData() {
  return {
    industries,
    stocks,
    watchlist: [],
    macroIndicators,
    dataUpdatedAt,
    dataSourceNote,
  };
}
