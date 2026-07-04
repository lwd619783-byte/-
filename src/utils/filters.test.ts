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
      expect.arrayContaining(["本体整机", "关节与执行器总成", "精密减速器", "线性执行器与丝杠", "电机驱动与运动控制", "视觉、传感器与电子皮肤", "汽车零部件迁移"]),
    );
  });
});
