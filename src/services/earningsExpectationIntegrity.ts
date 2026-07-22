import type {
  EarningsExpectationBusinessOrderStatus,
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationAvailabilityResolution,
  EarningsExpectationSnapshot,
  CanonicalBusinessTemporal,
  PreviousBusinessNodeStatus,
} from "../types";
import {
  compareAvailabilityResolution,
  deriveAvailabilityBounds,
  isPreciseInstant,
  isCalendarDate,
  isUnzonedLocalDateTime,
  laterCanonicalBusinessTemporal,
  toCanonicalBusinessTemporal,
  type BusinessTemporalValue,
} from "../utils/dateTime";

export interface EarningsExpectationCorrectionGraphIssue {
  code: "duplicate_id" | "missing_target" | "self_reference" | "cycle" | "branch" | "identity_mismatch" | "scope_mismatch" | "future_created_at" | "correction_time_before_target" | "audit_time_invalid";
  snapshotIds: string[];
  message: string;
}

export interface EarningsExpectationCorrectionGraphResult {
  ok: boolean;
  issues: EarningsExpectationCorrectionGraphIssue[];
}

export interface EarningsExpectationSelection {
  snapshot: EarningsExpectationSnapshot;
  businessRootSnapshot: EarningsExpectationSnapshot;
  correctionChain: EarningsExpectationSnapshot[];
  businessOrderUncertain: boolean;
  businessOrderStatus: EarningsExpectationBusinessOrderStatus;
  originalBusinessTime: BusinessTemporalValue | null;
  effectiveBusinessTime: BusinessTemporalValue | null;
  originalSourcePublishedAt: BusinessTemporalValue | null;
  effectiveSourcePublishedAt: BusinessTemporalValue | null;
  correctionRecordedAt: string | null;
  correctedTemporalFields: string[];
  temporalCorrectionApplied: boolean;
  actualSourceInterpretationTimeZone: string | null;
  formationTime: CanonicalBusinessTemporal;
  sourceTime: CanonicalBusinessTemporal | null;
  availableAt: EarningsExpectationAvailabilityResolution;
  previousResolution: PreviousBusinessNodeResolution;
  auditTimeStatus: "valid" | "invalid";
}

export interface EffectiveEarningsExpectationBusinessNode {
  businessRootSnapshot: EarningsExpectationSnapshot;
  effectiveSnapshot: EarningsExpectationSnapshot;
  correctionChain: EarningsExpectationSnapshot[];
  originalBusinessTime: BusinessTemporalValue | null;
  effectiveBusinessTime: BusinessTemporalValue | null;
  originalSourcePublishedAt: BusinessTemporalValue | null;
  effectiveSourcePublishedAt: BusinessTemporalValue | null;
  correctionRecordedAt: string | null;
  correctedTemporalFields: string[];
  temporalCorrectionApplied: boolean;
  actualSourceInterpretationTimeZone: string | null;
  originalFormationTime: CanonicalBusinessTemporal;
  effectiveFormationTime: CanonicalBusinessTemporal;
  originalSourceTime: CanonicalBusinessTemporal | null;
  effectiveSourceTime: CanonicalBusinessTemporal | null;
  availableAt: EarningsExpectationAvailabilityResolution;
  auditTimeStatus: "valid" | "invalid";
}

export interface PreviousBusinessNodeResolution {
  status: PreviousBusinessNodeStatus;
  previousNode: EffectiveEarningsExpectationBusinessNode | null;
  candidateNodes: EffectiveEarningsExpectationBusinessNode[];
  reasonCode: "business_order_ambiguous" | "business_order_equal" | "business_order_unresolved" | null;
}

const TEMPORAL_CORRECTION_FIELDS: Array<keyof EarningsExpectationSnapshot> = [
  "asOfDate", "formedAt", "formedAtPrecision", "formedAtResolution", "formedAtTimeZone", "formedAtCalendarDate",
  "sourcePublishedAt", "sourcePublishedAtPrecision", "sourcePublishedAtResolution", "sourcePublishedAtTimeZone", "sourcePublishedAtCalendarDate",
];

