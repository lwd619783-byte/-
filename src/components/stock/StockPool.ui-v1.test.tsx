// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockDashboardData } from "../../services/providers/mockProvider";
import { StockPool } from "./StockPool";

afterEach(cleanup);

function fixture() {
  const data = getMockDashboardData();
  const names = ["syntheticA 长名称公司研究测试对象", "syntheticB", "syntheticC"];
  return { industries: data.industries, stocks: data.stocks.slice(0, 3).map((stock, index) => ({
    ...stock, id: `ui-v1-${index}`, name: names[index],
    riskLevel: index === 0 ? "高" as const : "低" as const,
    quote: { ...stock.quote!, id: `ui-v1-${index}`, latestPrice: [0, 42, null][index], pctChange: [1, -2, null][index],
      pe: [10, 5, null][index], peTtm: null, marketCap: [2, 4, null][index], pb: null,
      quality: { status: "partial" as const, source: "synthetic fixture source" }, updatedAt: null },
  })) };
}

describe("StockPool UI V1 migration", () => {
  it("defaults to the research table and retains all five quality and six sort options", () => {
    const data = fixture();
    render(<StockPool {...data} globalSearch="" onOpenStock={vi.fn()} />);
    expect(screen.getByRole("button", { name: "表格" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(within(screen.getByRole("combobox", { name: "数据质量" })).getAllByRole("option").map((node) => node.textContent))
      .toEqual(["全部", "行情状态为真实", "缺失项", "暂不支持", "行情采集24小时内"]);
    expect(within(screen.getByRole("combobox", { name: "排序" })).getAllByRole("option").map((node) => node.textContent))
      .toEqual(["默认", "覆盖率高到低", "覆盖率低到高", "涨跌幅", "市值", "PE"]);
    expect(screen.queryByRole("textbox", { name: "池内搜索" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "风险等级" })).toBeNull();
  });

  it("counts, preserves and clears collapsed advanced filters without clearing the base conditions", () => {
    const data = fixture();
    render(<StockPool {...data} globalSearch="" onOpenStock={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), { target: { value: "PE" } });
    fireEvent.click(screen.getByRole("button", { name: "更多筛选" }));
    fireEvent.change(screen.getByRole("textbox", { name: "池内搜索" }), { target: { value: "syntheticA" } });
    fireEvent.change(screen.getByRole("combobox", { name: "风险等级" }), { target: { value: "高" } });
    fireEvent.click(screen.getByRole("button", { name: "更多筛选（2）" }));
    expect(screen.queryByRole("textbox", { name: "池内搜索" })).toBeNull();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "清除更多筛选" }));
    expect(screen.getByRole("button", { name: "更多筛选" }).getAttribute("aria-expanded")).toBe("false");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
    expect((screen.getByRole("combobox", { name: "排序" }) as HTMLSelectElement).value).toBe("PE");
  });

  it("uses the same sorted objects in table, responsive cards and explicit card view", () => {
    const data = fixture();
    const { container } = render(<StockPool {...data} globalSearch="" onOpenStock={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), { target: { value: "市值" } });
    const rowNames = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => row.querySelector("button")?.textContent);
    const cardNames = [...container.querySelectorAll("h3")].map((heading) => heading.textContent);
    expect(rowNames).toEqual([data.stocks[1].name, data.stocks[0].name, data.stocks[2].name]);
    expect(cardNames).toEqual(rowNames);
    fireEvent.click(screen.getByRole("button", { name: "卡片" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect([...container.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual(rowNames);
  });

  it("preserves focused identity and calls preview and full research with the original stock", () => {
    const data = fixture();
    const onOpenStock = vi.fn();
    const onOpenResearch = vi.fn();
    render(<StockPool {...data} globalSearch="" onOpenStock={onOpenStock} onOpenResearch={onOpenResearch} />);
    const table = screen.getByRole("table");
    const identity = within(table).getByRole("button", { name: data.stocks[0].name });
    expect(identity.getAttribute("data-stock-id")).toBe(data.stocks[0].id);
    expect(identity.className).not.toMatch(/truncate|line-clamp/);
    fireEvent.click(identity);
    fireEvent.click(within(table).getByRole("button", { name: `完整研究 ${data.stocks[0].name}` }));
    expect(onOpenStock).toHaveBeenCalledWith(data.stocks[0]);
    expect(onOpenResearch).toHaveBeenCalledWith(data.stocks[0]);
  });

  it("keeps all migrated row fields queryable and preserves unknown price timing and currency", () => {
    const data = fixture();
    render(<StockPool {...data} globalSearch="" onOpenStock={vi.fn()} />);
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    const details = row.querySelector("details");
    expect(details?.querySelector("summary")?.textContent).toBe("字段与研究摘要");
    expect(details?.textContent).toContain(data.stocks[0].financial.marketCap);
    expect(details?.textContent).toContain(data.stocks[0].thesis);
    expect(details?.textContent).toContain("缺失字段数");
    expect(row.textContent).toContain("币种：源字段未提供");
    expect(row.textContent).toContain("市场观测时间未知");
    expect(row.textContent).toContain("质量状态：部分可用");
    expect(within(within(row).getAllByRole("cell")[2]).getByText("0", { exact: true })).toBeTruthy();
  });

  it("applies an existing global search once and updates it without a stale local copy", () => {
    const data = fixture();
    const { rerender } = render(<StockPool {...data} globalSearch="syntheticA" onOpenStock={vi.fn()} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    rerender(<StockPool {...data} globalSearch="syntheticB" onOpenStock={vi.fn()} />);
    expect(within(screen.getByRole("table")).getByRole("button", { name: "syntheticB" })).toBeTruthy();
    expect(screen.queryByText("没有匹配个股")).toBeNull();
  });

  it("distinguishes an empty dataset from a filtered empty result", () => {
    const data = fixture();
    const { rerender } = render(<StockPool {...data} stocks={[]} globalSearch="" onOpenStock={vi.fn()} />);
    expect(screen.getByText("研究池暂无公司")).toBeTruthy();
    rerender(<StockPool {...data} globalSearch="not-a-real-fixture-company" onOpenStock={vi.fn()} />);
    expect(screen.getByText("没有匹配个股")).toBeTruthy();
  });
});
