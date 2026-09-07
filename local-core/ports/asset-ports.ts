import type { Account, Asset, Transaction, CashFlow, PositionSnapshot, DcaRevision, StoredExecution, ConfirmedOperation, StoredImportPlan, ImportFingerprint } from '../domain/asset-types.js';

export interface AssetReads {
  accounts(): Account[];
  assets(): Asset[];
  transactions(): Transaction[];
  cashFlows(): CashFlow[];
  positions(): PositionSnapshot[];
  dcaRevisions(): DcaRevision[];
  dcaExecutions(): StoredExecution[];
  operation(key: string): ConfirmedOperation | undefined;
  importPlan(id: string): StoredImportPlan | undefined;
  fingerprint(key: string): ImportFingerprint | undefined;
}
// Internal Node port; never exposed to AI / browser. Only scoped to the existing
// LocalDatabase transaction. Every official append references an approved receipt.
export interface AssetRepository extends AssetReads {
  createAccount(value: Account, operationKey: string): void;
  createAsset(value: Asset, operationKey: string): void;
  appendTransaction(value: Transaction, operationKey: string): void;
  appendCashFlow(value: CashFlow, operationKey: string): void;
  appendPosition(value: PositionSnapshot, operationKey: string): void;
  appendDcaRevision(value: DcaRevision, operationKey: string): void;
  appendDcaExecution(value: StoredExecution, operationKey: string): void;
  appendOperation(value: ConfirmedOperation): void;
  saveImportPlan(value: StoredImportPlan): void;
  appendFingerprint(value: ImportFingerprint): void;
}
