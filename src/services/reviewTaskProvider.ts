import type {
  EarningsVerificationChain,
  ResearchEvent,
  ReviewTask,
  ReviewTaskRuleType,
  ReviewTaskState,
  WatchItem,
} from "../types";
import {
  compareBusinessTemporal,
  getCalendarToday,
  isCalendarDate,
  isPreciseInstant,
  resolveTimeZone,
  toBusinessTemporal,
} from "../utils/dateTime";

const PERFORMANCE_RULES: Partial<Record<ResearchEvent["eventType"], ReviewTaskRuleType>> = {
  earnings_preview: "earnings_preview",
  earnings_preview_revision: "earnings_preview_revision",
  earnings_flash: "earnings_flash",
  periodic_report: "periodic_report",
  earnings_expectation_added: "earnings_expectation_added",
  earnings_expectation_comparison_available: "earnings_expectation_comparison",
  earnings_expectation_data_warning: "earnings_expectation_data_warning",
};

const QUALITY_STATUSES = new Set(["metadata_only", "parse_partial", "stale", "missing", "error"]);

export interface ReviewTaskInput {
  watchItems: WatchItem[];
  events: ResearchEvent[];
  chains: EarningsVerificationChain[];
  taskStates: ReviewTaskState[];
  now?: Date;
  longUnreviewedDays?: number;
  expectationRevisionThreshold?: number;
  timeZone?: string;
}

