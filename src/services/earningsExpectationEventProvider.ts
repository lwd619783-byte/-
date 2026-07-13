import type { EarningsExpectationComparison, EarningsExpectationSnapshot, ResearchEvent, Stock } from "../types";
import { comparisonResultLabel, expectationGroupKey, expectationRevision, sourceCategoryLabel } from "./earningsExpectationComparisonProvider";

export function buildEarningsExpectationResearchEvents(
  snapshots: EarningsExpectationSnapshot[],
  comparisons: EarningsExpectationComparison[],
  stocks: Stock[],
  revisionReminderThreshold = 0.1,
): ResearchEvent[] {
  const events: ResearchEvent[] = [];
  const comparisonBySnapshot = new Map(comparisons.map((comparison) => [comparison.snapshotId, comparison]));
  const history = new Map<string, EarningsExpectationSnapshot[]>();
  for (const snapshot of [...snapshots].sort((left, right) => left.asOfDate.localeCompare(right.asOfDate) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))) {
    const stock = stocks.find((item) => item.id === snapshot.stockId);
    if (!stock) continue;
    const key = expectationGroupKey(snapshot);
    const previousHistory = history.get(key) ?? [];
    const previous = previousHistory[previousHistory.length - 1];
    const revision = expectationRevision(snapshot, previous);
    const isRevision = Boolean(previous || snapshot.correctsSnapshotId);
    events.push(snapshotEvent(stock, snapshot, isRevision, revision, revisionReminderThreshold));
    history.set(key, [...(history.get(key) ?? []), snapshot]);

    const comparison = comparisonBySnapshot.get(snapshot.id);
    if (comparison?.comparabilityStatus === "comparable") {
      events.push(comparisonEvent(stock, snapshot, comparison));
    } else if (comparison) {
      events.push(warningEvent(stock, snapshot, comparison));
    } else if (snapshot.sourceVerificationStatus !== "verified") {
      events.push(warningEvent(stock, snapshot, null));
    }
  }
  return dedupe(events).sort((left, right) => eventTime(right).localeCompare(eventTime(left)) || left.id.localeCompare(right.id));
}

function snapshotEvent(
  stock: Stock,
  snapshot: EarningsExpectationSnapshot,
  isRevision: boolean,
  revision: ReturnType<typeof expectationRevision>,
  revisionReminderThreshold: number,
): ResearchEvent {
  const type = isRevision ? "earnings_expectation_revision" : "earnings_expectation_added";
  const category = sourceCategoryLabel(snapshot.sourceCategory);
  const reasons = snapshot.sourceVerificationStatus === "verified" ? [] : ["预期来源待核验"];
  return {
    ...base(stock, snapshot),
    id: `expectation-event:${snapshot.id}:${type}`,
    eventType: type,
    title: `${category}${isRevision ? "修订" : "新增"} · ${metricLabel(snapshot.metric)}`,
    summary: `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}；${formatExpectation(snapshot)}。${snapshot.sourceCategory === "user_estimate" ? "该记录为用户个人预测，不代表机构观点。" : ""}`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: reasons.length ? "pending" : "not_required",
    reviewReasons: reasons,
    materiality: isRevision && revision.magnitude !== null && Math.abs(revision.magnitude) >= revisionReminderThreshold ? "high" : "medium",
    expectation: payload(snapshot, null, revision),
  };
}

function comparisonEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison): ResearchEvent {
  return {
    ...base(stock, snapshot),
    id: `expectation-event:${snapshot.id}:comparison:${comparison.actualEventId ?? "missing"}`,
    eventType: "earnings_expectation_comparison_available",
    eventDate: comparison.calculatedAt.slice(0, 10),
    publishedAt: comparison.calculatedAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}比较结果可用 · ${metricLabel(snapshot.metric)}`,
    summary: `${comparisonResultLabel(comparison, snapshot)}；${comparison.comparisonMethod}。${comparison.isExAnte ? "事前有效快照。" : "仅作事后参考或口径核验。"}`,
    verificationStatus: comparison.comparabilityStatus === "comparable" ? "verified" : "partial",
    reviewStatus: "pending",
    reviewReasons: comparison.nonComparableReasons,
    materiality: comparison.comparisonResult === "above" || comparison.comparisonResult === "below" ? "high" : "medium",
    expectation: payload(snapshot, comparison, { direction: null, magnitude: null }),
  };
}

function warningEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null): ResearchEvent {
  const reasons = comparison?.nonComparableReasons.length ? comparison.nonComparableReasons : ["预期来源待核验"];
  return {
    ...base(stock, snapshot),
    id: `expectation-event:${snapshot.id}:warning:${stableHash(reasons.join("|"))}`,
    eventType: "earnings_expectation_data_warning",
    title: `业绩预期数据需要核验 · ${metricLabel(snapshot.metric)}`,
    summary: reasons.join("；"),
    verificationStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    parseStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "not_applicable",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: payload(snapshot, comparison, { direction: null, magnitude: null }),
  };
}

function base(stock: Stock, snapshot: EarningsExpectationSnapshot): ResearchEvent {
  return {
    id: "",
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "earnings_expectation_added",
    eventDate: snapshot.asOfDate,
    publishedAt: snapshot.sourcePublishedAt ?? snapshot.asOfDate,
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

function payload(snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null, revision: ReturnType<typeof expectationRevision>) {
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
    comparisonResult: comparison?.comparisonResult ?? null,
    sourceVerificationStatus: snapshot.sourceVerificationStatus,
    revisionDirection: revision.direction,
    revisionMagnitude: revision.magnitude,
  };
}

function dedupe(events: ResearchEvent[]) { return [...new Map(events.map((event) => [event.id, event])).values()]; }
function eventTime(event: ResearchEvent) { return event.publishedAt ?? event.eventDate ?? event.updatedAt ?? ""; }
function metricLabel(metric: EarningsExpectationSnapshot["metric"]) { return ({ revenue: "营业收入", attributable_net_profit: "归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益", operating_cash_flow: "经营现金流" })[metric]; }
function periodScopeLabel(scope: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[scope]; }
function formatExpectation(snapshot: EarningsExpectationSnapshot) { const suffix = snapshot.metric === "eps" ? `${snapshot.currency}/股` : unitLabel(snapshot.unit); return snapshot.estimateShape === "point" ? `点预测 ${snapshot.value ?? "缺失"} ${suffix}` : `区间 ${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${suffix}`; }
function unitLabel(unit: EarningsExpectationSnapshot["unit"]) { return ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[unit]; }
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
