import type { Industry, Market, RiskLevel, Stock } from "../types";

export interface StockFilters {
  search: string;
  industryId: string;
  segmentId: string;
  market: "全部" | Market;
  riskLevel: "全部" | RiskLevel;
}

export const defaultStockFilters: StockFilters = {
  search: "",
  industryId: "全部",
  segmentId: "全部",
  market: "全部",
  riskLevel: "全部",
};

export function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function getIndustryName(industries: Industry[], industryId: string) {
  return industries.find((industry) => industry.id === industryId)?.name ?? industryId;
}

export function getSegmentName(industries: Industry[], segmentId: string) {
  for (const industry of industries) {
    const segment = industry.segments.find((item) => item.id === segmentId);
    if (segment) return segment.name;
  }
  return segmentId;
}

export function getSegmentsByIndustry(industries: Industry[], industryId: string) {
  if (industryId === "全部") {
    return industries.flatMap((industry) => industry.segments);
  }
  return industries.find((industry) => industry.id === industryId)?.segments ?? [];
}

export function filterStocks(stocks: Stock[], filters: StockFilters, industries: Industry[]) {
  const keyword = normalizeKeyword(filters.search);

  return stocks.filter((stock) => {
    const industryName = getIndustryName(industries, stock.industryId);
    const segmentName = getSegmentName(industries, stock.segmentId);
    const searchable = [stock.name, stock.code, industryName, segmentName, stock.thesis]
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchable.includes(keyword)) &&
      (filters.industryId === "全部" || stock.industryId === filters.industryId) &&
      (filters.segmentId === "全部" || stock.segmentId === filters.segmentId) &&
      (filters.market === "全部" || stock.market === filters.market) &&
      (filters.riskLevel === "全部" || stock.riskLevel === filters.riskLevel)
    );
  });
}

export function findStocksForSegment(stocks: Stock[], segmentId: string) {
  return stocks.filter((stock) => stock.segmentId === segmentId);
}
