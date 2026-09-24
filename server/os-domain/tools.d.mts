import type { DecisionStaging } from './staging.mjs';
export const domainToolSchemas: Record<string, { parse(value: unknown): unknown }>;
export function callDomainTool(staging: DecisionStaging, name: string, input: unknown): Promise<unknown>;