export function normalizeSourceIdentity(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

export function getSourceIdentityKey(snapshot: Pick<EarningsExpectationSnapshot, "sourceCategory" | "sourceName">) {
  return `${snapshot.sourceCategory}|${normalizeSourceIdentity(snapshot.sourceName)}`;
}

export function getExpectationGroupKey(snapshot: EarningsExpectationSnapshot) {
  return [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, getSourceIdentityKey(snapshot)].join("|");
}

export function getExpectationFormationTemporal(snapshot: EarningsExpectationSnapshot): CanonicalBusinessTemporal {
  return toCanonicalBusinessTemporal({
    value: snapshot.formedAtPrecision === "datetime" ? snapshot.formedAt : snapshot.asOfDate,
    precision: snapshot.formedAtPrecision ?? "date",
    resolution: snapshot.formedAtResolution ?? (snapshot.formedAt ? "absolute" : "date"),
    interpretationTimeZone: snapshot.formedAtTimeZone ?? null,
    // asOfDate is the persisted business-date contract. V2 validation requires
    // formedAtCalendarDate to match it, so calculations do not depend on the
    // currently selected workflow/display time zone.
    businessCalendarDate: snapshot.asOfDate,
    fallbackBusinessCalendarDate: snapshot.asOfDate,
  });
}

export function getExpectationSourcePublishedTemporal(snapshot: EarningsExpectationSnapshot): CanonicalBusinessTemporal | null {
  if (!snapshot.sourcePublishedAt) return null;
  return toCanonicalBusinessTemporal({
    value: snapshot.sourcePublishedAt,
    precision: snapshot.sourcePublishedAtPrecision ?? (isCalendarDate(snapshot.sourcePublishedAt) ? "date" : "datetime"),
    resolution: snapshot.sourcePublishedAtResolution ?? (isCalendarDate(snapshot.sourcePublishedAt) ? "date" : isPreciseInstant(snapshot.sourcePublishedAt) ? "absolute" : "unresolved_legacy"),
    interpretationTimeZone: snapshot.sourcePublishedAtTimeZone ?? null,
    businessCalendarDate: snapshot.sourcePublishedAtCalendarDate
      ?? (isCalendarDate(snapshot.sourcePublishedAt)
        ? snapshot.sourcePublishedAt
        : snapshot.sourcePublishedAtResolution == null && isPreciseInstant(snapshot.sourcePublishedAt)
          ? String(snapshot.sourcePublishedAt).slice(0, 10)
          : null),
  });
}

export function getExpectationAvailability(snapshot: EarningsExpectationSnapshot): EarningsExpectationAvailabilityResolution {
  const formation = getExpectationFormationTemporal(snapshot);
  if (snapshot.sourceCategory === "user_estimate") {
    return formation.status === "resolved" || formation.status === "date_only"
      ? { status: "resolved", value: formation, decisiveSide: "formation", bounds: formation.bounds }
      : { status: "uncertain", value: null, candidates: [formation], reason: formation.uncertaintyReason ?? "missing_time", bounds: deriveAvailabilityBounds([formation]) };
  }
  const source = getExpectationSourcePublishedTemporal(snapshot);
  if (!source) return { status: "uncertain", value: null, candidates: [formation], reason: "missing_time", bounds: deriveAvailabilityBounds([formation, missingCanonicalTemporal()]) };
  if (snapshot.ingestionMethod === "provider" && snapshot.formationTimeBasis === "public_disclosure_proxy") {
    return source.status === "resolved" || source.status === "date_only"
      ? { status: "resolved", value: source, decisiveSide: "source", bounds: source.bounds }
      : { status: "uncertain", value: null, candidates: [source], reason: source.uncertaintyReason ?? "missing_time", bounds: deriveAvailabilityBounds([source]) };
  }
  return laterCanonicalBusinessTemporal(formation, source);
}

/** @deprecated Use getResolvedExpectationAvailableTime or getExpectationAvailability. */
export function getExpectationBusinessTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue | null {
  void timeZone;
  return getResolvedExpectationAvailableTime(snapshot);
}

export function getResolvedExpectationAvailableTime(snapshot: EarningsExpectationSnapshot): BusinessTemporalValue | null {
  const availableAt = getExpectationAvailability(snapshot);
  return availableAt.status === "resolved" ? canonicalToBusinessTemporal(availableAt.value) : null;
}

export function getExpectationFormationTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue {
  void timeZone;
  return canonicalToBusinessTemporal(getExpectationFormationTemporal(snapshot))
    ?? { value: snapshot.asOfDate, precision: "date", calendarDate: snapshot.asOfDate };
}

export function getExpectationSourcePublishedTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue | null {
  void timeZone;
  const source = getExpectationSourcePublishedTemporal(snapshot);
  if (!source || source.status === "invalid" || source.status === "unresolved_legacy" || !source.value || !source.businessCalendarDate) return null;
  return canonicalToBusinessTemporal(source);
}

export function getExpectationEventBusinessTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue | null {
  return getExpectationBusinessTime(snapshot, timeZone);
}

export function isExpectationSourcePublishedAtReliable(snapshot: EarningsExpectationSnapshot) {
  if (!snapshot.sourcePublishedAt || snapshot.sourcePublishedAtResolution === "unresolved_legacy") return false;
  if (snapshot.sourcePublishedAtPrecision === "datetime") return isPreciseInstant(snapshot.sourcePublishedAt);
  return isCalendarDate(snapshot.sourcePublishedAt);
}

export function isExpectationSourcePublishedAtUnresolved(snapshot: EarningsExpectationSnapshot) {
  return snapshot.sourcePublishedAtResolution === "unresolved_legacy"
    || Boolean(snapshot.sourcePublishedAt && isUnzonedLocalDateTime(snapshot.sourcePublishedAt) && !isPreciseInstant(snapshot.sourcePublishedAt));
}

export function isExpectationBusinessTimeUnresolved(snapshot: EarningsExpectationSnapshot) {
  return getExpectationAvailability(snapshot).status === "uncertain";
}

export function compareExpectationBusinessTime(
  left: EarningsExpectationSnapshot,
  right: EarningsExpectationSnapshot,
  timeZone?: string | null,
) {
  void timeZone;
  const comparison = compareExpectationAvailability(left, right);
  if (comparison.order !== 0) return comparison;
  return {
    ...comparison,
    order: left.id === right.id ? 0 as const : left.id < right.id ? -1 as const : 1 as const,
  };
}

export function sortExpectationsByBusinessTime(snapshots: EarningsExpectationSnapshot[], timeZone?: string | null) {
  return [...snapshots].sort((left, right) => compareExpectationBusinessTime(left, right, timeZone).order);
}

export function correctionBasisChanged(current: EarningsExpectationSnapshot, previous: EarningsExpectationSnapshot) {
  return current.estimateShape !== previous.estimateShape || current.currency !== previous.currency || current.unit !== previous.unit || current.accountingBasis !== previous.accountingBasis;
}

export function deriveExpectationCorrectionDelta(
  current: EarningsExpectationSnapshot,
  target: EarningsExpectationSnapshot | undefined,
): EarningsExpectationCorrectionDelta | null {
  if (!current.correctsSnapshotId || !target || current.correctsSnapshotId !== target.id) return null;
  const fields: Array<keyof EarningsExpectationSnapshot> = [
    "estimateShape", "value", "lowerBound", "upperBound", "currency", "unit", "accountingBasis",
    "sourceTitle", "sourceUrl", "sourcePublishedAt", "sourcePublishedAtPrecision", "sourcePublishedAtResolution", "sourcePublishedAtTimeZone",
    "sourcePublishedAtCalendarDate", "asOfDate", "formedAt", "formedAtPrecision", "formedAtResolution", "formedAtTimeZone", "formedAtCalendarDate",
    "sourceVerificationStatus", "analystCount", "institutionCount", "notes",
  ];
  const changedFields = fields.filter((field) => current[field] !== target[field]);
  const currentMidpoint = snapshotMidpoint(current);
  const targetMidpoint = snapshotMidpoint(target);
  const basisChanged = correctionBasisChanged(current, target) || current.estimateShape !== target.estimateShape;
  const valueDelta = !basisChanged && currentMidpoint !== null && targetMidpoint !== null ? currentMidpoint - targetMidpoint : null;
  const relativeDelta = valueDelta !== null && targetMidpoint !== null && targetMidpoint !== 0 && (currentMidpoint === 0 || Math.sign(currentMidpoint as number) === Math.sign(targetMidpoint))
    ? valueDelta / Math.abs(targetMidpoint)
    : null;
  const reason = basisChanged
    ? "更正改变了预测形态、币种、单位或会计口径，不计算跨口径相对差异。"
    : targetMidpoint === 0
      ? "被更正值为 0，不计算相对差异。"
      : currentMidpoint !== null && targetMidpoint !== null && currentMidpoint !== 0 && Math.sign(currentMidpoint) !== Math.sign(targetMidpoint)
        ? "更正前后数值跨越正负号，不计算相对差异。"
        : null;
  return {
    correctionTargetId: target.id,
    previousValue: targetMidpoint,
    correctedValue: currentMidpoint,
    valueDelta,
    relativeDelta,
    changedFields,
    basisChanged,
    accountingScopeChanged: current.accountingBasis !== target.accountingBasis,
    unitChanged: current.unit !== target.unit,
    currencyChanged: current.currency !== target.currency,
    correctionReason: current.notes,
    calculationNote: reason,
  };
}

export function deriveExpectationBusinessRevisionDelta(
  current: EarningsExpectationSnapshot,
  previous: EarningsExpectationSnapshot | undefined,
  businessOrderStatus: EarningsExpectationBusinessOrderStatus = "confirmed",
  identity?: {
    previousBusinessRootSnapshotId?: string;
    currentBusinessRootSnapshotId?: string;
  },
): EarningsExpectationBusinessRevisionDelta | null {
  if (!previous || businessOrderStatus !== "confirmed" || (current.correctsSnapshotId && !identity)) return null;
  if (current.ingestionMethod === "provider") {
    if (current.providerCorrectsVersionId) return null;
    if (current.sourceAnnouncementType !== "earnings_preview_revision" || current.providerBusinessRevisionPredecessorSnapshotId !== previous.id) return null;
  }
  if (current.estimateShape !== previous.estimateShape || correctionBasisChanged(current, previous)) return null;
  const currentMidpoint = snapshotMidpoint(current);
  const previousMidpoint = snapshotMidpoint(previous);
  if (currentMidpoint === null || previousMidpoint === null || previousMidpoint === 0 || (currentMidpoint !== 0 && Math.sign(currentMidpoint) !== Math.sign(previousMidpoint))) return null;
  const absoluteDelta = currentMidpoint - previousMidpoint;
  const relativeDelta = absoluteDelta / Math.abs(previousMidpoint);
  return {
    previousBusinessSnapshotId: previous.id,
    previousBusinessRootSnapshotId: identity?.previousBusinessRootSnapshotId ?? previous.id,
    previousEffectiveSnapshotId: previous.id,
    currentSnapshotId: current.id,
    baselineValue: previousMidpoint,
    resolvedThroughCorrectionChain: (identity?.previousBusinessRootSnapshotId ?? previous.id) !== previous.id,
    absoluteDelta,
    relativeDelta,
    direction: relativeDelta > 0 ? "up" : relativeDelta < 0 ? "down" : "unchanged",
  };
}

export function sameCorrectionIdentity(current: EarningsExpectationSnapshot, previous: EarningsExpectationSnapshot) {
  return current.stockId === previous.stockId
    && current.reportPeriod === previous.reportPeriod
    && current.periodScope === previous.periodScope
    && current.metric === previous.metric
    && current.sourceCategory === previous.sourceCategory
    && getSourceIdentityKey(current) === getSourceIdentityKey(previous);
}

export function validateEarningsExpectationCorrectionGraph(
  snapshots: EarningsExpectationSnapshot[],
  options: { now?: Date } = {},
): EarningsExpectationCorrectionGraphResult {
  const issues: EarningsExpectationCorrectionGraphIssue[] = [];
  const byId = new Map<string, EarningsExpectationSnapshot>();
  const duplicateIds = new Set<string>();
  for (const snapshot of snapshots) {
    if (byId.has(snapshot.id)) duplicateIds.add(snapshot.id);
    else byId.set(snapshot.id, snapshot);
  }
  for (const id of [...duplicateIds].sort()) issues.push(issue("duplicate_id", [id], `纠正关系图存在重复快照 ID：${id}`));

  const correctorsByTarget = new Map<string, EarningsExpectationSnapshot[]>();
  for (const snapshot of byId.values()) {
    if (!isPreciseInstant(snapshot.createdAt)) issues.push(issue("audit_time_invalid", [snapshot.id], `快照 ${snapshot.id} 的 createdAt 不是带时区的有效精确时刻。`));
    else if (options.now && Date.parse(snapshot.createdAt) > options.now.getTime()) issues.push(issue("future_created_at", [snapshot.id], `快照 ${snapshot.id} 的 createdAt 晚于当前允许时刻 ${options.now.toISOString()}。`));
    if (!snapshot.correctsSnapshotId) continue;
    if (snapshot.correctsSnapshotId === snapshot.id) issues.push(issue("self_reference", [snapshot.id], `快照 ${snapshot.id} 不能纠正自身。`));
    const original = byId.get(snapshot.correctsSnapshotId);
    if (!original) {
      issues.push(issue("missing_target", [snapshot.id, snapshot.correctsSnapshotId], `快照 ${snapshot.id} 的纠正目标 ${snapshot.correctsSnapshotId} 不存在。`));
      continue;
    }
    const correctors = correctorsByTarget.get(original.id) ?? [];
    correctorsByTarget.set(original.id, [...correctors, snapshot]);
    if (isPreciseInstant(snapshot.createdAt) && isPreciseInstant(original.createdAt) && Date.parse(snapshot.createdAt) < Date.parse(original.createdAt)) {
      issues.push(issue("correction_time_before_target", [original.id, snapshot.id], `纠正快照 ${snapshot.id} 的 createdAt ${snapshot.createdAt} 早于目标 ${original.id} 的 createdAt ${original.createdAt}。`));
    }
    if (!sameCorrectionIdentity(snapshot, original)) issues.push(issue("identity_mismatch", [original.id, snapshot.id], `纠正快照 ${snapshot.id} 改变了公司、报告期、指标或来源身份。`));
    const expectedScope = correctionBasisChanged(snapshot, original) ? "basis" : "value";
    if (snapshot.correctionScope !== null && snapshot.correctionScope !== undefined && snapshot.correctionScope !== expectedScope) issues.push(issue("scope_mismatch", [original.id, snapshot.id], `纠正快照 ${snapshot.id} 的 correctionScope 与实际口径变化不一致。`));
  }

  for (const [targetId, correctors] of [...correctorsByTarget.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (correctors.length > 1) {
      const ids = [targetId, ...correctors.map((snapshot) => snapshot.id).sort()];
      issues.push(issue("branch", ids, `快照 ${targetId} 存在多个直接纠正者：${ids.slice(1).join("、")}。`));
    }
  }

  const cycleKeys = new Set<string>();
  for (const start of [...byId.keys()].sort()) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | null = start;
    while (current && byId.has(current)) {
      const repeatedAt = position.get(current);
      if (repeatedAt !== undefined) {
        const cycle = path.slice(repeatedAt);
        const key = [...cycle].sort().join("|");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          issues.push(issue("cycle", [...cycle].sort(), `纠正关系图存在循环：${[...cycle, cycle[0]].join(" → ")}。`));
        }
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = byId.get(current)?.correctsSnapshotId ?? null;
    }
  }

  const unique = new Map(issues.map((item) => [`${item.code}|${item.snapshotIds.join("|")}`, item]));
  const ordered = [...unique.values()].sort((left, right) => left.code.localeCompare(right.code) || left.snapshotIds.join("|").localeCompare(right.snapshotIds.join("|")));
  return { ok: ordered.length === 0, issues: ordered };
}

export function resolveEarningsExpectationCorrectionChain(snapshots: EarningsExpectationSnapshot[], snapshotId: string) {
  const validation = validateEarningsExpectationCorrectionGraph(snapshots);
  if (!validation.ok) return { chain: [] as EarningsExpectationSnapshot[], terminal: null, issues: validation.issues };
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const start = byId.get(snapshotId);
  if (!start) return { chain: [] as EarningsExpectationSnapshot[], terminal: null, issues: [issue("missing_target", [snapshotId], `快照 ${snapshotId} 不存在。`)] };
  let root = start;
  while (root.correctsSnapshotId) root = byId.get(root.correctsSnapshotId) as EarningsExpectationSnapshot;
  const correctorByTarget = new Map<string, EarningsExpectationSnapshot>();
  for (const snapshot of snapshots) if (snapshot.correctsSnapshotId) correctorByTarget.set(snapshot.correctsSnapshotId, snapshot);
  const chain = [root];
  while (correctorByTarget.has(chain[chain.length - 1].id)) chain.push(correctorByTarget.get(chain[chain.length - 1].id) as EarningsExpectationSnapshot);
  return { chain, terminal: chain[chain.length - 1], issues: [] as EarningsExpectationCorrectionGraphIssue[] };
}

export function getEffectiveCorrectionTerminal(snapshots: EarningsExpectationSnapshot[], snapshotId: string) {
  return resolveEarningsExpectationCorrectionChain(snapshots, snapshotId).terminal;
}

export function getEffectiveCorrectionTerminals(snapshots: EarningsExpectationSnapshot[]) {
  const validation = validateEarningsExpectationCorrectionGraph(snapshots);
  if (!validation.ok) return [];
  const corrected = new Set(snapshots.map((snapshot) => snapshot.correctsSnapshotId).filter((value): value is string => Boolean(value)));
  return snapshots.filter((snapshot) => !corrected.has(snapshot.id)).sort((left, right) => left.id.localeCompare(right.id));
}

export function resolveEffectiveBusinessHistory(
  snapshots: EarningsExpectationSnapshot[],
  timeZone?: string | null,
): EffectiveEarningsExpectationBusinessNode[] {
  void timeZone;
  const validation = validateEarningsExpectationCorrectionGraph(snapshots);
  if (!validation.ok) return [];
  const roots = snapshots.filter((snapshot) => !snapshot.correctsSnapshotId);
  const nodes = roots.map((businessRootSnapshot) => {
    const resolved = resolveEarningsExpectationCorrectionChain(snapshots, businessRootSnapshot.id);
    const correctionChain = resolved.chain.length ? resolved.chain : [businessRootSnapshot];
    const effectiveSnapshot = resolved.terminal ?? businessRootSnapshot;
    const correctedTemporalFields = temporalCorrectionFields(correctionChain);
    const originalFormationTime = getExpectationFormationTemporal(businessRootSnapshot);
    const effectiveFormationTime = getExpectationFormationTemporal(effectiveSnapshot);
    const originalSourceTime = getExpectationSourcePublishedTemporal(businessRootSnapshot);
    const effectiveSourceTime = getExpectationSourcePublishedTemporal(effectiveSnapshot);
    const availableAt = getExpectationAvailability(effectiveSnapshot);
    return {
      businessRootSnapshot,
      effectiveSnapshot,
      correctionChain,
      originalBusinessTime: getExpectationBusinessTime(businessRootSnapshot, timeZone),
      effectiveBusinessTime: getExpectationBusinessTime(effectiveSnapshot, timeZone),
      originalSourcePublishedAt: getExpectationSourcePublishedTime(businessRootSnapshot, timeZone),
      effectiveSourcePublishedAt: getExpectationSourcePublishedTime(effectiveSnapshot, timeZone),
      correctionRecordedAt: correctionChain.length > 1 ? correctionChain[correctionChain.length - 1].createdAt : null,
      correctedTemporalFields,
      temporalCorrectionApplied: correctedTemporalFields.length > 0,
      actualSourceInterpretationTimeZone: effectiveSnapshot.sourcePublishedAtResolution === "workflow_time_zone"
        ? effectiveSnapshot.sourcePublishedAtTimeZone ?? null
        : effectiveSourceTime?.interpretationTimeZone ?? null,
      originalFormationTime,
      effectiveFormationTime,
      originalSourceTime,
      effectiveSourceTime,
      availableAt,
      auditTimeStatus: correctionChain.every((item, index) => isPreciseInstant(item.createdAt) && (index === 0 || Date.parse(item.createdAt) >= Date.parse(correctionChain[index - 1].createdAt))) ? "valid" : "invalid",
    } satisfies EffectiveEarningsExpectationBusinessNode;
  });
  return nodes.sort((left, right) => {
    const comparison = compareNodeBusinessTime(left, right);
    if (comparison.order !== 0) return comparison.order;
    return left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id);
  });
}

