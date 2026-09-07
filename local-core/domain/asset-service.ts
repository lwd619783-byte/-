import type { ContractRegistry, LocalDatabase, TransactionRepositories } from '../ports/index.js';
import type { Account, Asset, AssetCandidate, AuthorizedAppend, CandidatePayloads, CandidateType, CashFlow, Confirmation, DcaExecution, DcaPlan, MutationResult, PositionSnapshot, Transaction } from './asset-types.js';
import { candidateVersions, recordId } from './asset-types.js';
import { checked, digest, externalContributions, positionWarnings, readAssetState, resolveAsset, validateDcaPlan, validateRecord, validateTransferPairs } from './asset-invariants.js';
import type { AssetState } from './asset-invariants.js';
import { canonicalJson } from './canonical-json.js';
import { fail } from './errors.js';

export function requireConfirmation(value: Confirmation): Confirmation {
  const copy = JSON.parse(canonicalJson(value)) as Confirmation;
  if (!copy || !['userApprovalRef', 'idempotencyKey', 'actor', 'client'].every(k => typeof copy[k as keyof Confirmation] === 'string' && copy[k as keyof Confirmation].trim()) || Object.keys(copy).some(k => !['userApprovalRef', 'idempotencyKey', 'actor', 'client'].includes(k))) fail('APPROVAL_REQUIRED', 'Approved user reference, idempotency key and operator identity are required.');
  return copy;
}
// Shared domain orchestration inside the existing synchronous transaction. The
// preparation callback is read-only and supplies the exact audited mutation set.
export function confirmedMutation(repositories: TransactionRepositories, operation: string, confirmation: Confirmation, request: unknown,
  prepare: () => { result: MutationResult; appends: AuthorizedAppend[]; write: () => void }): MutationResult {
  const c = requireConfirmation(confirmation);
  const requestDigest = digest({ operation, request, confirmation: c });
  const previous = repositories.ledger.operation(c.idempotencyKey);
  if (previous) {
    if (previous.requestDigest !== requestDigest) fail('IDEMPOTENCY_CONFLICT', 'Idempotency key was already bound to different approved content.');
    return previous.result;
  }
  const { result, appends, write } = prepare();
  const audit = repositories.audit.append({ schemaVersion: 'bridge-audit-event.v1', requestId: c.idempotencyKey, timestamp: new Date().toISOString(),
    actor: c.actor, actorType: 'user', client: c.client, operation, confirmationState: 'approved', scope: c.userApprovalRef,
    idempotencyKey: c.idempotencyKey, success: true });
  repositories.ledger.appendOperation({ operation, confirmation: c, requestDigest, auditEventId: audit.eventId, result, appends });
  write();
  return result;
}

