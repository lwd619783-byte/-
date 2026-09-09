// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Industry, ResearchEvent, ReviewEntry, ReviewTask, Stock, WatchItem } from "../../types";
import { ReviewTimeline } from "./ReviewTimeline";
import { WatchlistTab } from "./WatchlistTab";

const stockA = { id: "stock-a", name: "甲公司", code: "000001.SZ", market: "A股", industryId: "tech", segmentId: "segment" } as Stock;
const stockB = { ...stockA, id: "stock-b", name: "乙公司", code: "000002.SZ", industryId: "energy" };
const itemA: WatchItem = { id: "watch-a", stockId: stockA.id, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", status: "观察", priority: "high", tags: ["核心"], reason: "甲关注理由", thesis: "甲当前判断", validationCriteria: ["甲验证条件"], riskCriteria: ["甲风险条件"], nextReviewAt: "2000-01-01", lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 };
const itemB: WatchItem = { ...itemA, id: "watch-b", stockId: stockB.id, status: "等业绩验证", priority: "low", tags: ["待验证"], reason: "乙关注理由", thesis: "乙当前判断", validationCriteria: ["乙验证条件"], riskCriteria: ["乙风险条件"], nextReviewAt: "2099-01-01", updatedAt: "2026-08-01T00:00:00Z" };
const eventA = { id: "event-a", stockId: stockA.id, eventDate: "2026-07-12", publishedAt: "2026-07-12", title: "甲研究事件", sourceUrl: "https://example.com/evidence-a" } as ResearchEvent;
const taskA: ReviewTask = { id: "task-a", watchItemId: itemA.id, ruleType: "earnings_preview", relatedEventIds: [eventA.id], createdAt: "2026-07-12", dueAt: "2026-07-12", severity: "high", title: "甲待处理提醒", description: "结合正式来源主动复盘", status: "pending", acknowledgedAt: null, dismissedAt: null, snoozedUntil: null };
const reviewA: ReviewEntry = { id: "review-a", watchItemId: itemA.id, createdAt: "2026-07-13T08:00:00Z", triggerType: "announcement_event", triggerEventIds: [eventA.id, "unavailable-event"], beforeSnapshot: { status: "观察", thesis: "旧判断", validationCriteria: ["旧验证"], riskCriteria: ["旧风险"] }, afterSnapshot: { status: "等业绩验证", thesis: "新判断", validationCriteria: ["新验证"], riskCriteria: ["新风险"] }, summary: "用户复盘甲", rationale: "等待正式报告", evidenceRefs: [{ eventId: eventA.id, sourceName: "用户引用材料", sourceUrl: eventA.sourceUrl! }], decision: "等待更多证据", nextReviewAt: "2026-08-01", correctsReviewEntryId: null };

function props() {
  return {
    watchItems: [itemA, itemB], stocks: [stockA, stockB], industries: [{ id: "tech", name: "科技", segments: [] }, { id: "energy", name: "能源", segments: [] }] as unknown as Industry[],
    samples: [{ ...itemA, id: "sample-a", source: "sample" as const }], reviewEntries: [reviewA], tasks: [taskA], events: [eventA], exportJson: "{}",
    onValidateImport: vi.fn(() => ({ ok: false, errors: [], preview: { schemaVersion: null, watchItemCount: 0, reviewEntryCount: 0, taskStateCount: 0, conflictCount: 0, invalidRecordCount: 0, addCount: 0, skipCount: 0, replaceCount: 0 }, data: null })),
    onMergeImport: vi.fn(), onReplaceImport: vi.fn(), onReset: vi.fn(), onAdd: vi.fn(), onEdit: vi.fn(), onStartReview: vi.fn(), onCorrectReview: vi.fn(), onArchive: vi.fn(), onRestore: vi.fn(), onLoadSample: vi.fn(), onLoadAllSamples: vi.fn(), onTaskState: vi.fn(), onOpenStock: vi.fn(),
  };
}

function selectCompany(name = stockA.name) {
  const trigger = screen.getByRole("button", { name: `查看观察项 ${name}` });
  fireEvent.click(trigger);
  return trigger;
}
function openDetails(summaryText: string) {
  const summary = screen.getByText(summaryText);
  fireEvent.click(summary);
  expect(summary.closest("details")?.open).toBe(true);
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute("data-theme"); });

