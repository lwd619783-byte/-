import type {
  EarningsVerificationChain,
  ResearchEvent,
  ReviewTask,
  ReviewTaskRuleType,
  ReviewTaskState,
  WatchItem,
} from "../types";

const PERFORMANCE_RULES: Partial<Record<ResearchEvent["eventType"], ReviewTaskRuleType>> = {
  earnings_preview: "earnings_preview",
  earnings_preview_revision: "earnings_preview_revision",
  earnings_flash: "earnings_flash",
  periodic_report: "periodic_report",
};

const QUALITY_STATUSES = new Set(["metadata_only", "parse_partial", "stale", "missing", "error"]);

export interface ReviewTaskInput {
  watchItems: WatchItem[];
  events: ResearchEvent[];
  chains: EarningsVerificationChain[];
  taskStates: ReviewTaskState[];
  now?: Date;
  longUnreviewedDays?: number;
}

export function buildReviewTasks({
  watchItems,
  events,
  chains,
  taskStates,
  now = new Date(),
  longUnreviewedDays = 90,
}: ReviewTaskInput): ReviewTask[] {
  const tasks: ReviewTask[] = [];
  const today = dateOnly(now);
  for (const item of watchItems.filter((candidate) => !candidate.archivedAt && candidate.source === "user")) {
    if (item.nextReviewAt === today) {
      tasks.push(task(item, "due_review", item.nextReviewAt, [], "medium", "复盘日期已到", `观察项计划在 ${item.nextReviewAt} 复盘，请由用户主动核验并记录判断。`, item.nextReviewAt));
    } else if (item.nextReviewAt && item.nextReviewAt < today) {
      tasks.push(task(item, "overdue_review", item.nextReviewAt, [], "high", "复盘日期已逾期", `计划复盘日为 ${item.nextReviewAt}，当前尚未记录新的复盘。`, item.nextReviewAt));
    }

    const boundary = item.lastReviewedAt ?? item.createdAt;
    const stockEvents = events.filter((event) => event.stockId === item.stockId && eventTimestamp(event) > boundary);
    for (const event of stockEvents) {
      const ruleType = PERFORMANCE_RULES[event.eventType];
      if (ruleType) {
        tasks.push(task(
          item,
          ruleType,
          event.id,
          [event.id],
          event.eventType === "earnings_preview_revision" || event.eventType === "periodic_report" ? "high" : "medium",
          performanceTitle(event.eventType),
          `公司新增正式披露事件“${event.title}”，请结合报告期 ${event.reportPeriod ?? "暂缺"} 主动复盘。`,
          event.eventDate ?? event.publishedAt,
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
        .filter((event) => eventTimestamp(event) > boundary);
      if (!related.length) continue;
      tasks.push(task(
        item,
        "material_difference",
        `${chain.id}:${related.map((event) => event.id).sort().join(",")}`,
        related.map((event) => event.id).sort(),
        "high",
        "业绩验证链存在显著数值差异",
        `报告期 ${chain.reportPeriod} 的预告、快报或正式财务值达到现有验证规则的差异阈值，请打开原始来源核验口径。`,
        latestEventDate(related),
      ));
    }

    if (daysBetween(item.lastReviewedAt ?? item.createdAt, now) >= longUnreviewedDays) {
      tasks.push(task(
        item,
        "long_unreviewed",
        dateOnly(new Date(item.lastReviewedAt ?? item.createdAt)),
        [],
        "medium",
        "观察项长期未复盘",
        `距离上次复盘或创建已达到 ${longUnreviewedDays} 天，请主动确认原投资假设是否仍需跟踪。`,
        today,
      ));
    }
  }

  const states = new Map(taskStates.map((state) => [state.taskId, state]));
  const unique = new Map(tasks.map((item) => [item.id, applyState(item, states.get(item.id), now)]));
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

function applyState(taskValue: ReviewTask, state: ReviewTaskState | undefined, now: Date): ReviewTask {
  if (!state) return taskValue;
  if (state.status === "snoozed" && state.snoozedUntil && state.snoozedUntil <= dateOnly(now)) return taskValue;
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
  } as Record<string, string>)[eventType] ?? "公司发布新的业绩事件";
}

function eventTimestamp(event: ResearchEvent) {
  return event.publishedAt ?? event.eventDate ?? event.updatedAt ?? "";
}

function latestEventDate(events: ResearchEvent[]) {
  const dates = events.map(eventTimestamp).sort();
  return dates[dates.length - 1] ?? null;
}

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(value: string, now: Date) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : Math.floor((now.getTime() - timestamp) / 86_400_000);
}

function severityRank(value: ReviewTask["severity"]) {
  return ({ low: 1, medium: 2, high: 3 })[value];
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
