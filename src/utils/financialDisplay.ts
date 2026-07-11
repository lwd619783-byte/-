import type { DashboardDataMode, FinancialChangeMetric, FinancialFetchStatus, Market } from "../types";

const MISSING = "暂未获取";

export function resolveFinancialDisplayValue({
  mode,
  realValue,
  status,
  mockValue,
  formatter = String,
}: {
  mode: DashboardDataMode;
  realValue: number | null | undefined;
  status?: FinancialFetchStatus | "not_implemented";
  mockValue: string;
  formatter?: (value: number) => string;
}) {
  if (mode === "mock") return mockValue;
  if (realValue !== null && realValue !== undefined && Number.isFinite(realValue)) return formatter(realValue);
  if (status === "not_applicable") return "不适用";
  if (status === "fetch_error" || status === "validation_error" || status === "source_unavailable") return "数据获取失败";
  if (status === "stale") return "数据已过期";
  if (status === "not_implemented") return "暂未接入";
  return MISSING;
}

export function financialUnavailableLabel(market: Market, status?: FinancialFetchStatus | "not_implemented") {
  if (market === "港股" && status === "not_implemented") return "港股财务数据暂未接入";
  if (status === "fetch_error" || status === "validation_error" || status === "source_unavailable") return "财务数据获取失败";
  if (status === "stale") return "财务数据已过期";
  if (status === "not_applicable") return "财务数据不适用";
  return MISSING;
}

export function formatFinancialAmount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(2)} 亿元`;
  if (absolute >= 10_000) return `${(value / 10_000).toFixed(2)} 万元`;
  return `${value.toFixed(2)} 元`;
}

export function formatFinancialRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${(value * 100).toFixed(2)}%`;
}

export function formatFinancialChangeMetric(metric: FinancialChangeMetric | null | undefined) {
  if (!metric || metric.reason === "missing_value") return MISSING;
  if (metric.reason === "denominator_zero" || metric.baseSign === "zero") return "基数为 0，百分比不适用";
  if (metric.value === null || !Number.isFinite(metric.value)) return MISSING;
  const percentage = formatFinancialRatio(metric.value);
  return metric.baseSign === "negative" ? `${percentage}（上期为负，需谨慎解读）` : percentage;
}

export function financialChangeTone(metric: FinancialChangeMetric | null | undefined): "neutral" | "warning" | "positive" | "negative" {
  if (!metric || metric.reason || metric.value === null) return metric?.reason === "denominator_zero" ? "warning" : "neutral";
  if (metric.baseSign === "negative" || metric.baseSign === "zero") return "warning";
  return metric.value >= 0 ? "positive" : "negative";
}

export function displayFinancialField(value: number | null | undefined, status?: string, percentage = false) {
  if (status === "not_applicable") return "不适用";
  return percentage ? formatFinancialRatio(value) : formatFinancialAmount(value);
}

export function financialStatusLabel(status?: string) {
  if (status === "stale") return "数据已过期";
  if (status === "fetch_error" || status === "source_unavailable" || status === "validation_error") return "数据获取失败";
  if (status === "partial") return "部分字段可用";
  if (status === "not_applicable") return "不适用";
  if (status === "success") return "真实数据可用";
  if (status === "not_implemented") return "暂未接入";
  return MISSING;
}
