import type {
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationComparison,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationEventPayload,
  EarningsExpectationSnapshot,
  EarningsExpectationWarningCode,
  ResearchEvent,
  Stock,
} from "../types";
import { comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "./earningsExpectationComparisonProvider";
import {
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getExpectationBusinessTime,
  getExpectationEventBusinessTime,
  getExpectationAvailability,
  getExpectationFormationTemporal,
  resolveEarningsExpectationCorrectionChain,
  resolveEffectiveBusinessHistory,
  resolveUniquePreviousBusinessNode,
  sortExpectationsByBusinessTime,
} from "./earningsExpectationIntegrity";
import {
  compareCanonicalBusinessTemporal,
  isPreciseInstant,
  resolveSafeWorkflowTimeZone,
  toCanonicalBusinessTemporal,
} from "../utils/dateTime";

export function buildEarningsExpectationResearchEvents(
  snapshots: EarningsExpectationSnapshot[],
  comparisons: EarningsExpectationComparison[],
  stocks: Stock[],
  revisionReminderThreshold = 0.1,
  timeZone = resolveSafeWorkflowTimeZone(),
): ResearchEvent[] {
  const events: ResearchEvent[] = [];
  const comparisonSnapshotIds = new Set(comparisons.map((comparison) => comparison.snapshotId));
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const businessNodes = resolveEffectiveBusinessHistory(snapshots, timeZone);
  const nodesByGroup = new Map<string, typeof businessNodes>();
  for (const node of businessNodes) {
    const key = expectationGroupKey(node.businessRootSnapshot);
    nodesByGroup.set(key, [...(nodesByGroup.get(key) ?? []), node]);
  }
  for (const group of nodesByGroup.values()) {
    const groupHasComparison = group.some((node) => comparisonSnapshotIds.has(node.effectiveSnapshot.id));
    const explicitWarningNode = [...group].reverse().find((node) => ["ambiguous", "equal_time", "unresolved"].includes(resolveUniquePreviousBusinessNode(node, group).status));
    group.forEach((node) => {
      const stock = stocks.find((item) => item.id === node.businessRootSnapshot.stockId);
      if (!stock) return;
      const previousResolution = resolveUniquePreviousBusinessNode(node, group);
      const previous = previousResolution.previousNode ?? undefined;
      const businessOrderStatus = previousResolution.status === "equal_time" ? "equal" : ["ambiguous", "unresolved"].includes(previousResolution.status) ? "uncertain" : "confirmed";
      const businessRevisionDelta = deriveExpectationBusinessRevisionDelta(
        node.effectiveSnapshot,
        previous?.effectiveSnapshot,
        businessOrderStatus,
        {
          previousBusinessRootSnapshotId: previous?.businessRootSnapshot.id,
          currentBusinessRootSnapshotId: node.businessRootSnapshot.id,
        },
      );
      events.push(snapshotEvent(stock, node.businessRootSnapshot, node.effectiveSnapshot, previousResolution.status === "unique", businessRevisionDelta, revisionReminderThreshold, timeZone, businessOrderStatus, node.correctionChain, previousResolution));
      if (["ambiguous", "equal_time", "unresolved"].includes(previousResolution.status) && !groupHasComparison && explicitWarningNode?.businessRootSnapshot.id === node.businessRootSnapshot.id) {
        const reason = businessOrderStatus === "equal"
          ? "两条独立预测形成于同一精确时刻，稳定 ID 仅用于显示排序；不生成方向性业务修订。"
          : previousResolution.status === "unresolved"
            ? "历史时间缺少可恢复的原解释时区，无法证明唯一业务前序。"
            : "存在多个互相无法排序的最大前序，不生成方向性业务修订。";
        events.push(warningEvent(stock, node.effectiveSnapshot, null, timeZone, businessOrderStatus, node.businessRootSnapshot, node.correctionChain, [reason], previousResolution.reasonCode ? [previousResolution.reasonCode] : ["business_order_ambiguous"]));
      }
    });
  }

  for (const correction of sortExpectationsByBusinessTime(snapshots.filter((snapshot) => Boolean(snapshot.correctsSnapshotId)), timeZone)) {
    const stock = stocks.find((item) => item.id === correction.stockId);
    if (!stock) continue;
    const resolved = resolveEarningsExpectationCorrectionChain(snapshots, correction.id);
    const root = resolved.chain[0] ?? correction;
    const terminal = resolved.terminal ?? correction;
    const correctionDelta = deriveExpectationCorrectionDelta(correction, correction.correctsSnapshotId ? snapshotsById.get(correction.correctsSnapshotId) : undefined);
    events.push(correctionEvent(stock, correction, correctionDelta, timeZone, root, terminal, resolved.chain));
  }

  const nodeByEffectiveId = new Map(businessNodes.map((node) => [node.effectiveSnapshot.id, node]));
  for (const comparison of comparisons) {
    const snapshot = snapshotsById.get(comparison.snapshotId);
    if (!snapshot) continue;
    const stock = stocks.find((item) => item.id === snapshot.stockId);
    if (!stock) continue;
    const node = nodeByEffectiveId.get(snapshot.id);
    const root = node?.businessRootSnapshot ?? snapshot;
    const chain = node?.correctionChain ?? [snapshot];
    if (comparison.comparabilityStatus === "comparable") events.push(comparisonEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus ?? "confirmed", root, chain));
    else events.push(warningEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus ?? "confirmed", root, chain));
  }
  for (const node of businessNodes) {
    if (comparisons.some((comparison) => comparison.snapshotId === node.effectiveSnapshot.id) || node.effectiveSnapshot.sourceVerificationStatus === "verified") continue;
    const stock = stocks.find((item) => item.id === node.effectiveSnapshot.stockId);
    if (stock) events.push(warningEvent(stock, node.effectiveSnapshot, null, timeZone, "confirmed", node.businessRootSnapshot, node.correctionChain));
  }
  return dedupe(events).sort((left, right) => compareResearchEventTime(right, left, timeZone) || left.id.localeCompare(right.id));
}