export function buildReviewTasks({
  watchItems,
  events,
  chains,
  taskStates,
  now = new Date(),
  longUnreviewedDays = 90,
  expectationRevisionThreshold = 0.1,
  timeZone = resolveTimeZone(),
}: ReviewTaskInput): ReviewTask[] {
  const tasks: ReviewTask[] = [];
  const today = getCalendarToday(now, timeZone);
  for (const item of watchItems.filter((candidate) => !candidate.archivedAt && candidate.source === "user")) {
    if (item.nextReviewAt === today) {
      tasks.push(task(item, "due_review", item.nextReviewAt, [], "medium", "复盘日期已到", `观察项计划在 ${item.nextReviewAt} 复盘，请由用户主动核验并记录判断。`, item.nextReviewAt));
    } else if (item.nextReviewAt && item.nextReviewAt < today) {
      tasks.push(task(item, "overdue_review", item.nextReviewAt, [], "high", "复盘日期已逾期", `计划复盘日为 ${item.nextReviewAt}，当前尚未记录新的复盘。`, item.nextReviewAt));
    }

    const boundary = item.lastReviewedAt ?? item.createdAt;
    const stockEvents = events.filter((event) => event.stockId === item.stockId && eventAfterBoundary(event, boundary, timeZone));
    for (const event of stockEvents) {
      let ruleType = PERFORMANCE_RULES[event.eventType];
      if (event.eventType === "earnings_expectation_revision") {
        const magnitude = event.expectation?.revisionMagnitude;
        if (magnitude !== null && magnitude !== undefined && Math.abs(magnitude) >= expectationRevisionThreshold) {
          ruleType = magnitude > 0 ? "earnings_expectation_revision_up" : "earnings_expectation_revision_down";
        }
      }
      if (ruleType) {
        tasks.push(task(
          item,
          ruleType,
          event.id,
          [event.id],
          event.eventType === "earnings_preview_revision" || event.eventType === "periodic_report" || event.eventType === "earnings_expectation_comparison_available" ? "high" : "medium",
          performanceTitle(event.eventType),
          expectationTaskDescription(event, expectationRevisionThreshold),
          reviewTaskEventDate(event),
        ));
      }
      if (QUALITY_STATUSES.has(event.parseStatus) || ["stale", "missing", "error"].includes(event.verificationStatus)) {
        tasks.push(task(
          item,
          "data_quality_warning",
          event.id,
          [event.id],
          event.parseStatus === "error" || event.parseStatus === "missing" ? "high" : "medium",
          "本地数据需要人工核验",
          qualityDescription(event),
          event.eventDate ?? event.updatedAt,
        ));
      }
      const divergence = reliableCashFlowDivergence(event);
      if (divergence !== null) {
        tasks.push(task(
          item,
          "cash_flow_profit_divergence",
          event.id,
          [event.id],
          "high",
          "累计经营现金流与累计归母净利润差异较大",
          `同一报告期累计口径下，两项已解析数值的相对差异约为 ${formatPercent(divergence)}。该提示仅用于口径核验，不自动解释为公司经营异常。`,
          event.eventDate ?? event.updatedAt,
        ));
      }
    }

    for (const chain of chains.filter((candidate) => candidate.stockId === item.stockId && candidate.hasMaterialDifference)) {
      const related = [...chain.preview, ...chain.revision, ...chain.flash, ...chain.formal, ...chain.financialUpdates]
        .filter((event) => eventAfterBoundary(event, boundary, timeZone));
      if (!related.length) continue;
      tasks.push(task(
        item,
        "material_difference",
        `${chain.id}:${related.map((event) => event.id).sort().join(",")}`,
        related.map((event) => event.id).sort(),
        "high",
        "业绩验证链存在显著数值差异",
        `报告期 ${chain.reportPeriod} 的预告、快报或正式财务值达到现有验证规则的差异阈值，请打开原始来源核验口径。`,
        latestEventDate(related, timeZone),
      ));
    }

    if (daysBetween(calendarDate(item.lastReviewedAt ?? item.createdAt, timeZone), today) >= longUnreviewedDays) {
      tasks.push(task(
        item,
        "long_unreviewed",
        calendarDate(item.lastReviewedAt ?? item.createdAt, timeZone),
        [],
        "medium",
        "观察项长期未复盘",
        `距离上次复盘或创建已达到 ${longUnreviewedDays} 天，请主动确认原投资假设是否仍需跟踪。`,
        today,
      ));
    }
  }

  const states = new Map(taskStates.map((state) => [state.taskId, state]));
  const unique = new Map(tasks.map((item) => [item.id, applyState(item, states.get(item.id), now, timeZone)]));
  return [...unique.values()].sort((left, right) => severityRank(right.severity) - severityRank(left.severity)
    || (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")
    || left.id.localeCompare(right.id));
}

export function stableReviewTaskId(watchItemId: string, ruleType: ReviewTaskRuleType, discriminator: string) {
  const raw = `${watchItemId}|${ruleType}|${discriminator}`;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `review-task-${(hash >>> 0).toString(36)}`;
}

function task(
  item: WatchItem,
  ruleType: ReviewTaskRuleType,
  discriminator: string,
  relatedEventIds: string[],
  severity: ReviewTask["severity"],
  title: string,
  description: string,
  dueAt: string | null,
): ReviewTask {
  return {
    id: stableReviewTaskId(item.id, ruleType, discriminator),
    watchItemId: item.id,
    ruleType,
    relatedEventIds,
    createdAt: dueAt ?? item.updatedAt,
    dueAt,
    severity,
    title,
    description,
    status: "pending",
    acknowledgedAt: null,
    dismissedAt: null,
    snoozedUntil: null,
  };
}

function applyState(taskValue: ReviewTask, state: ReviewTaskState | undefined, now: Date, timeZone: string): ReviewTask {
  if (!state) return taskValue;
  if (state.status === "snoozed" && state.snoozedUntil && state.snoozedUntil <= getCalendarToday(now, timeZone)) return taskValue;
  return {
    ...taskValue,
    status: state.status,
    acknowledgedAt: state.acknowledgedAt,
    dismissedAt: state.dismissedAt,
    snoozedUntil: state.snoozedUntil,
  };
}

function reliableCashFlowDivergence(event: ResearchEvent): number | null {
  if (event.eventType !== "financial_update" || ["error", "missing", "stale"].includes(event.parseStatus)) return null;
  const cash = event.metrics.find((metric) => metric.key === "netOperatingCashFlow" && metric.periodBasis === "cumulative" && metric.unit === "CNY")?.value;
  const profit = event.metrics.find((metric) => metric.key === "netProfitAttributableToParent" && metric.periodBasis === "cumulative" && metric.unit === "CNY")?.value;
  if (cash === null || cash === undefined || profit === null || profit === undefined || profit === 0) return null;
  const ratio = Math.abs(cash - profit) / Math.abs(profit);
  return ratio >= 0.5 ? ratio : null;
}

function qualityDescription(event: ResearchEvent) {
  const label = ({
    metadata_only: "仅取得元数据",
    parse_partial: "正文仅部分解析",
    stale: "本地数据已过时",
    missing: "本地数据缺失",
    error: "本地加载或解析出错",
  } as Record<string, string>)[event.parseStatus] ?? `证据状态为 ${event.verificationStatus}`;
  return `本地数据状态：${label}。这不等同于公司没有披露，请打开官方来源人工核验。`;
}

function performanceTitle(eventType: ResearchEvent["eventType"]) {
  return ({
    earnings_preview: "公司发布新的业绩预告",
    earnings_preview_revision: "公司发布业绩预告修正",
    earnings_flash: "公司发布业绩快报",
    periodic_report: "公司发布正式定期报告",
    earnings_expectation_added: "新增业绩预期快照",
    earnings_expectation_revision: "业绩预期出现修订",
    earnings_expectation_comparison_available: "实际业绩与预期比较可复盘",
    earnings_expectation_data_warning: "业绩预期证据需要核验",
  } as Record<string, string>)[eventType] ?? "公司发布新的业绩事件";
}

function expectationTaskDescription(event: ResearchEvent, threshold: number) {
  if (!event.eventType.startsWith("earnings_expectation")) return `公司新增正式披露事件“${event.title}”，请结合报告期 ${event.reportPeriod ?? "暂缺"} 主动复盘。`;
  const category = ({ company_guidance: "公司指引", institution_single: "单家机构预测", institution_consensus: "机构一致预期", user_estimate: "用户个人预测" } as Record<string, string>)[event.expectation?.sourceCategory ?? ""] ?? "业绩预期";
  if (event.eventType === "earnings_expectation_revision") return `${category}修订幅度达到 ${(threshold * 100).toFixed(0)}% 工作流提醒阈值。该阈值不是投资结论或行业标准，请核对来源和口径。`;
  if (event.eventType === "earnings_expectation_comparison_available") return `${category}已与同报告期可靠实际值形成比较，请打开来源和计算详情完成复盘；不自动生成买卖建议。`;
  if (event.eventType === "earnings_expectation_data_warning") return `报告期 ${event.reportPeriod ?? "暂缺"} 的${category}存在来源或可比性缺口，需要人工核验。`;
  return `新增${category}快照，请核对报告期、期间口径、指标、币种、单位和来源。`;
}

function eventTimestamp(event: ResearchEvent) {
  return event.publishedAt ?? event.eventDate ?? event.updatedAt ?? "";
}

function reviewTaskEventDate(event: ResearchEvent) {
  return event.publishedAt ?? event.eventDate ?? event.updatedAt;
}

function latestEventDate(events: ResearchEvent[], timeZone: string) {
  const dates = events.map(eventTimestamp).sort((left, right) => compareTemporal(left, right, timeZone));
  return dates[dates.length - 1] ?? null;
}

function eventAfterBoundary(event: ResearchEvent, boundary: string, timeZone: string) {
  return compareTemporal(eventTimestamp(event), boundary, timeZone) > 0;
}

function compareTemporal(left: string, right: string, timeZone: string) {
  const leftValue = isPreciseInstant(left) ? toBusinessTemporal(left, "datetime", timeZone) : isCalendarDate(left) ? toBusinessTemporal(left, "date", timeZone) : null;
  const rightValue = isPreciseInstant(right) ? toBusinessTemporal(right, "datetime", timeZone) : isCalendarDate(right) ? toBusinessTemporal(right, "date", timeZone) : null;
  if (!leftValue || !rightValue) return left.localeCompare(right);
  return compareBusinessTemporal(leftValue, rightValue).order;
}

function calendarDate(value: string, timeZone: string) {
  const fallback = value;
  if (isCalendarDate(value)) return value;
  if (isPreciseInstant(value)) return toBusinessTemporal(value, "datetime", timeZone)?.calendarDate ?? fallback.slice(0, 10);
  return fallback.slice(0, 10);
}

function daysBetween(value: string, today: string) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  const current = Date.parse(`${today}T00:00:00.000Z`);
  return Number.isNaN(timestamp) || Number.isNaN(current) ? 0 : Math.floor((current - timestamp) / 86_400_000);
}

function severityRank(value: ReviewTask["severity"]) {
  return ({ low: 1, medium: 2, high: 3 })[value];
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