describe("watchlist list and detail workflow", () => {
  it("switches identities without mixing judgments, then restores the list trigger focus", () => {
    const callbacks = props();
    render(<WatchlistTab {...callbacks} />);
    const trigger = selectCompany(stockB.name);
    const detail = screen.getByRole("region", { name: "观察项详情" });
    expect(document.activeElement).toBe(detail);
    expect(within(detail).getByText("乙当前判断")).toBeTruthy();
    expect(within(detail).queryByText("甲当前判断")).toBeNull();
    fireEvent.click(within(detail).getByRole("button", { name: "查看个股" }));
    expect(callbacks.onOpenStock).toHaveBeenCalledWith(stockB);
    fireEvent.click(within(detail).getByRole("button", { name: "返回观察列表" }));
    expect(document.activeElement).toBe(trigger);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(screen.getByRole("button", { name: "查看观察项 乙公司" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps basic and advanced filters, sorting, selection and callbacks intact across theme changes", () => {
    const callbacks = props();
    const { rerender } = render(<WatchlistTab {...callbacks} />);
    fireEvent.change(screen.getByRole("combobox", { name: "观察排序" }), { target: { value: "updated" } });
    expect(within(screen.getByRole("list", { name: "用户观察项列表" })).getAllByRole("listitem")[0].textContent).toContain(stockB.name);
    openDetails("更多筛选");
    fireEvent.change(screen.getByRole("combobox", { name: "观察行业" }), { target: { value: "energy" } });
    fireEvent.change(screen.getByRole("combobox", { name: "观察优先级" }), { target: { value: "low" } });
    fireEvent.change(screen.getByRole("combobox", { name: "观察标签" }), { target: { value: "待验证" } });
    expect(screen.getByText("更多筛选（3 项已启用）")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看观察项 甲公司" })).toBeNull();
    selectCompany(stockB.name);
    document.documentElement.dataset.theme = "light";
    rerender(<WatchlistTab {...callbacks} />);
    expect((screen.getByRole("combobox", { name: "观察排序" }) as HTMLSelectElement).value).toBe("updated");
    expect((screen.getByRole("combobox", { name: "观察标签" }) as HTMLSelectElement).value).toBe("待验证");
    expect(screen.getByRole("button", { name: "查看观察项 乙公司" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "清除更多筛选" }));
    expect(screen.getByRole("button", { name: "查看观察项 甲公司" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "观察公司" }), { target: { value: "000001" } });
    expect(screen.queryByRole("button", { name: "查看观察项 乙公司" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "观察状态" }), { target: { value: "等业绩验证" } });
    expect(screen.getByText("没有匹配的用户观察项")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除全部筛选" }));
    expect(screen.getAllByRole("button", { name: /查看观察项/ })).toHaveLength(2);
    expect(callbacks.onEdit).not.toHaveBeenCalled();
    expect(callbacks.onStartReview).not.toHaveBeenCalled();
  });

  it("invalidates filtered or archived detail instead of displaying another company's stale record", () => {
    const callbacks = props();
    const { rerender } = render(<WatchlistTab {...callbacks} />);
    selectCompany(stockB.name);
    fireEvent.click(screen.getByRole("button", { name: "仅看逾期" }));
    expect(screen.queryByText("乙当前判断")).toBeNull();
    expect(screen.getByText("请选择一个观察项查看详情。")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /个人观察清单/ }));
    fireEvent.click(screen.getByRole("button", { name: "仅看新事件" }));
    expect(screen.getAllByRole("button", { name: /查看观察项/ })).toHaveLength(1);
    selectCompany();
    rerender(<WatchlistTab {...callbacks} watchItems={[{ ...itemA, archivedAt: "2026-09-09T00:00:00Z" }, itemB]} />);
    expect(screen.queryByText("甲当前判断")).toBeNull();
    expect(screen.getByText("没有匹配的用户观察项")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "观察公司" }));
  });

  it("routes task states separately from review and exposes all pending reminders", () => {
    const callbacks = props();
    const tasks = Array.from({ length: 6 }, (_, index) => ({ ...taskA, id: `task-${index}`, title: `待办 ${index}` }));
    const snapshot = JSON.stringify(itemA);
    render(<WatchlistTab {...callbacks} tasks={tasks} />);
    selectCompany();
    expect(screen.getAllByRole("article", { name: /^提醒/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "展开全部 6 条提醒" }));
    expect(screen.getAllByRole("article", { name: /^提醒/ })).toHaveLength(6);
    const first = within(screen.getByRole("article", { name: "提醒 待办 0" }));
    fireEvent.click(first.getByRole("button", { name: "确认" }));
    fireEvent.click(first.getByRole("button", { name: "暂缓 7 天" }));
    fireEvent.click(first.getByRole("button", { name: "忽略" }));
    expect(callbacks.onTaskState.mock.calls[0]).toEqual(["task-0", "acknowledged"]);
    expect(callbacks.onTaskState.mock.calls[1]).toEqual(["task-0", "snoozed", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)]);
    expect(callbacks.onTaskState.mock.calls[2]).toEqual(["task-0", "dismissed"]);
    expect(callbacks.onStartReview).not.toHaveBeenCalled();
    expect(callbacks.onEdit).not.toHaveBeenCalled();
    expect(JSON.stringify(itemA)).toBe(snapshot);
  });

  it("retains add, metadata, review, archive and restore as distinct explicit actions", () => {
    const callbacks = props();
    const { rerender } = render(<WatchlistTab {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: "添加观察项" }));
    selectCompany();
    const detail = within(screen.getByRole("region", { name: "观察项详情" }));
    fireEvent.click(detail.getByRole("button", { name: "开始复盘" }));
    openDetails("更多操作");
    fireEvent.click(detail.getByRole("button", { name: "编辑元数据" }));
    fireEvent.click(detail.getByRole("button", { name: "归档" }));
    expect(callbacks.onAdd).toHaveBeenCalledTimes(1);
    expect(callbacks.onStartReview).toHaveBeenCalledWith(itemA);
    expect(callbacks.onEdit).toHaveBeenCalledWith(itemA);
    expect(callbacks.onArchive).toHaveBeenCalledWith(itemA);
    const archived = { ...itemA, archivedAt: "2026-09-09T00:00:00Z" };
    rerender(<WatchlistTab {...callbacks} watchItems={[archived, itemB]} />);
    fireEvent.click(screen.getByRole("button", { name: "显示归档" }));
    selectCompany();
    fireEvent.click(within(screen.getByRole("region", { name: "观察项详情" })).getByRole("button", { name: "恢复" }));
    expect(callbacks.onRestore).toHaveBeenCalledWith(archived);
  });

  it("keeps sample templates closed and excluded until the user explicitly loads them", () => {
    const callbacks = props();
    render(<WatchlistTab {...callbacks} watchItems={[]} reviewEntries={[]} tasks={[]} />);
    expect(screen.getByText("示例模板（不计入用户数据）").closest("details")?.open).toBe(false);
    expect(screen.getByRole("button", { name: "载入此示例" }).closest("details")?.open).toBe(false);
    expect(screen.getByRole("region", { name: "观察清单指标" }).textContent).toContain("正在观察0");
    expect(callbacks.onLoadSample).not.toHaveBeenCalled();
    expect(callbacks.onLoadAllSamples).not.toHaveBeenCalled();
    openDetails("示例模板（不计入用户数据）");
    fireEvent.click(screen.getByRole("button", { name: "载入此示例" }));
    fireEvent.click(screen.getByRole("button", { name: "载入全部示例" }));
    expect(callbacks.onLoadSample).toHaveBeenCalledWith(callbacks.samples[0]);
    expect(callbacks.onLoadAllSamples).toHaveBeenCalledTimes(1);
  });

  it("keeps unmatched records and storage recovery visible without inventing company identity", () => {
    const callbacks = props();
    render(<WatchlistTab {...callbacks} watchItems={[{ ...itemA, stockId: "missing-stock" }]} storageError="存储写入失败，已保留原记录" corruptedRaw="damaged original contents" />);
    expect(screen.getByRole("alert").textContent).toContain("存储写入失败，已保留原记录");
    expect(screen.getByText(/1 条观察记录无法匹配当前研究池公司/)).toBeTruthy();
    expect(screen.getByText("没有匹配的用户观察项")).toBeTruthy();
    openDetails("查看未匹配记录");
    expect(screen.getByText(/公司 ID：missing-stock/)).toBeTruthy();
    expect(screen.getByText("投资假设：甲当前判断")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开备份与恢复" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("存储写入失败，已保留原记录")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "导出损坏原始数据" })).toBeTruthy();
    expect(callbacks.onReset).not.toHaveBeenCalled();
    expect(callbacks.onReplaceImport).not.toHaveBeenCalled();
  });
});

