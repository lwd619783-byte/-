import { industries } from "../../data/industries";
import { dataSourceNote, dataUpdatedAt, macroIndicators } from "../../data/macroData";
import { stocks } from "../../data/stocks";
import { watchlist } from "../../data/watchlist";

export function getMockDashboardData() {
  return {
    industries,
    stocks,
    watchlist,
    macroIndicators,
    dataUpdatedAt,
    dataSourceNote,
  };
}
