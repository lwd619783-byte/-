import type {
  EarningsExpectationComparison,
  EarningsExpectationMetric,
  EarningsExpectationPeriodScope,
  EarningsExpectationSettings,
  EarningsExpectationSnapshot,
  EarningsExpectationBusinessOrderStatus,
  EarningsExpectationDisclosureTimingStatus,
  EarningsExpectationAvailabilityResolution,
  EarningsExpectationWarningCode,
  PerformanceDisclosureEvidence,
  ResearchEvent,
  ResearchEventMetric,
} from "../types";
import {
  deriveExpectationBusinessRevisionDelta,
  getExpectationAvailability,
  getExpectationBusinessTime,
  getExpectationGroupKey,
  isExpectationSourcePublishedAtUnresolved,
  selectEffectiveEarningsExpectations,
  type EarningsExpectationSelection,
} from "./earningsExpectationIntegrity";
import {
  compareCanonicalBusinessTemporal,
  isCalendarDate,
  isPreciseInstant,
  laterCanonicalBusinessTemporal,
  toCanonicalBusinessTemporal,
  resolveSafeWorkflowTimeZone,
} from "../utils/dateTime";

export const DEFAULT_EXPECTATION_COMPARISON_SETTINGS: EarningsExpectationSettings = {
  revisionReminderThreshold: 0.1,
  nearZeroThreshold: 1e-9,
  roundingTolerance: 1e-9,
  timeZone: resolveSafeWorkflowTimeZone(),
};

interface ActualCandidate {
  event: ResearchEvent;
  metric: ResearchEventMetric;
  actualValue: number;
  disclosedAt: string | null;
}

export function buildEarningsExpectationComparisons(
  snapshots: EarningsExpectationSnapshot[],
  events: ResearchEvent[],
  settings: EarningsExpectationSettings = DEFAULT_EXPECTATION_COMPARISON_SETTINGS,
  calculatedAt = new Date().toISOString(),
): EarningsExpectationComparison[] {
  return selectEffectiveEarningsExpectations(snapshots, settings.timeZone)
    .map((selection) => compareEarningsExpectation(selection.snapshot, events, settings, calculatedAt, selection.businessOrderStatus, selection.businessRootSnapshot.id, selection.snapshot, selection))
    .sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || left.snapshotId.localeCompare(right.snapshotId));
}