function snapshotEvent(
  stock: Stock,
  businessRootSnapshot: EarningsExpectationSnapshot,
  snapshot: EarningsExpectationSnapshot,
  isRevision: boolean,
  revision: EarningsExpectationBusinessRevisionDelta | null,
  revisionReminderThreshold: number,
  timeZone: string,
  businessOrderStatus: "confirmed" | "equal" | "uncertain",
  correctionChain: EarningsExpectationSnapshot[],
  previousResolution: ReturnType<typeof resolveUniquePreviousBusinessNode>,
): ResearchEvent {
  const type = isRevision ? "earnings_expectation_revision" : "earnings_expectation_added";
  const category = sourceCategoryLabel(snapshot.sourceCategory);
  const reasons = snapshot.sourceVerificationStatus === "verified" ? [] : ["预期来源待核验"];
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:business`,
    eventType: type,
    title: `${category}${isRevision ? snapshot.correctionScope === "basis" ? "口径纠正" : "修订" : "新增"} · ${metricLabel(snapshot.metric)}`,
    summary: `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}；${formatExpectation(snapshot)}。${snapshot.sourceCategory === "user_estimate" ? "该记录为用户个人预测，不代表机构观点。" : ""}`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: reasons.length ? "pending" : "not_required",
    reviewReasons: reasons,
    materiality: isRevision && revision && Math.abs(revision.relativeDelta) >= revisionReminderThreshold ? "high" : "medium",
    expectation: payload(snapshot, null, null, revision, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null, snapshot.id, previousResolution),
  };
}

function correctionEvent(
  stock: Stock,
  snapshot: EarningsExpectationSnapshot,
  correctionDelta: EarningsExpectationCorrectionDelta | null,
  timeZone: string,
  businessRootSnapshot: EarningsExpectationSnapshot,
  effectiveSnapshot: EarningsExpectationSnapshot,
  correctionChain: EarningsExpectationSnapshot[],
): ResearchEvent {
  const reasons = correctionDelta ? [] : ["无法匹配被更正快照，未计算更正差异"];
  const correctionRecordedAt = snapshot.createdAt;
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${snapshot.id}:earnings_expectation_correction`,
    eventType: "earnings_expectation_correction",
    eventDate: correctionRecordedAt.slice(0, 10),
    publishedAt: correctionRecordedAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}数据更正 · ${metricLabel(snapshot.metric)}`,
    summary: correctionDelta
      ? `历史数据更正：${correctionDelta.previousValue ?? "缺失"} → ${correctionDelta.correctedValue ?? "缺失"}。该差异仅描述数据修正，不代表业务预测上调或下调。${correctionDelta.calculationNote ?? ""}`
      : `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}的数据更正；无法匹配被更正快照。`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: payload(snapshot, null, correctionDelta, null, "confirmed", timeZone, businessRootSnapshot, correctionChain, correctionRecordedAt, effectiveSnapshot.id),
  };
}

function comparisonEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison, timeZone: string, businessOrderStatus: "confirmed" | "equal" | "uncertain", businessRootSnapshot: EarningsExpectationSnapshot, correctionChain: EarningsExpectationSnapshot[]): ResearchEvent {
  const availableAt = comparison.comparisonAvailableAt ?? comparison.actualDisclosureAt ?? comparison.performanceInformationCutoff ?? getExpectationEventBusinessTime(snapshot, timeZone).value;
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:comparison:${comparison.actualEventId ?? "missing"}`,
    eventType: "earnings_expectation_comparison_available",
    eventDate: comparison.comparisonAvailableBusinessCalendarDate ?? snapshot.asOfDate,
    publishedAt: availableAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}比较结果可用 · ${metricLabel(snapshot.metric)}`,
    summary: `${comparisonResultLabel(comparison, snapshot)}；${comparison.comparisonMethod}。${comparison.isExAnte ? "形成于任何同指标业绩信息披露前。" : "仅作事后参考或口径核验。"}`,
    verificationStatus: comparison.comparabilityStatus === "comparable" ? "verified" : "partial",
    reviewStatus: "pending",
    reviewReasons: comparison.nonComparableReasons,
    materiality: comparison.comparisonResult === "above" || comparison.comparisonResult === "below" ? "high" : "medium",
    expectation: payload(snapshot, comparison, null, null, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null),
  };
}

function warningEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null, timeZone: string, businessOrderStatus: "confirmed" | "equal" | "uncertain", businessRootSnapshot: EarningsExpectationSnapshot, correctionChain: EarningsExpectationSnapshot[], explicitReasons?: string[], explicitCodes?: EarningsExpectationWarningCode[]): ResearchEvent {
  const reasons = explicitReasons?.length ? explicitReasons : comparison?.nonComparableReasons.length ? comparison.nonComparableReasons : ["预期来源待核验"];
  const warningCodes = explicitCodes?.length ? explicitCodes : warningCodesFor(snapshot, comparison);
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:warning:${warningCodes.slice().sort().join("+")}`,
    eventType: "earnings_expectation_data_warning",
    title: `业绩预期数据需要核验 · ${metricLabel(snapshot.metric)}`,
    summary: reasons.join("；"),
    verificationStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    parseStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "not_applicable",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: { ...payload(snapshot, comparison, null, null, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null), structuredWarningCodes: warningCodes },
  };
}

