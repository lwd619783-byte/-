import type { IndustryMetricDataset, IndustryMetricPin } from '../types/industryMetric';
export interface IndustryMetricRegistryEntry {
  metricId: string; industryId: string;
  definitionRef: IndustryMetricPin; artifactRef: IndustryMetricPin; bindingRef: IndustryMetricPin; policyRef: IndustryMetricPin;
  presentation: { delta: 'absolute_difference' | 'none'; note: string; basisLabels: Record<string, string> };
}
export interface RegisteredIndustryMetric { entry: IndustryMetricRegistryEntry; owner: IndustryMetricDataset; binding: unknown }
export interface IndustryMetricProvider {
  list(industryId: string): RegisteredIndustryMetric[];
  get(industryId: string, metricId: string): RegisteredIndustryMetric | null;
}
export function createIndustryMetricProvider(registry: unknown, resources: { path: string; raw: string }[], digest?: (raw: string) => Promise<string> | string): Promise<IndustryMetricProvider>;