export function compareEarningsExpectation(
  snapshot: EarningsExpectationSnapshot,
  events: ResearchEvent[],
  settings: EarningsExpectationSettings = DEFAULT_EXPECTATION_COMPARISON_SETTINGS,
  calculatedAt = new Date().toISOString(),
  businessOrderStatus: EarningsExpectationBusinessOrderStatus = "confirmed",
  businessRootSnapshotId = snapshot.id,
  businessTemporalSnapshot: EarningsExpectationSnapshot = snapshot,
  temporalEvidence?: EarningsExpectationSelection,
): EarningsExpectationComparison {
  const candidates = actualCandidates(snapshot, events);
  const actual = candidates.length
    ? [...candidates].sort((left, right) => actualPriority(right.event) - actualPriority(left.event) || compareResearchDisclosureTime(right.event, left.event) || left.event.id.localeCompare(right.event.id))[0]
    : null;
  const actualDisclosureAt = actual?.disclosedAt ?? null;
  const disclosureBoundary = performanceDisclosureBoundary(businessTemporalSnapshot, events, settings.timeZone);
  const performanceInformationCutoff = disclosureBoundary.decisiveEvent?.occurredAt ?? null;
  const actualDisclosureTimingStatus = actualDisclosureAt ? snapshotDisclosureTimingStatus(businessTemporalSnapshot, actualDisclosureAt, settings.timeZone, actual?.event.eventDate ?? null) : "unknown";
  const performanceDisclosureTimingStatus = disclosureBoundary.timingStatus;
  const beforeActualDisclosure = timingStatusToLegacyBoolean(actualDisclosureTimingStatus);
  const beforeAnyPerformanceDisclosure = timingStatusToLegacyBoolean(performanceDisclosureTimingStatus);
  const availability = snapshotAvailableAt(businessTemporalSnapshot);
  const comparisonAvailability = actualDisclosureAt ? resolveComparisonAvailability(availability, actualDisclosureAt, actual?.event.eventDate ?? null, settings.timeZone) : null;
  const comparisonAvailableAt = comparisonAvailability?.occurredAt ?? null;
  const initialWarningCodes: EarningsExpectationWarningCode[] = [];
  if (availability.status === "uncertain") initialWarningCodes.push("availability_uncertain");
  if (disclosureBoundary.reasonCode) initialWarningCodes.push(disclosureBoundary.reasonCode);
  if (snapshot.sourceVerificationStatus !== "verified") initialWarningCodes.push("source_verification_pending");
  if (isExpectationSourcePublishedAtUnresolved(snapshot)) initialWarningCodes.push("source_time_unresolved");
  if (temporalEvidence?.auditTimeStatus === "invalid" || !isPreciseInstant(snapshot.createdAt)) initialWarningCodes.push("audit_time_invalid");
  const base: EarningsExpectationComparison = {
    ...comparisonBase(snapshot, calculatedAt, businessRootSnapshotId, settings.timeZone, temporalEvidence),
    beforeActualDisclosure,
    beforeAnyPerformanceDisclosure,
    actualDisclosureTimingStatus,
    performanceDisclosureTimingStatus,
    performanceDisclosureUncertain: disclosureBoundary.uncertain,
    earliestConfirmedDisclosure: disclosureBoundary.earliestConfirmed,
    earliestPossibleDisclosure: disclosureBoundary.earliestPossible,
    decisiveDisclosureEvent: disclosureBoundary.decisiveEvent,
    disclosureUncertaintyReasonCode: disclosureBoundary.reasonCode,
    businessOrderStatus,
    actualDisclosureAt,
    performanceInformationCutoff,
    comparisonAvailableAt,
    comparisonAvailableBusinessCalendarDate: comparisonAvailability?.businessCalendarDate ?? null,
    availableAt: availability,
    businessCalendarDate: availability.status === "resolved" ? availability.value.businessCalendarDate : null,
    interpretationTimeZone: availability.status === "resolved" ? availability.value.interpretationTimeZone : null,
    availabilityStatus: availability.status,
    availabilityUncertaintyReason: availability.status === "uncertain" ? availability.reason : null,
    structuredWarningCodes: [...new Set(initialWarningCodes)],
    nonComparableReasonCodes: [...new Set(initialWarningCodes)],
    isExAnte: beforeAnyPerformanceDisclosure === true,
  };
  if (businessOrderStatus === "uncertain") {
    return notComparable(withWarningCode(base, "business_order_ambiguous"), ["同日存在多条仅日期精度的预测，无法确认业务先后顺序。当前不生成正式预期差，请补充精确形成时间。"], "业务顺序不确定，未执行数值比较");
  }
  if (businessOrderStatus === "equal") {
    return notComparable(withWarningCode(base, "business_order_equal"), ["存在形成于同一精确时刻的独立预测，时间关系为 equal；稳定 ID 仅用于显示，不能据此认定业务先后。"], "独立预测形成时刻相同，未执行方向性或最新值比较");
  }
  const structuralReasons = structuralComparabilityReasons(snapshot);
  if (structuralReasons.length) return notComparable(base, structuralReasons, "口径校验失败，未执行数值比较");

  if (!actual) {
    const related = events.filter((event) => event.stockId === snapshot.stockId && event.reportPeriod === snapshot.reportPeriod);
    const actualDisclosureRecognized = related.some((event) => ["earnings_flash", "periodic_report", "financial_update"].includes(event.eventType) && event.performanceDisclosureScope !== "none" && Boolean(event.publishedAt ?? event.eventDate));
    const reasons = actualDisclosureRecognized
      ? ["无法匹配实际值", "公司实际业绩披露已识别，但本地实际值缺失、口径不匹配或解析状态不足"]
      : ["无法匹配实际值"];
    return { ...withWarningCode(base, "actual_value_unavailable"), comparisonResult: "insufficient_data", comparabilityStatus: "insufficient_data", nonComparableReasons: reasons, comparisonMethod: actualDisclosureRecognized ? "实际值暂不可可靠比较：公司披露已识别，但本地指标值缺失或尚未可靠解析" : "未找到同公司、同报告期、同期间口径和同指标的可靠实际值" };
  }

  const timingReasons = exAnteReasons(businessTemporalSnapshot, actualDisclosureAt, actualDisclosureTimingStatus, performanceDisclosureTimingStatus);
  if (timingReasons.length) {
    return notComparable({ ...base, actualEventId: actual.event.id, actualValue: actual.actualValue }, timingReasons, "实际披露后形成或来源无法核验，仅作事后参考");
  }

  const normalized = normalizeExpected(snapshot);
  if (normalized === null) return notComparable({ ...base, actualEventId: actual.event.id, actualValue: actual.actualValue }, ["单位无法可靠标准化"], "预期单位无法换算为实际值的元口径");
  if (snapshot.estimateShape === "point") {
    const expected = normalized.value;
    if (expected === null) return { ...base, actualEventId: actual.event.id, actualValue: actual.actualValue, comparisonResult: "insufficient_data", comparabilityStatus: "insufficient_data", nonComparableReasons: ["预期值缺失"], comparisonMethod: "点预测缺少有效数值" };
    const absoluteDifference = actual.actualValue - expected;
    const relative = relativeDifference(expected, actual.actualValue, snapshot.metric, settings.nearZeroThreshold);
    return {
      ...base,
      actualEventId: actual.event.id,
      expectedValue: expected,
      actualValue: actual.actualValue,
      absoluteDifference,
      relativeDifference: relative.value,
      comparisonResult: absoluteDifference > settings.roundingTolerance ? "above" : absoluteDifference < -settings.roundingTolerance ? "below" : "within",
      comparisonMethod: relative.reason ? `点预测：实际值减预期值；${relative.reason}` : "点预测：实际值减预期值，并以预期值绝对值计算相对差异",
      isExAnte: beforeAnyPerformanceDisclosure === true,
      comparabilityStatus: "comparable",
      nonComparableReasons: relative.reason ? [relative.reason] : [],
    };
  }

  const lower = normalized.lowerBound;
  const upper = normalized.upperBound;
  if (lower === null || upper === null) return { ...base, actualEventId: actual.event.id, actualValue: actual.actualValue, comparisonResult: "insufficient_data", comparabilityStatus: "insufficient_data", nonComparableReasons: ["预期区间缺失"], comparisonMethod: "区间预测缺少上下限" };
  const tolerance = settings.roundingTolerance;
  const result = actual.actualValue > upper + tolerance ? "above" : actual.actualValue < lower - tolerance ? "below" : "within";
  return {
    ...base,
    actualEventId: actual.event.id,
    expectedLowerBound: lower,
    expectedUpperBound: upper,
    actualValue: actual.actualValue,
    absoluteDifference: result === "above" ? actual.actualValue - upper : result === "below" ? actual.actualValue - lower : 0,
    relativeDifference: null,
    comparisonResult: result,
    comparisonMethod: "区间预测：实际值高于上限、处于区间或低于下限；使用集中舍入容差",
    isExAnte: beforeAnyPerformanceDisclosure === true,
    comparabilityStatus: "comparable",
    nonComparableReasons: [],
  };
}

