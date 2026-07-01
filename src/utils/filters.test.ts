import { describe, expect, it } from "vitest";
import { industries } from "../data/industries";
import { stocks } from "../data/stocks";
import { defaultStockFilters, filterStocks, getSegmentsByIndustry } from "./filters";

describe("stock filters", () => {
  it("finds stocks by code, name, industry, or segment keyword", () => {
    const result = filterStocks(stocks, { ...defaultStockFilters, search: "光模块" }, industries);

    expect(result.map((stock) => stock.name)).toEqual(expect.arrayContaining(["新易盛", "中际旭创"]));
  });

  it("limits segment options when an industry is selected", () => {
    const result = getSegmentsByIndustry(industries, "robotics");

    expect(result.map((segment) => segment.name)).toEqual(
      expect.arrayContaining(["丝杠", "灵巧手", "减速器", "电机"]),
    );
  });
});