export function resolveUniquePreviousBusinessNode(
  current: EffectiveEarningsExpectationBusinessNode,
  allNodes: EffectiveEarningsExpectationBusinessNode[],
): PreviousBusinessNodeResolution {
  const others = allNodes.filter((node) => node.businessRootSnapshot.id !== current.businessRootSnapshot.id);
  const before: EffectiveEarningsExpectationBusinessNode[] = [];
  const uncertain: EffectiveEarningsExpectationBusinessNode[] = [];
  const equal: EffectiveEarningsExpectationBusinessNode[] = [];
  for (const candidate of others) {
    const relation = compareNodeBusinessTime(candidate, current);
    if (relation.status === "before") before.push(candidate);
    else if (relation.status === "equal") equal.push(candidate);
    else if (relation.status === "uncertain") uncertain.push(candidate);
  }
  if (equal.length) return { status: "equal_time", previousNode: null, candidateNodes: equal.sort(nodeIdOrder), reasonCode: "business_order_equal" };
  if (uncertain.length) {
    const unresolved = uncertain.some((node) => node.availableAt.status === "uncertain" && node.availableAt.reason === "legacy_time_zone_unknown")
      || (current.availableAt.status === "uncertain" && ["legacy_time_zone_unknown", "missing_time"].includes(current.availableAt.reason));
    return { status: unresolved ? "unresolved" : "ambiguous", previousNode: null, candidateNodes: uncertain.sort(nodeIdOrder), reasonCode: unresolved ? "business_order_unresolved" : "business_order_ambiguous" };
  }
  if (!before.length) return { status: "none", previousNode: null, candidateNodes: [], reasonCode: null };
  const maximal = before.filter((candidate) => !before.some((other) => other.businessRootSnapshot.id !== candidate.businessRootSnapshot.id && compareNodeBusinessTime(candidate, other).status === "before"));
  if (maximal.length === 1) return { status: "unique", previousNode: maximal[0], candidateNodes: maximal, reasonCode: null };
  const hasEqual = maximal.some((left, index) => maximal.slice(index + 1).some((right) => compareNodeBusinessTime(left, right).status === "equal"));
  return { status: hasEqual ? "equal_time" : "ambiguous", previousNode: null, candidateNodes: maximal.sort(nodeIdOrder), reasonCode: hasEqual ? "business_order_equal" : "business_order_ambiguous" };
}

