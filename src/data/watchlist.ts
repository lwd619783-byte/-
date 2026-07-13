import type { WatchItem } from "../types";

const SAMPLE_TIMESTAMP = "2026-07-01T00:00:00.000Z";

/**
 * Explicit templates only. They are never included in user state or KPIs until
 * the user chooses to copy one into the local watchlist.
 */
export const watchlistSamples: WatchItem[] = [
  {
    id: "sample-sugon",
    stockId: "sugon",
    createdAt: SAMPLE_TIMESTAMP,
    updatedAt: SAMPLE_TIMESTAMP,
    status: "观察",
    priority: "high",
    tags: ["示例", "国产算力"],
    reason: "示例：跟踪国产算力主线中的订单、利润率与现金流验证。",
    thesis: "订单兑现与盈利质量同步改善，才支持进一步提高关注级别。",
    validationCriteria: ["正式披露中的订单或收入兑现", "累计经营现金流与利润口径同步改善"],
    riskCriteria: ["收入增长但现金流持续恶化", "关键适配或交付节奏低于公司披露计划"],
    nextReviewAt: "2026-07-15",
    lastReviewedAt: null,
    archivedAt: null,
    source: "sample",
    schemaVersion: 2,
  },
  {
    id: "sample-eoptolink",
    stockId: "eoptolink",
    createdAt: SAMPLE_TIMESTAMP,
    updatedAt: SAMPLE_TIMESTAMP,
    status: "等回调",
    priority: "medium",
    tags: ["示例", "高速光模块"],
    reason: "示例：业务弹性较强，同时关注估值与客户集中风险。",
    thesis: "新增产品放量需要由正式财务数据和公司披露交叉验证。",
    validationCriteria: ["高速产品收入贡献获得正式披露", "毛利率与费用率没有明显恶化"],
    riskCriteria: ["价格下降导致盈利质量持续承压", "客户集中风险上升"],
    nextReviewAt: "2026-07-10",
    lastReviewedAt: null,
    archivedAt: null,
    source: "sample",
    schemaVersion: 2,
  },
];
