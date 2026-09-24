export type AccountStatus = 'active' | 'inactive' | 'archived';
export interface Receipt { recordedAt: string; operationKey: string; auditEventId: string; payloadDigest: string }
export interface PortfolioInput {
  schemaVersion: 'portfolio-input.v1'; scope: 'real' | 'synthetic';
  accounts: { accountId: string; name: string; status: AccountStatus; receipt: Receipt }[];
  assets: { assetId: string; name: string; assetType: string; primaryCategory: string; strategyBucket: string | null; instrumentId: string | null; receipt: Receipt }[];
  snapshots: { snapshotId: string; snapshotDate: string; accountId: string; assetId: string; quantity: number; marketValue: number; currency: string; receipt: Receipt; warnings: string[] }[];
}
export interface PortfolioPosition { positionId: string; accountId: string; accountName: string; accountStatus: AccountStatus; assetId: string; assetName: string; assetType: string; primaryCategory: string; strategyBucket: string | null; instrumentId: string | null; snapshotId: string; snapshotDate: string; quantity: number; marketValue: number; currency: string; blockers: string[]; lineage: { snapshot: Receipt; account: Receipt; asset: Receipt } }
export type Dimension = 'accountId' | 'assetId' | 'assetType' | 'primaryCategory' | 'strategyBucket' | 'currency';
export interface Exposure { dimension: Dimension; value: string | null; marketValue: number; share: number | null; positionIds: string[] }
export interface PortfolioProjection { integrity: { version: 'portfolio-integrity.v1'; canonicalPayload: string }; schemaVersion: 'portfolio-projection.v1'; methodology: 'portfolio-exposure.v1'; scope: 'real' | 'synthetic'; asOf: string; status: 'partial' | 'unresolved' | 'conflicted'; positions: PortfolioPosition[]; cohorts: { currency: string; snapshotDate: string; total: number; exposures: Exposure[]; blockers: string[] }[]; blockers: string[]; denominator: 'recorded_positions_only' }
export const methodology: 'portfolio-exposure.v1';
export const dimensions: Dimension[];
export const portfolioInputSchema: { parse(value: unknown): PortfolioInput };
export function projectPortfolio(input: unknown, asOf: string): PortfolioProjection;
export function positionIdentity(accountId: string, assetId: string): string;
export function sumAmounts(values: number[]): number;
export const portfolioProjectionSchema: { parse(value: unknown): PortfolioProjection };
export function validateProjection(value: unknown): PortfolioProjection;
