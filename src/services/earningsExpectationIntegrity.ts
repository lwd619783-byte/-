import type {
  EarningsExpectationBusinessOrderStatus,
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationSnapshot,
  EarningsExpectationTimePrecision,
} from "../types";
import {
  compareBusinessTemporal,
  getTemporalCalendarDate,
  isPreciseInstant,
  isCalendarDate,
  isUnzonedLocalDateTime,
  resolveTimeZone,
  toBusinessTemporal,
  type BusinessTemporalValue,
} from "../utils/dateTime";

export interface EarningsExpectationCorrectionGraphIssue {
  code: "duplicate_id" | "missing_target" | "self_reference" | "cycle" | "branch" | "identity_mismatch" | "scope_mismatch";
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
}

export interface EffectiveEarningsExpectationBusinessNode {
  businessRootSnapshot: EarningsExpectationSnapshot;
  effectiveSnapshot: EarningsExpectationSnapshot;
  correctionChain: EarningsExpectationSnapshot[];
  originalBusinessTime: BusinessTemporalValue;
}

export function normalizeSourceIdentity(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

export function getSourceIdentityKey(snapshot: Pick<EarningsExpectationSnapshot, "sourceCategory" | "sourceName">) {
  return `${snapshot.sourceCategory}|${normalizeSourceIdentity(snapshot.sourceName)}`;
}

export function getExpectationGroupKey(snapshot: EarningsExpectationSnapshot) {
  return [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, getSourceIdentityKey(snapshot)].join("|");
}

export function getExpectationBusinessTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue {
  const zone = resolveTimeZone(timeZone);
  if (snapshot.formedAtPrecision === "datetime" && snapshot.formedAt && isPreciseInstant(snapshot.formedAt)) {
    return toBusinessTemporal(snapshot.formedAt, "datetime", zone) as BusinessTemporalValue;
  }
  return {
    value: snapshot.asOfDate,
    precision: "date",
    calendarDate: snapshot.asOfDate,
  };
}

export function getExpectationEventBusinessTime(snapshot: EarningsExpectationSnapshot, timeZone?: string | null): BusinessTemporalValue {
  if (snapshot.sourceCategory !== "user_estimate" && snapshot.sourcePublishedAt && isExpectationSourcePublishedAtReliable(snapshot)) {
    const precision: EarningsExpectationTimePrecision = snapshot.sourcePublishedAtPrecision === "datetime" ? "datetime" : "date";
    const sourceTime = toBusinessTemporal(snapshot.sourcePublishedAt, precision, timeZone);
    if (sourceTime) return sourceTime;
  }
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

export function compareExpectationBusinessTime(
  left: EarningsExpectationSnapshot,
  right: EarningsExpectationSnapshot,
  timeZone?: string | null,
) {
  const comparison = compareBusinessTemporal(getExpectationBusinessTime(left, timeZone), getExpectationBusinessTime(right, timeZone));
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
    "asOfDate", "formedAt", "formedAtPrecision",
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

export function validateEarningsExpectationCorrectionGraph(snapshots: EarningsExpectationSnapshot[]): EarningsExpectationCorrectionGraphResult {
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
    if (!snapshot.correctsSnapshotId) continue;
    if (snapshot.correctsSnapshotId === snapshot.id) issues.push(issue("self_reference", [snapshot.id], `快照 ${snapshot.id} 不能纠正自身。`));
    const original = byId.get(snapshot.correctsSnapshotId);
    if (!original) {
      issues.push(issue("missing_target", [snapshot.id, snapshot.correctsSnapshotId], `快照 ${snapshot.id} 的纠正目标 ${snapshot.correctsSnapshotId} 不存在。`));
      continue;
    }
    const correctors = correctorsByTarget.get(original.id) ?? [];
    correctorsByTarget.set(original.id, [...correctors, snapshot]);
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
  const validation = validateEarningsExpectationCorrectionGraph(snapshots);
  if (!validation.ok) return [];
  const roots = snapshots.filter((snapshot) => !snapshot.correctsSnapshotId);
  const nodes = roots.map((businessRootSnapshot) => {
    const resolved = resolveEarningsExpectationCorrectionChain(snapshots, businessRootSnapshot.id);
    return {
      businessRootSnapshot,
      effectiveSnapshot: resolved.terminal ?? businessRootSnapshot,
      correctionChain: resolved.chain.length ? resolved.chain : [businessRootSnapshot],
      originalBusinessTime: getExpectationBusinessTime(businessRootSnapshot, timeZone),
    } satisfies EffectiveEarningsExpectationBusinessNode;
  });
  return nodes.sort((left, right) => {
    const comparison = compareBusinessTemporal(left.originalBusinessTime, right.originalBusinessTime);
    if (comparison.order !== 0) return comparison.order;
    return left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id);
  });
}

export function selectEffectiveEarningsExpectations(snapshots: EarningsExpectationSnapshot[], timeZone?: string | null): EarningsExpectationSelection[] {
  const history = resolveEffectiveBusinessHistory(snapshots, timeZone);
  const groups = new Map<string, EffectiveEarningsExpectationBusinessNode[]>();
  for (const node of history) {
    const key = getExpectationGroupKey(node.businessRootSnapshot);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, group]) => {
    const ordered = [...group].sort((left, right) => {
      const comparison = compareBusinessTemporal(left.originalBusinessTime, right.originalBusinessTime);
      return comparison.order || left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id);
    });
    const selected = ordered[ordered.length - 1];
    const relations = ordered
      .filter((candidate) => candidate.businessRootSnapshot.id !== selected.businessRootSnapshot.id)
      .map((candidate) => compareBusinessTemporal(candidate.originalBusinessTime, selected.originalBusinessTime));
    const businessOrderStatus: EarningsExpectationBusinessOrderStatus = relations.some((relation) => relation.status === "uncertain")
      ? "uncertain"
      : relations.some((relation) => relation.status === "equal")
        ? "equal"
        : "confirmed";
    return {
      snapshot: selected.effectiveSnapshot,
      businessRootSnapshot: selected.businessRootSnapshot,
      correctionChain: selected.correctionChain,
      businessOrderUncertain: businessOrderStatus === "uncertain",
      businessOrderStatus,
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
  const comparison = compareBusinessTemporal(getExpectationBusinessTime(left, timeZone), getExpectationBusinessTime(right, timeZone));
  if (comparison.status === "uncertain") return "uncertain";
  if (comparison.status === "equal") return "equal";
  return "confirmed";
}

function isSameCalendarOrderUncertain(left: EarningsExpectationSnapshot, right: EarningsExpectationSnapshot, timeZone?: string | null) {
  const leftTime = getExpectationBusinessTime(left, timeZone);
  const rightTime = getExpectationBusinessTime(right, timeZone);
  return leftTime.calendarDate === rightTime.calendarDate && compareBusinessTemporal(leftTime, rightTime).uncertain;
}

function issue(code: EarningsExpectationCorrectionGraphIssue["code"], snapshotIds: string[], message: string): EarningsExpectationCorrectionGraphIssue {
  return { code, snapshotIds, message };
}

function snapshotMidpoint(snapshot: EarningsExpectationSnapshot) {
  if (snapshot.estimateShape === "point") return snapshot.value;
  return snapshot.lowerBound === null || snapshot.upperBound === null ? null : (snapshot.lowerBound + snapshot.upperBound) / 2;
}

export function getExpectationCalendarDate(snapshot: EarningsExpectationSnapshot, timeZone?: string | null) {
  const businessTime = getExpectationBusinessTime(snapshot, timeZone);
  return getTemporalCalendarDate(businessTime.value, businessTime.precision, timeZone) ?? snapshot.asOfDate;
}
