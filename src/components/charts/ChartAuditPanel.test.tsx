// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartAuditPanel } from "./ChartAuditPanel";
import { ChartAuditStateReview } from "../../ui-review/ChartAuditStateReview";
import { createReviewFixtures } from "../../ui-review/fixtures";
import { financialChartAudit } from "../../services/chartAudit";
import { ProductShell } from "../layout/ProductShell";
import { RelatedResearchEvidence } from "../research/RelatedResearchEvidence";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Auditable Chart presentation and shell", () => {
  it("preserves all fail-closed states, 0, and blocks unsafe view-model links", () => {
    const { container } = render(<ChartAuditStateReview />);
    for (const value of ["NOT_ADMITTED", "missing", "partial", "stale", "conflicted", "not_admitted", "unknown"]) expect(container.textContent).toContain(value);
    expect(screen.getByText("0")).toBeTruthy();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("当前图表没有可验证的正式证据关联");
  });
  it("renders real owner metadata including safe source and distinct times", () => {
    const fixture = createReviewFixtures("full"), stock = fixture.companies[0], detail = fixture.details[stock.id].financial!;
    detail.reports[0].sourceUrl = "https://example.com/fixture";
    const audit = financialChartAudit(stock, detail, detail.reports, "singleQuarter", "consolidated");
    const { container } = render(<ChartAuditPanel audit={audit} />);
    expect(container.textContent).toContain("announcementDate");
    expect(container.textContent).toContain("fetchedAt");
    expect(container.textContent).toContain("未提供 / 未证明");
    expect(screen.getAllByRole("link", { hidden: true })[0].getAttribute("href")).toBe("https://example.com/fixture");
  });
  it("shell delegates navigation without touching storage or generating business objects", () => {
    const write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem"), clear = vi.spyOn(Storage.prototype, "clear");
    const navigate = vi.fn();
    const { rerender } = render(<ProductShell section="首页" title="研究工作台" scope="公司 A" actions={<button onClick={navigate}>继续研究</button>}/>);
    fireEvent.click(screen.getByRole("button", { name: "继续研究" }));
    expect(navigate).toHaveBeenCalledOnce();
    rerender(<ProductShell section="公司 / 财务" title="公司 B" scope="B"/>);
    expect(screen.getByLabelText("研究上下文").textContent).toContain("公司 B");
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });
  it("company-related evidence opens the exact current owner event, not a chart linkage", () => {
    const fixture = createReviewFixtures("full"), stock = fixture.companies[0], event = fixture.snapshot.events[0];
    const onOpenEvent = vi.fn(), before = JSON.stringify(fixture);
    render(<RelatedResearchEvidence stock={stock} events={[event]} onOpenStock={vi.fn()} onOpenEvent={onOpenEvent}/>);
    fireEvent.click(screen.getByRole("button", { name: "公司相关证据（1）" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开对应事件" }));
    expect(onOpenEvent).toHaveBeenCalledWith(event);
    expect(JSON.stringify(fixture)).toBe(before);
  });
  it("refuses wrong company/code/market or duplicate event identity and closes on company change", () => {
    const fixture = createReviewFixtures("full"), stock = fixture.companies[0], event = fixture.snapshot.events[0];
    const { rerender } = render(<RelatedResearchEvidence stock={stock} events={[{ ...event, stockId: "wrong" }, { ...event, id: "wrong-code", stockCode: "wrong" }, { ...event, id: "wrong-market", market: "港股" }]} onOpenStock={vi.fn()}/>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    rerender(<RelatedResearchEvidence stock={stock} events={[event, { ...event }]} onOpenStock={vi.fn()}/>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    rerender(<RelatedResearchEvidence stock={stock} events={[event]} onOpenStock={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button"));
    rerender(<RelatedResearchEvidence stock={fixture.companies[1]} events={[event]} onOpenStock={vi.fn()}/>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