export function expectationRevision(
  current: EarningsExpectationSnapshot,
  previous: EarningsExpectationSnapshot | undefined,
): { direction: "up" | "down" | "unchanged" | null; magnitude: number | null } {
  const revision = deriveExpectationBusinessRevisionDelta(current, previous);
  return revision ? { direction: revision.direction, magnitude: revision.relativeDelta } : { direction: null, magnitude: null };
}

export function expectationGroupKey(snapshot: EarningsExpectationSnapshot) {
  return getExpectationGroupKey(snapshot);
}

export function sourceCategoryLabel(category: EarningsExpectationSnapshot["sourceCategory"]) {
  return ({ company_guidance: "公司指引", institution_single: "单家机构预测", institution_consensus: "机构一致预期", user_estimate: "用户个人预测" })[category];
}

export function comparisonResultLabel(comparison: EarningsExpectationComparison, snapshot: EarningsExpectationSnapshot) {
  if (comparison.comparisonResult === "not_comparable") return "不可比较";
  if (comparison.comparisonResult === "insufficient_data") return "实际值不足";
  if (comparison.comparisonResult === "within") return snapshot.estimateShape === "range" ? "处于预测区间" : "与预测值基本一致";
  const direction = comparison.comparisonResult === "above" ? "高于" : "低于";
  return `${direction}${sourceCategoryLabel(snapshot.sourceCategory)}`;
}

