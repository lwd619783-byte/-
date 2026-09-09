import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";
import { PriceChange, priceTone } from "./PriceChange";
import { ChartPanel } from "./ChartPanel";

describe("UI V1 financial chart semantics", () => {
  it("preserves gaps rather than joining valid prices across missing observations", () => {
    const html = renderToStaticMarkup(<Sparkline points={[
      { date: "2026-01-01", close: 0, amount: null, pctChange: null },
      { date: "2026-01-02", close: null, amount: null, pctChange: null },
      { date: "2026-01-03", close: -10, amount: null, pctChange: null },
      { date: "2026-01-04", close: -5, amount: null, pctChange: null },
    ]} />);
    expect(html).toContain('d="M0.00,4.00  M66.67,36.00 L100.00,20.00"');
    expect(html).toContain("3 个有效值；缺失处断线");
    expect(html).toContain("var(--ui-down)");
  });

  it("keeps an isolated snapshot as a dot with no manufactured line", () => {
    const html = renderToStaticMarkup(<Sparkline points={[{ date: "2026-01-01", close: 1e15, amount: null, pctChange: null }]} />);
    expect(html).toContain('d="M50.00,36.00"');
    expect(html).toContain("<circle");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("renders unavailable data without a fake zero or line", () => {
    const html = renderToStaticMarkup(<Sparkline points={[
      { date: "2026-01-01", close: null, amount: null, pctChange: null },
      { date: "2026-01-02", close: Number.NaN, amount: null, pctChange: null },
    ]} />);
    expect(html).toContain("数据暂缺");
    expect(html).not.toContain("<svg");
  });

  it("uses red up and green down roles while retaining signs", () => {
    expect(priceTone(1)).toBe("red");
    expect(priceTone(-1)).toBe("green");
    expect(renderToStaticMarkup(<PriceChange value={1} />)).toContain("text-up");
    expect(renderToStaticMarkup(<PriceChange value={1} />)).toContain("+1%");
    expect(renderToStaticMarkup(<PriceChange value={-1} />)).toContain("text-down");
    expect(renderToStaticMarkup(<PriceChange value={-1} />)).toContain("-1%");
    expect(priceTone(Number.POSITIVE_INFINITY)).toBe("neutral");
    expect(renderToStaticMarkup(<PriceChange value={Number.NaN} />)).toContain("—");
  });

  it("offers source data through an accessible native disclosure", () => {
    const html = renderToStaticMarkup(<ChartPanel title="价格" summary="仅 1 个观察点" dataTable={<table><tbody><tr><td>2026-01-01</td><td>42</td></tr></tbody></table>}>
      <span>图表</span>
    </ChartPanel>);
    expect(html).toContain("<details");
    expect(html).toContain("查看原始数据表");
    expect(html).toContain("仅 1 个观察点");
    expect(html).toContain("2026-01-01");
  });
});
