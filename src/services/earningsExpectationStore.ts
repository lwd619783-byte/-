import type { EarningsExpectationSnapshot, EarningsExpectationStoreEnvelope } from "../types";
import { EarningsExpectationRepository, earningsExpectationFingerprint, validateEarningsExpectationSnapshot } from "./earningsExpectationRepository";

export type CreateEarningsExpectationSnapshotInput = Omit<EarningsExpectationSnapshot, "id" | "createdAt" | "createdBy" | "schemaVersion" | "correctsSnapshotId"> & {
  id?: string;
  createdAt?: string;
  createdBy?: string;
};

export interface EarningsExpectationActionResult {
  ok: boolean;
  data: EarningsExpectationStoreEnvelope;
  error: string | null;
  snapshot?: EarningsExpectationSnapshot;
}

export class EarningsExpectationStore {
  constructor(
    private readonly repository: EarningsExpectationRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly idFactory: () => string = defaultId,
  ) {}

  appendSnapshot(data: EarningsExpectationStoreEnvelope, input: CreateEarningsExpectationSnapshotInput): EarningsExpectationActionResult {
    return this.append(data, {
      ...clone(input),
      id: input.id ?? this.idFactory(),
      createdAt: input.createdAt ?? this.now().toISOString(),
      createdBy: input.createdBy ?? "local-user",
      correctsSnapshotId: null,
      schemaVersion: 1,
    });
  }

  appendCorrection(
    data: EarningsExpectationStoreEnvelope,
    correctsSnapshotId: string,
    input: CreateEarningsExpectationSnapshotInput,
  ): EarningsExpectationActionResult {
    const original = data.snapshots.find((snapshot) => snapshot.id === correctsSnapshotId);
    if (!original) return failure(data, "待纠正的原快照不存在。");
    if (data.snapshots.some((snapshot) => snapshot.correctsSnapshotId === correctsSnapshotId)) return failure(data, "该快照已有纠正版本，请基于最新有效快照继续追加纠正。");
    const candidate: EarningsExpectationSnapshot = {
      ...clone(input),
      id: input.id ?? this.idFactory(),
      createdAt: input.createdAt ?? this.now().toISOString(),
      createdBy: input.createdBy ?? "local-user",
      correctsSnapshotId,
      schemaVersion: 1,
    };
    if (candidate.stockId !== original.stockId || candidate.reportPeriod !== original.reportPeriod || candidate.periodScope !== original.periodScope || candidate.metric !== original.metric || candidate.sourceCategory !== original.sourceCategory) {
      return failure(data, "纠正快照必须保持公司、报告期、期间口径、指标和来源类别一致。");
    }
    return this.append(data, candidate);
  }

  /** Historical snapshots are append-only; no update or delete API is intentionally exposed. */
  private append(data: EarningsExpectationStoreEnvelope, snapshot: EarningsExpectationSnapshot): EarningsExpectationActionResult {
    const errors = validateEarningsExpectationSnapshot(snapshot);
    if (errors.length) return failure(data, errors.join("；"));
    if (data.snapshots.some((item) => item.id === snapshot.id)) return failure(data, "快照 ID 已存在，未写入任何数据。");
    if (data.snapshots.some((item) => earningsExpectationFingerprint(item) === earningsExpectationFingerprint(snapshot))) return failure(data, "相同快照已存在，未重复写入。");
    const next: EarningsExpectationStoreEnvelope = {
      ...clone(data),
      updatedAt: snapshot.createdAt,
      snapshots: [...data.snapshots, snapshot],
    };
    const saved = this.repository.save(next);
    return saved.ok ? { ok: true, data: next, error: null, snapshot } : { ok: false, data, error: saved.error, snapshot };
  }
}

function failure(data: EarningsExpectationStoreEnvelope, error: string): EarningsExpectationActionResult { return { ok: false, data, error }; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function defaultId() { const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return `expectation-${random}`; }
