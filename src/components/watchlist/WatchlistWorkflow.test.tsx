import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResearchEvent, ReviewEntry, ReviewTask, Stock, WatchItem } from "../../types";
import { WatchlistTab } from "./WatchlistTab";
import { ReviewFormModal } from "./ReviewFormModal";
import { ReviewTimeline } from "./ReviewTimeline";
import { StockWatchlistPanel } from "./StockWatchlistPanel";

const stock = { id: "demo", name: "测试公司", code: "300001.SZ", market: "A股", industryId: "tech", segmentId: "segment" } as Stock;
const watchItem: WatchItem = { id: "watch-1", stockId: stock.id, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", status: "观察", priority: "high", tags: ["核心"], reason: "关注理由", thesis: "当前投资假设", validationCriteria: ["验证条件"], riskCriteria: ["风险条件"], nextReviewAt: "2026-07-12", lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 };
const event = { id: "event-1", stockId: stock.id, stockName: stock.name, stockCode: stock.code, industryId: stock.industryId, market: "A股", eventType: "earnings_preview", eventDate: "2026-07-12", publishedAt: "2026-07-12", reportPeriod: "2026-06-30", title: "业绩预告", summary: "公告摘要", sourceType: "announcement", sourceName: "巨潮资讯", sourceUrl: "https://example.com/official", pdfUrl: null, verificationStatus: "metadata_only", parseStatus: "metadata_only", materiality: "high", metrics: [], relatedAnnouncementIds: ["announcement-1"], relatedFinancialPeriod: null, reviewStatus: "pending", reviewReasons: ["人工核验"], isRestated: false, updatedAt: "2026-07-12" } as ResearchEvent;
const task: ReviewTask = { id: "task-1", watchItemId: watchItem.id, ruleType: "earnings_preview", relatedEventIds: [event.id], createdAt: "2026-07-12", dueAt: "2026-07-12", severity: "high", title: "公司发布新的业绩预告", description: "请结合正式来源主动复盘。", status: "pending", acknowledgedAt: null, dismissedAt: null, snoozedUntil: null };
const entry: ReviewEntry = { id: "review-1", watchItemId: watchItem.id, createdAt: "2026-07-13T08:00:00Z", triggerType: "announcement_event", triggerEventIds: [event.id], beforeSnapshot: { status: "观察", thesis: "旧假设", validationCriteria: ["旧验证"], riskCriteria: ["旧风险"] }, afterSnapshot: { status: "等业绩验证", thesis: "新假设", validationCriteria: ["新验证"], riskCriteria: ["新风险"] }, summary: "新增公告证据", rationale: "等待正式报告", evidenceRefs: [{ eventId: event.id, sourceName: "巨潮资讯", sourceUrl: event.sourceUrl ?? undefined }], decision: "等待更多证据", nextReviewAt: "2026-08-01", correctsReviewEntryId: null };

describe("watchlist workflow UI", () => {
  it("renders KPI, filters, editable actions, tasks and responsive card content", () => {
    const html = renderToStaticMarkup(<WatchlistTab {...baseProps()} />);
    for (const copy of ["正在观察", "待复盘", "已逾期", "新事件提醒", "已归档", "添加观察项", "编辑元数据", "开始复盘", "公司发布新的业绩预告"]) expect(html).toContain(copy);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("renders an empty user state and keeps samples explicitly separated", () => {
    const sample = { ...watchItem, id: "sample-1", source: "sample" as const, tags: ["示例"] };
    const html = renderToStaticMarkup(<WatchlistTab {...baseProps()} watchItems={[]} tasks={[]} reviewEntries={[]} samples={[sample]} />);
    expect(html).toContain("没有匹配的用户观察项");
    expect(html).toContain("示例模板（不计入用户数据）");
    expect(html).toContain("载入此示例");
  });

  it("renders storage errors without crashing the page", () => {
    const html = renderToStaticMarkup(<WatchlistTab {...baseProps()} storageError="本地观察清单已损坏，已安全回退为空状态" />);
    expect(html).toContain("本地观察清单已损坏");
    expect(html).toContain("个人观察清单");
  });

  it("renders the complete review form with core fields and linked ResearchEvent", () => {
    const html = renderToStaticMarkup(<ReviewFormModal watchItem={watchItem} events={[event]} tasks={[task]} onClose={() => undefined} onSubmit={() => undefined} />);
    for (const copy of ["本次触发原因", "关联 ResearchEvent", "当前投资假设", "本次新证据", "更新后的投资假设", "下一次复盘日期", "提交复盘", "业绩预告"]) expect(html).toContain(copy);
  });

  it("renders append-only timeline snapshots, evidence source and correction entry action", () => {
    const html = renderToStaticMarkup(<ReviewTimeline entries={[entry]} events={[event]} onCorrect={() => undefined} />);
    expect(html).toContain("复盘前");
    expect(html).toContain("复盘后");
    expect(html).toContain("官方来源");
    expect(html).toContain("新增纠正记录");
  });

  it("renders add action when stock is not watched and prevents a second add UI when active", () => {
    const empty = renderToStaticMarkup(<StockWatchlistPanel tasks={[]} entries={[]} events={[]} onAdd={() => undefined} onEdit={() => undefined} onStartReview={() => undefined} onRestore={() => undefined} />);
    const active = renderToStaticMarkup(<StockWatchlistPanel activeItem={watchItem} tasks={[task]} entries={[entry]} events={[event]} onAdd={() => undefined} onEdit={() => undefined} onStartReview={() => undefined} onRestore={() => undefined} />);
    expect(empty).toContain("加入观察清单");
    expect(active).toContain("当前观察状态");
    expect(active).not.toContain("加入观察清单");
    expect(active).toContain("复盘时间线");
  });
});

function baseProps() {
  return {
    watchItems: [watchItem], samples: [], reviewEntries: [entry], tasks: [task], stocks: [stock], industries: [{ id: "tech", name: "科技", segments: [] }] as never[], events: [event], exportJson: "{}",
    onValidateImport: () => ({ ok: false, errors: [], preview: { schemaVersion: null, watchItemCount: 0, reviewEntryCount: 0, taskStateCount: 0, conflictCount: 0, invalidRecordCount: 0, addCount: 0, skipCount: 0, replaceCount: 0 }, data: null }),
    onMergeImport: () => undefined, onReplaceImport: () => undefined, onReset: () => undefined, onAdd: () => undefined, onEdit: () => undefined, onStartReview: () => undefined, onCorrectReview: () => undefined, onArchive: () => undefined, onRestore: () => undefined, onLoadSample: () => undefined, onLoadAllSamples: () => undefined, onTaskState: () => undefined, onOpenStock: () => undefined,
  };
}
