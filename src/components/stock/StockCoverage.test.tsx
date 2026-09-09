import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stocks } from "../../data/stocks";
import { industries } from "../../data/industries";
import type { Stock } from "../../types";
import { StockCard } from "./StockCard";
import { StockPool } from "./StockPool";
import { StockDetailDrawer } from "./StockDetailDrawer";

const coveredStock: Stock = {
  ...stocks[0], dataMode: "real", dataCoverage: 50,
  dataCoverageDetails: {
    scope: "mapped_numeric_fields", numerator: 6, denominator: 12, percent: 50, excludedFields: [],
    modules: [{ id: "financials", status: "missing" }, { id: "quotes", status: "partial" }, { id: "research", status: "not_implemented" }],
  },
};

describe("stock coverage display", () => {
  const surfaces = {
    card: (stock: Stock) => <StockCard stock={stock} industries={industries} onOpen={() => undefined} />,
    pool: (stock: Stock) => <StockPool stocks={[stock]} industries={industries} globalSearch="" onOpenStock={() => undefined} />,
    detail: (stock: Stock) => <StockDetailDrawer stock={stock} stocks={[stock]} industries={industries} onClose={() => undefined} />,
  };
  for (const [name, render] of Object.entries(surfaces)) {
    it(`${name} explains the numerator and denominator separately from module state`, () => {
      const html = renderToStaticMarkup(render(coveredStock));
      expect(html).toContain("行情/财务字段");
      expect(html).toContain("6/12（50%）");
      expect(html).toContain("缺失/失败模块 1");
      expect(html).toContain("部分模块 1");
      expect(html).toContain("不适用/未接入模块 1");
    });
    it(`${name} displays explicit N/A for unsupported coverage`, () => {
      const html = renderToStaticMarkup(render({
        ...coveredStock, dataCoverage: null,
        dataCoverageDetails: { scope: "mapped_numeric_fields", numerator: 0, denominator: 0, percent: null, excludedFields: [], modules: [{ id: "quotes", status: "unsupported_market" }] },
      }));
      expect(html).toContain("N/A（暂无适用字段）");
      expect(html).not.toContain("100%");
    });
  }
});
