import type { ContractRegistry, LocalDatabase, TransactionRepositories } from '../ports/index.js';
import type { AssetCandidate, AssetImportBundle, AssetImportCommitRequest, AssetImportPlan, CandidatePayloads, Confirmation, ImportPlanItem, HistoricalAssetImport, ImportOperation, LegacyAssetImport, MutationResult, StoredImportPlan } from './asset-types.js';
import { candidateVersions, recordId } from './asset-types.js';
import { amountSum, amountsEqual, checked, digest, externalContributions, ledgerBaselineDate as baselineDate, readAssetState, requireObservedFactDate, validateRecord, validateTransferPairs } from './asset-invariants.js';
import { addToState, appendRecord, authorizeRecord, confirmedMutation, duplicateKeys, factDigest, officialRecords, registerRecord, requireConfirmation } from './asset-service.js';
import type { ValidatedRecord } from './asset-service.js';
import { canonicalJson } from './canonical-json.js';
import { fail, LocalCoreError } from './errors.js';
import { historicalCandidate, reconcileAccountValues, resolveImportEvidence } from './import-evidence.js';
import { unavailableImportTrust } from '../ports/import-trust.js';
import type { ImportTrust } from '../ports/import-trust.js';

const order = { account: 0, asset: 1, transaction: 2, cash_flow: 3, position_snapshot: 4, dca_execution: 5 };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
interface Planned { stored: StoredImportPlan; records: { candidate: AssetCandidate; record: ValidatedRecord }[] }

