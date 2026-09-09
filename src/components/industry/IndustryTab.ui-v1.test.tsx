// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockDashboardData } from "../../services/providers/mockProvider";
import { roboticsPrivateCompanies } from "../../data/privateCompanies";
import type { Industry, Stock } from "../../types";
import { IndustryTab } from "./IndustryTab";

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; });

function fixture() {
  const data = getMockDashboardData();
  const template = data.stocks[0];
  const industry = (id: string): Industry => ({ id, name: id === "robotics" ? "机器人样本" : "普通行业样本", prosperity: "中", stage: "左侧布局", drivers: ["现有驱动"], catalysts: ["现有催化"], risks: ["现有风险"], styles: ["主题"], chain: [{ stage: "上游", items: ["原料环节"] }, { stage: "下游", items: ["产品环节"] }],
    segments: ["first", "second"].map((suffix) => ({ id: `${id}-${suffix}`, industryId: id, name: `${id} ${suffix}`, logic: "既有细分逻辑全文", demandSource: "既有需求", supplyPattern: "既有供给", moat: "既有壁垒", trend: "既有订单趋势", keyVariables: ["既有关键变量"], stockIds: [] })) });
  const industries = [industry("ordinary"), industry("robotics")];
  const stocks: Stock[] = [
    { ...template, id: "synthetic-core", name: "synthetic 核心公司", industryId: "robotics", segmentId: "robotics-first", candidateType: "核心池" },
    { ...template, id: "synthetic-watch", name: "synthetic 观察公司", industryId: "robotics", segmentId: "robotics-second", candidateType: "观察池" },
    { ...template, id: "synthetic-ordinary", name: "synthetic 普通公司", industryId: "ordinary", segmentId: "ordinary-first" },
  ];
  return { industries, stocks };
}

