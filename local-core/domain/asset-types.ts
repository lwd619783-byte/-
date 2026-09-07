// Frozen V1 wire shapes. Revision, confirmation and receipt fields below are
// internal Node service/persistence metadata, never extra V1 payload fields.
export interface Money { amount: number; currency: string }
export interface EvidenceRef {
  refType: 'provider_fact' | 'web_source' | 'document' | 'conversation_archive' | 'screenshot' | 'research_note' | 'manual_input';
  refId: string; title?: string; asOf?: string; sourceUrl?: string;
  quality?: 'verified' | 'candidate' | 'partial' | 'stale' | 'unknown';
}
export interface Account {
  schemaVersion: 'account.v1'; accountId: string;
  accountType: 'brokerage' | 'fund' | 'bank' | 'cash' | 'physical_asset' | 'insurance' | 'crypto' | 'other';
  name: string; provider?: string; baseCurrency: string; status: 'active' | 'inactive' | 'archived'; displayOrder?: number;
}
export interface Asset {
  schemaVersion: 'asset.v1'; assetId: string; instrumentId?: string;
  assetType: 'stock' | 'etf' | 'fund' | 'cash' | 'deposit' | 'physical_gold' | 'insurance' | 'crypto' | 'commodity_proxy' | 'other';
  name: string; primaryCategory: string; strategyBucket?: string; tags: string[]; displayOrder: number; userOverrides?: Record<string, unknown>;
}
export interface Transaction {
  schemaVersion: 'transaction.v1'; transactionId: string; accountId: string; assetId: string; tradeDate: string; settleDate?: string;
  side: 'buy' | 'sell' | 'subscribe' | 'redeem' | 'acquire' | 'dispose' | 'adjustment';
  quantity?: number; price?: Money; grossAmount?: Money; fees?: Money; netAmount?: Money;
  source: 'confirmed_screenshot' | 'manual' | 'legacy_import' | 'provider_import'; sourceEvidenceRef?: EvidenceRef;
  reconciliationStatus: 'confirmed' | 'candidate' | 'warning' | 'unreconciled';
}
export interface CashFlow {
  schemaVersion: 'cash-flow.v1'; cashFlowId: string; accountId: string; date: string;
  type: 'external_contribution' | 'external_withdrawal' | 'internal_transfer' | 'dividend' | 'interest' | 'fee' | 'salary' | 'insurance_premium' | 'other';
  amount: Money; pairedTransferId?: string; sourceEvidenceRef?: EvidenceRef; notes?: string;
}
export interface PositionSnapshot {
  schemaVersion: 'position-snapshot.v1'; snapshotId: string; snapshotDate: string; accountId: string; assetId: string;
  quantity: number; marketValue: Money; costBasis?: Money; unrealizedPnl?: Money;
  source: 'confirmed_screenshot' | 'manual' | 'legacy_import' | 'calculated';
}
export interface DcaConstraint { constraintType: string; value?: unknown; effectiveFrom: string; effectiveTo?: string; source?: string }
export interface DcaPlan {
  schemaVersion: 'dca-plan.v1'; planId: string; name: string; assetId?: string; primaryCategory?: string;
  frequency: 'weekly' | 'monthly' | 'custom'; plannedAmount?: Money; status: 'active' | 'paused' | 'archived'; priority?: number;
  activeFrom: string; activeTo?: string; constraints?: DcaConstraint[];
}
export interface DcaExecution {
  schemaVersion: 'dca-execution.v1'; executionId: string; planId: string; period: string;
  plannedAmount: Money; executedAmount: Money; pendingAmount: Money; rolloverFromExecutionId?: string;
  transactionIds?: string[]; status: 'planned' | 'partial' | 'completed' | 'deferred' | 'cancelled'; exceptionReason?: string;
}
export interface DcaRevision { plan: DcaPlan; revision: number }
export interface StoredExecution { execution: DcaExecution; planRevision: number }
export interface LegacyAssetImport {
  schemaVersion: 'legacy-asset-import.v1'; importId: string;
  sourceType: 'chatgpt_library_workbook' | 'chatgpt_library_document' | 'manual_archive'; sourceRefs?: EvidenceRef[];
  baselineDate: string; status: 'prepared' | 'needs_review' | 'ready_to_commit' | 'committed' | 'cancelled';
  candidateCounts: { accounts: number; assets: number; transactions: number; cashFlows: number; positions: number; dcaExecutions: number };
  candidateRefs?: { entityType: string; entityId: string; displayName?: string }[]; warnings?: string[]; userApprovalRef?: string;
}
export interface CandidatePayloads { account: Account; asset: Asset; transaction: Transaction; cash_flow: CashFlow; position_snapshot: PositionSnapshot; dca_execution: DcaExecution }
export type CandidateType = keyof CandidatePayloads;
export interface AssetCandidate {
  candidateId: string; candidateType: CandidateType; confidence: number; payload: Record<string, unknown>;
  sourceEvidenceRefs?: string[]; fingerprint?: string; warnings?: string[];
}
export interface AssetImportBundle {
  schemaVersion: 'asset-import-bundle.v1'; importId: string; asOf: string;
  sourceType: 'chatgpt_screenshot_parse' | 'manual_entry' | 'file_import'; sourceEvidenceRefs?: string[];
  candidates: AssetCandidate[]; declaredExternalContribution?: Money; notes?: string;
}
export interface ImportPlanItem {
  candidateId: string; decision: 'pass' | 'warn' | 'skip_duplicate' | 'needs_resolution' | 'blocked'; summary: string;
  resolvedEntityId?: string; reconciliationDelta?: Money; warnings?: string[];
}
export interface AssetImportPlan {
  schemaVersion: 'asset-import-plan.v1'; planId: string; importId: string; planDigest: string;
  status: 'ready' | 'needs_review' | 'blocked' | 'committed' | 'cancelled'; items: ImportPlanItem[];
  summary?: { externalContribution?: Money; transactionCount?: number; cashFlowCount?: number; positionCount?: number; dcaExecutionCount?: number };
  warnings?: string[];
}
export interface AssetImportCommitRequest {
  schemaVersion: 'asset-import-commit-request.v1'; planId: string; planDigest: string; idempotencyKey: string; userApprovalRef: string;
}
export interface Confirmation { userApprovalRef: string; idempotencyKey: string; actor: string; client: string }
export interface MutationResult { recordIds: string[]; warnings: string[] }
export interface AuthorizedAppend { version: string; id: string; payloadDigest: string; revision?: number }
export interface ConfirmedOperation { operation: string; confirmation: Confirmation; requestDigest: string; auditEventId: string; result: MutationResult; appends: AuthorizedAppend[] }
export interface StoredImportPlan { bundle: AssetImportBundle; plan: AssetImportPlan; stateDigest: string; legacy?: LegacyAssetImport }
export interface ImportFingerprint { key: string; factDigest: string; recordId: string; operationKey: string }

export const candidateVersions: Record<CandidateType, string> = {
  account: 'account.v1', asset: 'asset.v1', transaction: 'transaction.v1', cash_flow: 'cash-flow.v1',
  position_snapshot: 'position-snapshot.v1', dca_execution: 'dca-execution.v1',
};
export function recordId(value: CandidatePayloads[CandidateType]): string {
  switch (value.schemaVersion) {
    case 'account.v1': return value.accountId;
    case 'asset.v1': return value.assetId;
    case 'transaction.v1': return value.transactionId;
    case 'cash-flow.v1': return value.cashFlowId;
    case 'position-snapshot.v1': return value.snapshotId;
    case 'dca-execution.v1': return value.executionId;
  }
}
