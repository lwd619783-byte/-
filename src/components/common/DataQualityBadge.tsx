import type { DataQualityMeta } from "../../types";
import { StatusBadge } from "./StatusBadge";

export function DataQualityBadge({ quality }: { quality?: DataQualityMeta[] }) {
  const status = quality?.find((item) => item.status === "error" || item.status === "not_implemented" || item.status === "missing")?.status
    ?? quality?.find((item) => item.status === "real")?.status
    ?? quality?.[0]?.status
    ?? "mock";
  return <StatusBadge status={status} />;
}