function comparisonBase(
  snapshot: EarningsExpectationSnapshot,
  calculatedAt: string,
  businessRootSnapshotId: string,
  timeZone: string,
  temporalEvidence?: EarningsExpectationSelection,
): EarningsExpectationComparison {
  const effectiveBusinessTime = temporalEvidence?.effectiveBusinessTime ?? getExpectationBusinessTime(snapshot, timeZone);
  const originalBusinessTime = temporalEvidence?.originalBusinessTime ?? effectiveBusinessTime;
  return {
    id: `expectation-comparison-${stableHash(businessRootSnapshotId)}`,
    snapshotId: snapshot.id,
    businessRootSnapshotId,
    effectiveSnapshotId: snapshot.id,
    actualEventId: null,
    stockId: snapshot.stockId,
    reportPeriod: snapshot.reportPeriod,
    periodScope: snapshot.periodScope,
    metric: snapshot.metric,
    expectedValue: snapshot.value,
    expectedLowerBound: snapshot.lowerBound,
    expectedUpperBound: snapshot.upperBound,
    actualValue: null,
    absoluteDifference: null,
    relativeDifference: null,
    comparisonResult: "insufficient_data",
    comparisonMethod: "尚未比较",
    isExAnte: false,
    businessOrderStatus: "confirmed",
    beforeActualDisclosure: null,
    beforeAnyPerformanceDisclosure: null,
    actualDisclosureTimingStatus: "unknown",
    performanceDisclosureTimingStatus: "unknown",
    performanceDisclosureUncertain: false,
    originalBusinessTime: originalBusinessTime.value,
    effectiveBusinessTime: effectiveBusinessTime.value,
    originalSourcePublishedAt: temporalEvidence?.businessRootSnapshot.sourcePublishedAt ?? snapshot.sourcePublishedAt ?? null,
    effectiveSourcePublishedAt: temporalEvidence?.snapshot.sourcePublishedAt ?? snapshot.sourcePublishedAt ?? null,
    temporalCorrectionApplied: temporalEvidence?.temporalCorrectionApplied ?? false,
    correctedTemporalFields: temporalEvidence?.correctedTemporalFields ?? [],
    actualSourceInterpretationTimeZone: temporalEvidence?.actualSourceInterpretationTimeZone
      ?? (snapshot.sourcePublishedAtResolution === "workflow_time_zone" ? snapshot.sourcePublishedAtTimeZone ?? null : null),
    actualDisclosureAt: null,
    performanceInformationCutoff: null,
    comparisonAvailableAt: null,
    comparisonAvailableBusinessCalendarDate: null,
    availableAt: temporalEvidence?.availableAt ?? getExpectationAvailability(snapshot),
    businessCalendarDate: temporalEvidence?.availableAt.status === "resolved" ? temporalEvidence.availableAt.value.businessCalendarDate : null,
    interpretationTimeZone: temporalEvidence?.availableAt.status === "resolved" ? temporalEvidence.availableAt.value.interpretationTimeZone : null,
    availabilityStatus: temporalEvidence?.availableAt.status ?? getExpectationAvailability(snapshot).status,
    availabilityUncertaintyReason: temporalEvidence?.availableAt.status === "uncertain" ? temporalEvidence.availableAt.reason : null,
    previousResolutionStatus: temporalEvidence?.previousResolution.status ?? "none",
    previousCandidateIds: temporalEvidence?.previousResolution.candidateNodes.map((node) => node.businessRootSnapshot.id) ?? [],
    previousCandidateEffectiveSnapshotIds: temporalEvidence?.previousResolution.candidateNodes.map((node) => node.effectiveSnapshot.id) ?? [],
    auditTimeStatus: temporalEvidence?.auditTimeStatus ?? (isPreciseInstant(snapshot.createdAt) ? "valid" : "invalid"),
    structuredWarningCodes: temporalEvidence?.availableAt.status === "uncertain" ? ["availability_uncertain"] : [],
    nonComparableReasonCodes: [],
    comparabilityStatus: "insufficient_data",
    nonComparableReasons: [],
    calculatedAt,
  };
}

