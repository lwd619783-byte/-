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
describe("UI V2.1 workbench and task composition", () => {
  it("keeps real object callbacks and removes unavailable question and reading surfaces", () => {
    const data = props(), onOpenSources = vi.fn();
    render(<ResearchWorkbench {...data} onOpenSources={onOpenSources} />);
    const watched = data.watchItems.find(item => !item.archivedAt)!;
    const stock = data.stocks.find(item => item.id === watched.stockId)!;
    fireEvent.click(screen.getByRole("button", { name: `继续研究：${stock.name}` }));
    expect(data.onOpenStock).toHaveBeenCalledWith(stock);
    fireEvent.click(screen.getByRole("button", { name: /公司研究/ }));
    expect(data.onNavigate).toHaveBeenCalledWith("个股池");
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "输入研究主题" })).toBeNull();
    expect(screen.queryByText("最近阅读")).toBeNull();
  });
  it("removes the actual side track when no review tasks exist", () => {
    const { container } = render(<ResearchWorkbench {...props()} watchItems={[]} tasks={[]} events={[]} />);
    expect(container.querySelector('.ui-v21-home-columns')?.getAttribute('data-columns')).toBe('1');
    expect(container.querySelector('.ui-v21-home-columns.has-tasks')).toBeNull();
    expect(screen.queryByLabelText("待处理复盘")).toBeNull();
    expect(screen.getByText("还没有观察项")).toBeTruthy();
  });
  it("keeps an unresolved watch item without opening a different stock", () => {
    const data = props(); data.watchItems = [{ ...data.watchItems[0], stockId: "not-loaded" }, { ...data.watchItems[0], id: "archived", archivedAt: "2026-09-01" }];
    render(<ResearchWorkbench {...data} tasks={[]} />);
    expect(screen.getByText("研究对象未载入")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看观察记录" }));
    expect(data.onNavigate).toHaveBeenCalledWith("观察清单"); expect(data.onOpenStock).not.toHaveBeenCalled();
  });
  it("does not turn loading, failure or locked observations into an empty count", () => {
    const data = props(); const { rerender, container } = render(<ResearchWorkbench {...data} dataState="loading" />);
    expect(screen.queryByText("还没有观察项")).toBeNull();
    expect(container.textContent).toContain("数量尚未确定");
    rerender(<ResearchWorkbench {...data} dataState="error" dataMessage="存储读取失败" />);
    expect(screen.getAllByRole("alert")[0].textContent).toContain("存储读取失败");
    rerender(<ResearchWorkbench {...data} dataState="locked" />);
    expect(screen.queryByLabelText("待处理复盘")).toBeNull();
    expect(container.textContent).toContain("已锁定");
  });
  it("preserves review owner and evidence actions, with knowledge count unloaded separately", () => {
    const data = props(); render(<TaskWorkspace {...data} />);
    expect(screen.getByRole("tab", { name: /知识待审.*待载入/ })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "研究事件列表" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /查看证据/ })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "打开对应事件" }));
    expect(data.onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: data.events[0].id }));
  });
  it("event verification includes only the shared needsDataReview selection, including task-linked events", () => {
    const data = props(); const normal = { ...data.events[0], id: 'normal', parseStatus: 'parse_success' as const, reviewReasons: [], metrics: [] };
    const warning = { ...normal, id: data.events[0].id, title: '仅元数据合成事件', parseStatus: 'metadata_only' as const };
    render(<TaskWorkspace {...data} events={[normal, warning]} activeQueue="verification" />);
    expect(screen.getByRole('tab', { name: '事件核验 1' })).toBeTruthy();
    const table = screen.getByRole('table', { name: '事件核验列表' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('仅元数据合成事件')).toBeTruthy();
    expect(within(table).queryByText(normal.title)).toBeNull();
    fireEvent.click(within(table).getByRole('button', { name: /查看证据/ }));
    expect(screen.getByRole('dialog').textContent).toContain('仅元数据合成事件');
  });
  it("supports controlled category changes without mounting a duplicate knowledge owner", () => {
    const data = props(), onQueueChange = vi.fn();
    const { rerender } = render(<TaskWorkspace {...data} activeQueue="review" onQueueChange={onQueueChange} knowledgeState={{ status: 'ready', count: 2 }} />);
    fireEvent.click(screen.getByRole('tab', { name: '知识待审 2' }));
    expect(onQueueChange).toHaveBeenCalledWith('knowledge');
    rerender(<TaskWorkspace {...data} activeQueue="knowledge" onQueueChange={onQueueChange} knowledgeState={{ status: 'ready', count: 2 }} />);
    expect(screen.queryByLabelText('研究收件箱')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });
});
