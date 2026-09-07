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
afterEach(cleanup);

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
    fireEvent.click(screen.getByRole("button", { name: /地产/ }));
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
