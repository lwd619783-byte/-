// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReviewFixtures, REVIEW_NOW } from "../../ui-review/fixtures";
import { ResearchWorkbench, TaskWorkspace } from "./ResearchWorkbench";

afterEach(cleanup);

function props() {
  const data = createReviewFixtures("full");
  return { stocks: data.companies, watchItems: data.watchItems, tasks: data.tasks, events: data.snapshot.events, now: REVIEW_NOW, onNavigate: vi.fn(), onOpenStock: vi.fn(), onOpenEvent: vi.fn(), onStartReview: vi.fn(), onOpenKnowledge: vi.fn(), onOpenTasks: vi.fn(), onOpenReview: vi.fn() };
}

describe("UI V2 workbench owner navigation", () => {
  it("opens the existing company pool and preserves exact watched company identity", () => {
    const data = props();
    render(<ResearchWorkbench {...data} />);
    fireEvent.click(screen.getByRole("button", { name: "开始研究" }));
    expect(data.onNavigate).toHaveBeenCalledWith("个股池");
    const watched = data.watchItems.find(item => !item.archivedAt)!;
    const stock = data.stocks.find(item => item.id === watched.stockId)!;
    fireEvent.click(screen.getByRole("button", { name: `继续研究：${stock.name}` }));
    expect(data.onOpenStock).toHaveBeenCalledWith(stock);
    fireEvent.click(screen.getByRole("button", { name: "打开知识库" }));
    expect(data.onOpenKnowledge).toHaveBeenCalledOnce();
    expect(screen.getByText(/当前尚未记录阅读历史/)).toBeTruthy();
  });

  it("submits the entered question to real company search and opens existing sources", () => {
    const data = props(), onResearchQuery = vi.fn(), onOpenSources = vi.fn();
    render(<ResearchWorkbench {...data} onResearchQuery={onResearchQuery} onOpenSources={onOpenSources} />);
    expect(screen.getByRole("heading", { name: "从一个问题，开始研究。" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "输入研究主题" }), { target: { value: "  光通信  " } });
    fireEvent.click(screen.getByRole("button", { name: "开始研究" }));
    expect(onResearchQuery).toHaveBeenCalledWith("光通信");
    expect(data.onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("opens implemented macro and company research paths", () => {
    const data = props();
    render(<ResearchWorkbench {...data} watchItems={[]} tasks={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /从宏观到产业/ }));
    expect(data.onNavigate).toHaveBeenCalledWith("宏观");
    fireEvent.click(screen.getByRole("button", { name: /从产业到公司/ }));
    expect(data.onNavigate).toHaveBeenCalledWith("个股池");
    expect(screen.getByText("从你的第一项研究开始")).toBeTruthy();
    expect(screen.getByText("当前没有待处理复盘")).toBeTruthy();
  });

  it("keeps an unresolved watch item readable without opening a different stock", () => {
    const data = props();
    data.watchItems = [{ ...data.watchItems[0], stockId: "not-loaded" }, { ...data.watchItems[0], id: "archived", archivedAt: "2026-09-01" }];
    render(<ResearchWorkbench {...data} tasks={[]} />);
    expect(screen.getByText("研究对象未载入")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^继续研究：/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看观察记录" }));
    expect(data.onNavigate).toHaveBeenCalledWith("观察清单");
    expect(data.onOpenStock).not.toHaveBeenCalled();
  });

  it("routes pending review to the existing watch owner and preserves incomplete-source notices", () => {
    const data = props();
    const task = data.tasks.find(item => item.status === "pending")!;
    const watch = data.watchItems.find(item => item.id === task.watchItemId)!;
    render(<ResearchWorkbench {...data} tasks={[task]} inboxSourceNotice="来源读取失败，任务范围不完整" />);
    fireEvent.click(screen.getByRole("button", { name: "开始复盘" }));
    expect(data.onStartReview).toHaveBeenCalledWith(watch);
    expect(screen.getByRole("status").textContent).toContain("范围不完整");
  });

  it("retains the research inbox evidence and review paths in tasks", () => {
    const data = props();
    render(<TaskWorkspace {...data} />);
    fireEvent.click(screen.getByRole("button", { name: "打开知识待审" }));
    expect(data.onOpenReview).toHaveBeenCalledOnce();
    fireEvent.click(screen.getAllByRole("button", { name: /查看证据/ })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "打开对应事件" }));
    expect(data.onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: data.events[0].id }));
  });
});
