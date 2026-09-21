import type { ResearchEvent } from "../types";

/** Existing global review-queue selection, shared by its presentation surfaces. */
export function needsDataReview(event: ResearchEvent) {
  return event.eventType === "data_warning" || event.eventType === "earnings_expectation_data_warning"
    || ["parse_partial", "metadata_only", "parse_unavailable", "missing", "stale", "error"].includes(event.parseStatus)
    || event.metrics.some((metric) => metric.value === null)
    || event.reviewReasons.some((reason) => reason.includes("无法匹配"));
}