describe("review timeline history and provenance", () => {
  it("preserves complete before/after snapshots, missing event references, evidence URLs and correction relationships", () => {
    const corrected = { ...reviewA, correctsReviewEntryId: "prior-review" };
    const onCorrect = vi.fn();
    render(<ReviewTimeline entries={[corrected]} events={[eventA]} onCorrect={onCorrect} />);
    for (const text of ["旧判断", "新判断", "旧验证", "新验证", "旧风险", "新风险"]) expect(screen.getByText(text, { exact: false })).toBeTruthy();
    expect(screen.getByText(/unavailable-event/)).toBeTruthy();
    expect(screen.getByText("纠正记录：prior-review")).toBeTruthy();
    expect(screen.getByRole("link", { name: "查看证据来源" }).getAttribute("href")).toBe(eventA.sourceUrl);
    expect(screen.queryByText("官方来源")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "新增纠正记录" }));
    expect(onCorrect).toHaveBeenCalledWith(corrected);
  });

  it("expands all records in the existing stable history order without rewriting entries", () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({ ...reviewA, id: `history-${index}`, summary: `历史 ${index}`, createdAt: `2026-07-${String(index + 10).padStart(2, "0")}T00:00:00Z` }));
    const snapshot = JSON.stringify(entries);
    render(<ReviewTimeline entries={entries} />);
    expect(screen.getAllByRole("article")[0].getAttribute("aria-label")).toBe("复盘记录 历史 6");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "展开全部 7 条" })); });
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("article")[6].getAttribute("aria-label")).toBe("复盘记录 历史 0");
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
