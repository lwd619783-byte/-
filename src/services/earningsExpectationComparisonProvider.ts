import type {
  EarningsExpectationComparison,
  EarningsExpectationMetric,
  EarningsExpectationPeriodScope,
  EarningsExpectationSettings,
  EarningsExpectationSnapshot,
  EarningsExpectationBusinessOrderStatus,
  EarningsExpectationDisclosureTimingStatus,
  ResearchEvent,
  ResearchEventMetric,
} from "../types";
import {
  deriveExpectationBusinessRevisionDelta,
  getExpectationBusinessTime,
  getExpectationGroupKey,
  selectEffectiveEarningsExpectations,
} from "./earningsExpectationIntegrity";
import {
  compareBusinessTemporal,
  isCalendarDate,
  isPreciseInstant,
  laterBusinessTemporal,
  resolveTimeZone,
  toBusinessTemporal,
  type BusinessTemporalValue,
} from "../utils/dateTime";

export const DEFAULT_EXPECTATION_COMPARISON_SETTINGS: EarningsExpectationSettings = {
  revisionReminderThreshold: 0.1,
  nearZeroThreshold: 1e-9,
  roundingTolerance: 1e-9,
  timeZone: resolveTimeZone(),
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
    .map(({ snapshot, businessOrderUncertain }) => compareEarningsExpectation(snapshot, events, settings, calculatedAt, businessOrderUncertain ? "uncertain" : "confirmed"))
    .sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || left.snapshotId.localeCompare(right.snapshotId));
}

