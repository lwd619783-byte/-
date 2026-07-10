import type { DataQualityMeta } from "../../types";
import type { DataSourceStatus, EvidenceSourceType } from "../../types/dataSource";
import { StatusBadge } from "./StatusBadge";

const priority: Array<DataSourceStatus | EvidenceSourceType> = [
    "error", "conflicted", "stale", "not_implemented", "missing", "source_unavailable", "partial", "manual_unverified",
    "inferred", "unknown", "manual_verified", "generated_real", "real", "static_reference", "mock", "placeholder",
];

export function getHighestRiskStatus(quality?: DataQualityMeta[]) {
  return priority.find((candidate) => quality?.some((item) => item.status === candidate)) ?? "mock";
}

export function DataQualityBadge({ quality }: { quality?: DataQualityMeta[] }) {
  const status = getHighestRiskStatus(quality);
  return <StatusBadge status={status} />;
}
