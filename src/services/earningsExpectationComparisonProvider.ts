import type {
  EarningsExpectationComparison,
  EarningsExpectationMetric,
  EarningsExpectationPeriodScope,
  EarningsExpectationSettings,
  EarningsExpectationSnapshot,
  ResearchEvent,
  ResearchEventMetric,
} from "../types";
import { effectiveEarningsExpectationSnapshots } from "./earningsExpectationRepository";

export const DEFAULT_EXPECTATION_COMPARISON_SETTINGS: EarningsExpectationSettings = {
  revisionReminderThreshold: 0.1,
  nearZeroThreshold: 1e-9,
  roundingTolerance: 1e-9,
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
  return effectiveEarningsExpectationSnapshots(snapshots)
    .map((snapshot) => compareEarningsExpectation(snapshot, events, settings, calculatedAt))
    .sort((left, right) => right.reportPeriod.localeCompare(left.reportPeriod) || left.snapshotId.localeCompare(right.snapshotId));
}

export function compareEarningsExpectation(
  snapshot: EarningsExpectationSnapshot,
  events: ResearchEvent[],
  settings: EarningsExpectationSettings = DEFAULT_EXPECTATION_COMPARISON_SETTINGS,
  calculatedAt = new Date().toISOString(),
): EarningsExpectationComparison {
  const candidates = actualCandidates(snapshot, events);
  const actual = candidates.length
    ? [...candidates].sort((left, right) => actualPriority(right.event) - actualPriority(left.event) || timestamp(right.disclosedAt) - timestamp(left.disclosedAt) || left.event.id.localeCompare(right.event.id))[0]
    : null;
  const actualDisclosureAt = actual?.disclosedAt ?? null;
  const performanceInformationCutoff = performanceCutoff(snapshot, events);
  const beforeActualDisclosure = actualDisclosureAt ? snapshotBeforeCutoff(snapshot, actualDisclosureAt) : null;
  const beforeAnyPerformanceDisclosure = performanceInformationCutoff ? snapshotBeforeCutoff(snapshot, performanceInformationCutoff) : null;
  const comparisonAvailableAt = actualDisclosureAt ? laterTemporal(snapshotAvailableAt(snapshot), actualDisclosureAt) : null;
  const base: EarningsExpectationComparison = {
    ...comparisonBase(snapshot, calculatedAt),
    beforeActualDisclosure,
    beforeAnyPerformanceDisclosure,
    actualDisclosureAt,
    performanceInformationCutoff,
    comparisonAvailableAt,
    isExAnte: beforeAnyPerformanceDisclosure === true,
  };
  const structuralReasons = structuralComparabilityReasons(snapshot);
  if (structuralReasons.length) return notComparable(base, structuralReasons, "口径校验失败，未执行数值比较");

  if (!actual) {
    const related = events.filter((event) => event.stockId === snapshot.stockId && event.reportPeriod === snapshot.reportPeriod);
    const reasons = related.some((event) => event.verificationStatus !== "verified" || !["parse_success", "not_applicable"].includes(event.parseStatus))
      ? ["实际数据解析状态不足"]
      : ["无法匹配实际值"];
    return { ...base, comparisonResult: "insufficient_data", comparabilityStatus: "insufficient_data", nonComparableReasons: reasons, comparisonMethod: "未找到同公司、同报告期、同期间口径和同指标的可靠实际值" };
  }

  const timingReasons = exAnteReasons(snapshot, actualDisclosureAt, performanceInformationCutoff);
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
  if (!previous || current.estimateShape !== previous.estimateShape || correctionBasisChanged(current, previous)) return { direction: null, magnitude: null };
  const currentMid = snapshotMidpoint(current);
  const previousMid = snapshotMidpoint(previous);
  if (currentMid === null || previousMid === null || previousMid === 0 || Math.sign(currentMid) !== Math.sign(previousMid)) return { direction: null, magnitude: null };
  const magnitude = (currentMid - previousMid) / Math.abs(previousMid);
  return { direction: magnitude > 0 ? "up" : magnitude < 0 ? "down" : "unchanged", magnitude };
}

export function expectationGroupKey(snapshot: EarningsExpectationSnapshot) {
  return [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, snapshot.sourceCategory, snapshot.sourceName].join("|");
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
    beforeActualDisclosure: null,
    beforeAnyPerformanceDisclosure: null,
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

function exAnteReasons(snapshot: EarningsExpectationSnapshot, actualDisclosureAt: string | null, performanceInformationCutoff: string | null) {
  const reasons: string[] = [];
  if (!actualDisclosureAt) reasons.push("实际值候选的公开披露时间缺失");
  else if (snapshotBeforeCutoff(snapshot, actualDisclosureAt) !== true) reasons.push(timingFailureReason(snapshot, actualDisclosureAt, "实际值披露"));
  if (!performanceInformationCutoff) reasons.push("同指标业绩信息首次公开披露时间缺失");
  else if (snapshotBeforeCutoff(snapshot, performanceInformationCutoff) !== true) reasons.push(timingFailureReason(snapshot, performanceInformationCutoff, "同指标业绩信息披露"));
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
    if (event.verificationStatus !== "verified" || !["parse_success", "not_applicable"].includes(event.parseStatus)) continue;
    for (const metric of event.metrics) {
      if (!keys.includes(metric.key) || metric.periodBasis !== expectedBasis || metric.value === null || metric.unit !== "CNY") continue;
      candidates.push({ event, metric, actualValue: metric.value, disclosedAt: event.publishedAt ?? event.eventDate });
    }
  }
  return candidates;
}

