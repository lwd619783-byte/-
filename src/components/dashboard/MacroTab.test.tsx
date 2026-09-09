// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MacroIndicator } from "../../types";
import { buildMacroIndicatorRows, MacroTab } from "./MacroTab";

const now = new Date("2026-09-07T12:00:00+08:00");
const indicator = (metrics: MacroIndicator["metrics"]): MacroIndicator => ({
  id: "test", name: "测试", category: "宏观环境", currentStatus: "偏利好", trend: "上行", marketImpact: "偏宽松", trackingIndicators: [], metrics,
  dataQuality: [{ source: "unrelated real source", status: "real" }],
});
const metrics: MacroIndicator["metrics"] = [
  { label: "GDP 同比", value: "5%", note: "报告期：2026年第1季度", updatedAt: "2026年第1季度", source: "AKShare macro_china_gdp", status: "real" },
  { label: "PMI", value: "50.3", note: "月份：2026年06月份", updatedAt: "2026年06月份", status: "partial" },
  { label: "就业", value: "数据暂缺", note: "来源缺失", status: "missing" },
  { label: "LPR", value: "0% / 数据暂缺", note: "公布：2026-07-01；生效：2026-07-02", updatedAt: "2026-07-01", status: "conflicted" },
];
afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; });

describe("MacroTab trustworthy observations", () => {
  it.each([0, 1, 4])("%s records never produce a score or directional conclusion", (count) => {
    const { container } = render(<MacroTab indicators={count ? [indicator(metrics.slice(0, count))] : []} now={now} />);
    expect(screen.getByText("宏观指标观测 · 模型尚未接入")).toBeTruthy();
    expect(container.textContent).not.toMatch(/偏利好|偏宽松|中性偏积极|宏观观察雷达/);
    expect(container.querySelector(".recharts-wrapper")).toBeNull();
    expect(screen.getByText("数值覆盖")).toBeTruthy();
    if (!count) expect(screen.getByText("暂无宏观指标；模型尚未接入。")).toBeTruthy();
  });

  it("retains raw values, native dates, distinct source states and category interaction", () => {
    render(<MacroTab indicators={[indicator(metrics)]} now={now} generatedAt="2026-09-07T11:00:00+08:00" />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("5%")).toBeTruthy();
    expect(within(table).getByText("暂无")).toBeTruthy();
    expect(within(table).getByText("0% / 数据暂缺")).toBeTruthy();
    expect(within(table).getByText("冲突")).toBeTruthy();
    expect(table.textContent).toContain("报告期：2026年第1季度");
    expect(table.textContent).toContain("发布时间未知");
    expect(table.textContent).not.toContain("unrelated real source");
    expect(screen.queryByText("5%%", { exact: true })).toBeNull();
    expect(screen.getByText("5%", { selector: "p", exact: true })).toBeTruthy();
    expect(screen.getByText(/文件生成时间：2026-09-07/)).toBeTruthy();
    const policy = screen.getByRole("button", { name: /政策与利率/ });
    fireEvent.click(policy);
    expect(policy.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("原始说明：公布：2026-07-01；生效：2026-07-02")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("其他宏观分类"), { target: { value: "地产" } });
    expect(screen.getByText(/该分类暂未接入可用指标/)).toBeTruthy();
  });

  it("preserves real quality status on missing values and never invents source from another row", () => {
    const rows = buildMacroIndicatorRows([indicator([{ label: "GDP", value: "X", note: "", status: "real" }])]);
    expect(rows[0]).toMatchObject({ value: null, status: "real", source: undefined, timeKind: "unknown" });
    expect(buildMacroIndicatorRows([indicator([{ label: "新房价格同比", value: "97.9", note: "" }])])[0].unit).toBeUndefined();
  });
});


it("shows unknown macro source alongside real quality without inferring provenance", () => {
  const { container } = render(<MacroTab indicators={[indicator([{ label: "GDP", value: "42", note: "", status: "real" }])]} now={now} />);
  expect(screen.getByText("来源：未知", { exact: true })).toBeTruthy();
  expect(container.textContent).toContain("质量状态：真实数据");
  expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "质量状态" })).toBeTruthy();
  expect(container.textContent).not.toMatch(/真实来源|来源标记真实|unrelated real source/);
});

