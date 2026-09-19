import type { IndustryMetricDataset, IndustryMetricObservation } from '../types/industryMetric';
export interface IndustryHistoryPoint { period: string; value: number | null; records: IndustryMetricObservation[]; states: string[] }
export function industryHistory(owner: IndustryMetricDataset, basis: string): {
  history: IndustryHistoryPoint[]; latest: IndustryHistoryPoint | null; previous: IndustryHistoryPoint | null;
  delta: number | null; states: string[]; available: number; target: number; rejectedCount: number;
};