function base(stock: Stock, snapshot: EarningsExpectationSnapshot, timeZone: string, _businessRootSnapshot: EarningsExpectationSnapshot = snapshot): ResearchEvent {
  const availability = getExpectationAvailability(snapshot);
  const formation = getExpectationFormationTemporal(snapshot);
  const eventDate = availability.status === "resolved" ? availability.value.businessCalendarDate : formation.businessCalendarDate;
  const occurredAt = availability.status === "resolved" ? availability.value.value : null;
  return {
    id: "",
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "earnings_expectation_added",
    eventDate,
    publishedAt: occurredAt,
    reportPeriod: snapshot.reportPeriod,
    title: "",
    summary: "",
    sourceType: "earnings_expectation",
    sourceName: snapshot.sourceName || sourceCategoryLabel(snapshot.sourceCategory),
    sourceUrl: snapshot.sourceUrl,
    pdfUrl: null,
    verificationStatus: "partial",
    parseStatus: "not_applicable",
    materiality: "medium",
    metrics: [],
    relatedAnnouncementIds: [],
    relatedFinancialPeriod: snapshot.reportPeriod,
    reviewStatus: "not_required",
    reviewReasons: [],
    isRestated: Boolean(snapshot.correctsSnapshotId),
    updatedAt: snapshot.createdAt,
  };
}