function performanceCutoff(snapshot: EarningsExpectationSnapshot, events: ResearchEvent[]) {
  const allowedEvents = new Set(["earnings_preview", "earnings_preview_revision", "earnings_flash", "periodic_report", "financial_update"]);
  const keys = new Set(cutoffMetricKeys(snapshot.metric, snapshot.periodScope));
  const disclosures = events
    .filter((event) => event.stockId === snapshot.stockId && event.reportPeriod === snapshot.reportPeriod && allowedEvents.has(event.eventType))
    .filter((event) => event.metrics.some((metric) => keys.has(metric.key) && metric.value !== null))
    .map((event) => event.publishedAt ?? event.eventDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => timestamp(left) - timestamp(right) || left.localeCompare(right));
  return disclosures[0] ?? null;
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

function snapshotBeforeCutoff(snapshot: EarningsExpectationSnapshot, cutoff: string) {
  const formation = snapshot.formedAtPrecision === "datetime" && snapshot.formedAt ? snapshot.formedAt : snapshot.asOfDate;
  const formationPrecision = snapshot.formedAtPrecision === "datetime" && snapshot.formedAt ? "datetime" : "date";
  if (!strictlyBefore(formation, formationPrecision, cutoff)) return false;
  if (snapshot.sourceCategory === "user_estimate") return true;
  if (!snapshot.sourcePublishedAt) return false;
  const sourcePrecision = snapshot.sourcePublishedAtPrecision === "datetime" ? "datetime" : "date";
  return strictlyBefore(snapshot.sourcePublishedAt, sourcePrecision, cutoff);
}

function strictlyBefore(value: string, precision: "date" | "datetime", cutoff: string) {
  const valueDate = value.slice(0, 10);
  const cutoffDate = cutoff.slice(0, 10);
  if (valueDate < cutoffDate) return true;
  if (valueDate > cutoffDate) return false;
  if (precision !== "datetime" || !isExactDateTime(cutoff)) return false;
  return Date.parse(value) < Date.parse(cutoff);
}

function timingFailureReason(snapshot: EarningsExpectationSnapshot, cutoff: string, label: string) {
  const formation = snapshot.formedAtPrecision === "datetime" && snapshot.formedAt ? snapshot.formedAt : snapshot.asOfDate;
  const source = snapshot.sourceCategory === "user_estimate" ? null : snapshot.sourcePublishedAt;
  if (formation.slice(0, 10) === cutoff.slice(0, 10) && (snapshot.formedAtPrecision !== "datetime" || !snapshot.formedAt || !isExactDateTime(cutoff))) return `预期形成时间与${label}同日但缺少双方精确时间，不能证明事前形成`;
  if (source && source.slice(0, 10) === cutoff.slice(0, 10) && (snapshot.sourcePublishedAtPrecision !== "datetime" || !isExactDateTime(cutoff))) return `外部来源与${label}同日但缺少双方精确时间，不能证明事前发布`;
  return `预期形成或外部来源时间不早于${label}`;
}

function snapshotAvailableAt(snapshot: EarningsExpectationSnapshot) {
  const formation = snapshot.formedAtPrecision === "datetime" && snapshot.formedAt ? snapshot.formedAt : snapshot.asOfDate;
  if (snapshot.sourceCategory === "user_estimate" || !snapshot.sourcePublishedAt) return formation;
  return laterTemporal(formation, snapshot.sourcePublishedAt);
}

function laterTemporal(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime)) return right;
  if (Number.isNaN(rightTime)) return left;
  if (leftTime === rightTime) return left.localeCompare(right) >= 0 ? left : right;
  return leftTime > rightTime ? left : right;
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

function snapshotMidpoint(snapshot: EarningsExpectationSnapshot) { if (snapshot.estimateShape === "point") return snapshot.value; return snapshot.lowerBound === null || snapshot.upperBound === null ? null : (snapshot.lowerBound + snapshot.upperBound) / 2; }
function correctionBasisChanged(current: EarningsExpectationSnapshot, previous: EarningsExpectationSnapshot) { return current.currency !== previous.currency || current.unit !== previous.unit || current.accountingBasis !== previous.accountingBasis; }
function actualPriority(event: ResearchEvent) { if (event.eventType === "financial_update") return 3; if (event.eventType === "periodic_report") return 2; return 1; }
function timestamp(value: string | null) { if (!value) return Number.MAX_SAFE_INTEGER; const result = Date.parse(value); return Number.isNaN(result) ? Number.MAX_SAFE_INTEGER : result; }
function isExactDateTime(value: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value)); }
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