export function compareEarningsExpectation(
  snapshot: EarningsExpectationSnapshot,
  events: ResearchEvent[],
  settings: EarningsExpectationSettings = DEFAULT_EXPECTATION_COMPARISON_SETTINGS,
  calculatedAt = new Date().toISOString(),
  businessOrderStatus: EarningsExpectationBusinessOrderStatus = "confirmed",
): EarningsExpectationComparison {
  const candidates = actualCandidates(snapshot, events);
  const actual = candidates.length
    ? [...candidates].sort((left, right) => actualPriority(right.event) - actualPriority(left.event) || compareTemporalStrings(right.disclosedAt, left.disclosedAt, settings.timeZone) || left.event.id.localeCompare(right.event.id))[0]
    : null;
  const actualDisclosureAt = actual?.disclosedAt ?? null;
  const disclosureBoundary = performanceDisclosureBoundary(snapshot, events, settings.timeZone);
  const performanceInformationCutoff = disclosureBoundary.cutoff;
  const actualDisclosureTimingStatus = actualDisclosureAt ? snapshotDisclosureTimingStatus(snapshot, actualDisclosureAt, settings.timeZone) : "unknown";
  const performanceDisclosureTimingStatus = disclosureBoundary.timingStatus;
  const beforeActualDisclosure = timingStatusToLegacyBoolean(actualDisclosureTimingStatus);
  const beforeAnyPerformanceDisclosure = timingStatusToLegacyBoolean(performanceDisclosureTimingStatus);
  const comparisonAvailableAt = actualDisclosureAt ? laterTemporal(snapshotAvailableAt(snapshot, settings.timeZone), actualDisclosureAt, settings.timeZone) : null;
  const base: EarningsExpectationComparison = {
    ...comparisonBase(snapshot, calculatedAt),
    beforeActualDisclosure,
    beforeAnyPerformanceDisclosure,
    actualDisclosureTimingStatus,
    performanceDisclosureTimingStatus,
    performanceDisclosureUncertain: disclosureBoundary.uncertain,
    businessOrderStatus,
    actualDisclosureAt,
    performanceInformationCutoff,
    comparisonAvailableAt,
    isExAnte: beforeAnyPerformanceDisclosure === true,
  };
  if (businessOrderStatus === "uncertain") {
    return notComparable(base, ["同日存在多条仅日期精度的预测，无法确认业务先后顺序。当前不生成正式预期差，请补充精确形成时间。"], "业务顺序不确定，未执行数值比较");
  }
  const structuralReasons = structuralComparabilityReasons(snapshot);
  if (structuralReasons.length) return notComparable(base, structuralReasons, "口径校验失败，未执行数值比较");

  if (!actual) {
    const related = events.filter((event) => event.stockId === snapshot.stockId && event.reportPeriod === snapshot.reportPeriod);
    const actualDisclosureRecognized = related.some((event) => ["earnings_flash", "periodic_report", "financial_update"].includes(event.eventType) && event.performanceDisclosureScope !== "none" && Boolean(event.publishedAt ?? event.eventDate));
    const reasons = actualDisclosureRecognized
      ? ["无法匹配实际值", "公司实际业绩披露已识别，但本地实际值缺失、口径不匹配或解析状态不足"]
      : ["无法匹配实际值"];
    return { ...base, comparisonResult: "insufficient_data", comparabilityStatus: "insufficient_data", nonComparableReasons: reasons, comparisonMethod: actualDisclosureRecognized ? "实际值暂不可可靠比较：公司披露已识别，但本地指标值缺失或尚未可靠解析" : "未找到同公司、同报告期、同期间口径和同指标的可靠实际值" };
  }

  const timingReasons = exAnteReasons(snapshot, actualDisclosureAt, actualDisclosureTimingStatus, performanceDisclosureTimingStatus);
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

function comparisonBase(snapshot: EarningsExpectationSnapshot, calculatedAt: string): EarningsExpectationComparison {
  return {
    id: `expectation-comparison-${stableHash(snapshot.id)}`,
    snapshotId: snapshot.id,
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
    actualDisclosureAt: null,
    performanceInformationCutoff: null,
    comparisonAvailableAt: null,
    comparabilityStatus: "insufficient_data",
    nonComparableReasons: [],
    calculatedAt,
  };
}

function notComparable(base: EarningsExpectationComparison, reasons: string[], method: string): EarningsExpectationComparison {
  return { ...base, comparisonResult: "not_comparable", comparabilityStatus: "not_comparable", nonComparableReasons: [...new Set(reasons)], comparisonMethod: method, absoluteDifference: null, relativeDifference: null };
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
  cutoff: string | null;
  timingStatus: EarningsExpectationDisclosureTimingStatus;
  uncertain: boolean;
}

function performanceDisclosureBoundary(snapshot: EarningsExpectationSnapshot, events: ResearchEvent[], timeZone: string): PerformanceDisclosureBoundary {
  const allowedEvents = new Set(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report", "financial_update"]);
  const keys = new Set(cutoffMetricKeys(snapshot.metric, snapshot.periodScope));
  const confirmed: string[] = [];
  const possible: string[] = [];
  for (const event of events) {
    if (event.stockId !== snapshot.stockId || event.reportPeriod !== snapshot.reportPeriod || !allowedEvents.has(event.eventType)) continue;
    const disclosedAt = event.publishedAt ?? event.eventDate;
    if (!disclosedAt) continue;
    const scope = inferPerformanceDisclosureScope(event, keys);
    if (scope === "all_metrics" || (scope === "listed_metrics" && event.metrics.some((metric) => keys.has(metric.key)))) confirmed.push(disclosedAt);
    else if (scope === "unknown") possible.push(disclosedAt);
  }
  const order = (left: string, right: string) => compareTemporalStrings(left, right, timeZone) || left.localeCompare(right);
  confirmed.sort(order);
  possible.sort(order);
  const all = [...confirmed, ...possible].sort(order);
  if (!all.length) return { cutoff: null, timingStatus: "unknown", uncertain: false };
  const confirmedStatus = confirmed.length ? snapshotDisclosureTimingStatus(snapshot, confirmed[0], timeZone) : null;
  if (confirmedStatus === "after" || confirmedStatus === "same_time") return { cutoff: all[0], timingStatus: confirmedStatus, uncertain: possible.length > 0 };
  if (possible.length > 0) return { cutoff: all[0], timingStatus: "unknown", uncertain: true };
  if (confirmedStatus === "before") return { cutoff: all[0], timingStatus: "before", uncertain: false };
  return { cutoff: all[0], timingStatus: "unknown", uncertain: true };
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

function snapshotDisclosureTimingStatus(snapshot: EarningsExpectationSnapshot, cutoff: string, timeZone: string): EarningsExpectationDisclosureTimingStatus {
  const formation = getExpectationBusinessTime(snapshot, timeZone);
  const cutoffTime = temporalFromString(cutoff, timeZone);
  if (!cutoffTime) return "unknown";
  const formationStatus = temporalTimingStatus(formation, cutoffTime);
  if (formationStatus !== "before") return formationStatus;
  if (snapshot.sourceCategory === "user_estimate") return "before";
  if (!snapshot.sourcePublishedAt) return "unknown";
  const sourcePrecision = snapshot.sourcePublishedAtPrecision === "datetime" ? "datetime" : "date";
  const sourceTime = toBusinessTemporal(snapshot.sourcePublishedAt, sourcePrecision, timeZone);
  return sourceTime ? temporalTimingStatus(sourceTime, cutoffTime) : "unknown";
}

function temporalTimingStatus(left: BusinessTemporalValue, right: BusinessTemporalValue): EarningsExpectationDisclosureTimingStatus {
  const comparison = compareBusinessTemporal(left, right);
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

function snapshotAvailableAt(snapshot: EarningsExpectationSnapshot, timeZone: string) {
  const formation = getExpectationBusinessTime(snapshot, timeZone);
  if (snapshot.sourceCategory === "user_estimate" || !snapshot.sourcePublishedAt) return formation.value;
  const source = toBusinessTemporal(snapshot.sourcePublishedAt, snapshot.sourcePublishedAtPrecision === "datetime" ? "datetime" : "date", timeZone);
  return source ? laterBusinessTemporal(formation, source).value : formation.value;
}

function laterTemporal(left: string, right: string, timeZone: string) {
  const leftTime = temporalFromString(left, timeZone);
  const rightTime = temporalFromString(right, timeZone);
  if (!leftTime) return right;
  if (!rightTime) return left;
  return laterBusinessTemporal(leftTime, rightTime).value;
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
function temporalFromString(value: string | null, timeZone: string): BusinessTemporalValue | null {
  if (!value) return null;
  if (isPreciseInstant(value)) return toBusinessTemporal(value, "datetime", timeZone);
  if (isCalendarDate(value)) return toBusinessTemporal(value, "date", timeZone);
  return null;
}
function compareTemporalStrings(left: string | null, right: string | null, timeZone: string) {
  const leftTime = temporalFromString(left, timeZone);
  const rightTime = temporalFromString(right, timeZone);
  if (!leftTime && !rightTime) return 0;
  if (!leftTime) return 1;
  if (!rightTime) return -1;
  return compareBusinessTemporal(leftTime, rightTime).order;
}
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