function notComparable(base: EarningsExpectationComparison, reasons: string[], method: string): EarningsExpectationComparison {
  return { ...base, comparisonResult: "not_comparable", comparabilityStatus: "not_comparable", nonComparableReasons: [...new Set(reasons)], comparisonMethod: method, absoluteDifference: null, relativeDifference: null };
}

function withWarningCode(base: EarningsExpectationComparison, code: EarningsExpectationWarningCode): EarningsExpectationComparison {
  return {
    ...base,
    structuredWarningCodes: [...new Set([...(base.structuredWarningCodes ?? []), code])],
    nonComparableReasonCodes: [...new Set([...(base.nonComparableReasonCodes ?? []), code])],
  };
}

function structuralComparabilityReasons(snapshot: EarningsExpectationSnapshot) {
  const reasons: string[] = [];
  if (snapshot.currency !== "CNY") reasons.push("币种无法可靠换算");
  if (snapshot.accountingBasis !== "PRC_GAAP") reasons.push("会计口径不同或不明确");
  if (snapshot.sourceVerificationStatus !== "verified") reasons.push("预期来源无法核验");
  if (snapshot.metric === "eps" && snapshot.unit !== "currency_per_share") reasons.push("EPS 单位不明确");
  if (snapshot.metric !== "eps" && snapshot.unit === "currency_per_share") reasons.push("金额与每股单位混用");
  if (snapshot.periodScope === "ttm") reasons.push("TTM 实际值口径尚未接入");
  return reasons;
}

function exAnteReasons(
  snapshot: EarningsExpectationSnapshot,
  actualDisclosureAt: string | null,
  actualStatus: EarningsExpectationDisclosureTimingStatus,
  performanceStatus: EarningsExpectationDisclosureTimingStatus,
) {
  const reasons: string[] = [];
  if (!actualDisclosureAt) reasons.push("实际值候选的公开披露时间缺失");
  else if (actualStatus !== "before") reasons.push(disclosureTimingReason(snapshot, actualStatus, "实际值披露"));
  if (performanceStatus !== "before") reasons.push(disclosureTimingReason(snapshot, performanceStatus, "同指标业绩信息披露"));
  if (snapshot.sourceCategory !== "user_estimate" && !snapshot.sourcePublishedAt) reasons.push("外部来源发布日期缺失");
  else if (snapshot.sourceCategory !== "user_estimate" && isExpectationSourcePublishedAtUnresolved(snapshot)) reasons.push("历史来源时间缺少可确认的原解释时区，保留原值并等待人工核验");
  return reasons;
}

function actualCandidates(snapshot: EarningsExpectationSnapshot, events: ResearchEvent[]): ActualCandidate[] {
  const allowedEvents = new Set(["earnings_flash", "periodic_report", "financial_update"]);
  const keys = metricKeys(snapshot.metric, snapshot.periodScope);
  const expectedBasis = snapshot.periodScope === "single_quarter" ? "single_quarter" : "cumulative";
  const candidates: ActualCandidate[] = [];
  for (const event of events) {
    if (event.stockId !== snapshot.stockId || event.reportPeriod !== snapshot.reportPeriod || !allowedEvents.has(event.eventType)) continue;
    if (event.performanceDisclosureScope === "none") continue;
    if (event.verificationStatus !== "verified" || !["parse_success", "not_applicable"].includes(event.parseStatus)) continue;
    for (const metric of event.metrics) {
      if (!keys.includes(metric.key) || metric.periodBasis !== expectedBasis || metric.value === null || metric.unit !== "CNY") continue;
      candidates.push({ event, metric, actualValue: metric.value, disclosedAt: event.publishedAt ?? event.eventDate });
    }
  }
  return candidates;
}

