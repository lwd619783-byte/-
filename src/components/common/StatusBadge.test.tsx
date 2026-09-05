import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge 中文展示", () => {
  it.each([
    ["missing", "缺失"],
    ["stale", "过期"],
    ["unsupported_market", "当前市场不支持"],
  ] as const)("将 %s 状态显示为中文", (status, label) => {
    const html = renderToStaticMarkup(<StatusBadge status={status} />);
    expect(html).toContain(label);
    expect(html).not.toContain(`>${status}<`);
  });
});
