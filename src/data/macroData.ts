import type { MacroIndicator } from "../types";
import generatedMacro from "./real/macro.generated.json";

type GeneratedMacroData = {
  updatedAt?: string;
  sourceSummary?: string[];
  errors?: string[];
  indicators?: MacroIndicator[];
};

const fallbackUpdatedAt = "2026-06-30 20:00";
const fallbackSourceNote = "示例数据 / 待接入真实数据源；数值仅用于结构演示，不代表实时行情或投资建议。";

const fallbackMacroIndicators: MacroIndicator[] = [
  {
    id: "macro-cycle",
    category: "宏观环境",
    name: "增长与价格组合",
    currentStatus: "弱复苏观察期，价格弹性仍需验证",
    trend: "待验证",
    marketImpact: "偏利好低估值修复和政策受益链条，但需要盈利数据确认。",
    trackingIndicators: ["GDP", "PMI", "CPI", "PPI", "社融", "M2"],
    metrics: [
      { label: "GDP", value: "X", note: "待接入统计局数据" },
      { label: "PMI", value: "X", note: "待接入官方 PMI" },
      { label: "CPI/PPI", value: "X", note: "待接入口径" },
    ],
  },
  {
    id: "liquidity",
    category: "流动性",
    name: "资金与利率环境",
    currentStatus: "流动性中性偏宽，结构性资金分化",
    trend: "震荡",
    marketImpact: "有助于主题扩散，但高估值资产仍受盈利兑现约束。",
    trackingIndicators: ["10Y 国债", "汇率", "ETF 资金", "融资余额", "北向资金"],
    metrics: [
      { label: "利率", value: "X", note: "待接入债券行情" },
      { label: "汇率", value: "X", note: "待接入外汇行情" },
      { label: "ETF 资金", value: "X", note: "待接入交易所数据" },
    ],
  },
  {
    id: "policy",
    category: "政策窗口",
    name: "会议与产业政策",
    currentStatus: "等待政策落地和订单兑现",
    trend: "上行",
    marketImpact: "对 AI、机器人、创新药出海和高端制造的风险偏好有支撑。",
    trackingIndicators: ["重要会议", "财政支出", "货币政策", "产业政策细则"],
    metrics: [
      { label: "会议", value: "跟踪中", note: "待接入政策原文" },
      { label: "财政", value: "X", note: "待接入财政数据" },
      { label: "产业", value: "跟踪中", note: "按行业拆解" },
    ],
  },
  {
    id: "style",
    category: "市场风格",
    name: "风格与主题活跃度",
    currentStatus: "科技成长与高股息轮动，主题拥挤度需监控",
    trend: "震荡",
    marketImpact: "适合用相对强度和成交结构过滤主线，避免只按题材追高。",
    trackingIndicators: ["成长/价值", "大小盘", "高股息", "科技成长", "主题活跃度"],
    metrics: [
      { label: "成长/价值", value: "轮动", note: "示例状态" },
      { label: "大小盘", value: "分化", note: "示例状态" },
      { label: "主题活跃", value: "中", note: "示例状态" },
    ],
  },
];

const realMacro = generatedMacro as GeneratedMacroData;
const hasRealMacro = Boolean(realMacro.indicators?.length);

export const dataUpdatedAt = hasRealMacro ? realMacro.updatedAt ?? fallbackUpdatedAt : fallbackUpdatedAt;
export const dataSourceNote = hasRealMacro
  ? `宏观数据：AKShare 本地生成 JSON；覆盖 ${realMacro.sourceSummary?.length ?? 0} 个宏观接口；错误 ${realMacro.errors?.length ?? 0} 个。`
  : fallbackSourceNote;

export const macroIndicators: MacroIndicator[] = hasRealMacro ? realMacro.indicators ?? fallbackMacroIndicators : fallbackMacroIndicators;