function payload(
  snapshot: EarningsExpectationSnapshot,
  comparison: EarningsExpectationComparison | null,
  correctionDelta: EarningsExpectationCorrectionDelta | null,
  businessRevisionDelta: EarningsExpectationBusinessRevisionDelta | null,
  businessOrderStatus: "confirmed" | "equal" | "uncertain",
  timeZone: string,
  businessRootSnapshot: EarningsExpectationSnapshot,
  correctionChain: EarningsExpectationSnapshot[],
  correctionRecordedAt: string | null,
  effectiveSnapshotId = snapshot.id,
  previousResolution?: ReturnType<typeof resolveUniquePreviousBusinessNode>,
): EarningsExpectationEventPayload {
  const temporalNode = resolveEffectiveBusinessHistory(correctionChain, timeZone).find((node) => node.businessRootSnapshot.id === businessRootSnapshot.id);
  const originalBusinessTime = temporalNode?.originalBusinessTime ?? getExpectationBusinessTime(businessRootSnapshot, timeZone);
  const effectiveBusinessTime = temporalNode?.effectiveBusinessTime ?? getExpectationBusinessTime(snapshot, timeZone);
  const availableAt = temporalNode?.availableAt ?? getExpectationAvailability(snapshot);
  return {
    snapshotId: snapshot.id,
    businessEventKey: `expectation-business:${businessRootSnapshot.id}`,
    businessRootSnapshotId: businessRootSnapshot.id,
    effectiveSnapshotId,
    correctionChainSnapshotIds: correctionChain.map((item) => item.id),
    originalBusinessTime: originalBusinessTime.value,
    effectiveBusinessTime: effectiveBusinessTime.value,
    originalSourcePublishedAt: businessRootSnapshot.sourcePublishedAt ?? null,
    effectiveSourcePublishedAt: snapshot.sourcePublishedAt ?? null,
    temporalCorrectionApplied: temporalNode?.temporalCorrectionApplied ?? false,
    correctedTemporalFields: temporalNode?.correctedTemporalFields ?? [],
    actualSourceInterpretationTimeZone: temporalNode?.actualSourceInterpretationTimeZone ?? null,
    correctionRecordedAt,
    sourceCategory: snapshot.sourceCategory,
    sourceName: snapshot.sourceName,
    reportPeriod: snapshot.reportPeriod,
    metric: snapshot.metric,
    expectedValue: snapshot.value,
    expectedLowerBound: snapshot.lowerBound,
    expectedUpperBound: snapshot.upperBound,
    isExAnte: comparison?.isExAnte ?? null,
    beforeActualDisclosure: comparison?.beforeActualDisclosure ?? null,
    beforeAnyPerformanceDisclosure: comparison?.beforeAnyPerformanceDisclosure ?? null,
    performanceInformationCutoff: comparison?.performanceInformationCutoff ?? null,
    comparisonResult: comparison?.comparisonResult ?? null,
    sourceVerificationStatus: snapshot.sourceVerificationStatus,
    sourcePublishedAt: snapshot.sourcePublishedAt,
    sourcePublishedAtPrecision: snapshot.sourcePublishedAtPrecision ?? null,
    sourcePublishedAtResolution: snapshot.sourcePublishedAtResolution ?? null,
    sourcePublishedAtTimeZone: snapshot.sourcePublishedAtTimeZone ?? null,
    correctsSnapshotId: snapshot.correctsSnapshotId,
    businessOrderStatus,
    correctionDelta,
    businessRevisionDelta,
    actualDisclosureTimingStatus: comparison?.actualDisclosureTimingStatus ?? "unknown",
    performanceDisclosureTimingStatus: comparison?.performanceDisclosureTimingStatus ?? "unknown",
    performanceDisclosureUncertain: comparison?.performanceDisclosureUncertain ?? false,
    earliestConfirmedDisclosure: comparison?.earliestConfirmedDisclosure ?? null,
    earliestPossibleDisclosure: comparison?.earliestPossibleDisclosure ?? null,
    decisiveDisclosureEvent: comparison?.decisiveDisclosureEvent ?? null,
    disclosureUncertaintyReasonCode: comparison?.disclosureUncertaintyReasonCode ?? null,
    availableAt,
    businessCalendarDate: availableAt.status === "resolved" ? availableAt.value.businessCalendarDate : null,
    interpretationTimeZone: availableAt.status === "resolved" ? availableAt.value.interpretationTimeZone : null,
    availabilityStatus: availableAt.status,
    availabilityUncertaintyReason: availableAt.status === "uncertain" ? availableAt.reason : null,
    previousResolutionStatus: previousResolution?.status ?? comparison?.previousResolutionStatus ?? "none",
    previousCandidateIds: previousResolution?.candidateNodes.map((node) => node.businessRootSnapshot.id) ?? comparison?.previousCandidateIds ?? [],
    previousCandidateEffectiveSnapshotIds: previousResolution?.candidateNodes.map((node) => node.effectiveSnapshot.id) ?? comparison?.previousCandidateEffectiveSnapshotIds ?? [],
    auditTimeStatus: temporalNode?.auditTimeStatus ?? comparison?.auditTimeStatus ?? (isPreciseInstant(snapshot.createdAt) ? "valid" : "invalid"),
    structuredWarningCodes: comparison?.structuredWarningCodes ?? [],
    nonComparableReasonCodes: comparison?.nonComparableReasonCodes ?? [],
    revisionDirection: businessRevisionDelta?.direction ?? null,
    revisionMagnitude: businessRevisionDelta?.relativeDelta ?? null,
    businessTimePrecision: originalBusinessTime.precision,
    effectiveBusinessTimePrecision: effectiveBusinessTime.precision,
    businessOrderUncertain: businessOrderStatus === "uncertain",
  };
}

