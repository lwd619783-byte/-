import { describe, expect, it } from "vitest";
import { buildReviewTasks, stableReviewTaskId } from "./reviewTaskProvider";
import type { EarningsVerificationChain, ResearchEvent, ReviewTaskState, WatchItem } from "../types";

const NOW = new Date("2026-07-13T12:00:00+08:00");

describe("reviewTaskProvider", () => {
  it("generates mutually exclusive due and overdue tasks", () => {
    const due = watch("due", "stock-a", "2026-07-13");
    const overdue = watch("overdue", "stock-b", "2026-07-12");
    const tasks = build([due, overdue]);
    expect(tasks.filter((task) => task.watchItemId === due.id).map((task) => task.ruleType)).toContain("due_review");
    expect(tasks.filter((task) => task.watchItemId === due.id).map((task) => task.ruleType)).not.toContain("overdue_review");
    expect(tasks.filter((task) => task.watchItemId === overdue.id).map((task) => task.ruleType)).toContain("overdue_review");
  });

  it("generates tasks for new preview, revision, flash and periodic-report events", () => {
    const item = watch("watch", "stock-a", null);
    const events = ["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report"].map((type, index) => event(`event-${index}`, type as ResearchEvent["eventType"]));
    const rules = build([item], events).map((task) => task.ruleType);
    expect(rules).toEqual(expect.arrayContaining(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report"]));
  });

  it("uses stable task IDs and deduplicates the same event and rule", () => {
    const item = watch("watch", "stock-a", null);
    const source = event("event-1", "earnings_preview");
    const first = build([item], [source, source]).filter((task) => task.ruleType === "earnings_preview");
    const second = build([item], [source]).filter((task) => task.ruleType === "earnings_preview");
    expect(first).toHaveLength(1);
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).toBe(stableReviewTaskId(item.id, "earnings_preview", source.id));
  });

  it("applies persisted acknowledged, dismissed and snoozed states", () => {
    const item = watch("watch", "stock-a", null);
    const source = event("event-1", "earnings_preview");
    const taskId = stableReviewTaskId(item.id, "earnings_preview", source.id);
    for (const state of [stateOf(taskId, "acknowledged"), stateOf(taskId, "dismissed"), stateOf(taskId, "snoozed", "2026-07-20")]) {
      expect(buildReviewTasks({ watchItems: [item], events: [source], chains: [], taskStates: [state], now: NOW })[0].status).toBe(state.status);
    }
  });

  it("returns an expired snooze to pending without changing the stable ID", () => {
    const item = watch("watch", "stock-a", null);
    const source = event("event-1", "earnings_preview");
    const taskId = stableReviewTaskId(item.id, "earnings_preview", source.id);
    const tasks = buildReviewTasks({ watchItems: [item], events: [source], chains: [], taskStates: [stateOf(taskId, "snoozed", "2026-07-12")], now: NOW });
    expect(tasks.find((task) => task.id === taskId)?.status).toBe("pending");
  });

  it("describes metadata_only and parse_partial as local parsing states", () => {
    const item = watch("watch", "stock-a", null);
    const tasks = build([item], [qualityEvent("metadata", "metadata_only"), qualityEvent("partial", "parse_partial")]);
    const copy = tasks.filter((task) => task.ruleType === "data_quality_warning").map((task) => task.description).join("\n");
    expect(copy).toContain("本地数据状态");
    expect(copy).toContain("仅取得元数据");
    expect(copy).toContain("正文仅部分解析");
    expect(copy).toContain("不等同于公司没有披露");
  });

  it("does not describe parse failures as company non-disclosure", () => {
    const task = build([watch("watch", "stock-a", null)], [qualityEvent("error", "error")]).find((item) => item.ruleType === "data_quality_warning");
    expect(task?.description).toContain("本地加载或解析出错");
    expect(task?.description).not.toContain("公司未披露");
  });

  it("generates cash-flow divergence only for reliable cumulative non-null values", () => {
    const item = watch("watch", "stock-a", null);
    const reliable = financial("financial-1", 100, 220);
    const missing = financial("financial-2", 100, null);
    const tasks = build([item], [reliable, missing]).filter((task) => task.ruleType === "cash_flow_profit_divergence");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].relatedEventIds).toEqual(["financial-1"]);
    expect(tasks[0].description).toContain("累计口径");
  });

  it("uses existing verification-chain materiality without inventing missing values", () => {
    const item = watch("watch", "stock-a", null);
    const preview = event("preview", "earnings_preview");
    const chain: EarningsVerificationChain = { id: "chain", stockId: item.stockId, stockName: "测试", stockCode: "000001", reportPeriod: "2026-06-30", preview: [preview], revision: [], flash: [], formal: [], financialUpdates: [], missingStages: ["revision", "flash", "formal"], differences: [], hasMaterialDifference: true, needsReview: true };
    const tasks = buildReviewTasks({ watchItems: [item], events: [preview], chains: [chain], taskStates: [], now: NOW });
    expect(tasks.some((task) => task.ruleType === "material_difference")).toBe(true);
  });

  it("does not mutate user status or output trading and consensus-expectation language", () => {
    const item = watch("watch", "stock-a", null);
    const before = JSON.stringify(item);
    const copy = JSON.stringify(build([item], [event("event-1", "earnings_flash"), qualityEvent("error", "error")]));
    expect(JSON.stringify(item)).toBe(before);
    for (const forbidden of ["买入", "卖出", "加仓", "减仓", "超机构预期", "目标价", "买入评级"]) expect(copy).not.toContain(forbidden);
  });

  it("ignores archived and sample items", () => {
    const archived = { ...watch("archived", "stock-a", null), archivedAt: "2026-07-12" };
    const sample = { ...watch("sample", "stock-b", null), source: "sample" as const };
    expect(build([archived, sample], [event("event-1", "earnings_preview")])).toEqual([]);
  });
});

