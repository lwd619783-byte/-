import type { WatchlistItem } from "../types";

export const watchlist: WatchlistItem[] = [
  {
    id: "watch-sugon",
    stockId: "sugon",
    reason: "国产算力主线核心观察样本。",
    status: "观察",
    trigger: "订单和利润率同时改善。",
    questions: ["国产芯片适配进度是否兑现？", "经营现金流是否跟随收入改善？"],
    nextReviewDate: "2026-07-15",
    latestNote: "示例记录：等待真实公告和财报数据接入。",
  },
  {
    id: "watch-eoptolink",
    stockId: "eoptolink",
    reason: "高速光模块弹性强，但估值和客户集中风险高。",
    status: "等回调",
    trigger: "海外订单延续且估值回到可接受区间。",
    questions: ["1.6T 放量节奏如何？", "价格降幅是否影响毛利率？"],
    nextReviewDate: "2026-07-10",
    latestNote: "示例记录：只作为结构演示。",
  },
  {
    id: "watch-best",
    stockId: "best",
    reason: "机器人丝杠链条早期弹性观察。",
    status: "等业绩验证",
    trigger: "客户定点或量产订单出现披露级证据。",
    questions: ["丝杠收入是否能拆分？", "扩产是否对应真实订单？"],
    nextReviewDate: "2026-08-01",
    latestNote: "示例记录：D/X 线索不得进入长期逻辑。",
  },
  {
    id: "watch-cosco",
    stockId: "cosco-energy",
    reason: "油运周期高位震荡中的现金流和分红观察。",
    status: "已配置",
    trigger: "VLCC 运价维持高位且分红预期稳定。",
    questions: ["供给是否继续受约束？", "地缘事件对航距的影响是否延续？"],
    nextReviewDate: "2026-07-20",
    latestNote: "示例记录：需接入运价和公告源。",
  },
];
