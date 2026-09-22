// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchInbox } from "./ResearchInbox";
import { createReviewFixtures, REVIEW_NOW } from "../../ui-review/fixtures";
import { ReviewFormModal } from "../watchlist/ReviewFormModal";
import { WatchlistRepository } from "../../services/watchlistRepository";
import { WatchlistStore } from "../../services/watchlistStore";
import { buildReviewTasks } from "../../services/reviewTaskProvider";
import { useWorkspaceNavigation } from "../../hooks/useWorkspaceNavigation";
import type { WatchItem, WatchlistStoreEnvelope } from "../../types";

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); window.history.replaceState(null, "", "#/home"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function props() {
  const data = createReviewFixtures("full");
  return { events: data.snapshot.events, tasks: data.tasks, watchItems: data.watchItems, stocks: data.companies, now: REVIEW_NOW, timeZone: "Asia/Shanghai", onOpenStock: vi.fn(), onOpenEvent: vi.fn(), onStartReview: vi.fn() };
}

describe("Research Inbox interactions", () => {
  it("removes the empty review track rather than retaining a half-width column", () => {
    const data = props();
    const { container } = render(<ResearchInbox {...data} tasks={[]} />);
    expect(screen.queryByLabelText("待处理事项")).toBeNull();
    expect(container.querySelector('.inbox-tracks')?.getAttribute('data-columns')).toBe('1');
    expect(container.querySelector('.has-review-track')).toBeNull();
    expect(screen.getByRole('table', { name: '研究事件列表' })).toBeTruthy();
  });
  it("keeps data and verification states distinct and preserves incremental loading and denominator", () => {
    const data = props();
    const events = Array.from({ length: 9 }, (_, index) => ({ ...data.events[0], id: `compact-${index}`, title: `合成事件 ${index}`, eventDate: '2026-09-08', reviewStatus: 'not_required' as const, parseStatus: 'metadata_only' as const, verificationStatus: 'verified' as const, reviewReasons: [] }));
    render(<ResearchInbox {...data} tasks={[]} events={events} initialLimit={2} />);
    const table = screen.getByRole('table', { name: '研究事件列表' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('显示 2 / 9 项 · 未合并事件共 9 项')).toBeTruthy();
    expect(within(table).getAllByText('仅元数据 / 已核验')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '显示更多事件（剩余 7）' }));
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText('显示 4 / 9 项 · 未合并事件共 9 项')).toBeTruthy();
  });
  it("deduplicates equal status wording without losing parse and verification dimensions", () => {
    const data = props(), event = { ...data.events[0], parseStatus: 'metadata_only' as const, verificationStatus: 'metadata_only' as const };
    const { rerender } = render(<ResearchInbox {...data} tasks={[]} events={[event]} />);
    expect(screen.getByLabelText('解析：仅元数据；核验：仅元数据').textContent).toBe('仅元数据');
    expect(screen.queryByText('仅元数据 / 仅元数据')).toBeNull();
    rerender(<ResearchInbox {...data} tasks={[]} events={[{ ...event, verificationStatus: 'verified' }]} />);
    expect(screen.getByLabelText('解析：仅元数据；核验：已核验').textContent).toBe('仅元数据 / 已核验');
  });
  it("does not publish an empty denominator during loading, error, or lock", () => {
    const data = props(); const { rerender } = render(<ResearchInbox {...data} dataState="loading" />);
    expect(screen.getByRole('status').textContent).toContain('尚不能确定队列数量');
    expect(screen.queryByRole('table')).toBeNull();
    rerender(<ResearchInbox {...data} dataState="error" />);
    expect(screen.getByRole('alert').textContent).toContain('读取失败');
    expect(screen.queryByText(/显示 0/)).toBeNull();
    rerender(<ResearchInbox {...data} dataState="locked" />);
    expect(screen.getByRole('alert').textContent).toContain('已锁定');
  });
  it("keeps a long row title complete in the evidence drawer", () => {
    const data = props();
    const title = '合成完整研究标题'.repeat(20);
    render(<ResearchInbox {...data} tasks={[]} events={[{ ...data.events[0], title }]} />);
    fireEvent.click(screen.getByRole('button', { name: /查看证据/ }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: title })).toBeTruthy();
  });
  it("shows empty and source failure states without claiming no data exists", () => {
    render(<ResearchInbox {...props()} events={[]} tasks={[]} watchItems={[]} sourceNotice="预期索引 error；范围不完整" />);
    expect(screen.getByRole("status").textContent).toContain("范围不完整");
    expect(screen.queryByLabelText("待处理事项")).toBeNull();
    expect(screen.getByText("当前已载入范围内没有未合并研究事件。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看证据/ })).toBeNull();
  });
  it("shows old and unknown-date events only after an explicit date expansion", () => {
    const data = props(); const events = data.events.slice(0, 2).map((event, i) => ({ ...event, reviewStatus: "not_required" as const, eventDate: i ? null : "2025-01-01" }));
    render(<ResearchInbox {...data} events={events} tasks={[]} />);
    expect(screen.queryByRole("button", { name: /查看证据/ })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "日期范围" }), { target: { value: "all" } });
    expect(screen.getAllByRole("button", { name: /查看证据/ })).toHaveLength(2);
  });
  it("keeps historical pending events out of today's task lane and exposes the full count", () => {
    const data = props(); const events = [{ ...data.events[0], eventDate: "2020-01-01", reviewStatus: "pending" as const }];
    render(<ResearchInbox {...data} events={events} tasks={[]} />);
    expect(screen.queryByLabelText("待处理事项")).toBeNull();
    expect(screen.getByText(/另有 1 条记录不在近 30 天范围/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "日期范围" }), { target: { value: "all" } });
    expect(within(screen.getByLabelText("近期变化")).getByText("待复盘")).toBeTruthy();
  });
  it("opens evidence with all task reasons and restores keyboard focus when closed", () => {
    render(<ResearchInbox {...props()} />);
    const trigger = screen.getAllByRole("button", { name: /查看证据/ })[0]; trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole("dialog").textContent).toContain("关联复盘任务");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it("uses real workspace navigation with exact encoded event and company identity", () => {
    const data = props(); data.events[0].id = "precise/event?one"; data.tasks[0].relatedEventIds = [data.events[0].id];
    function Harness() { const nav = useWorkspaceNavigation(); return <ResearchInbox {...data} onOpenEvent={event => nav.openEvent(event.id)} onOpenStock={stock => nav.openCompany(stock.id)} />; }
    render(<Harness />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看证据/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "打开对应事件" }));
    expect(window.location.hash).toBe("#/verification?event=precise%2Fevent%3Fone");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /查看证据/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "打开对应公司" }));
    expect(window.location.hash).toBe("#/company/ui-review-company-1/overview?from=verification");
  });
  it("completes the existing review form/store workflow with one append, no duplicate watch/task creation", async () => {
    const data = props(); const storage = new Map<string, string>();
    const write = vi.fn((key: string, value: string) => { storage.set(key, value); });
    const repository = new WatchlistRepository({ getItem: key => storage.get(key) ?? null, setItem: write, removeItem: key => { storage.delete(key); } }, () => REVIEW_NOW);
    let id = 0; const store = new WatchlistStore(repository, () => REVIEW_NOW, prefix => `${prefix}-${++id}`);
    let latest: WatchlistStoreEnvelope = { ...repository.load().data, watchItems: [{ ...data.watchItems[0], source: "user", createdAt: "2026-08-01", lastReviewedAt: null }] };
    function Harness() {
      const [owner, setOwner] = useState(latest); const [review, setReview] = useState<WatchItem | null>(null);
      const tasks = buildReviewTasks({ watchItems: owner.watchItems, events: data.events, chains: [], taskStates: owner.reviewTaskStates, now: REVIEW_NOW, timeZone: data.timeZone });
      return <><ResearchInbox {...data} watchItems={owner.watchItems} tasks={tasks} onStartReview={setReview} />{review ? <ReviewFormModal watchItem={review} events={data.events} tasks={tasks} onClose={() => setReview(null)} onSubmit={input => { const result = store.completeReview(owner, review.id, input); expect(result.ok).toBe(true); latest = result.data; setOwner(result.data); setReview(null); }} /> : null}</>;
    }
    render(<Harness />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看证据/ })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "开始复盘" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog").textContent).toContain("完成一次投研复盘");
    expect(write).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("下一次复盘日期"), { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByLabelText("本次新证据"), { target: { value: "核对合成来源后完成复盘" } });
    fireEvent.click(screen.getByRole("button", { name: "提交复盘" }));
    await waitFor(() => expect(latest.reviewEntries).toHaveLength(1));
    expect(latest.watchItems).toHaveLength(1);
    expect(new Set(latest.reviewTaskStates.map(task => task.taskId)).size).toBe(latest.reviewTaskStates.length);
    expect(latest.reviewEntries[0].triggerEventIds).toContain(data.events[0].id);
    const pending = buildReviewTasks({ watchItems: latest.watchItems, events: data.events, chains: [], taskStates: latest.reviewTaskStates, now: REVIEW_NOW, timeZone: data.timeZone }).filter(task => task.status === "pending");
    expect(pending).toEqual([]); expect(screen.queryByRole("dialog")).toBeNull();
  });
});
