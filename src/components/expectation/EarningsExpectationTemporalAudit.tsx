import type { EarningsExpectationComparison, EarningsExpectationSnapshot } from "../../types";
import {
  getExpectationAvailability,
  getExpectationFormationTemporal,
  getExpectationSourcePublishedTemporal,
  type EarningsExpectationSelection,
} from "../../services/earningsExpectationIntegrity";
import { isPreciseInstant } from "../../utils/dateTime";

interface EarningsExpectationTemporalAuditProps {
  snapshot: EarningsExpectationSnapshot;
  selection?: EarningsExpectationSelection;
  comparison?: EarningsExpectationComparison;
  displayTimeZone: string;
}

export function EarningsExpectationTemporalAudit({ snapshot, selection, comparison, displayTimeZone }: EarningsExpectationTemporalAuditProps) {
  const formation = selection?.formationTime ?? getExpectationFormationTemporal(snapshot);
  const source = selection?.sourceTime ?? getExpectationSourcePublishedTemporal(snapshot);
  const availability = selection?.availableAt ?? comparison?.availableAt ?? getExpectationAvailability(snapshot);
  const previous = selection?.previousResolution;
  const previousStatus = previous?.status ?? comparison?.previousResolutionStatus ?? "none";
  const rootCandidates = previous?.candidateNodes.map((node) => node.businessRootSnapshot.id) ?? comparison?.previousCandidateIds ?? [];
  const effectiveCandidates = previous?.candidateNodes.map((node) => node.effectiveSnapshot.id) ?? comparison?.previousCandidateEffectiveSnapshotIds ?? [];
  const auditStatus = selection?.auditTimeStatus ?? comparison?.auditTimeStatus ?? (isPreciseInstant(snapshot.createdAt) ? "valid" : "invalid");
  const recordTimeZone = availability.status === "resolved"
    ? availability.value.interpretationTimeZone
    : source?.interpretationTimeZone ?? formation.interpretationTimeZone;
  const warningCodes = [...new Set([...(comparison?.structuredWarningCodes ?? []), ...(comparison?.nonComparableReasonCodes ?? [])])];

  return <section aria-label="业绩预期时间与证据审计" className="mt-3 min-w-0 rounded border border-borderSoft bg-surface/50 p-3">
    <p className="text-xs font-semibold text-textStrong">规范化时间与证据状态</p>
    <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <AuditField label="预测形成时间" value={formatTemporal(formation)} />
      <AuditField label="来源发布时间" value={source ? formatTemporal(source) : "缺失"} />
      <AuditField label="投研可用时间" value={formatAvailability(availability)} warning={availability.status === "uncertain"} />
      <AuditField label="业务日期" value={availability.status === "resolved" ? availability.value.businessCalendarDate ?? "不确定" : "不确定"} warning={availability.status === "uncertain"} />
      <AuditField label="记录解释时区" value={recordTimeZone ?? "日期精度 / 未记录"} />
      <AuditField label="当前界面显示时区" value={displayTimeZone} />
      <AuditField label="业务前序" value={previousStatusLabel(previousStatus)} warning={!['unique', 'none'].includes(previousStatus)} />
      <AuditField label="模糊前序候选" value={formatCandidates(rootCandidates, effectiveCandidates)} warning={rootCandidates.length > 0 && previousStatus !== "unique"} />
      <AuditField label="决定性披露事件" value={formatDecisiveDisclosure(comparison)} warning={comparison?.decisiveDisclosureEvent?.category === "possible"} />
      <AuditField label="审计录入时间" value={`${formatAuditInstant(snapshot.createdAt)} · ${auditStatus === "valid" ? "有效" : "异常"}`} warning={auditStatus === "invalid"} />
      <AuditField label="结构化核验代码" value={warningCodes.length ? warningCodes.join("、") : "无"} warning={warningCodes.length > 0} />
    </div>
    {availability.status === "uncertain" ? <p role="status" className="mt-2 text-xs text-warning">可用时间不确定（{availability.reason}），不会据此证明事前有效、最新预测或方向性修订；请补充精确时间或原解释时区。</p> : null}
  </section>;
}

function formatTemporal(value: ReturnType<typeof getExpectationFormationTemporal>) {
  const shown = value.precision === "date" ? value.businessCalendarDate ?? value.value : value.instant ?? value.value;
  return `${shown ?? "缺失"} · ${value.precision ?? "未知精度"} · ${value.status}${value.interpretationTimeZone ? ` · ${value.interpretationTimeZone}` : ""}`;
}

function formatAvailability(value: ReturnType<typeof getExpectationAvailability>) {
  if (value.status === "uncertain") return `不确定 · ${value.reason} · 候选 ${value.candidates.map((item) => item.value ?? item.businessCalendarDate ?? "缺失").join(" / ")}`;
  return `${value.value.instant ?? value.value.value ?? value.value.businessCalendarDate ?? "缺失"} · ${value.value.precision ?? "未知精度"} · ${value.decisiveSide}`;
}

function previousStatusLabel(value: string) {
  return ({ unique: "唯一可证明前序", none: "无前序（首个业务节点）", ambiguous: "前序不唯一", equal_time: "存在精确同刻候选", unresolved: "历史时间未解析" } as Record<string, string>)[value] ?? value;
}

function formatCandidates(rootIds: string[], effectiveIds: string[]) {
  if (!rootIds.length) return "无";
  return rootIds.map((rootId, index) => `${rootId}（终点 ${effectiveIds[index] ?? "缺失"}）`).join("、");
}

function formatDecisiveDisclosure(comparison?: EarningsExpectationComparison) {
  const decisive = comparison?.decisiveDisclosureEvent;
  if (!decisive) return "尚无决定性披露事件";
  const category = decisive.category === "confirmed" ? "已确认披露" : "可能披露（范围待核验）";
  return `${category} · ${decisive.eventId} · ${decisive.occurredAt}`;
}

function formatAuditInstant(value: string) {
  return isPreciseInstant(value) ? value.replace("T", " ") : value;
}

function AuditField({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded border p-2 ${warning ? "border-warning/35 bg-warning/10" : "border-borderSoft bg-bg2/50"}`}><p className="text-xs text-textMuted">{label}</p><p className={`mt-1 break-words text-xs ${warning ? "text-warning" : "text-textStrong"}`}>{value}</p></div>;
}
