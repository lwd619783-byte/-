import { createHash } from 'node:crypto';
import type { ContractRegistry, EntityRepository } from '../ports/index.js';
import type { AssetReads } from '../ports/asset-ports.js';
import type { Account, Asset, CandidatePayloads, CandidateType, CashFlow, DcaExecution, DcaPlan, DcaRevision, Money, PositionSnapshot, StoredExecution, Transaction } from './asset-types.js';
import { canonicalJson } from './canonical-json.js';
import { fail } from './errors.js';
import { V1EntityResolver } from './resolver.js';

export const digest = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
export function checked<T>(contracts: ContractRegistry, version: string, value: unknown): T {
  const copy = JSON.parse(canonicalJson(value)) as T;
  contracts.validate(version, copy);
  return copy;
}
// Exact arithmetic over the supplied decimal representation. No invented
// currency precision, rounding policy, or epsilon used to force reconciliation.
type Decimal = { units: bigint; scale: number };
function decimal(value: number): Decimal {
  if (!Number.isFinite(value)) fail('LEDGER_INVALID', 'Finite amounts are required.');
  const [base = '', exponent = '0'] = String(value).toLowerCase().split('e');
  const scale = (base.split('.')[1]?.length ?? 0) - Number(exponent);
  const units = BigInt(base.replace('.', ''));
  return scale < 0 ? { units: units * 10n ** BigInt(-scale), scale: 0 } : { units, scale };
}
function sum(values: Decimal[]): Decimal {
  const scale = Math.max(0, ...values.map(v => v.scale));
  return { units: values.reduce((total, v) => total + v.units * 10n ** BigInt(scale - v.scale), 0n), scale };
}
export function amountsEqual(left: number[], right: number[]): boolean {
  return sum([...left.map(decimal), ...right.map(v => { const d = decimal(v); return { ...d, units: -d.units }; })]).units === 0n;
}
export function amountSum(values: number[]): number {
  const d = sum(values.map(decimal));
  const negative = d.units < 0n;
  const digits = (negative ? -d.units : d.units).toString().padStart(d.scale + 1, '0');
  const value = Number(`${negative ? '-' : ''}${d.scale ? `${digits.slice(0, -d.scale)}.${digits.slice(-d.scale)}` : digits}`);
  if (!Number.isFinite(value)) fail('RECONCILIATION_REQUIRED', 'Summary amount is not representable.');
  return value;
}
function productEquals(a: number, b: number, total: number): boolean {
  const x = decimal(a), y = decimal(b), z = decimal(total);
  return sum([{ units: x.units * y.units, scale: x.scale + y.scale }, { ...z, units: -z.units }]).units === 0n;
}
export const inflowSides = ['buy', 'subscribe', 'acquire'];
function nonnegative(value: number | undefined): void { if (value !== undefined && (!Number.isFinite(value) || value < 0)) fail('LEDGER_INVALID', 'Absolute quantities and DCA amounts must be nonnegative.'); }
function sameCurrency(values: Money[]): boolean { return new Set(values.map(v => v.currency)).size <= 1; }
export interface AssetState {
  accounts: Account[]; assets: Asset[]; transactions: Transaction[]; cashFlows: CashFlow[];
  positions: PositionSnapshot[]; revisions: DcaRevision[]; executions: StoredExecution[];
}
export function readAssetState(reads: AssetReads): AssetState {
  return { accounts: reads.accounts(), assets: reads.assets(), transactions: reads.transactions(), cashFlows: reads.cashFlows(),
    positions: reads.positions(), revisions: reads.dcaRevisions(), executions: reads.dcaExecutions() };
}
export function requireAccount(state: AssetState, id: string): Account {
  return state.accounts.find(v => v.accountId === id) ?? fail('RECORD_NOT_FOUND', 'Account reference is unresolved.');
}
export function requireAsset(state: AssetState, id: string): Asset {
  return state.assets.find(v => v.assetId === id) ?? fail('RECORD_NOT_FOUND', 'Asset reference is unresolved.');
}
export function resolveAsset(asset: Asset, entities: EntityRepository, contracts: ContractRegistry): string | undefined {
  if (asset.instrumentId === undefined) return undefined; // Non-security assets need no invented instrument.
  const entry = entities.get(asset.instrumentId);
  if (entry.entityType !== 'instrument' || entry.status !== 'active') fail('ENTITY_NEEDS_CONFIRMATION', 'Asset instrument must be an active instrument identity.');
  const result = new V1EntityResolver(entities, contracts).resolve({ schemaVersion: 'entity-resolution-request.v1', requestId: asset.assetId,
    rawName: entry.canonicalName, expectedEntityTypes: ['instrument'],
    ...(entry.exchange ? { exchangeHint: entry.exchange } : {}), ...(entry.ticker ? { tickerHint: entry.ticker } : {}) });
  if (result.status === 'conflicted') fail('ENTITY_CONFLICTED', 'Asset identity conflicts with the registry.');
  if (result.status !== 'resolved' || result.resolvedEntityId !== entry.entityId) fail('ENTITY_NEEDS_CONFIRMATION', 'Asset identity needs resolution.');
  return entry.entityId;
}
export function transactionWarnings(value: Transaction): string[] {
  nonnegative(value.quantity);
  const money = [value.price, value.grossAmount, value.fees, value.netAmount].filter((v): v is Money => v !== undefined);
  money.forEach(v => nonnegative(v.amount));
  if (value.reconciliationStatus !== 'confirmed') fail('LEDGER_INVALID', 'Only confirmed transactions can enter the ledger.');
  if (value.sourceEvidenceRef && value.sourceEvidenceRef.quality !== 'verified') fail('RECONCILIATION_REQUIRED', 'Transaction evidence has not been verified.');
  if (value.source === 'confirmed_screenshot' && (!value.sourceEvidenceRef || value.sourceEvidenceRef.refType !== 'screenshot')) fail('RECONCILIATION_REQUIRED', 'Confirmed screenshot requires its verified screenshot evidence.');
  const warnings: string[] = [];
  if (!sameCurrency(money)) warnings.push('TRANSACTION_CURRENCY_CONFLICT');
  if (value.quantity !== undefined && value.price && value.grossAmount && !productEquals(value.quantity, value.price.amount, value.grossAmount.amount)) warnings.push('TRANSACTION_GROSS_MISMATCH');
  if (value.grossAmount && value.netAmount) {
    if (value.side === 'adjustment') warnings.push('ADJUSTMENT_DIRECTION_UNSPECIFIED');
    else if (value.fees) {
      const direction = inflowSides.includes(value.side) ? 1 : -1;
      if (!amountsEqual([value.grossAmount.amount, direction * value.fees.amount], [value.netAmount.amount])) warnings.push('TRANSACTION_NET_MISMATCH');
    } else if (!amountsEqual([value.grossAmount.amount], [value.netAmount.amount])) warnings.push('TRANSACTION_FEES_UNKNOWN');
  }
  return warnings;
}
export function validateCashFlow(value: CashFlow): void {
  const positive = ['external_contribution', 'dividend', 'interest', 'salary'];
  const negative = ['external_withdrawal', 'fee', 'insurance_premium'];
  if ((positive.includes(value.type) && value.amount.amount <= 0) || (negative.includes(value.type) && value.amount.amount >= 0)) fail('LEDGER_INVALID', 'CashFlow sign must follow the account perspective.');
  if (value.type === 'internal_transfer') {
    if (!value.pairedTransferId?.trim() || value.amount.amount === 0) fail('RECONCILIATION_REQUIRED', 'Internal transfer requires a nonzero amount and pair ID.');
  } else if (value.pairedTransferId !== undefined) fail('LEDGER_INVALID', 'Only internal transfer records can have pairedTransferId.');
  if (value.sourceEvidenceRef && value.sourceEvidenceRef.quality !== 'verified') fail('RECONCILIATION_REQUIRED', 'CashFlow evidence has not been verified.');
}
export function validateTransferPairs(values: CashFlow[]): void {
  const pairs = new Map<string, CashFlow[]>();
  for (const value of values) {
    validateCashFlow(value);
    if (value.type === 'internal_transfer') pairs.set(value.pairedTransferId!, [...(pairs.get(value.pairedTransferId!) ?? []), value]);
  }
  for (const pair of pairs.values()) {
    const [a, b] = pair;
    if (pair.length !== 2 || !a || !b || a.accountId === b.accountId || a.amount.currency !== b.amount.currency || a.amount.amount * b.amount.amount >= 0 || !amountsEqual([a.amount.amount, b.amount.amount], [])) fail('RECONCILIATION_REQUIRED', 'Internal transfer pair must balance in the same currency across two accounts; fees are separate.');
  }
}
export function externalContributions(values: CashFlow[]): Money[] {
  const groups = new Map<string, number[]>();
  for (const flow of values.filter(v => v.type === 'external_contribution')) groups.set(flow.amount.currency, [...(groups.get(flow.amount.currency) ?? []), flow.amount.amount]);
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amounts]) => ({ currency, amount: amountSum(amounts) }));
}
export function positionWarnings(value: PositionSnapshot, transactions: Transaction[]): string[] {
  nonnegative(value.quantity);
  const relevant = transactions.filter(t => t.accountId === value.accountId && t.assetId === value.assetId && t.tradeDate <= value.snapshotDate);
  if (!relevant.length || relevant.some(t => t.quantity === undefined || t.side === 'adjustment')) return ['POSITION_LEDGER_QUANTITY_UNAVAILABLE'];
  return amountsEqual(relevant.map(t => (inflowSides.includes(t.side) ? 1 : -1) * t.quantity!), [value.quantity]) ? [] : ['POSITION_LEDGER_MISMATCH'];
}
export function validateDcaPlan(plan: DcaPlan, state: AssetState): void {
  if (!plan.assetId?.trim() && !plan.primaryCategory?.trim()) fail('LEDGER_INVALID', 'DCA plan requires assetId or primaryCategory.');
  if (plan.assetId !== undefined) requireAsset(state, plan.assetId);
  nonnegative(plan.plannedAmount?.amount);
  if (plan.activeTo && plan.activeTo < plan.activeFrom) fail('LEDGER_INVALID', 'DCA active date interval is invalid.');
  for (const constraint of plan.constraints ?? []) {
    if (constraint.effectiveTo && constraint.effectiveTo < constraint.effectiveFrom) fail('LEDGER_INVALID', 'Constraint effective interval is invalid.');
  }
}
export function validateExecution(execution: DcaExecution, state: AssetState): number {
  const amounts = [execution.plannedAmount, execution.executedAmount, execution.pendingAmount];
  amounts.forEach(v => nonnegative(v.amount));
  if (!sameCurrency(amounts)) fail('RECONCILIATION_REQUIRED', 'DCA currencies conflict.');
  const revisions = state.revisions.filter(v => v.plan.planId === execution.planId);
  if (!revisions.length) fail('RECORD_NOT_FOUND', 'DCA plan does not exist.');
  if (execution.status === 'completed' && (execution.executedAmount.amount <= 0 || execution.pendingAmount.amount !== 0)) fail('LEDGER_INVALID', 'Completed execution requires an actual positive subscription and no pending amount.');
  if (['planned', 'deferred', 'cancelled'].includes(execution.status) && execution.executedAmount.amount !== 0) fail('LEDGER_INVALID', 'Unexecuted status cannot claim a fill.');
  if (execution.status === 'partial' && (execution.executedAmount.amount <= 0 || execution.pendingAmount.amount <= 0)) fail('LEDGER_INVALID', 'Partial execution requires both filled and pending amounts.');
  const ids = execution.transactionIds ?? [];
  if (new Set(ids).size !== ids.length) fail('LEDGER_INVALID', 'DCA transaction links must be unique.');
  const linked = ids.map(id => state.transactions.find(v => v.transactionId === id) ?? fail('RECORD_NOT_FOUND', 'DCA transaction reference is unresolved.'));
  if (state.executions.some(v => v.execution.transactionIds?.some(id => ids.includes(id)))) fail('LEDGER_INVALID', 'A transaction cannot fund multiple DCA executions.');
  let revision: DcaRevision | undefined;
  if (linked.length) {
    const selected = linked.map(t => {
      const applicable = revisions.filter(r => r.plan.activeFrom <= t.tradeDate).at(-1);
      return applicable && (!applicable.plan.activeTo || t.tradeDate <= applicable.plan.activeTo) ? applicable : undefined;
    });
    revision = selected[0];
    if (!revision || selected.some(r => r?.revision !== revision?.revision)) fail('RECONCILIATION_REQUIRED', 'DCA transactions do not identify one effective plan revision.');
    if (linked.some(t => !inflowSides.includes(t.side) || (revision!.plan.assetId ? t.assetId !== revision!.plan.assetId : requireAsset(state, t.assetId).primaryCategory !== revision!.plan.primaryCategory))) fail('RECONCILIATION_REQUIRED', 'DCA transaction asset or direction does not match the plan.');
    if (linked.some(t => !t.netAmount || t.netAmount.currency !== execution.executedAmount.currency) || !amountsEqual(linked.map(t => t.netAmount!.amount), [execution.executedAmount.amount])) fail('RECONCILIATION_REQUIRED', 'DCA actual amount cannot reconcile to its linked transaction net amounts.');
  } else {
    // period is a NonEmptyString, not a frozen date grammar. Do not silently
    // select latest rules for an undated execution after a revision.
    if (revisions.length !== 1) fail('CONTRACT_GAP', 'V1 undated DCA execution cannot select an effective revision after a rule change.');
    revision = revisions[0]!;
  }
  if (execution.rolloverFromExecutionId) {
    const old = state.executions.find(v => v.execution.executionId === execution.rolloverFromExecutionId)?.execution;
    if (!old || old.planId !== execution.planId || old.pendingAmount.amount <= 0 || old.pendingAmount.currency !== execution.pendingAmount.currency || old.period === execution.period || state.executions.some(v => v.execution.rolloverFromExecutionId === old.executionId)) fail('RECONCILIATION_REQUIRED', 'Rollover must refer to one prior pending execution of the same plan and currency.');
    // No budget formula is invented: V1 does not define whether plannedAmount
    // includes the rollover. The explicit link is preserved, never cash flow.
  }
  return revision.revision;
}
export function validateRecord(type: CandidateType, value: CandidatePayloads[CandidateType], state: AssetState, entities: EntityRepository, contracts: ContractRegistry): { warnings: string[]; entityId?: string; revision?: number } {
  let warnings: string[] = [], entityId: string | undefined, revision: number | undefined;
  switch (type) {
    case 'account': break;
    case 'asset': entityId = resolveAsset(value as Asset, entities, contracts); break;
    case 'transaction': {
      const t = value as Transaction; requireAccount(state, t.accountId); entityId = resolveAsset(requireAsset(state, t.assetId), entities, contracts);
      warnings = transactionWarnings(t); break;
    }
    case 'cash_flow': { const c = value as CashFlow; requireAccount(state, c.accountId); validateCashFlow(c); break; }
    case 'position_snapshot': {
      const p = value as PositionSnapshot; requireAccount(state, p.accountId); entityId = resolveAsset(requireAsset(state, p.assetId), entities, contracts);
      warnings = positionWarnings(p, state.transactions); break;
    }
    case 'dca_execution': revision = validateExecution(value as DcaExecution, state); break;
  }
  return { warnings, ...(entityId ? { entityId } : {}), ...(revision ? { revision } : {}) };
}
