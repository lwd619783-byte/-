import type {
  ReviewEntry,
  ReviewEvidenceRef,
  ReviewTaskState,
  ReviewTriggerType,
  WatchItem,
  WatchItemSnapshot,
  WatchPriority,
  WatchStatus,
  WatchlistStoreEnvelope,
} from "../types";
import { WatchlistRepository } from "./watchlistRepository";

export interface WatchItemMetadataInput {
  reason: string;
  priority: WatchPriority;
  tags: string[];
  nextReviewAt: string | null;
}

export interface CreateWatchItemInput extends WatchItemMetadataInput {
  stockId: string;
  status?: WatchStatus;
  thesis: string;
  validationCriteria: string[];
  riskCriteria: string[];
}

export interface CompleteReviewInput {
  triggerType: ReviewTriggerType;
  triggerEventIds: string[];
  handledTaskIds: string[];
  summary: string;
  rationale: string;
  evidenceRefs: ReviewEvidenceRef[];
  decision: string;
  thesis: string;
  validationCriteria: string[];
  riskCriteria: string[];
  status: WatchStatus;
  nextReviewAt: string | null;
  correctsReviewEntryId?: string | null;
}

export interface WatchlistActionResult {
  ok: boolean;
  data: WatchlistStoreEnvelope;
  error: string | null;
  watchItem?: WatchItem;
  reviewEntry?: ReviewEntry;
  restored?: boolean;
}

export class WatchlistStore {
  constructor(
    private readonly repository: WatchlistRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly idFactory: (prefix: string) => string = defaultId,
  ) {}

  createWatchItem(data: WatchlistStoreEnvelope, input: CreateWatchItemInput): WatchlistActionResult {
    const active = data.watchItems.find((item) => item.stockId === input.stockId && !item.archivedAt);
    if (active) return failure(data, "该公司已经存在活跃观察项，请打开现有记录。", active);
    const archived = data.watchItems.find((item) => item.stockId === input.stockId && item.archivedAt);
    if (archived) return this.restoreWatchItem(data, archived.id);
    const timestamp = this.now().toISOString();
    const item: WatchItem = {
      id: this.idFactory("watch"),
      stockId: input.stockId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: input.status ?? "观察",
      priority: input.priority,
      tags: cleanList(input.tags),
      reason: input.reason.trim(),
      thesis: input.thesis.trim(),
      validationCriteria: cleanList(input.validationCriteria),
      riskCriteria: cleanList(input.riskCriteria),
      nextReviewAt: input.nextReviewAt,
      lastReviewedAt: null,
      archivedAt: null,
      source: "user",
      schemaVersion: 2,
    };
    return this.commit({ ...clone(data), updatedAt: timestamp, watchItems: [...data.watchItems, item] }, data, { watchItem: item });
  }

  loadSample(data: WatchlistStoreEnvelope, sample: WatchItem): WatchlistActionResult {
    if (sample.source !== "sample") return failure(data, "只能从明确标记的示例模板载入。", undefined);
    return this.createWatchItem(data, {
      stockId: sample.stockId,
      status: sample.status,
      priority: sample.priority,
      tags: sample.tags.filter((tag) => tag !== "示例"),
      reason: sample.reason.replace(/^示例[：:]\s*/, ""),
      thesis: sample.thesis,
      validationCriteria: sample.validationCriteria,
      riskCriteria: sample.riskCriteria,
      nextReviewAt: sample.nextReviewAt,
    });
  }

  updateWatchItemMetadata(data: WatchlistStoreEnvelope, watchItemId: string, input: WatchItemMetadataInput): WatchlistActionResult {
    const current = data.watchItems.find((item) => item.id === watchItemId);
    if (!current) return failure(data, "未找到观察项。", undefined);
    const timestamp = this.now().toISOString();
    const updated: WatchItem = {
      ...current,
      reason: input.reason.trim(),
      priority: input.priority,
      tags: cleanList(input.tags),
      nextReviewAt: input.nextReviewAt,
      updatedAt: timestamp,
    };
    const next = { ...clone(data), updatedAt: timestamp, watchItems: data.watchItems.map((item) => item.id === watchItemId ? updated : item) };
    return this.commit(next, data, { watchItem: updated });
  }

  archiveWatchItem(data: WatchlistStoreEnvelope, watchItemId: string): WatchlistActionResult {
    const current = data.watchItems.find((item) => item.id === watchItemId);
    if (!current) return failure(data, "未找到观察项。", undefined);
    const timestamp = this.now().toISOString();
    const updated = { ...current, archivedAt: timestamp, updatedAt: timestamp };
    const next = { ...clone(data), updatedAt: timestamp, watchItems: data.watchItems.map((item) => item.id === watchItemId ? updated : item) };
    return this.commit(next, data, { watchItem: updated });
  }

