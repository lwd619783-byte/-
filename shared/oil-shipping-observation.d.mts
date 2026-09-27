import type { Stock } from '../src/types';
import type { IndustryMetricDataset } from '../src/types/industryMetric';
export { freightCandidate } from './oil-shipping-scope.mjs';
export interface ObservationPoint { date: string; value: number | null }
export interface ObservationSeries { points: ObservationPoint[]; states: string[]; publication: string | null }
export type ObservationStock = Pick<Stock, 'id' | 'market' | 'dataMode' | 'priceHistory' | 'priceHistorySource'>;
export const observationStateLabels: Record<string, string>;
export function observationWindow(asOf: string, days: number): { start: string; end: string };
export function observationChange(points: ObservationPoint[], periods: number): number | null;
export function observationStreak(points: ObservationPoint[]): { direction: number; count: number };
export function stockObservation(stock: ObservationStock, asOf: string): ObservationSeries;
export function freightObservation(owner: IndustryMetricDataset | null, basis: string, asOf: string): ObservationSeries;
export function normalizeObservationSeries(series: ObservationSeries[], start: string, end: string): { base: string | null; rows: { date: string; values: Array<number | null> }[] };
export function samplePerformance(series: ObservationSeries[], periods: number): { mean: number | null; up: number | null; down: number | null; flat: number | null; states: string[]; availability: string; endpoints: { start: string; end: string } | null };
export function observationRelationship(freight: ObservationSeries, stocks: ObservationSeries[], start: string, end: string): string;
export function observedCompanyCount(stocks: Pick<Stock, 'id' | 'code' | 'market'>[]): number | null;
