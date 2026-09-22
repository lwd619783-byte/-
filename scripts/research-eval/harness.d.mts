export interface EvalResult {
  outcome: string; selectedRefs: string[]; citationRefs: string[]; conditions: string[];
  value: number | null; unit: string | null; exAnte: boolean | null; reproducible: boolean | null;
}
export function evaluateRequest(target: {
  targetId: string; targetVersion: string; targetKind: 'deterministic_service'; supportedOperations: string[];
  execute(payload: { operation: string; request: unknown; input: unknown }): Promise<EvalResult> | EvalResult;
}, payload: { operation: string; request: unknown; input: unknown }, expected: EvalResult): Promise<{ status: string; actual: EvalResult | null; semanticDiff: unknown[] }>;