  restoreWatchItem(data: WatchlistStoreEnvelope, watchItemId: string): WatchlistActionResult {
    const current = data.watchItems.find((item) => item.id === watchItemId);
    if (!current) return failure(data, "未找到归档观察项。", undefined);
    const duplicate = data.watchItems.find((item) => item.stockId === current.stockId && !item.archivedAt && item.id !== current.id);
    if (duplicate) return failure(data, "该公司已经存在其他活跃观察项，不能恢复重复记录。", duplicate);
    const timestamp = this.now().toISOString();
    const updated = { ...current, archivedAt: null, updatedAt: timestamp };
    const next = { ...clone(data), updatedAt: timestamp, watchItems: data.watchItems.map((item) => item.id === watchItemId ? updated : item) };
    return this.commit(next, data, { watchItem: updated, restored: true });
  }

  completeReview(data: WatchlistStoreEnvelope, watchItemId: string, input: CompleteReviewInput): WatchlistActionResult {
    const current = data.watchItems.find((item) => item.id === watchItemId);
    if (!current) return failure(data, "未找到观察项，无法提交复盘。", undefined);
    if (input.correctsReviewEntryId && !data.reviewEntries.some((item) => item.id === input.correctsReviewEntryId && item.watchItemId === watchItemId)) {
      return failure(data, "待纠正的历史复盘记录不存在。", current);
    }
    const timestamp = this.now().toISOString();
    const beforeSnapshot = snapshot(current);
    const afterSnapshot: WatchItemSnapshot = {
      status: input.status,
      thesis: input.thesis.trim(),
      validationCriteria: cleanList(input.validationCriteria),
      riskCriteria: cleanList(input.riskCriteria),
    };
    const entry: ReviewEntry = {
      id: this.idFactory("review"),
      watchItemId,
      createdAt: timestamp,
      triggerType: input.triggerType,
      triggerEventIds: cleanList(input.triggerEventIds),
      beforeSnapshot,
      afterSnapshot,
      summary: input.summary.trim(),
      rationale: input.rationale.trim(),
      evidenceRefs: clone(input.evidenceRefs),
      decision: input.decision.trim(),
      nextReviewAt: input.nextReviewAt,
      correctsReviewEntryId: input.correctsReviewEntryId ?? null,
    };
    if (data.reviewEntries.some((item) => item.id === entry.id)) return failure(data, "复盘记录 ID 冲突，未保存任何修改。", current);
    const updated: WatchItem = {
      ...current,
      ...afterSnapshot,
      lastReviewedAt: timestamp,
      nextReviewAt: input.nextReviewAt,
      updatedAt: timestamp,
    };
    const handled = new Set(input.handledTaskIds);
    const retainedTaskStates = data.reviewTaskStates.filter((state) => !handled.has(state.taskId));
    const acknowledgedStates: ReviewTaskState[] = [...handled].map((taskId) => ({
      taskId,
      status: "acknowledged",
      acknowledgedAt: timestamp,
      dismissedAt: null,
      snoozedUntil: null,
      updatedAt: timestamp,
    }));
    const next: WatchlistStoreEnvelope = {
      ...clone(data),
      updatedAt: timestamp,
      watchItems: data.watchItems.map((item) => item.id === watchItemId ? updated : item),
      reviewEntries: [...data.reviewEntries, entry],
      reviewTaskStates: [...retainedTaskStates, ...acknowledgedStates],
    };
    return this.commit(next, data, { watchItem: updated, reviewEntry: entry });
  }

  setTaskState(data: WatchlistStoreEnvelope, taskId: string, status: "acknowledged" | "dismissed" | "snoozed", snoozedUntil: string | null = null): WatchlistActionResult {
    const timestamp = this.now().toISOString();
    if (status === "snoozed" && !snoozedUntil) return failure(data, "暂缓任务必须设置恢复日期。", undefined);
    const nextState: ReviewTaskState = {
      taskId,
      status,
      acknowledgedAt: status === "acknowledged" ? timestamp : null,
      dismissedAt: status === "dismissed" ? timestamp : null,
      snoozedUntil: status === "snoozed" ? snoozedUntil : null,
      updatedAt: timestamp,
    };
    const next = {
      ...clone(data),
      updatedAt: timestamp,
      reviewTaskStates: [...data.reviewTaskStates.filter((item) => item.taskId !== taskId), nextState],
    };
    return this.commit(next, data, {});
  }

  /** No update/delete method exists for ReviewEntry; corrections are new append-only entries. */
  appendCorrection(data: WatchlistStoreEnvelope, watchItemId: string, correctsReviewEntryId: string, input: CompleteReviewInput) {
    return this.completeReview(data, watchItemId, { ...input, correctsReviewEntryId });
  }

  private commit(next: WatchlistStoreEnvelope, previous: WatchlistStoreEnvelope, extras: Omit<WatchlistActionResult, "ok" | "data" | "error">): WatchlistActionResult {
    const result = this.repository.save(next);
    if (!result.ok) return { ok: false, data: previous, error: result.error, ...extras };
    return { ok: true, data: next, error: null, ...extras };
  }
}

export function snapshot(item: WatchItem): WatchItemSnapshot {
  return {
    status: item.status,
    thesis: item.thesis,
    validationCriteria: [...item.validationCriteria],
    riskCriteria: [...item.riskCriteria],
  };
}

export function sortReviewEntries(entries: ReviewEntry[]) {
  return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
}

function failure(data: WatchlistStoreEnvelope, error: string, watchItem?: WatchItem): WatchlistActionResult {
  return { ok: false, data, error, watchItem };
}

function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