function build(watchItems: WatchItem[], events: ResearchEvent[] = []) { return buildReviewTasks({ watchItems, events, chains: [], taskStates: [], now: NOW, longUnreviewedDays: 90 }); }
function watch(id: string, stockId: string, nextReviewAt: string | null): WatchItem { return { id, stockId, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", status: "观察", priority: "medium", tags: [], reason: "理由", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }; }
function event(id: string, eventType: ResearchEvent["eventType"]): ResearchEvent { return { id, stockId: "stock-a", stockName: "测试公司", stockCode: "000001", industryId: "tech", market: "A股", eventType, eventDate: "2026-07-12", publishedAt: "2026-07-12T08:00:00.000Z", reportPeriod: "2026-06-30", title: "正式披露事件", summary: "摘要", sourceType: "announcement", sourceName: "巨潮资讯", sourceUrl: "https://example.com/official", pdfUrl: null, verificationStatus: "verified", parseStatus: "parse_success", materiality: "high", metrics: [], relatedAnnouncementIds: [id], relatedFinancialPeriod: null, reviewStatus: "not_required", reviewReasons: [], isRestated: false, updatedAt: "2026-07-12T08:00:00.000Z" }; }
function qualityEvent(id: string, parseStatus: ResearchEvent["parseStatus"]): ResearchEvent { return { ...event(id, "data_warning"), verificationStatus: parseStatus === "metadata_only" ? "metadata_only" : parseStatus === "parse_partial" ? "partial" : "error", parseStatus, sourceType: "provider_status" }; }
function financial(id: string, profit: number | null, cash: number | null): ResearchEvent { return { ...event(id, "financial_update"), sourceType: "financial_report", parseStatus: "not_applicable", metrics: [{ key: "netProfitAttributableToParent", label: "累计归母净利润", value: profit, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: null, sourceFinancialPeriod: "2026-06-30" }, { key: "netOperatingCashFlow", label: "累计经营现金流", value: cash, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: null, sourceFinancialPeriod: "2026-06-30" }] }; }
function stateOf(taskId: string, status: ReviewTaskState["status"], snoozedUntil: string | null = null): ReviewTaskState { return { taskId, status, acknowledgedAt: status === "acknowledged" ? "2026-07-13" : null, dismissedAt: status === "dismissed" ? "2026-07-13" : null, snoozedUntil, updatedAt: "2026-07-13" }; }