export function selectEffectiveEarningsExpectations(snapshots: EarningsExpectationSnapshot[], timeZone?: string | null): EarningsExpectationSelection[] {
  const history = resolveEffectiveBusinessHistory(snapshots, timeZone);
  const groups = new Map<string, EffectiveEarningsExpectationBusinessNode[]>();
  for (const node of history) {
    const key = getExpectationGroupKey(node.businessRootSnapshot);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, group]) => {
    const maximal = group.filter((candidate) => !group.some((other) => other.businessRootSnapshot.id !== candidate.businessRootSnapshot.id && compareNodeBusinessTime(candidate, other).status === "before"));
    const selected = [...maximal].sort(nodeIdOrder)[maximal.length - 1];
    const selectedPeers = maximal.filter((node) => node.businessRootSnapshot.id !== selected.businessRootSnapshot.id);
    const businessOrderStatus: EarningsExpectationBusinessOrderStatus = selectedPeers.some((node) => compareNodeBusinessTime(node, selected).status === "equal")
      ? "equal"
      : selectedPeers.length
        ? "uncertain"
        : "confirmed";
    const previousResolution = resolveUniquePreviousBusinessNode(selected, group);
    return {
      snapshot: selected.effectiveSnapshot,
      businessRootSnapshot: selected.businessRootSnapshot,
      correctionChain: selected.correctionChain,
      businessOrderUncertain: businessOrderStatus === "uncertain",
      businessOrderStatus,
      originalBusinessTime: selected.originalBusinessTime,
      effectiveBusinessTime: selected.effectiveBusinessTime,
      originalSourcePublishedAt: selected.originalSourcePublishedAt,
      effectiveSourcePublishedAt: selected.effectiveSourcePublishedAt,
      correctionRecordedAt: selected.correctionRecordedAt,
      correctedTemporalFields: selected.correctedTemporalFields,
      temporalCorrectionApplied: selected.temporalCorrectionApplied,
      actualSourceInterpretationTimeZone: selected.actualSourceInterpretationTimeZone,
      formationTime: selected.effectiveFormationTime,
      sourceTime: selected.effectiveSourceTime,
      availableAt: selected.availableAt,
      previousResolution,
      auditTimeStatus: selected.auditTimeStatus,
    };
  });
}

