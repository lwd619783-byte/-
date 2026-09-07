// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockPool } from "./StockPool";
import { getMockDashboardData } from "../../services/providers/mockProvider";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("StockPool quote filters", () => {
  it("filters the quote collection time, preserves history, and opens the selected stock", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-07T12:00:00+08:00"));
    const data = getMockDashboardData();
    const stock = { ...data.stocks[0], quote: {
      id: data.stocks[0].id, latestPrice: 42, pctChange: -1, marketCap: null, pe: null, pb: null,
      updatedAt: "2026-07-01T00:00:00Z", quality: { source: "fixture quote source", status: "real" as const },
    }, dataQuality: [{ source: "new profile", status: "real" as const, updatedAt: new Date().toISOString() }], isRecentlyUpdated: true };
    const onOpen = vi.fn();
    const { container } = render(<StockPool stocks={[stock]} industries={data.industries} globalSearch="" onOpenStock={onOpen} />);
    expect(container.textContent).toContain("快照价格");
    expect(container.textContent).toContain("行情来源：fixture quote source · 真实数据");
    expect(container.textContent).toContain("超过 24 小时");
    fireEvent.change(screen.getByRole("combobox", { name: "数据质量" }), { target: { value: "行情采集24小时内" } });
    expect(screen.getByText("没有匹配个股")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "数据质量" }), { target: { value: "行情来源真实" } });
    expect(screen.queryByText("没有匹配个股")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: stock.name }));
    expect(onOpen).toHaveBeenCalledWith(stock);
  });
});
