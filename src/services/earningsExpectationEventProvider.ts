import type {
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationComparison,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationEventPayload,
  EarningsExpectationSnapshot,
  ResearchEvent,
  Stock,
} from "../types";
import { comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "./earningsExpectationComparisonProvider";
import {
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getExpectationEventBusinessTime,
  isExpectationBusinessOrderUncertain,
  sortExpectationsByBusinessTime,
} from "./earningsExpectationIntegrity";
import {
  compareBusinessTemporal,
  getTemporalCalendarDate,
  isCalendarDate,
  isPreciseInstant,
  resolveTimeZone,
  toBusinessTemporal,
} from "../utils/dateTime";

export function buildEarningsExpectationResearchEvents(
  snapshots: EarningsExpectationSnapshot[],
  comparisons: EarningsExpectationComparison[],
  stocks: Stock[],
  revisionReminderThreshold = 0.1,
  timeZone = resolveTimeZone(),
): ResearchEvent[] {
  const events: ResearchEvent[] = [];
  const comparisonBySnapshot = new Map(comparisons.map((comparison) => [comparison.snapshotId, comparison]));
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const businessHistory = new Map<string, EarningsExpectationSnapshot[]>();
  for (const snapshot of sortExpectationsByBusinessTime(snapshots, timeZone)) {
    const stock = stocks.find((item) => item.id === snapshot.stockId);
    if (!stock) continue;
    const key = expectationGroupKey(snapshot);
    const previousHistory = businessHistory.get(key) ?? [];
    const previousBusinessSnapshot = previousHistory[previousHistory.length - 1];
    const nextBusinessHistory = snapshot.correctsSnapshotId ? previousHistory : [...previousHistory, snapshot];
    const businessOrderUncertain = !snapshot.correctsSnapshotId && isExpectationBusinessOrderUncertain(nextBusinessHistory, timeZone);
    if (snapshot.correctsSnapshotId) {
      const correctionDelta = deriveExpectationCorrectionDelta(snapshot, snapshotsById.get(snapshot.correctsSnapshotId));
      events.push(correctionEvent(stock, snapshot, correctionDelta, timeZone));
    } else {
      const businessRevisionDelta = deriveExpectationBusinessRevisionDelta(snapshot, previousBusinessSnapshot, businessOrderUncertain ? "uncertain" : "confirmed");
      events.push(snapshotEvent(stock, snapshot, Boolean(previousBusinessSnapshot) && !businessOrderUncertain, businessRevisionDelta, revisionReminderThreshold, timeZone, businessOrderUncertain));
      businessHistory.set(key, nextBusinessHistory);
    }

    const comparison = comparisonBySnapshot.get(snapshot.id);
    if (comparison?.comparabilityStatus === "comparable") {
      events.push(comparisonEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus === "uncertain"));
    } else if (comparison) {
      events.push(warningEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus === "uncertain"));
    } else if (snapshot.sourceVerificationStatus !== "verified") {
      events.push(warningEvent(stock, snapshot, null, timeZone, businessOrderUncertain));
    }
  }
  return dedupe(events).sort((left, right) => compareResearchEventTime(right, left, timeZone) || left.id.localeCompare(right.id));
}

function snapshotEvent(
  stock: Stock,
  snapshot: EarningsExpectationSnapshot,
  isRevision: boolean,
  revision: EarningsExpectationBusinessRevisionDelta | null,
  revisionReminderThreshold: number,
  timeZone: string,
  businessOrderUncertain: boolean,
): ResearchEvent {
  const type = isRevision ? "earnings_expectation_revision" : "earnings_expectation_added";
  const category = sourceCategoryLabel(snapshot.sourceCategory);
  const reasons = snapshot.sourceVerificationStatus === "verified" ? [] : ["预期来源待核验"];
  return {
    ...base(stock, snapshot, timeZone),
    id: `expectation-event:${snapshot.id}:${type}`,
    eventType: type,
    title: `${category}${isRevision ? snapshot.correctionScope === "basis" ? "口径纠正" : "修订" : "新增"} · ${metricLabel(snapshot.metric)}`,
    summary: `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}；${formatExpectation(snapshot)}。${snapshot.sourceCategory === "user_estimate" ? "该记录为用户个人预测，不代表机构观点。" : ""}`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: reasons.length ? "pending" : "not_required",
    reviewReasons: reasons,
    materiality: isRevision && revision && Math.abs(revision.relativeDelta) >= revisionReminderThreshold ? "high" : "medium",
    expectation: payload(snapshot, null, null, revision, businessOrderUncertain, timeZone),
  };
}