export function isExpectationBusinessOrderUncertain(snapshots: EarningsExpectationSnapshot[], timeZone?: string | null) {
  if (snapshots.length < 2) return false;
  const ordered = sortExpectationsByBusinessTime(snapshots, timeZone);
  const selected = ordered[ordered.length - 1];
  return ordered.some((candidate) => candidate.id !== selected.id && isSameCalendarOrderUncertain(candidate, selected, timeZone));
}

export function getExpectationBusinessOrderStatus(
  left: EarningsExpectationSnapshot,
  right: EarningsExpectationSnapshot,
  timeZone?: string | null,
): EarningsExpectationBusinessOrderStatus {
  void timeZone;
  const comparison = compareExpectationAvailability(left, right);
  if (comparison.status === "uncertain") return "uncertain";
  if (comparison.status === "equal") return "equal";
  return "confirmed";
}

function isSameCalendarOrderUncertain(left: EarningsExpectationSnapshot, right: EarningsExpectationSnapshot, timeZone?: string | null) {
  void timeZone;
  return compareExpectationAvailability(left, right).uncertain;
}

function issue(code: EarningsExpectationCorrectionGraphIssue["code"], snapshotIds: string[], message: string): EarningsExpectationCorrectionGraphIssue {
  return { code, snapshotIds, message };
}

