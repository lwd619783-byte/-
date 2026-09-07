// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

afterEach(cleanup);

function renderHeader(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  const onDataModeChange = vi.fn();
  const result = render(<Header
    search=""
    onSearchChange={vi.fn()}
    updatedAt="2026-07-05T17:40:20+08:00"
    sourceNote="数据源：A Stock Data；存在 missing / stale / unsupported 字段。"
    dataMode="mixed"
    modeLabel="Mixed Data"
    coverageSummary="A股行情 56/56"
    onDataModeChange={onDataModeChange}
    {...overrides}
  />);
  return { ...result, onDataModeChange };
}

describe("Header 中文展示", () => {
  it("缺失时间不会回退到今天或被称为交易日", () => {
    const { container } = renderHeader({ updatedAt: "" });
    expect(container.textContent).toContain("数据包更新时间：未知");
    expect(container.textContent).toContain("时间缺失");
    expect(container.textContent).not.toContain("交易日：");
  });
  it.each([
    ["mock", "Mock Data", "模拟数据"],
    ["mixed", "Mixed Data", "混合数据"],
    ["real", "Real Data", "真实数据"],
  ] as const)("将 %s 模式显示为中文", (dataMode, modeLabel, expected) => {
    const { container } = renderHeader({ dataMode, modeLabel });
    expect(container.textContent).toContain(`当前模式：${expected}`);
    expect(container.textContent).not.toContain(modeLabel);
  });

  it("真实数据请求降级为混合数据时展示有效状态", () => {
    const { container } = renderHeader({ dataMode: "real", modeLabel: "Mixed Data" });
    expect(container.textContent).toContain("当前模式：混合数据");
    expect(container.textContent).not.toContain("当前模式：真实数据");
  });

  it("翻译来源与异常状态并保留模式切换交互", () => {
    const { container, onDataModeChange } = renderHeader();
    expect(container.textContent).toContain("数据源：A 股数据");
    expect(container.textContent).toContain("缺失、过期或不支持");
    expect(container.textContent).not.toMatch(/A Stock Data|missing|stale|unsupported/);
    fireEvent.change(screen.getByRole("combobox", { name: "数据模式" }), { target: { value: "real" } });
    expect(onDataModeChange).toHaveBeenCalledWith("real");
  });
});


it("does not display a real package timestamp in Mock mode", () => {
  const { container } = renderHeader({ dataMode: "mock", modeLabel: "Mock Data" });
  expect(container.textContent).toContain("数据包更新时间：未知");
  expect(container.textContent).not.toContain("2026-07-05T17:40:20+08:00");
});
it("labels a non-Mock manifest as package update without quote freshness claims", () => {
  const { container } = renderHeader();
  expect(container.textContent).toContain("数据包更新时间：2026-07-05T17:40:20+08:00");
  expect(container.textContent).not.toMatch(/数据包采集时间|24 小时|交易日：/);
});