export interface ValidatedRecord { type: CandidateType; value: CandidatePayloads[CandidateType]; revision?: number }
export function authorizeRecord(item: ValidatedRecord): AuthorizedAppend {
  return { version: item.value.schemaVersion, id: recordId(item.value), payloadDigest: digest(item.value), ...(item.revision ? { revision: item.revision } : {}) };
}
export function addToState(state: AssetState, item: ValidatedRecord): void {
  switch (item.type) {
    case 'account': state.accounts.push(item.value as Account); break;
    case 'asset': state.assets.push(item.value as Asset); break;
    case 'transaction': state.transactions.push(item.value as Transaction); break;
    case 'cash_flow': state.cashFlows.push(item.value as CashFlow); break;
    case 'position_snapshot': state.positions.push(item.value as PositionSnapshot); break;
    case 'dca_execution': state.executions.push({ execution: item.value as DcaExecution, planRevision: item.revision! }); break;
  }
}
export function officialRecords(state: AssetState, type: CandidateType): CandidatePayloads[CandidateType][] {
  switch (type) {
    case 'account': return state.accounts;
    case 'asset': return state.assets;
    case 'transaction': return state.transactions;
    case 'cash_flow': return state.cashFlows;
    case 'position_snapshot': return state.positions;
    case 'dca_execution': return state.executions.map(v => v.execution);
  }
}
export function appendRecord(repositories: TransactionRepositories, item: ValidatedRecord, key: string): void {
  const r = repositories.ledger;
  switch (item.type) {
    case 'account': r.createAccount(item.value as Account, key); break;
    case 'asset': r.createAsset(item.value as Asset, key); break;
    case 'transaction': r.appendTransaction(item.value as Transaction, key); break;
    case 'cash_flow': r.appendCashFlow(item.value as CashFlow, key); break;
    case 'position_snapshot': r.appendPosition(item.value as PositionSnapshot, key); break;
    case 'dca_execution': r.appendDcaExecution({ execution: item.value as DcaExecution, planRevision: item.revision! }, key); break;
  }
}
// Retain all value-bearing fields; exclude mutable import identity/provenance
// only for duplicate detection, never from the official payload or plan digest.
export function factDigest(value: CandidatePayloads[CandidateType]): string {
  const copy = { ...value } as Record<string, unknown>;
  for (const k of ['transactionId', 'cashFlowId', 'snapshotId', 'executionId', 'source', 'sourceEvidenceRef', 'notes']) delete copy[k];
  return digest(copy);
}
export function duplicateKeys(type: CandidateType, value: CandidatePayloads[CandidateType], candidate?: AssetCandidate, bundleEvidence: string[] = []): string[] {
  const fact = factDigest(value);
  const keys = [`id:${type}:${recordId(value)}`];
  if (candidate?.fingerprint?.trim()) keys.push(`fingerprint:${type}:${digest(candidate.fingerprint)}`);
  const evidence = new Set([...bundleEvidence, ...(candidate?.sourceEvidenceRefs ?? []), ...('sourceEvidenceRef' in value && value.sourceEvidenceRef ? [value.sourceEvidenceRef.refId] : [])]);
  for (const ref of [...evidence].sort()) keys.push(`evidence:${type}:${digest(ref)}:${fact}`);
  return keys;
}
export function registerRecord(repositories: TransactionRepositories, item: ValidatedRecord, key: string, candidate?: AssetCandidate, evidence: string[] = []): void {
  for (const fingerprint of duplicateKeys(item.type, item.value, candidate, evidence)) repositories.ledger.appendFingerprint({ key: fingerprint, factDigest: factDigest(item.value), recordId: recordId(item.value), operationKey: key });
}

