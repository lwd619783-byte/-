// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReviewFixtures } from "../../ui-review/fixtures";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { buildEarningsExpectationResearchEvents } from "../../services/earningsExpectationEventProvider";
import type { ResearchEvent } from "../../types";

afterEach(cleanup);
function props() {
  const data = createReviewFixtures("full");
  return { events: [data.snapshot.events[0]], tasks: data.tasks.slice(0, 1), watchItem: data.watchItems[0], stocks: data.companies, onClose: vi.fn(), onOpenStock: vi.fn(), onOpenEvent: vi.fn(), onStartReview: vi.fn() };
}
describe("Evidence Drawer fail-closed owner evidence", () => {
  it("shows source, distinct clocks, references, missing metrics and real zero without asserting PIT/admission", () => {
    const data = props(); data.events[0] = { ...data.events[0], sourceUrl: "https://example.com/source", pdfUrl: "https://example.com/source.pdf", publishedAt: "2026-09-08T09:00:00+08:00", updatedAt: "2026-09-09T12:00:00+08:00", relatedAnnouncementIds: ["original-announcement"], metrics: [{ ...data.events[0].metrics[0], value: 0 }, { ...data.events[0].metrics[0], key: "missing", label: "缺失字段", value: null }] };
    render(<EvidenceDrawer {...data} />);
    expect(screen.getByRole("link", { name: "原始来源" }).getAttribute("href")).toBe(data.events[0].sourceUrl);
    const dialog = screen.getByRole("dialog");
    for (const text of ["2026-09-08T09:00:00+08:00", "2026-09-09T12:00:00+08:00", "original-announcement", "历史时点可得性（PIT）：未证明", "准入：未证明", "修订连续性：未证明", "证据关联闭合性：未证明"]) expect(dialog.textContent).toContain(text);
    expect(within(screen.getByRole("table")).getByText("0.00 元")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("缺失")).toBeTruthy();
  });
  it.each(["partial", "stale", "missing", "error", "metadata_only"] as const)("keeps %s warning-colored even with parse_success", verificationStatus => {
    const data = props(); data.events[0] = { ...data.events[0], verificationStatus, parseStatus: "parse_success", reviewStatus: "not_required" };
    const { container } = render(<EvidenceDrawer {...data} />);
    expect(document.querySelector(".bg-success\\/10")).toBeNull();
    expect(screen.getByRole("dialog").textContent).not.toContain("PIT：已证明");
    expect(container).toBeTruthy();
  });
  it("preserves explicit conflict reasons without adding graph facts", () => {
    const data = props(); data.events[0] = { ...data.events[0], verificationStatus: "error", reviewReasons: ["关系=内容冲突", "冲突字段=value", "not_admitted"] };
    render(<EvidenceDrawer {...data} />);
    expect(screen.getByText("关系=内容冲突")).toBeTruthy(); expect(screen.getByText("尚未准入")).toBeTruthy();
  });
  it("blocks unsafe URLs and preserves a safe PDF alternative", () => {
    const data = props(); data.events[0] = { ...data.events[0], sourceUrl: "javascript:alert(1)", pdfUrl: "https://example.com/safe.pdf" };
    render(<EvidenceDrawer {...data} />);
    expect(screen.getByRole("link", { name: "原始来源" }).getAttribute("href")).toBe("https://example.com/safe.pdf");
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });
  it("keeps a reminder with no evidence explicit and disables event navigation", () => {
    const data = props(); render(<EvidenceDrawer {...data} events={[]} unresolvedEventIds={["missing-id"]} />);
    expect(screen.getByText("未提供关联事件证据")).toBeTruthy(); expect(screen.getByRole("dialog").textContent).toContain("missing-id");
    expect(screen.queryByRole("button", { name: "打开对应事件" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "开始复盘" })); expect(data.onStartReview).toHaveBeenCalledWith(data.watchItem);
  });
  it("navigates to the exact selected event and company after closing", () => {
    const data = props(); const other = { ...data.events[0], id: "second-event", title: "第二条精确事件" };
    render(<EvidenceDrawer {...data} events={[...data.events, other]} />);
    fireEvent.change(screen.getByRole("combobox", { name: "关联证据" }), { target: { value: other.id } });
    fireEvent.click(screen.getByRole("button", { name: "打开对应事件" })); expect(data.onOpenEvent).toHaveBeenCalledWith(other);
    fireEvent.click(screen.getByRole("button", { name: "打开对应公司" })); expect(data.onOpenStock).toHaveBeenCalledWith(data.stocks[0]);
    expect(data.onClose.mock.invocationCallOrder[0]).toBeLessThan(data.onOpenEvent.mock.invocationCallOrder[0]);
  });
  it("only renders expectation numbers from the exact owner snapshot and preserves its unit", () => {
    const fixture = createReviewFixtures("full"); const snapshot = fixture.expectations[0];
    const event = buildEarningsExpectationResearchEvents([snapshot], [], fixture.companies, .1, "Asia/Shanghai")[0];
    expect(event.expectation?.snapshotId).toBe(snapshot.id);
    const data = props(); const { rerender } = render(<EvidenceDrawer {...data} events={[event]} expectationSnapshots={[snapshot]} />);
    expect(screen.getByLabelText("预期原始快照数值").textContent).toContain("120000000 至 160000000 · 人民币 · 元");
    rerender(<EvidenceDrawer {...data} events={[event]} expectationSnapshots={[{ ...snapshot, stockId: "wrong-company" }]} />);
    expect(screen.getByLabelText("预期原始快照数值").textContent).toContain("未提供可唯一匹配");
  });
  it("does not infer official source or effective time from ingestion type and original time", () => {
    const fixture = createReviewFixtures("full");
    const event = buildEarningsExpectationResearchEvents([fixture.expectations[0]], [], fixture.companies, .1, "Asia/Shanghai")[0];
    event.expectation = { ...event.expectation!, ingestionMethod: "provider", sourceName: "合成来源", effectiveBusinessTime: null, effectiveBusinessTimePrecision: null, originalBusinessTime: "2026-07-01" };
    render(<EvidenceDrawer {...props()} events={[event]} />);
    const text = screen.getByRole("dialog").textContent;
    expect(text).toContain("当前有效时间：缺失");
    expect(text).not.toContain("巨潮官方公告");
    expect(text).not.toContain("公司官方指引");
  });
  it("does not invent admission even for unexpected unprovided owner conditions", () => {
    const data = props(); data.events[0] = { ...data.events[0], verificationStatus: "unknown" as ResearchEvent["verificationStatus"] };
    render(<EvidenceDrawer {...data} />); expect(screen.getByRole("dialog").textContent).toContain("unknown");
    fireEvent.keyDown(document, { key: "Escape" }); expect(data.onClose).toHaveBeenCalledTimes(1);
  });
});