export class AssetImportService {
  constructor(private readonly database: LocalDatabase, private readonly contracts: ContractRegistry, private readonly now: () => string = () => new Date().toISOString(), private readonly trust: ImportTrust = unavailableImportTrust) {}
  private bundle(input: AssetImportBundle): AssetImportBundle {
    const bundle = checked<AssetImportBundle>(this.contracts, 'asset-import-bundle.v1', input);
    if (Date.parse(bundle.asOf) > Date.parse(this.now())) fail('LEDGER_INVALID', 'Import observation cannot be in the future.');
    if (new Set(bundle.candidates.map(v => v.candidateId)).size !== bundle.candidates.length) fail('CONTRACT_INVALID', 'Candidate IDs must be unique within an import.');
    bundle.candidates.sort((a, b) => order[a.candidateType] - order[b.candidateType] || compare(a.candidateId, b.candidateId));
    return bundle;
  }
  private metadata<T extends LegacyAssetImport | HistoricalAssetImport>(input: T, bundle: AssetImportBundle): T {
    const value = checked<T>(this.contracts, input.schemaVersion, input);
    if (value.importId !== bundle.importId || value.baselineDate !== baselineDate || !['prepared', 'needs_review', 'ready_to_commit'].includes(value.status) || value.userApprovalRef !== undefined) fail('LEDGER_INVALID', 'Import metadata must be uncommitted and match the bundle and frozen baseline.');
    const counts = { accounts: 0, assets: 0, transactions: 0, cashFlows: 0, positions: 0, dcaExecutions: 0 };
    const names = { account: 'accounts', asset: 'assets', transaction: 'transactions', cash_flow: 'cashFlows', position_snapshot: 'positions', dca_execution: 'dcaExecutions' } as const;
    for (const c of bundle.candidates) counts[names[c.candidateType]] += 1;
    if (canonicalJson(counts) !== canonicalJson(value.candidateCounts)) fail('LEDGER_INVALID', 'Metadata candidate counts must exactly match the candidate bundle.');
    return value;
  }
  private plan(repositories: TransactionRepositories, bundle: AssetImportBundle, legacy?: LegacyAssetImport, historical?: HistoricalAssetImport, prepared?: StoredImportPlan): Planned {
    if (legacy) this.metadata(legacy, bundle);
    if (historical) this.metadata(historical, bundle);
    const operation: ImportOperation = historical ? 'historical_asset_import.commit' : legacy ? 'legacy_asset_import.commit' : 'asset_import.commit';
    const evidence = resolveImportEvidence(bundle, historical, this.trust);
    const initial = readAssetState(repositories.ledger);
    const stateDigest = digest({ ledger: initial, entities: repositories.entities.list() });
    const state = structuredClone(initial);
    const items: ImportPlanItem[] = [];
    const records: Planned['records'] = [];
    const seen = new Map<string, { fact: string; id: string }>();
    const seenIds = new Set<string>();
    for (const candidate of bundle.candidates) {
      const item: ImportPlanItem = { candidateId: candidate.candidateId, decision: 'pass', summary: 'Validated candidate for confirmed import.' };
      items.push(item);
      try {
        const value = checked<CandidatePayloads[typeof candidate.candidateType]>(this.contracts, candidateVersions[candidate.candidateType], candidate.payload);
        const id = recordId(value), identity = `${candidate.candidateType}:${id}`, fact = factDigest(value);
        if (candidate.warnings?.length || legacy?.warnings?.length || historical?.warnings?.length) fail('RECONCILIATION_REQUIRED', 'Candidate or legacy source has unresolved warnings.');
        if ([...(candidate.sourceEvidenceRefs ?? []), ...(bundle.sourceEvidenceRefs ?? [])].some(v => !v.trim()) || (candidate.fingerprint !== undefined && !candidate.fingerprint.trim())) fail('RECONCILIATION_REQUIRED', 'Evidence references and fingerprints must not be blank.');
        const date = 'tradeDate' in value ? value.tradeDate : 'date' in value ? value.date : 'snapshotDate' in value ? value.snapshotDate : undefined;
        if (!historical && date && date < baselineDate) {
          if (!legacy?.sourceRefs?.some(ref => ref.quality === 'verified')) fail('RECONCILIATION_REQUIRED', 'Earlier history requires verified evidence; no back-inference is permitted.');
          fail('CONTRACT_GAP', 'Earlier history must use historical_asset_import.prepare/commit.');
        }
        if (historical) historicalCandidate(candidate, value, bundle, historical, evidence, state);
        if (legacy) {
          if (!legacy.sourceRefs?.length || legacy.sourceRefs.some(ref => ref.quality !== 'verified')) fail('RECONCILIATION_REQUIRED', 'Legacy import requires verified source references.');
          if (('source' in value && value.source !== 'legacy_import') || bundle.sourceType !== 'file_import') fail('LEDGER_INVALID', 'Legacy records must retain legacy provenance and file-import routing.');
          if (value.schemaVersion === 'dca-execution.v1' && !value.transactionIds?.length && !value.periodStart) fail('CONTRACT_GAP', 'Legacy DCA history needs dated transaction references; V1 period cannot prove that execution occurred on or after the baseline.');
        } else if (!historical && 'source' in value && value.source === 'legacy_import') fail('LEDGER_INVALID', 'Legacy records require legacy prepare.');
        requireObservedFactDate(value, state, bundle.asOf.slice(0, 10));
        if (bundle.sourceType === 'chatgpt_screenshot_parse') {
          if (!bundle.sourceEvidenceRefs?.length && !candidate.sourceEvidenceRefs?.length) fail('RECONCILIATION_REQUIRED', 'Screenshot candidates require source evidence.');
          if ('source' in value && value.source !== 'confirmed_screenshot') fail('RECONCILIATION_REQUIRED', 'Screenshot provenance must not be relabelled as manual.');
        }
        if (seenIds.has(identity)) fail('LEDGER_INVALID', 'Multiple candidates reuse the same official ID.');
        seenIds.add(identity);
        const previous = officialRecords(initial, candidate.candidateType).find(v => recordId(v) === id);
        if (previous && canonicalJson(previous) !== canonicalJson(value)) fail('LEDGER_INVALID', 'Existing official ID has changed payload.');
        let duplicate = Boolean(previous);
        for (const key of duplicateKeys(candidate.candidateType, value, candidate, bundle.sourceEvidenceRefs)) {
          const stored = repositories.ledger.fingerprint(key);
          const within = seen.get(key);
          if ((stored && stored.factDigest !== fact) || (within && within.fact !== fact)) fail('LEDGER_INVALID', 'Fingerprint conflicts with a different fact.');
          if (stored || within) duplicate = true;
        }
        // Reconciliation may use a duplicate same-bundle position, but only
        // after formal entity/domain validation, never as a ledger fallback.
        if (candidate.candidateType === 'position_snapshot') {
          const validation = validateRecord(candidate.candidateType, value, state, repositories.entities, this.contracts, Boolean(historical));
          if (validation.warnings.length) fail('RECONCILIATION_REQUIRED', validation.warnings.join(', '));
        }
        if (duplicate) {
          item.decision = 'skip_duplicate'; item.summary = 'Existing ID, fingerprint or evidence identifies an already recorded fact.';
          continue;
        }
        // Equal date/amount/asset without common evidence can also be two real
        // fills. Fail closed on this ambiguity rather than silently deleting one.
        if (!['account', 'asset'].includes(candidate.candidateType) && officialRecords(state, candidate.candidateType).some(v => factDigest(v) === fact)) fail('RECONCILIATION_REQUIRED', 'Date/amount/asset duplicate is ambiguous without shared evidence or fingerprint.');
        const validation = validateRecord(candidate.candidateType, value, state, repositories.entities, this.contracts, Boolean(historical));
        if (validation.entityId) item.resolvedEntityId = validation.entityId;
        if (validation.warnings.length) {
          item.decision = 'warn'; item.summary = 'Candidate reconciliation requires review.'; item.warnings = validation.warnings;
          continue;
        }
        const record: ValidatedRecord = { type: candidate.candidateType, value, ...(validation.revision ? { revision: validation.revision } : {}) };
        records.push({ candidate, record }); addToState(state, record);
        for (const key of duplicateKeys(candidate.candidateType, value, candidate, bundle.sourceEvidenceRefs)) seen.set(key, { fact, id });
      } catch (error) {
        if (!(error instanceof LocalCoreError)) throw error;
        if (!['CONTRACT_INVALID', 'LEDGER_INVALID', 'RECONCILIATION_REQUIRED', 'RECORD_NOT_FOUND', 'ENTITY_NOT_FOUND', 'ENTITY_NEEDS_CONFIRMATION', 'ENTITY_CONFLICTED', 'CONTRACT_GAP'].includes(error.code)) throw error;
        item.decision = ['RECORD_NOT_FOUND', 'ENTITY_NOT_FOUND', 'ENTITY_NEEDS_CONFIRMATION', 'ENTITY_CONFLICTED'].includes(error.code) ? 'needs_resolution' : error.code === 'RECONCILIATION_REQUIRED' ? 'warn' : 'blocked';
        item.summary = error.message;
        item.warnings = [error.code, ...(candidate.warnings ?? []), ...(legacy?.warnings ?? []), ...(historical?.warnings ?? [])];
      }
    }
    const accountValueReconciliations = reconcileAccountValues(bundle, items, evidence, this.contracts);
    const warnings: string[] = accountValueReconciliations.flatMap(r => r.warnings ?? []);
    if (bundle.sourceType === 'chatgpt_screenshot_parse') {
      for (const c of bundle.candidates.filter(c => !['account', 'asset'].includes(c.candidateType))) {
        const accounts = c.candidateType === 'dca_execution' ? state.transactions.filter(t => (c.payload.transactionIds as string[] | undefined)?.includes(t.transactionId)).map(t => t.accountId) : [c.payload.accountId];
        const date = c.payload.snapshotDate ?? c.payload.tradeDate ?? c.payload.date;
        if (!accounts.length || accounts.some(id => !accountValueReconciliations.some(r => r.accountId === id && (date === undefined || r.snapshotDate === date)))) warnings.push('SCREENSHOT_ACCOUNT_VALUE_OBSERVATION_MISSING');
      }
    }
    try { validateTransferPairs(state.cashFlows); }
    catch (error) {
      if (!(error instanceof LocalCoreError) || error.code !== 'RECONCILIATION_REQUIRED') throw error;
      warnings.push('INTERNAL_TRANSFER_RECONCILIATION_REQUIRED');
      for (const { candidate, record } of records) if (record.type === 'cash_flow' && 'type' in record.value && record.value.type === 'internal_transfer') {
        const item = items.find(v => v.candidateId === candidate.candidateId)!;
        item.decision = 'warn'; item.summary = error.message; item.warnings = ['RECONCILIATION_REQUIRED'];
      }
    }
    const contributions = externalContributions(state.cashFlows.filter(v => !initial.cashFlows.some(old => old.cashFlowId === v.cashFlowId)));
    const declared = bundle.declaredExternalContribution;
    if (declared) {
      if (declared.amount < 0 || contributions.some(v => v.currency !== declared.currency) || !amountsEqual(contributions.map(v => v.amount), [declared.amount])) {
        warnings.push('DECLARED_EXTERNAL_CONTRIBUTION_MISMATCH');
        for (const item of items.filter(v => v.decision === 'pass')) {
          item.decision = 'warn'; item.summary = 'Declared external contribution cannot reconcile to new external cash flows.';
          if (!contributions.some(v => v.currency !== declared.currency)) item.reconciliationDelta = { currency: declared.currency, amount: amountSum([...contributions.map(v => v.amount), -declared.amount]) };
        }
      }
    }
    const status: AssetImportPlan['status'] = items.some(v => v.decision === 'blocked') ? 'blocked' : warnings.length || items.some(v => v.warnings?.length || ['warn', 'needs_resolution'].includes(v.decision)) ? 'needs_review' : 'ready';
    const content = { schemaVersion: 'asset-import-plan.v1' as const, importId: bundle.importId, status, items, ...(bundle.accountValueObservations ? { accountValueReconciliations } : {}),
      summary: { transactionCount: records.filter(v => v.record.type === 'transaction').length, cashFlowCount: records.filter(v => v.record.type === 'cash_flow').length,
        positionCount: records.filter(v => v.record.type === 'position_snapshot').length, dcaExecutionCount: records.filter(v => v.record.type === 'dca_execution').length,
        ...(contributions.length === 1 ? { externalContribution: contributions[0]! } : {}) }, warnings };
    const latestId = repositories.ledger.latestImportPlanId(bundle.importId);
    const latest = latestId ? repositories.ledger.importPlan(latestId) : undefined;
    const inputs = { operation, bundle, legacy: legacy ?? null, historical: historical ?? null, evidence, stateDigest };
    const unchanged = latest && digest(inputs) === digest({ operation: latest.operation, bundle: latest.bundle, legacy: latest.legacy ?? null,
      historical: latest.historical ?? null, evidence: latest.evidence ?? [], stateDigest: latest.stateDigest });
    // Re-preparing unchanged input is deterministic; reverting to a previously
    // superseded input gets a new immutable preview and needs fresh approval.
    const supersedes = prepared ? prepared.supersedes : unchanged ? latest?.supersedes : latestId;
    const planDigest = digest({ ...inputs, supersedes: supersedes ?? null, content });
    const plan: AssetImportPlan = { ...content, planId: `asset-plan-${planDigest}`, planDigest };
    this.contracts.validate('asset-import-plan.v1', plan);
    return { stored: { bundle, plan, stateDigest, operation, evidence, ...(supersedes ? { supersedes } : {}), ...(legacy ? { legacy } : {}), ...(historical ? { historical } : {}) }, records };
  }
  prepare(input: AssetImportBundle): AssetImportPlan {
    const bundle = this.bundle(input);
    return this.database.transaction(repositories => {
      const { stored } = this.plan(repositories, bundle); repositories.ledger.saveImportPlan(stored); return stored.plan;
    });
  }
  prepareLegacy(input: LegacyAssetImport, candidates: AssetImportBundle): AssetImportPlan {
    const bundle = this.bundle(candidates), legacy = this.metadata(checked<LegacyAssetImport>(this.contracts, 'legacy-asset-import.v1', input), bundle);
    return this.database.transaction(repositories => {
      const { stored } = this.plan(repositories, bundle, legacy); repositories.ledger.saveImportPlan(stored); return stored.plan;
    });
  }
  prepareHistorical(input: HistoricalAssetImport, candidates: AssetImportBundle): AssetImportPlan {
    const bundle = this.bundle(candidates), historical = this.metadata(checked<HistoricalAssetImport>(this.contracts, 'historical-asset-import.v1', input), bundle);
    return this.database.transaction(repositories => {
      const { stored } = this.plan(repositories, bundle, undefined, historical); repositories.ledger.saveImportPlan(stored); return stored.plan;
    });
  }
  commitHistorical(input: AssetImportCommitRequest, operator: Pick<Confirmation, 'actor' | 'client'>): MutationResult {
    return this.commitOperation(input, operator, true);
  }
  getPlan(id: string): AssetImportPlan {
    return this.database.transaction(({ ledger }) => {
      const plan = ledger.importPlan(id)?.plan ?? fail('RECORD_NOT_FOUND', 'Import plan does not exist.');
      return ledger.fingerprint(`import:${plan.importId}`)?.recordId === id ? { ...plan, status: 'committed' as const } : plan;
    });
  }
  commit(input: AssetImportCommitRequest, operator: Pick<Confirmation, 'actor' | 'client'>): MutationResult {
    return this.commitOperation(input, operator, false);
  }
  private commitOperation(input: AssetImportCommitRequest, operator: Pick<Confirmation, 'actor' | 'client'>, historical: boolean): MutationResult {
    const request = checked<AssetImportCommitRequest>(this.contracts, 'asset-import-commit-request.v1', input);
    const confirmation = requireConfirmation({ ...operator, userApprovalRef: request.userApprovalRef, idempotencyKey: request.idempotencyKey });
    return this.database.transaction(repositories => {
      const stored = repositories.ledger.importPlan(request.planId) ?? fail('RECORD_NOT_FOUND', 'Prepared planId is required.');
      if (stored.plan.planDigest !== request.planDigest) fail('IMPORT_PLAN_STALE', 'Submitted digest differs from the immutable prepared plan.');
      const operation: ImportOperation = stored.historical ? 'historical_asset_import.commit' : stored.legacy ? 'legacy_asset_import.commit' : 'asset_import.commit';
      if (historical !== Boolean(stored.historical) || (stored.operation && stored.operation !== operation)) fail('IMPORT_PLAN_STALE', 'Prepared operation does not match the requested import operation.');
      return confirmedMutation(repositories, operation, confirmation, request, () => {
        if (repositories.ledger.latestImportPlanId(stored.bundle.importId) !== request.planId) fail('IMPORT_PLAN_STALE', 'A newer prepared candidate set superseded this plan.');
        const planned = this.plan(repositories, this.bundle(stored.bundle), stored.legacy, stored.historical, stored);
        if (planned.stored.plan.planDigest !== request.planDigest || planned.stored.stateDigest !== stored.stateDigest || canonicalJson(planned.stored.plan) !== canonicalJson(stored.plan)) fail('IMPORT_PLAN_STALE', 'Import input, evidence, ledger, Entity state or plan output changed; prepare again.');
        if (planned.stored.plan.status !== 'ready' || planned.stored.plan.warnings?.length || planned.stored.plan.items.some(i => i.warnings?.length)) fail('IMPORT_NOT_READY', 'Only a fully reconciled ready plan may commit.');
        if (historical || stored.bundle.accountValueObservations?.length) {
          const approval = this.trust.resolveApproval(request.userApprovalRef);
          const expected = { userApprovalRef: request.userApprovalRef, operation, planId: request.planId, planDigest: request.planDigest, ...operator };
          if (!approval || canonicalJson(approval) !== canonicalJson(expected)) fail('APPROVAL_REQUIRED', 'Approval must resolve to the same user, complete plan and import operation.');
        }
        const committed = stored.historical ? { ...stored.historical, status: 'committed' as const, userApprovalRef: request.userApprovalRef } : undefined;
        if (committed) this.contracts.validate('historical-asset-import.v1', committed);
        // Import ID is an independent replay guard even if all candidate IDs,
        // fingerprints and the confirmation key were replaced by the caller.
        if (repositories.ledger.fingerprint(`import:${stored.bundle.importId}`)) fail('IDEMPOTENCY_CONFLICT', 'Import identity was already committed.');
        return { importProvenance: { importId: stored.bundle.importId, planId: request.planId, planDigest: request.planDigest, ...(committed ? { historical: committed } : {}) }, result: { recordIds: planned.records.map(v => recordId(v.record.value)), warnings: [] }, appends: planned.records.map(v => authorizeRecord(v.record)), write: () => {
          for (const { candidate, record } of planned.records) {
            appendRecord(repositories, record, confirmation.idempotencyKey);
            registerRecord(repositories, record, confirmation.idempotencyKey, candidate, stored.bundle.sourceEvidenceRefs);
          }
          repositories.ledger.appendFingerprint({ key: `import:${stored.bundle.importId}`, factDigest: digest(stored.bundle), recordId: request.planId, operationKey: confirmation.idempotencyKey });
        } };
      });
    });
  }
}
