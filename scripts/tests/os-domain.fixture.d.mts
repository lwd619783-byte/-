import type { DecisionStore } from '../../server/os-domain/staging.mjs';
import type { DecisionSnapshot } from '../../shared/decision-snapshot.mjs';
export class DecisionTestStore implements DecisionStore {
 values: Map<string, unknown>;
 get(key: string): Promise<unknown>;
 versioned(key: string): Promise<{ value: unknown; etag: string } | null>;
 putNew(key: string, value: unknown): Promise<void>;
 compareExchange(key: string, etag: string | null, value: unknown): Promise<boolean>;
}
export function emptyDecisionFixture(now?: number): DecisionSnapshot;
export const domainTestEnv: Record<string, string>;
