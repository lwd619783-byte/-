import type { DecisionSnapshot } from '../../shared/decision-snapshot.mjs';
export interface DecisionBinding { snapshotId: string; digest: string; generation: number; asOf: string }
export interface DecisionStore { get(key: string): Promise<unknown>; versioned(key: string): Promise<{ value: unknown; etag: string } | null>; putNew(key: string, value: unknown): Promise<void>; compareExchange(key: string, etag: string | null, value: unknown): Promise<boolean> }
export function snapshotDigest(value: unknown): string;
export class DecisionStaging {
 constructor(store: DecisionStore, subject: string, now?: () => number, scope?: 'real' | 'synthetic');
 prefix: string;
 publish(input: unknown): Promise<{ binding: DecisionBinding; expiresAt: number; authority: string }>;
 revoke(generation: number): Promise<{ status: string; generation: number }>;
 read(binding?: DecisionBinding): Promise<{ snapshot: DecisionSnapshot; binding: DecisionBinding; expiresAt: number }>;
 status(): Promise<{ generation: number; status: string; binding: DecisionBinding | null; expiresAt: number }>;
}
