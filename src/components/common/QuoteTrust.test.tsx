// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stock, StockQuote } from "../../types";
import { QuoteTrust, QuoteTrustSummary } from "./QuoteTrust";

const now = new Date("2026-09-07T12:00:00+08:00");
const quote: StockQuote = { id: "fixture", latestPrice: 42, pctChange: 1, marketCap: null, pe: null, pb: null, updatedAt: "2026-07-01T00:00:00Z", quality: { status: "real", source: "fixture source" } };
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("visible quote trust", () => {
  it("shows old real source with collection age instead of latest-market claims", () => {
    const { container } = render(<QuoteTrust quote={quote} now={now} />);
    expect(container.textContent).toContain("真实数据");
    expect(container.textContent).toContain("超过 24 小时");
    expect(container.textContent).toContain("市场观测时间未知");
    expect(container.textContent).not.toMatch(/最新行情|实时行情/);
  });
  it("includes missing records in the visible dataset counts", () => {
    render(<QuoteTrustSummary stocks={[{ quote: { ...quote, updatedAt: now.toISOString() } }, { quote }, {}] as Stock[]} now={now} />);
    const text = screen.getByLabelText("行情覆盖与时效汇总").textContent;
    expect(text).toContain("价格覆盖 2/3");
    expect(text).toContain("24 小时内 1/3");
    expect(text).toContain("缺失 1/3");
  });
  it("shows unknown source/time for empty quotes", () => {
    const { container } = render(<QuoteTrust now={now} />);
    expect(container.textContent).toContain("行情来源：未知");
    expect(container.textContent).toContain("价格缺失");
    expect(container.textContent).toContain("时间缺失");
  });
  it("re-evaluates the runtime clock while the page remains open", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const { container } = render(<QuoteTrust quote={{ ...quote, updatedAt: "2026-09-06T12:00:00+08:00" }} />);
    expect(container.textContent).toContain("24 小时内");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(container.textContent).toContain("超过 24 小时");
    expect(container.textContent).toContain("真实数据");
  });
});
