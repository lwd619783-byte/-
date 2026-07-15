import type { EarningsExpectationSnapshot, EarningsExpectationStoreEnvelope } from "../types";
import { EarningsExpectationRepository, earningsExpectationFingerprint, validateEarningsExpectationSnapshot } from "./earningsExpectationRepository";
import {
  correctionBasisChanged,
  sameCorrectionIdentity,
  validateEarningsExpectationCorrectionGraph,
} from "./earningsExpectationIntegrity";
import {
  isUnzonedLocalDateTime,
  isValidTimeZone,
  resolveImportedFormedAt,
  resolveImportedSourcePublishedAt,
} from "../utils/dateTime";

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
    const sourceTime = normalizeSourceTimeForWrite(input, data.settings.timeZone, false);
    if (!sourceTime.ok) return failure(data, sourceTime.error);
    const formationTime = normalizeFormationTimeForWrite(input, data.settings.timeZone, false);
    if (!formationTime.ok) return failure(data, formationTime.error);
    return this.append(data, {
      ...clone(input),
      ...sourceTime.fields,
      ...formationTime.fields,
      id: input.id ?? this.idFactory(),
      createdAt: input.createdAt ?? this.now().toISOString(),
      createdBy: input.createdBy ?? "local-user",
      correctsSnapshotId: null,
      correctionScope: null,
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
    const preserveUnresolvedLegacy = original.sourcePublishedAtResolution === "unresolved_legacy"
      && original.sourcePublishedAt === input.sourcePublishedAt;
    const sourceTime = normalizeSourceTimeForWrite(input, data.settings.timeZone, preserveUnresolvedLegacy);
    if (!sourceTime.ok) return failure(data, sourceTime.error);
    const preserveUnresolvedFormation = original.formedAtResolution === "unresolved_legacy"
      && original.formedAt === input.formedAt;
    const formationTime = normalizeFormationTimeForWrite(input, data.settings.timeZone, preserveUnresolvedFormation);
    if (!formationTime.ok) return failure(data, formationTime.error);
    const candidate: EarningsExpectationSnapshot = {
      ...clone(input),
      ...sourceTime.fields,
      ...formationTime.fields,
      id: input.id ?? this.idFactory(),
      createdAt: this.now().toISOString(),
      createdBy: input.createdBy ?? "local-user",
      correctsSnapshotId,
      correctionScope: correctionBasisChanged(input as EarningsExpectationSnapshot, original) ? "basis" : "value",
      schemaVersion: 1,
    };
    if (!sameCorrectionIdentity(candidate, original)) {
      return failure(data, "纠正快照必须保持公司、报告期、期间口径、指标、来源类别和来源名称一致。");
    }
    return this.append(data, candidate);
  }

  /** Historical snapshots are append-only; no update or delete API is intentionally exposed. */
  private append(data: EarningsExpectationStoreEnvelope, snapshot: EarningsExpectationSnapshot): EarningsExpectationActionResult {
    const errors = validateEarningsExpectationSnapshot(snapshot, { now: this.now(), timeZone: data.settings.timeZone });
    if (errors.length) return failure(data, errors.join("；"));
    if (data.snapshots.some((item) => item.id === snapshot.id)) return failure(data, "快照 ID 已存在，未写入任何数据。");
    if (data.snapshots.some((item) => earningsExpectationFingerprint(item) === earningsExpectationFingerprint(snapshot))) return failure(data, "相同快照已存在，未重复写入。");
    const graph = validateEarningsExpectationCorrectionGraph([...data.snapshots, snapshot]);
    if (!graph.ok) return failure(data, `纠正关系图无效，未写入任何数据：${graph.issues.map((issue) => issue.message).join("；")}`);
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
function normalizeSourceTimeForWrite(
  input: CreateEarningsExpectationSnapshotInput,
  timeZone: string,
  preserveUnresolvedLegacy: boolean,
): { ok: true; fields: Pick<EarningsExpectationSnapshot, "sourcePublishedAt" | "sourcePublishedAtPrecision" | "sourcePublishedAtResolution" | "sourcePublishedAtTimeZone"> } | { ok: false; error: string } {
  if (preserveUnresolvedLegacy && input.sourcePublishedAt && isUnzonedLocalDateTime(input.sourcePublishedAt)) {
    return { ok: true, fields: { sourcePublishedAt: input.sourcePublishedAt, sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "unresolved_legacy", sourcePublishedAtTimeZone: null } };
  }
  const resolved = resolveImportedSourcePublishedAt({
    rawValue: input.sourcePublishedAt,
    declaredResolution: input.sourcePublishedAtResolution,
    declaredTimeZone: input.sourcePublishedAtTimeZone,
    fallbackTimeZone: timeZone,
  });
  if (["nonexistent", "ambiguous", "invalid"].includes(resolved.status)) return { ok: false, error: "message" in resolved ? resolved.message : "来源时间无效。" };
  if (resolved.status === "empty") return { ok: true, fields: { sourcePublishedAt: null, sourcePublishedAtPrecision: null, sourcePublishedAtResolution: null, sourcePublishedAtTimeZone: null } };
  const preserveWorkflowProvenance = resolved.status === "absolute"
    && input.sourcePublishedAtResolution === "workflow_time_zone"
    && isValidTimeZone(input.sourcePublishedAtTimeZone);
  return {
    ok: true,
    fields: {
      sourcePublishedAt: resolved.value,
      sourcePublishedAtPrecision: resolved.precision,
      sourcePublishedAtResolution: preserveWorkflowProvenance ? "workflow_time_zone" : resolved.resolution,
      sourcePublishedAtTimeZone: preserveWorkflowProvenance ? input.sourcePublishedAtTimeZone : resolved.interpretedTimeZone,
    },
  };
}

function normalizeFormationTimeForWrite(
  input: CreateEarningsExpectationSnapshotInput,
  timeZone: string,
  preserveUnresolvedLegacy: boolean,
): { ok: true; fields: Pick<EarningsExpectationSnapshot, "formedAt" | "formedAtPrecision" | "formedAtResolution" | "formedAtTimeZone"> } | { ok: false; error: string } {
  if (preserveUnresolvedLegacy && input.formedAt && isUnzonedLocalDateTime(input.formedAt)) {
    return { ok: true, fields: { formedAt: input.formedAt, formedAtPrecision: "datetime", formedAtResolution: "unresolved_legacy", formedAtTimeZone: null } };
  }
  const resolved = resolveImportedFormedAt({
    rawValue: input.formedAt,
    declaredResolution: input.formedAtResolution,
    declaredTimeZone: input.formedAtTimeZone,
    fallbackTimeZone: timeZone,
    asOfDate: input.asOfDate,
  });
  if (["nonexistent", "ambiguous", "invalid"].includes(resolved.status)) return { ok: false, error: "message" in resolved ? resolved.message : "预期形成时间无效。" };
  if (resolved.status === "empty") return { ok: true, fields: { formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null } };
  const preserveWorkflowProvenance = resolved.status === "absolute"
    && input.formedAtResolution === "workflow_time_zone"
    && isValidTimeZone(input.formedAtTimeZone);
  return { ok: true, fields: { formedAt: resolved.value, formedAtPrecision: "datetime", formedAtResolution: preserveWorkflowProvenance ? "workflow_time_zone" : resolved.resolution, formedAtTimeZone: preserveWorkflowProvenance ? input.formedAtTimeZone : resolved.interpretedTimeZone } };
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function defaultId() { const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return `expectation-${random}`; }
