export const errorCodes = [
  'CONTRACT_INVALID', 'SCHEMA_VERSION_UNSUPPORTED', 'MIGRATION_CHECKSUM_MISMATCH',
  'DATABASE_OPEN_FAILED', 'DATABASE_INTEGRITY_FAILED', 'ENTITY_NOT_FOUND',
  'ENTITY_NEEDS_CONFIRMATION', 'ENTITY_CONFLICTED', 'ENTITY_DUPLICATE_IDENTIFIER',
  'AUDIT_APPEND_FAILED', 'TRANSACTION_ROLLED_BACK',
  'APPROVAL_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'LEDGER_INVALID', 'RECONCILIATION_REQUIRED',
  'IMPORT_PLAN_STALE', 'IMPORT_NOT_READY', 'RECORD_NOT_FOUND', 'CONTRACT_GAP',
] as const;
export type ErrorCode = typeof errorCodes[number];

// Diagnostics deliberately exclude raw driver messages, paths and input payloads.
export class LocalCoreError extends Error {
  readonly name = 'LocalCoreError';
  constructor(readonly code: ErrorCode, message: string, readonly reasonCode?: ErrorCode) {
    super(message);
  }
}

export function fail(code: ErrorCode, message: string): never {
  throw new LocalCoreError(code, message);
}