describe("frozen macro observation workflow", () => {
  it("retains all nine classifications in compact navigation and clears the readout for an empty category", () => {
    render(<MacroTab indicators={[indicator(metrics)]} now={now} />);
    const nav = screen.getByRole("navigation", { name: "宏观分类" });
    expect(within(nav).getAllByRole("button")).toHaveLength(4);
    const other = within(nav).getByRole("combobox");
    expect(within(other).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "其他分类（5）", "汇率与外部环境 · 待接入", "外贸 · 待接入", "地产 · 待接入", "就业 · 1 项", "风险因子 · 待接入",
    ]);
    expect(screen.getByRole("region", { name: "当前宏观指标读数" }).textContent).toContain("GDP 同比");
    fireEvent.change(other, { target: { value: "地产" } });
    expect(screen.queryByRole("region", { name: "当前宏观指标读数" })).toBeNull();
    expect(screen.getByText("该分类数据待接入")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("GDP 同比")).toBeTruthy();
  });

  it("selects one indicator, remembers it across categories and themes, and retains the full detail table", () => {
    const values = [indicator(metrics)]; const view = render(<MacroTab indicators={values} now={now} />);
    const pmi = buildMacroIndicatorRows(values).find((row) => row.label === "PMI")!;
    fireEvent.change(screen.getByLabelText("所选宏观指标"), { target: { value: pmi.key } });
    expect(screen.getByRole("region", { name: "当前宏观指标读数" }).textContent).toContain("50.3");
    fireEvent.click(screen.getByRole("button", { name: /政策与利率/ }));
    fireEvent.click(screen.getByRole("button", { name: /增长与价格/ }));
    for (const theme of ["pro", "light", "neon"]) {
      document.documentElement.dataset.theme = theme;
      view.rerender(<MacroTab indicators={values} now={now} />);
      expect((screen.getByLabelText("所选宏观指标") as HTMLSelectElement).value).toBe(pmi.key);
      expect(screen.getByRole("region", { name: "当前宏观指标读数" }).textContent).toContain("50.3");
    }
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText("历史序列尚未接入当前页面")).toBeTruthy();
  });

  it("shows future and invalid source times without changing original quality or filling publication time", () => {
    const values = [indicator([
      { label: "GDP future", value: "0%", note: "公布：2099-01-01", updatedAt: "2099-01-01", status: "real" },
      { label: "GDP invalid", value: "-3%", note: "公布：不是日期", updatedAt: "不是日期", status: "partial" },
    ])];
    render(<MacroTab indicators={values} now={now} />);
    let readout = screen.getByRole("region", { name: "当前宏观指标读数" });
    expect(within(readout).getByRole("alert").textContent).toContain("未来日期");
    expect(readout.textContent).toContain("真实数据");
    fireEvent.change(screen.getByLabelText("所选宏观指标"), { target: { value: buildMacroIndicatorRows(values)[1].key } });
    readout = screen.getByRole("region", { name: "当前宏观指标读数" });
    expect(within(readout).getByRole("alert").textContent).toContain("时间无效或时区未知");
    expect(readout.textContent).toContain("-3%"); expect(readout.textContent).toContain("部分可用");
  });

  it("keeps the displayed denominator and duplicated observations in the audit details", () => {
    const duplicate = indicator([metrics[0], metrics[0], metrics[2]]);
    render(<MacroTab indicators={[duplicate]} now={now} />);
    expect(screen.getByText(/2\/3 · 覆盖与时间口径/)).toBeTruthy();
    expect(screen.getByText(/重复指标未去重/)).toBeTruthy();
    expect(within(screen.getByRole("table")).getAllByText("GDP 同比")).toHaveLength(2);
    expect(screen.getByText(/分母 3，逐项核验/)).toBeTruthy();
  });

  it("retains raw source and field details without using generic dates as publication dates", () => {
    render(<MacroTab indicators={[indicator([{ label: "GDP", value: "42", note: "日期：2026-08-01", updatedAt: "2026-08-01", source: "https://example.test/very/long/source", status: "conflicted" }])]} now={now} />);
    const readout = screen.getByRole("region", { name: "当前宏观指标读数" });
    expect(readout.textContent).toContain("来源日期（语义待核验）");
    expect(readout.textContent).toContain("来源发布时间：待核验");
    expect(readout.textContent).toContain("冲突");
    expect(within(screen.getByRole("table")).getByText("test.GDP")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("原始来源：https://example.test/very/long/source")).toBeTruthy();
  });
});
