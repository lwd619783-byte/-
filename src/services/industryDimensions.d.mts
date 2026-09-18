import type { IndustryMetricPin } from '../types/industryMetric';
import type { IndustryMetricProvider, RegisteredIndustryMetric } from './industryMetricRegistry.mjs';
export type IndustryDimension = 'demand' | 'supply' | 'inventory' | 'price' | 'margin' | 'utilization' | 'capex' | 'policy' | 'valuation' | 'trading_state' | 'trade_flow';
export interface IndustryDimensionEntry { industryId: string; metricId: string; definitionRef: IndustryMetricPin; dimension: IndustryDimension; subdimension?: string }
export interface IndustryDimensions {
  schemaVersion: 'industry-dimension-mapping.v1'; revision: string;
  list(industryId: string): { metric: RegisteredIndustryMetric; mapping: IndustryDimensionEntry }[];
}
export const INDUSTRY_DIMENSIONS: readonly IndustryDimension[];
export const DIMENSION_MAPPING_REVIEWED_SHA256: string;
export function dimensionReviewPayload(mapping: unknown): string;
export function createIndustryDimensions(mapping: unknown, provider: IndustryMetricProvider, hash?: (raw: string) => Promise<string> | string): Promise<IndustryDimensions>;