function snapshotMidpoint(snapshot: EarningsExpectationSnapshot) {
  if (snapshot.estimateShape === "point") return snapshot.value;
  return snapshot.lowerBound === null || snapshot.upperBound === null ? null : (snapshot.lowerBound + snapshot.upperBound) / 2;
}

function temporalCorrectionFields(chain: EarningsExpectationSnapshot[]) {
  const changed = new Set<string>();
  for (let index = 1; index < chain.length; index += 1) {
    const previous = chain[index - 1];
    const current = chain[index];
    for (const field of TEMPORAL_CORRECTION_FIELDS) if (current[field] !== previous[field]) changed.add(String(field));
  }
  return [...changed].sort();
}

export function getExpectationCalendarDate(snapshot: EarningsExpectationSnapshot, timeZone?: string | null) {
  void timeZone;
  const availability = getExpectationAvailability(snapshot);
  return availability.status === "resolved"
    ? availability.value.businessCalendarDate ?? snapshot.asOfDate
    : availability.bounds.businessDateMax ?? getExpectationFormationTemporal(snapshot).businessCalendarDate ?? snapshot.asOfDate;
}

function canonicalToBusinessTemporal(value: CanonicalBusinessTemporal): BusinessTemporalValue | null {
  if (!value.value || !value.businessCalendarDate || !value.precision) return null;
  return {
    value: value.value,
    precision: value.precision,
    calendarDate: value.businessCalendarDate,
  };
}

export function compareExpectationAvailability(left: EarningsExpectationSnapshot, right: EarningsExpectationSnapshot) {
  const leftAvailability = getExpectationAvailability(left);
  const rightAvailability = getExpectationAvailability(right);
  return compareAvailabilityResolution(leftAvailability, rightAvailability);
}

export function compareNodeBusinessTime(left: EffectiveEarningsExpectationBusinessNode, right: EffectiveEarningsExpectationBusinessNode) {
  return compareAvailabilityResolution(left.availableAt, right.availableAt);
}

function missingCanonicalTemporal(): CanonicalBusinessTemporal {
  return {
    value: null,
    precision: null,
    businessCalendarDate: null,
    instant: null,
    interpretationTimeZone: null,
    resolution: null,
    status: "uncertain",
    uncertaintyReason: "missing_time",
    bounds: { earliest: null, latest: null, businessDateMin: null, businessDateMax: null, bounded: false, uncertaintyReason: "missing_time" },
  };
}

function nodeIdOrder(left: EffectiveEarningsExpectationBusinessNode, right: EffectiveEarningsExpectationBusinessNode) {
  return left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id);
}