// Trusted local operator service; no authentication or AI tool surface is
// created. Future adapters must bind approval refs to an actual user ceremony.
export class AssetService {
  constructor(private readonly database: LocalDatabase, private readonly contracts: ContractRegistry, private readonly now: () => string = () => new Date().toISOString()) {}
  private create(type: CandidateType, input: unknown, confirmation: Confirmation, operation: string, allowPositionWarning = false): MutationResult {
    const value = checked<CandidatePayloads[CandidateType]>(this.contracts, candidateVersions[type], input);
    const c = requireConfirmation(confirmation);
    return this.database.transaction(repositories => confirmedMutation(repositories, operation, c, value, () => {
      const state = readAssetState(repositories.ledger);
      if ('tradeDate' in value && value.tradeDate > this.now().slice(0, 10)) fail('LEDGER_INVALID', 'A future plan cannot be recorded as an actual transaction.');
      if (officialRecords(state, type).some(v => recordId(v) === recordId(value))) fail('LEDGER_INVALID', 'Stable record ID already exists.');
      const validation = validateRecord(type, value, state, repositories.entities, this.contracts);
      if (validation.warnings.length && !allowPositionWarning) fail('RECONCILIATION_REQUIRED', 'Official write requires resolved reconciliation.');
      const item: ValidatedRecord = { type, value, ...(validation.revision ? { revision: validation.revision } : {}) };
      for (const key of duplicateKeys(type, value)) if (repositories.ledger.fingerprint(key)) fail('LEDGER_INVALID', 'Duplicate official fact requires review.');
      return { result: { recordIds: [recordId(value)], warnings: validation.warnings }, appends: [authorizeRecord(item)], write: () => { appendRecord(repositories, item, c.idempotencyKey); registerRecord(repositories, item, c.idempotencyKey); } };
    }));
  }
  createAccount(value: Account, confirmation: Confirmation): MutationResult { return this.create('account', value, confirmation, 'account.create'); }
  createAsset(value: Asset, confirmation: Confirmation): MutationResult { return this.create('asset', value, confirmation, 'asset.create'); }
  createTransaction(value: Transaction, confirmation: Confirmation): MutationResult {
    if (value.source !== 'manual') fail('LEDGER_INVALID', 'Manual creation accepts manual facts; file and screenshot records require import prepare.');
    return this.create('transaction', value, confirmation, 'transaction.manual_create');
  }
  createCashFlows(input: CashFlow[], confirmation: Confirmation): MutationResult {
    const values = input.map(v => checked<CashFlow>(this.contracts, 'cash-flow.v1', v));
    const c = requireConfirmation(confirmation);
    if (!values.length || new Set(values.map(v => v.cashFlowId)).size !== values.length) fail('LEDGER_INVALID', 'CashFlow batch requires unique records.');
    return this.database.transaction(repositories => confirmedMutation(repositories, 'cashflow.manual_create', c, values, () => {
      const state = readAssetState(repositories.ledger);
      for (const value of values) {
        if (state.cashFlows.some(v => v.cashFlowId === value.cashFlowId) || duplicateKeys('cash_flow', value).some(k => repositories.ledger.fingerprint(k))) fail('LEDGER_INVALID', 'CashFlow already exists.');
        validateRecord('cash_flow', value, state, repositories.entities, this.contracts);
      }
      validateTransferPairs([...state.cashFlows, ...values]);
      return { result: { recordIds: values.map(v => v.cashFlowId), warnings: [] }, appends: values.map(value => authorizeRecord({ type: 'cash_flow', value })), write: () => {
        for (const value of values) { const item: ValidatedRecord = { type: 'cash_flow', value }; appendRecord(repositories, item, c.idempotencyKey); registerRecord(repositories, item, c.idempotencyKey); }
      } };
    }));
  }
  createPosition(value: PositionSnapshot, confirmation: Confirmation): MutationResult { return this.create('position_snapshot', value, confirmation, 'position_snapshot.create', true); }
  commitDcaExecution(value: DcaExecution, confirmation: Confirmation): MutationResult { return this.create('dca_execution', value, confirmation, 'dca_execution.commit'); }
  saveDcaPlan(input: DcaPlan, expectedRevision: number, confirmation: Confirmation): MutationResult {
    const plan = checked<DcaPlan>(this.contracts, 'dca-plan.v1', input), c = requireConfirmation(confirmation);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('LEDGER_INVALID', 'DCA expected revision must be a nonnegative integer.');
    return this.database.transaction(repositories => confirmedMutation(repositories, 'dca_plan.revise', c, { plan, expectedRevision }, () => {
      const state = readAssetState(repositories.ledger);
      validateDcaPlan(plan, state);
      if (plan.assetId) resolveAsset(state.assets.find(a => a.assetId === plan.assetId)!, repositories.entities, this.contracts);
      const previous = state.revisions.filter(v => v.plan.planId === plan.planId).at(-1);
      if ((previous?.revision ?? 0) !== expectedRevision) fail('IMPORT_PLAN_STALE', 'DCA expected revision is stale.');
      if (previous) {
        if (plan.activeFrom <= previous.plan.activeFrom || plan.activeFrom <= this.now().slice(0, 10)) fail('LEDGER_INVALID', 'New DCA revision must begin in the future and after the previous revision.');
        if (plan.constraints?.some(v => v.effectiveFrom < plan.activeFrom && !previous.plan.constraints?.some(old => canonicalJson(old) === canonicalJson(v)))) fail('LEDGER_INVALID', 'Changed constraints cannot change earlier cycles; unchanged historical constraints may be retained.');
        const priorDates = state.executions.filter(v => v.execution.planId === plan.planId).flatMap(v => v.execution.transactionIds ?? []).map(id => state.transactions.find(t => t.transactionId === id)!.tradeDate);
        if (priorDates.some(date => date >= plan.activeFrom)) fail('LEDGER_INVALID', 'Revision would change an already recorded execution interval.');
      }
      return { result: { recordIds: [plan.planId], warnings: [] }, appends: [{ version: plan.schemaVersion, id: plan.planId, payloadDigest: digest(plan), revision: expectedRevision + 1 }], write: () => repositories.ledger.appendDcaRevision({ plan, revision: expectedRevision + 1 }, c.idempotencyKey) };
    }));
  }
  externalContributions(): ReturnType<typeof externalContributions> {
    return this.database.transaction(({ ledger }) => externalContributions(ledger.cashFlows()));
  }
  reconcilePosition(id: string): string[] {
    return this.database.transaction(({ ledger }) => {
      const snapshot = ledger.positions().find(v => v.snapshotId === id) ?? fail('RECORD_NOT_FOUND', 'Snapshot does not exist.');
      return positionWarnings(snapshot, ledger.transactions());
    });
  }
}