interface PerformanceDisclosureBoundary {
  earliestConfirmed: PerformanceDisclosureEvidence | null;
  earliestPossible: PerformanceDisclosureEvidence | null;
  decisiveEvent: PerformanceDisclosureEvidence | null;
  timingStatus: EarningsExpectationDisclosureTimingStatus;
  uncertain: boolean;
  reasonCode: "disclosure_scope_uncertain" | null;
}

function performanceDisclosureBoundary(snapshot: EarningsExpectationSnapshot, events: ResearchEvent[], timeZone: string): PerformanceDisclosureBoundary {
  const allowedEvents = new Set(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report", "financial_update"]);
  const keys = new Set(cutoffMetricKeys(snapshot.metric, snapshot.periodScope));
  const confirmed: PerformanceDisclosureEvidence[] = [];
  const possible: PerformanceDisclosureEvidence[] = [];
  for (const event of events) {
    if (event.stockId !== snapshot.stockId || event.reportPeriod !== snapshot.reportPeriod || !allowedEvents.has(event.eventType)) continue;
    const disclosedAt = event.publishedAt ?? event.eventDate;
    if (!disclosedAt) continue;
    const scope = inferPerformanceDisclosureScope(event, keys);
    if (scope === "all_metrics" || (scope === "listed_metrics" && event.metrics.some((metric) => keys.has(metric.key)))) confirmed.push({ eventId: event.id, occurredAt: disclosedAt, businessCalendarDate: event.eventDate ?? disclosedAt.slice(0, 10), category: "confirmed" });
    else if (scope === "unknown") possible.push({ eventId: event.id, occurredAt: disclosedAt, businessCalendarDate: event.eventDate ?? disclosedAt.slice(0, 10), category: "possible" });
  }
  const order = (left: PerformanceDisclosureEvidence, right: PerformanceDisclosureEvidence) => compareDisclosureEvidenceTime(left, right) || left.eventId.localeCompare(right.eventId);
  confirmed.sort(order);
  possible.sort(order);
  const earliestConfirmed = confirmed[0] ?? null;
  const earliestPossible = possible[0] ?? null;
  const all = [...confirmed, ...possible].sort(order);
  if (!all.length) return { earliestConfirmed: null, earliestPossible: null, decisiveEvent: null, timingStatus: "unknown", uncertain: false, reasonCode: null };
  const confirmedStatus = earliestConfirmed ? snapshotDisclosureTimingStatus(snapshot, earliestConfirmed.occurredAt, timeZone, earliestConfirmed.businessCalendarDate) : null;
  const possibleStatus = earliestPossible ? snapshotDisclosureTimingStatus(snapshot, earliestPossible.occurredAt, timeZone, earliestPossible.businessCalendarDate) : null;
  if (confirmedStatus === "after" || confirmedStatus === "same_time") return { earliestConfirmed, earliestPossible, decisiveEvent: earliestConfirmed, timingStatus: confirmedStatus, uncertain: false, reasonCode: null };
  if (confirmedStatus === "before") {
    if (!possibleStatus || possibleStatus === "before") return { earliestConfirmed, earliestPossible, decisiveEvent: all[0], timingStatus: "before", uncertain: false, reasonCode: null };
    return { earliestConfirmed, earliestPossible, decisiveEvent: earliestPossible, timingStatus: "unknown", uncertain: true, reasonCode: "disclosure_scope_uncertain" };
  }
  if (!confirmedStatus && possibleStatus === "before") return { earliestConfirmed, earliestPossible, decisiveEvent: earliestPossible, timingStatus: "before", uncertain: false, reasonCode: null };
  return { earliestConfirmed, earliestPossible, decisiveEvent: earliestPossible ?? earliestConfirmed, timingStatus: "unknown", uncertain: true, reasonCode: "disclosure_scope_uncertain" };
}

function inferPerformanceDisclosureScope(event: ResearchEvent, keys: Set<string>) {
  if (event.performanceDisclosureScope) return event.performanceDisclosureScope;
  if (event.eventType === "periodic_report" || event.eventType === "earnings_flash") return "all_metrics" as const;
  if (event.eventType === "earnings_preview" || event.eventType === "earnings_preview_revision") return event.metrics.length ? "listed_metrics" as const : "unknown" as const;
  if (event.eventType === "financial_update") return event.metrics.some((metric) => keys.has(metric.key)) ? "listed_metrics" as const : "none" as const;
  return "none" as const;
}

function cutoffMetricKeys(metric: EarningsExpectationMetric, scope: EarningsExpectationPeriodScope) {
  const actual = metricKeys(metric, scope);
  const forecast = ({
    revenue: ["operatingRevenueForecastLower", "operatingRevenueForecastUpper", "operatingRevenueForecastMidpoint"],
    attributable_net_profit: ["netProfitAttributableToParentForecastLower", "netProfitAttributableToParentForecastUpper", "netProfitAttributableToParentForecastMidpoint"],
    adjusted_net_profit: ["netProfitExcludingNonRecurringForecastLower", "netProfitExcludingNonRecurringForecastUpper", "netProfitExcludingNonRecurringForecastMidpoint"],
    operating_cash_flow: [],
    eps: [],
  } as Record<EarningsExpectationMetric, string[]>)[metric];
  return [...actual, ...forecast];
}

function snapshotDisclosureTimingStatus(snapshot: EarningsExpectationSnapshot, cutoff: string, timeZone: string, cutoffBusinessCalendarDate?: string | null): EarningsExpectationDisclosureTimingStatus {
  const availability = getExpectationAvailability(snapshot);
  if (availability.status === "uncertain") return "unknown";
  const cutoffCanonical = toCanonicalBusinessTemporal({
    value: cutoff,
    precision: isPreciseInstant(cutoff) ? "datetime" : isCalendarDate(cutoff) ? "date" : null,
    resolution: isPreciseInstant(cutoff) ? "absolute" : isCalendarDate(cutoff) ? "date" : null,
    interpretationTimeZone: isPreciseInstant(cutoff) && !cutoffBusinessCalendarDate ? timeZone : null,
    businessCalendarDate: cutoffBusinessCalendarDate ?? (isCalendarDate(cutoff) ? cutoff : null),
  });
  const comparison = compareCanonicalBusinessTemporal(availability.value, cutoffCanonical);
  if (comparison.uncertain) return "unknown";
  if (comparison.order < 0) return "before";
  if (comparison.order > 0) return "after";
  return "same_time";
}

function timingStatusToLegacyBoolean(status: EarningsExpectationDisclosureTimingStatus) {
  if (status === "before") return true;
  if (status === "unknown") return null;
  return false;
}

function disclosureTimingReason(snapshot: EarningsExpectationSnapshot, status: EarningsExpectationDisclosureTimingStatus, label: string) {
  if (status === "unknown") return `预期形成、外部来源与${label}同日或缺少可确认先后顺序的精确时间`;
  if (status === "same_time") return `预期可用时间与${label}相同，不能认定为事前预测`;
  if (status === "after") return `预期形成或外部来源时间不早于${label}`;
  return snapshot.sourceCategory !== "user_estimate" && !snapshot.sourcePublishedAt ? "外部来源发布日期缺失" : "";
}

function snapshotAvailableAt(snapshot: EarningsExpectationSnapshot) {
  return getExpectationAvailability(snapshot);
}

function resolveComparisonAvailability(availability: EarningsExpectationAvailabilityResolution, actualDisclosureAt: string, actualBusinessCalendarDate: string | null, timeZone: string) {
  if (availability.status === "uncertain") return null;
  const actualCanonical = toCanonicalBusinessTemporal({
    value: actualDisclosureAt,
    precision: isPreciseInstant(actualDisclosureAt) ? "datetime" : isCalendarDate(actualDisclosureAt) ? "date" : null,
    resolution: isPreciseInstant(actualDisclosureAt) ? "absolute" : isCalendarDate(actualDisclosureAt) ? "date" : null,
    interpretationTimeZone: isPreciseInstant(actualDisclosureAt) && !actualBusinessCalendarDate ? timeZone : null,
    businessCalendarDate: actualBusinessCalendarDate ?? (isCalendarDate(actualDisclosureAt) ? actualDisclosureAt : null),
  });
  const later = laterCanonicalBusinessTemporal(availability.value, actualCanonical);
  return later.status === "resolved"
    ? { occurredAt: later.value.value ?? later.value.businessCalendarDate, businessCalendarDate: later.value.businessCalendarDate }
    : null;
}

function metricKeys(metric: EarningsExpectationMetric, scope: EarningsExpectationPeriodScope) {
  const single = scope === "single_quarter";
  return ({
    revenue: [single ? "singleQuarterOperatingRevenue" : "operatingRevenue"],
    attributable_net_profit: [single ? "singleQuarterParentNetProfit" : "netProfitAttributableToParent"],
    adjusted_net_profit: [single ? "singleQuarterDeductedNetProfit" : "netProfitExcludingNonRecurring"],
    operating_cash_flow: [single ? "singleQuarterOperatingCashFlow" : "netOperatingCashFlow"],
    eps: ["basicEPS"],
  } as Record<EarningsExpectationMetric, string[]>)[metric];
}

function normalizeExpected(snapshot: EarningsExpectationSnapshot) {
  if (snapshot.metric === "eps") return snapshot.unit === "currency_per_share" ? { value: snapshot.value, lowerBound: snapshot.lowerBound, upperBound: snapshot.upperBound } : null;
  const factor = ({ yuan: 1, ten_thousand_yuan: 10_000, million_yuan: 1_000_000, hundred_million_yuan: 100_000_000, currency_per_share: Number.NaN })[snapshot.unit];
  if (!Number.isFinite(factor)) return null;
  const convert = (value: number | null) => value === null ? null : value * factor;
  return { value: convert(snapshot.value), lowerBound: convert(snapshot.lowerBound), upperBound: convert(snapshot.upperBound) };
}

function relativeDifference(expected: number, actual: number, metric: EarningsExpectationMetric, nearZero: number) {
  if (expected === 0) return { value: null, reason: "预期值为0，百分比差异不适用" };
  if (Math.abs(expected) <= nearZero) return { value: null, reason: "预期值接近0，百分比差异不适用" };
  if (Math.sign(expected) !== Math.sign(actual) && actual !== 0) return { value: null, reason: "实际值与预期值正负号跨越，百分比差异不展示" };
  if (metric === "operating_cash_flow") return { value: null, reason: "经营现金流波动性较高，仅展示同报告期绝对差异" };
  return { value: (actual - expected) / Math.abs(expected), reason: null };
}

function actualPriority(event: ResearchEvent) { if (event.eventType === "financial_update") return 3; if (event.eventType === "periodic_report") return 2; return 1; }
function compareResearchDisclosureTime(left: ResearchEvent, right: ResearchEvent) {
  return compareDisclosureEvidenceTime(
    { eventId: left.id, occurredAt: left.publishedAt ?? left.eventDate ?? "", businessCalendarDate: left.eventDate, category: "confirmed" },
    { eventId: right.id, occurredAt: right.publishedAt ?? right.eventDate ?? "", businessCalendarDate: right.eventDate, category: "confirmed" },
  );
}

function compareDisclosureEvidenceTime(left: PerformanceDisclosureEvidence, right: PerformanceDisclosureEvidence) {
  const canonical = (evidence: PerformanceDisclosureEvidence) => toCanonicalBusinessTemporal({
    value: evidence.occurredAt,
    precision: isPreciseInstant(evidence.occurredAt) ? "datetime" : isCalendarDate(evidence.occurredAt) ? "date" : null,
    resolution: isPreciseInstant(evidence.occurredAt) ? "absolute" : isCalendarDate(evidence.occurredAt) ? "date" : null,
    interpretationTimeZone: null,
    businessCalendarDate: evidence.businessCalendarDate ?? (isCalendarDate(evidence.occurredAt) ? evidence.occurredAt : null),
  });
  const comparison = compareCanonicalBusinessTemporal(canonical(left), canonical(right));
  if (!comparison.uncertain) return comparison.order;
  return (left.businessCalendarDate ?? "").localeCompare(right.businessCalendarDate ?? "");
}
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