function correctionEvent(
  stock: Stock,
  snapshot: EarningsExpectationSnapshot,
  correctionDelta: EarningsExpectationCorrectionDelta | null,
  timeZone: string,
): ResearchEvent {
  const reasons = correctionDelta ? [] : ["无法匹配被更正快照，未计算更正差异"];
  return {
    ...base(stock, snapshot, timeZone),
    id: `expectation-event:${snapshot.id}:earnings_expectation_correction`,
    eventType: "earnings_expectation_correction",
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}数据更正 · ${metricLabel(snapshot.metric)}`,
    summary: correctionDelta
      ? `历史数据更正：${correctionDelta.previousValue ?? "缺失"} → ${correctionDelta.correctedValue ?? "缺失"}。该差异仅描述数据修正，不代表业务预测上调或下调。${correctionDelta.calculationNote ?? ""}`
      : `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}的数据更正；无法匹配被更正快照。`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: payload(snapshot, null, correctionDelta, null, false, timeZone),
  };
}

function comparisonEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison, timeZone: string, businessOrderUncertain: boolean): ResearchEvent {
  const availableAt = comparison.comparisonAvailableAt ?? comparison.actualDisclosureAt ?? comparison.performanceInformationCutoff ?? getExpectationEventBusinessTime(snapshot, timeZone).value;
  return {
    ...base(stock, snapshot, timeZone),
    id: `expectation-event:${snapshot.id}:comparison:${comparison.actualEventId ?? "missing"}`,
    eventType: "earnings_expectation_comparison_available",
    eventDate: calendarDate(availableAt, timeZone) ?? snapshot.asOfDate,
    publishedAt: availableAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}比较结果可用 · ${metricLabel(snapshot.metric)}`,
    summary: `${comparisonResultLabel(comparison, snapshot)}；${comparison.comparisonMethod}。${comparison.isExAnte ? "形成于任何同指标业绩信息披露前。" : "仅作事后参考或口径核验。"}`,
    verificationStatus: comparison.comparabilityStatus === "comparable" ? "verified" : "partial",
    reviewStatus: "pending",
    reviewReasons: comparison.nonComparableReasons,
    materiality: comparison.comparisonResult === "above" || comparison.comparisonResult === "below" ? "high" : "medium",
    expectation: payload(snapshot, comparison, null, null, businessOrderUncertain, timeZone),
  };
}

function warningEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null, timeZone: string, businessOrderUncertain: boolean): ResearchEvent {
  const reasons = comparison?.nonComparableReasons.length ? comparison.nonComparableReasons : ["预期来源待核验"];
  return {
    ...base(stock, snapshot, timeZone),
    id: `expectation-event:${snapshot.id}:warning:${stableHash(reasons.join("|"))}`,
    eventType: "earnings_expectation_data_warning",
    title: `业绩预期数据需要核验 · ${metricLabel(snapshot.metric)}`,
    summary: reasons.join("；"),
    verificationStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    parseStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "not_applicable",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: payload(snapshot, comparison, null, null, businessOrderUncertain, timeZone),
  };
}

function base(stock: Stock, snapshot: EarningsExpectationSnapshot, timeZone: string): ResearchEvent {
  const businessTime = getExpectationEventBusinessTime(snapshot, timeZone);
  return {
    id: "",
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "earnings_expectation_added",
    eventDate: businessTime.calendarDate,
    publishedAt: businessTime.value,
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
  businessOrderUncertain: boolean,
  timeZone: string,
): EarningsExpectationEventPayload {
  return {
    snapshotId: snapshot.id,
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
    correctsSnapshotId: snapshot.correctsSnapshotId,
    businessOrderStatus: businessOrderUncertain ? "uncertain" : "confirmed",
    correctionDelta,
    businessRevisionDelta,
    actualDisclosureTimingStatus: comparison?.actualDisclosureTimingStatus ?? "unknown",
    performanceDisclosureTimingStatus: comparison?.performanceDisclosureTimingStatus ?? "unknown",
    performanceDisclosureUncertain: comparison?.performanceDisclosureUncertain ?? false,
    revisionDirection: businessRevisionDelta?.direction ?? null,
    revisionMagnitude: businessRevisionDelta?.relativeDelta ?? null,
    businessTimePrecision: getExpectationEventBusinessTime(snapshot, timeZone).precision,
    businessOrderUncertain,
  };
}

function dedupe(events: ResearchEvent[]) { return [...new Map(events.map((event) => [event.id, event])).values()]; }
function calendarDate(value: string, timeZone: string) { return getTemporalCalendarDate(value, isPreciseInstant(value) ? "datetime" : "date", timeZone); }
function compareResearchEventTime(left: ResearchEvent, right: ResearchEvent, timeZone: string) {
  const leftValue = left.publishedAt ?? left.eventDate ?? left.updatedAt ?? "";
  const rightValue = right.publishedAt ?? right.eventDate ?? right.updatedAt ?? "";
  const leftTime = isPreciseInstant(leftValue) ? toBusinessTemporal(leftValue, "datetime", timeZone) : isCalendarDate(leftValue) ? toBusinessTemporal(leftValue, "date", timeZone) : null;
  const rightTime = isPreciseInstant(rightValue) ? toBusinessTemporal(rightValue, "datetime", timeZone) : isCalendarDate(rightValue) ? toBusinessTemporal(rightValue, "date", timeZone) : null;
  if (!leftTime || !rightTime) return leftValue.localeCompare(rightValue);
  return compareBusinessTemporal(leftTime, rightTime).order;
}
function metricLabel(metric: EarningsExpectationSnapshot["metric"]) { return ({ revenue: "营业收入", attributable_net_profit: "归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益", operating_cash_flow: "经营现金流" })[metric]; }
function periodScopeLabel(scope: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[scope]; }
function formatExpectation(snapshot: EarningsExpectationSnapshot) { const suffix = snapshot.metric === "eps" ? `${snapshot.currency}/股` : unitLabel(snapshot.unit); return snapshot.estimateShape === "point" ? `点预测 ${snapshot.value ?? "缺失"} ${suffix}` : `区间 ${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${suffix}`; }
function unitLabel(unit: EarningsExpectationSnapshot["unit"]) { return ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[unit]; }
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