describe("Industry UI V1 migration", () => {
  it("preserves overview fields, independent chain material and keyboard navigation", () => {
    const data = fixture();
    render(<IndustryTab {...data} globalSearch="" onOpenStock={vi.fn()} />);
    const overview = screen.getByRole("tabpanel", { name: "研究概览" });
    for (const text of ["景气：中", "阶段：左侧布局", "现有驱动", "现有催化", "现有风险", "主题"]) expect(within(overview).getByText(text)).toBeTruthy();
    expect(screen.getByText(/行业资料来源与更新时间：当前字段未提供/)).toBeTruthy();
    const tab = screen.getByRole("tab", { name: "研究概览" });
    fireEvent.keyDown(tab, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "产业链" }));
    expect(screen.getByRole("tabpanel", { name: "产业链" }).textContent).toContain("原料环节");
    expect(screen.getByRole("tabpanel", { name: "产业链" }).textContent).toContain("位置不表示收入权重或资金流向");
  });

  it("defaults robotics to all and ordinary industries to their first segment", () => {
    const data = fixture();
    const onSelectionChange = vi.fn();
    render(<IndustryTab {...data} globalSearch="" onOpenStock={vi.fn()} onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "选择行业" }), { target: { value: "robotics" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ industryId: "robotics", segmentId: "__all__" });
    fireEvent.click(screen.getByRole("tab", { name: "细分比较" }));
    expect((screen.getByRole("combobox", { name: "选择细分板块" }) as HTMLSelectElement).value).toBe("__all__");
    expect(screen.getByText("全部机器人产业链")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "选择行业" }), { target: { value: "ordinary" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ industryId: "ordinary", segmentId: "ordinary-first" });
    expect((screen.getByRole("combobox", { name: "选择细分板块" }) as HTMLSelectElement).value).toBe("ordinary-first");
  });

  it("keeps distribution in the listed company pool and private leads available even with no matching stock", () => {
    const data = fixture();
    render(<IndustryTab {...data} initialIndustryId="robotics" globalSearch="no-matching-company" onOpenStock={vi.fn()} />);
    const overview = screen.getByRole("tabpanel", { name: "研究概览" });
    expect(overview.textContent).toContain("当前行业研究池的 2 家上市公司");
    expect(overview.textContent).toContain("未上市线索不计入分母");
    expect(within(overview).getAllByText("1 / 2 家")).toHaveLength(2);
    fireEvent.click(screen.getByRole("tab", { name: "产业链" }));
    const chain = screen.getByRole("tabpanel", { name: "产业链" });
    expect(within(chain).getByText(roboticsPrivateCompanies[0].name)).toBeTruthy();
    expect(chain.textContent).toContain("未上市公司不参与行情合并");
  });

  it("retains segment logic, market summary, comparison and both robotics pools", () => {
    const data = fixture();
    const onOpenStock = vi.fn();
    render(<IndustryTab {...data} initialIndustryId="robotics" globalSearch="" onOpenStock={onOpenStock} />);
    fireEvent.click(screen.getByRole("tab", { name: "细分比较" }));
    fireEvent.change(screen.getByRole("combobox", { name: "选择细分板块" }), { target: { value: "robotics-first" } });
    for (const value of ["既有细分逻辑全文", "既有需求", "既有供给", "既有壁垒", "既有订单趋势", "既有关键变量"]) expect(screen.getByText(value)).toBeTruthy();
    expect(screen.getByText("最近行情采集时间")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "公司比较表" }));
    expect(screen.getByRole("table").textContent).toContain(data.stocks[0].financial.revenueGrowth);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: data.stocks[0].name }));
    expect(onOpenStock).toHaveBeenCalledWith(data.stocks[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "选择细分板块" }), { target: { value: "__all__" } });
    fireEvent.click(screen.getByRole("button", { name: "公司列表" }));
    expect(screen.getByRole("heading", { name: "核心池" })).toBeTruthy();
    const observation = screen.getByRole("button", { name: /观察池 机构纪要/ });
    expect(observation.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(observation);
    expect(screen.getByRole("heading", { name: data.stocks[1].name })).toBeTruthy();
  });

  it("restores external IDs and rejects invalid IDs without leaving prior industry content", () => {
    const data = fixture();
    const { rerender } = render(<IndustryTab {...data} initialIndustryId="robotics" initialSegmentId="robotics-second" globalSearch="" onOpenStock={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "细分比较" }));
    expect((screen.getByRole("combobox", { name: "选择细分板块" }) as HTMLSelectElement).value).toBe("robotics-second");
    rerender(<IndustryTab {...data} initialIndustryId="robotics" initialSegmentId="ordinary-first" globalSearch="" onOpenStock={vi.fn()} />);
    expect(screen.getByText("找不到行业或细分板块")).toBeTruthy();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    rerender(<IndustryTab {...data} initialIndustryId="nonexistent" globalSearch="" onOpenStock={vi.fn()} />);
    expect(screen.getByText("找不到行业或细分板块")).toBeTruthy();
    expect(screen.queryByText("现有驱动")).toBeNull();
  });

  it("preserves subview, selection and expanded pool across theme rerenders", () => {
    const data = fixture();
    const props = { ...data, initialIndustryId: "robotics", globalSearch: "", onOpenStock: vi.fn() };
    const { rerender } = render(<IndustryTab {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "细分比较" }));
    fireEvent.click(screen.getByRole("button", { name: "公司列表" }));
    fireEvent.click(screen.getByRole("button", { name: /观察池 机构纪要/ }));
    for (const theme of ["light", "pro", "neon"]) {
      document.documentElement.dataset.theme = theme;
      rerender(<IndustryTab {...props} />);
      expect(screen.getByRole("tab", { name: "细分比较" }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("button", { name: /观察池 机构纪要/ }).getAttribute("aria-expanded")).toBe("true");
      expect((screen.getByRole("combobox", { name: "选择细分板块" }) as HTMLSelectElement).value).toBe("__all__");
    }
  });

  it("supports searching the industry selector without implicitly switching the active object", () => {
    const data = fixture();
    render(<IndustryTab {...data} globalSearch="" onOpenStock={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "查找行业" }), { target: { value: "机器人" } });
    const selector = screen.getByRole("combobox", { name: "选择行业" }) as HTMLSelectElement;
    expect(selector.value).toBe("ordinary");
    expect(within(selector).getByRole("option", { name: "普通行业样本（当前）" })).toBeTruthy();
    expect(within(selector).getByRole("option", { name: "机器人样本" })).toBeTruthy();
  });

  it("does not aggregate monetary snapshots across markets or turn missing values into zero", () => {
    const data = fixture();
    data.stocks[0].quote = { id: "a", latestPrice: null, pctChange: null, marketCap: 10, amount: 20, pe: null, pb: null, quality: { status: "partial", source: "synthetic" } };
    data.stocks[1].quote = { id: "b", latestPrice: null, pctChange: null, marketCap: 20, amount: 30, pe: null, pb: null, quality: { status: "stale", source: "synthetic" } };
    data.stocks[1].market = "港股";
    render(<IndustryTab {...data} initialIndustryId="robotics" globalSearch="" onOpenStock={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "细分比较" }));
    expect(screen.getAllByText("跨市场不可比")).toHaveLength(2);
    expect(screen.queryByText("30.0 亿")).toBeNull();
    expect(screen.getByText("池内快照平均涨跌（0/2）").parentElement?.textContent).toContain("暂无");
  });
});
