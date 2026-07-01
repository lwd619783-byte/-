import type { DataQualityMeta } from "../types/dataSource";

export function isMissingValue(value: unknown) {
  return value === null || value === undefined || value === "" || value === "N/A" || value === "数据暂缺";
}

export function countMissingFields(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([, value]) => isMissingValue(value))
    .map(([key]) => key);
}

export function dataModeLabel(quality: DataQualityMeta[]) {
  const statuses = new Set(quality.map((item) => item.status));
  if (statuses.size === 0 || (statuses.size === 1 && statuses.has("mock"))) return "Mock Data";
  if (statuses.size === 1 && statuses.has("real")) return "Real Data";
  if (statuses.size === 1 && statuses.has("unsupported_market")) return "Mixed Data";
  return "Mixed Data";
}

export function isRecentlyUpdated(updatedAt: string | null | undefined, now = new Date(), thresholdHours = 24) {
  if (!updatedAt) return false;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return false;
  const diffHours = (now.getTime() - date.getTime()) / 36e5;
  return diffHours >= 0 && diffHours <= thresholdHours;
}

export function formatMissing(value: string | number | null | undefined, suffix = "") {
  if (isMissingValue(value)) return "数据暂缺";
  return `${value}${suffix}`;
}

export function mergeQuality(...groups: Array<DataQualityMeta | DataQualityMeta[] | undefined>) {
  return groups.flatMap((group) => (Array.isArray(group) ? group : group ? [group] : []));
}