function dedupe(events: ResearchEvent[]) { return [...new Map(events.map((event) => [event.id, event])).values()]; }
function warningCodesFor(snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null): EarningsExpectationWarningCode[] {
  const codes = new Set<EarningsExpectationWarningCode>(comparison?.structuredWarningCodes ?? []);
  for (const code of comparison?.nonComparableReasonCodes ?? []) codes.add(code);
  if (snapshot.sourceVerificationStatus !== "verified") codes.add("source_verification_pending");
  if (snapshot.sourcePublishedAtResolution === "unresolved_legacy") codes.add("source_time_unresolved");
  if (comparison?.performanceDisclosureUncertain) codes.add("disclosure_scope_uncertain");
  if (!comparison?.actualEventId) codes.add("actual_value_unavailable");
  if (!codes.size) codes.add("source_verification_pending");
  return [...codes].sort();
}
function compareResearchEventTime(left: ResearchEvent, right: ResearchEvent, timeZone: string) {
  void timeZone;
  const leftOccurredAt = expectationEventOccurredAt(left);
  const rightOccurredAt = expectationEventOccurredAt(right);
  if (leftOccurredAt && rightOccurredAt) {
    const canonical = compareCanonicalBusinessTemporal(leftOccurredAt, rightOccurredAt);
    if (!canonical.uncertain) return canonical.order;
  }
  const calendarOrder = (left.eventDate ?? "").localeCompare(right.eventDate ?? "");
  if (calendarOrder) return calendarOrder;
  const leftValue = left.publishedAt ?? left.updatedAt ?? "";
  const rightValue = right.publishedAt ?? right.updatedAt ?? "";
  if (isPreciseInstant(leftValue) && isPreciseInstant(rightValue)) return Date.parse(leftValue) - Date.parse(rightValue);
  return leftValue.localeCompare(rightValue);
}
function expectationEventOccurredAt(event: ResearchEvent) {
  if (!event.expectation) return null;
  if (event.eventType === "earnings_expectation_correction" || event.eventType === "earnings_expectation_comparison_available") {
    const occurredAt = event.publishedAt ?? event.eventDate;
    if (!occurredAt) return null;
    return toCanonicalBusinessTemporal({
      value: occurredAt,
      precision: isPreciseInstant(occurredAt) ? "datetime" : "date",
      resolution: isPreciseInstant(occurredAt) ? "absolute" : "date",
      interpretationTimeZone: null,
      businessCalendarDate: event.eventDate,
    });
  }
  return event.expectation.availableAt?.status === "resolved" ? event.expectation.availableAt.value : null;
}
function metricLabel(metric: EarningsExpectationSnapshot["metric"]) { return ({ revenue: "营业收入", attributable_net_profit: "归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益", operating_cash_flow: "经营现金流" })[metric]; }
function periodScopeLabel(scope: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[scope]; }
function formatExpectation(snapshot: EarningsExpectationSnapshot) { const suffix = snapshot.metric === "eps" ? `${snapshot.currency}/股` : unitLabel(snapshot.unit); return snapshot.estimateShape === "point" ? `点预测 ${snapshot.value ?? "缺失"} ${suffix}` : `区间 ${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${suffix}`; }
function unitLabel(unit: EarningsExpectationSnapshot["unit"]) { return ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[unit]; }
