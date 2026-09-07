import type Database from 'better-sqlite3';
import type { ContractRegistry } from '../ports/index.js';
import type { AssetRepository } from '../ports/asset-ports.js';
import type { Account, Asset, Transaction, CashFlow, PositionSnapshot, DcaPlan, DcaExecution, DcaRevision, StoredExecution, ConfirmedOperation, StoredImportPlan, ImportFingerprint } from '../domain/asset-types.js';
import { canonicalJson } from '../domain/canonical-json.js';
import { fail, LocalCoreError } from '../domain/errors.js';
import { payloadDigest } from './audit-adapter.js';
import type { Atomic } from './entity-adapter.js';
import type { BridgeAuditEvent } from '../domain/types.js';

type Table = 'accounts' | 'assets' | 'transactions' | 'cash_flows' | 'position_snapshots';
interface PayloadRow { payload_json: string; payload_sha256: string }
export class SqliteAssetRepository implements AssetRepository {
  readonly #db: Database.Database;
  readonly #contracts: ContractRegistry;
  readonly #atomic: Atomic;
  constructor(db: Database.Database, contracts: ContractRegistry, atomic: Atomic) { this.#db = db; this.#contracts = contracts; this.#atomic = atomic; }
  private decode<T>(row: PayloadRow, version?: string): T {
    try {
      const value = JSON.parse(row.payload_json) as T;
      if (canonicalJson(value) !== row.payload_json || payloadDigest(row.payload_json) !== row.payload_sha256) fail('DATABASE_INTEGRITY_FAILED', 'Asset payload digest mismatch.');
      if (version) this.#contracts.validate(version, value);
      return value;
    } catch { return fail('DATABASE_INTEGRITY_FAILED', 'Asset persistence validation failed.'); }
  }
  private read<T>(work: () => T): T {
    try { return work(); } catch (error) {
      if (error instanceof LocalCoreError) throw error;
      return fail('DATABASE_INTEGRITY_FAILED', 'Asset repository read failed.');
    }
  }
  private list<T>(table: Table, version: string): T[] {
    return this.read(() => (this.#db.prepare(`SELECT payload_json, payload_sha256 FROM ${table} ORDER BY id`).all() as PayloadRow[]).map(row => this.decode<T>(row, version)));
  }
  accounts(): Account[] { return this.list('accounts', 'account.v1'); }
  assets(): Asset[] {
    return this.read(() => this.list<Asset>('assets', 'asset.v1').map(asset => {
      const tags = (this.#db.prepare('SELECT tag FROM asset_tags WHERE asset_id=? ORDER BY ordinal').all(asset.assetId) as { tag: string }[]).map(v => v.tag);
      if (canonicalJson(tags) !== canonicalJson(asset.tags)) fail('DATABASE_INTEGRITY_FAILED', 'Asset tag mapping differs from its immutable payload.');
      return asset;
    }));
  }
  transactions(): Transaction[] { return this.list('transactions', 'transaction.v1'); }
  cashFlows(): CashFlow[] { return this.list('cash_flows', 'cash-flow.v1'); }
  positions(): PositionSnapshot[] { return this.list('position_snapshots', 'position-snapshot.v1'); }
  dcaRevisions(): DcaRevision[] {
    return this.read(() => (this.#db.prepare('SELECT * FROM dca_plan_revisions ORDER BY plan_id, revision').all() as (PayloadRow & { revision: number })[])
      .map(row => {
        const plan = this.decode<DcaPlan>(row, 'dca-plan.v1');
        const constraints = (this.#db.prepare('SELECT payload_json FROM dca_constraints WHERE plan_id=? AND revision=? ORDER BY ordinal').all(plan.planId, row.revision) as { payload_json: string }[]).map(v => JSON.parse(v.payload_json) as unknown);
        if (canonicalJson(constraints) !== canonicalJson(plan.constraints ?? [])) fail('DATABASE_INTEGRITY_FAILED', 'DCA constraint mapping differs from its revision.');
        return { plan, revision: row.revision };
      }));
  }
  dcaExecutions(): StoredExecution[] {
    return this.read(() => (this.#db.prepare('SELECT * FROM dca_executions ORDER BY id').all() as (PayloadRow & { plan_revision: number })[])
      .map(row => {
        const execution = this.decode<DcaExecution>(row, 'dca-execution.v1');
        const links = (this.#db.prepare('SELECT transaction_id FROM dca_execution_transactions WHERE execution_id=? ORDER BY transaction_id').all(execution.executionId) as { transaction_id: string }[]).map(v => v.transaction_id);
        if (canonicalJson(links) !== canonicalJson([...(execution.transactionIds ?? [])].sort())) fail('DATABASE_INTEGRITY_FAILED', 'DCA transaction links differ from the execution.');
        return { execution, planRevision: row.plan_revision };
      }));
  }
  operation(key: string): ConfirmedOperation | undefined {
    return this.read(() => {
      const row = this.#db.prepare('SELECT * FROM confirmed_operations WHERE operation_key=?').get(key) as (PayloadRow & { operation: string; approval_ref: string; request_digest: string; audit_event_id: string }) | undefined;
      if (!row) return undefined;
      const value = this.decode<ConfirmedOperation>(row);
      if (value.confirmation.idempotencyKey !== key || value.operation !== row.operation || value.confirmation.userApprovalRef !== row.approval_ref || value.requestDigest !== row.request_digest || value.auditEventId !== row.audit_event_id) fail('DATABASE_INTEGRITY_FAILED', 'Operation receipt metadata mismatch.');
      this.validateImportProvenance(value);
      return value;
    });
  }
  private validateImportProvenance(value: ConfirmedOperation): void {
    const p = value.importProvenance;
    if (value.operation === 'historical_asset_import.commit' && !p?.historical) fail('APPROVAL_REQUIRED', 'Historical operation requires committed provenance.');
    if (!p) return;
    const plan = this.importPlan(p.planId);
    if (!plan || plan.bundle.importId !== p.importId || plan.plan.planDigest !== p.planDigest || plan.operation !== value.operation) fail('APPROVAL_REQUIRED', 'Import provenance must bind the prepared operation.');
    if (p.historical) {
      this.#contracts.validate('historical-asset-import.v1', p.historical);
      if (value.operation !== 'historical_asset_import.commit' || canonicalJson(p.historical) !== canonicalJson({ ...plan.historical, status: 'committed', userApprovalRef: value.confirmation.userApprovalRef })) fail('APPROVAL_REQUIRED', 'Historical metadata, request approval and operation must agree.');
    }
  }
  importPlan(id: string): StoredImportPlan | undefined {
    return this.read(() => {
      const row = this.#db.prepare('SELECT * FROM import_plans WHERE plan_id=?').get(id) as (PayloadRow & { import_id: string; plan_digest: string; state_digest: string }) | undefined;
      if (!row) return undefined;
      const value = this.decode<StoredImportPlan>(row);
      this.#contracts.validate('asset-import-bundle.v1', value.bundle);
      this.#contracts.validate('asset-import-plan.v1', value.plan);
      if (value.legacy) this.#contracts.validate('legacy-asset-import.v1', value.legacy);
      if (value.historical) this.#contracts.validate('historical-asset-import.v1', value.historical);
      if (value.plan.planId !== id || value.bundle.importId !== row.import_id || value.plan.planDigest !== row.plan_digest || value.stateDigest !== row.state_digest) fail('DATABASE_INTEGRITY_FAILED', 'Import plan metadata mismatch.');
      return value;
    });
  }
  latestImportPlanId(importId: string): string | undefined {
    return this.read(() => (this.#db.prepare('SELECT plan_id FROM import_plans WHERE import_id=? ORDER BY rowid DESC LIMIT 1').get(importId) as { plan_id: string } | undefined)?.plan_id);
  }
  fingerprint(key: string): ImportFingerprint | undefined {
    return this.read(() => {
      const row = this.#db.prepare('SELECT * FROM import_fingerprints WHERE key=?').get(key) as { key: string; fact_digest: string; record_id: string; operation_key: string } | undefined;
      return row ? { key: row.key, factDigest: row.fact_digest, recordId: row.record_id, operationKey: row.operation_key } : undefined;
    });
  }
  private requireOperation(key: string, append?: { id: string; version: string; payloadDigest: string; revision?: number }): void {
    if (!this.#db.inTransaction) fail('APPROVAL_REQUIRED', 'Official repository writes require the domain transaction.');
    const operation = this.operation(key);
    if (!operation || !operation.confirmation.userApprovalRef.trim() || (append !== undefined && !operation.appends.some(v => canonicalJson(v) === canonicalJson(append)))) fail('APPROVAL_REQUIRED', 'Official append must match the approved type, identity, payload digest and revision.');
  }
  private insert(table: Table, id: string, value: Account | Asset | Transaction | CashFlow | PositionSnapshot, key: string): void {
    const payload = canonicalJson(value);
    this.requireOperation(key, { id, version: value.schemaVersion, payloadDigest: payloadDigest(payload) });
    this.#contracts.validate(value.schemaVersion, JSON.parse(payload));
    this.#db.prepare(`INSERT INTO ${table}(id,payload_json,payload_sha256,operation_key) VALUES(?,?,?,?)`).run(id, payload, payloadDigest(payload), key);
  }
  createAccount(value: Account, key: string): void { this.#atomic(() => this.insert('accounts', value.accountId, value, key)); }
  createAsset(value: Asset, key: string): void {
    this.#atomic(() => {
      this.insert('assets', value.assetId, value, key);
      for (const [index, tag] of value.tags.entries()) this.#db.prepare('INSERT INTO asset_tags(asset_id,tag,ordinal) VALUES(?,?,?)').run(value.assetId, tag, index);
    });
  }
  appendTransaction(value: Transaction, key: string): void { this.#atomic(() => this.insert('transactions', value.transactionId, value, key)); }
  appendCashFlow(value: CashFlow, key: string): void { this.#atomic(() => this.insert('cash_flows', value.cashFlowId, value, key)); }
  appendPosition(value: PositionSnapshot, key: string): void { this.#atomic(() => this.insert('position_snapshots', value.snapshotId, value, key)); }
  appendDcaRevision(value: DcaRevision, key: string): void {
    this.#atomic(() => {
      const payload = canonicalJson(value.plan);
      this.requireOperation(key, { id: value.plan.planId, version: value.plan.schemaVersion, payloadDigest: payloadDigest(payload), revision: value.revision });
      this.#contracts.validate('dca-plan.v1', JSON.parse(payload));
      if (value.revision === 1) this.#db.prepare('INSERT INTO dca_plans(plan_id,operation_key) VALUES(?,?)').run(value.plan.planId, key);
      this.#db.prepare('INSERT INTO dca_plan_revisions(plan_id,revision,payload_json,payload_sha256,operation_key) VALUES(?,?,?,?,?)')
        .run(value.plan.planId, value.revision, payload, payloadDigest(payload), key);
      for (const [index, constraint] of (value.plan.constraints ?? []).entries()) this.#db.prepare('INSERT INTO dca_constraints(plan_id,revision,ordinal,payload_json) VALUES(?,?,?,?)')
        .run(value.plan.planId, value.revision, index, canonicalJson(constraint));
    });
  }
  appendDcaExecution(value: StoredExecution, key: string): void {
    this.#atomic(() => {
      const payload = canonicalJson(value.execution);
      this.requireOperation(key, { id: value.execution.executionId, version: value.execution.schemaVersion, payloadDigest: payloadDigest(payload), revision: value.planRevision });
      this.#contracts.validate('dca-execution.v1', JSON.parse(payload));
      this.#db.prepare('INSERT INTO dca_executions(id,payload_json,payload_sha256,operation_key,plan_revision) VALUES(?,?,?,?,?)')
        .run(value.execution.executionId, payload, payloadDigest(payload), key, value.planRevision);
      for (const id of value.execution.transactionIds ?? []) this.#db.prepare('INSERT INTO dca_execution_transactions(execution_id,transaction_id) VALUES(?,?)').run(value.execution.executionId, id);
    });
  }
  appendOperation(value: ConfirmedOperation): void {
    this.#atomic(() => {
      this.validateImportProvenance(value);
      const payload = canonicalJson(value);
      const c = value.confirmation;
      if (![c.actor, c.client, c.userApprovalRef, c.idempotencyKey].every(v => typeof v === 'string' && v.trim())) fail('APPROVAL_REQUIRED', 'Nonempty user confirmation is required.');
      const row = this.#db.prepare('SELECT payload_json,payload_sha256 FROM audit_events WHERE event_id=?').get(value.auditEventId) as PayloadRow | undefined;
      if (!row) fail('APPROVAL_REQUIRED', 'Operation requires an existing audit in the same transaction.');
      const event = this.decode<BridgeAuditEvent>(row, 'bridge-audit-event.v1');
      if (!event.success || event.confirmationState !== 'approved' || event.actorType !== 'user' || event.actor !== c.actor || event.client !== c.client || event.operation !== value.operation || event.idempotencyKey !== c.idempotencyKey || event.scope !== c.userApprovalRef) fail('APPROVAL_REQUIRED', 'Operation receipt and approved audit must agree.');
      this.#db.prepare('INSERT INTO confirmed_operations(operation_key,operation,approval_ref,request_digest,audit_event_id,payload_json,payload_sha256) VALUES(?,?,?,?,?,?,?)')
        .run(c.idempotencyKey, value.operation, c.userApprovalRef, value.requestDigest, value.auditEventId, payload, payloadDigest(payload));
    });
  }
  saveImportPlan(value: StoredImportPlan): void {
    this.#atomic(() => {
      const payload = canonicalJson(value);
      this.#contracts.validate('asset-import-bundle.v1', value.bundle);
      this.#contracts.validate('asset-import-plan.v1', value.plan);
      if (value.legacy) this.#contracts.validate('legacy-asset-import.v1', value.legacy);
      if (value.historical) this.#contracts.validate('historical-asset-import.v1', value.historical);
      const previous = this.importPlan(value.plan.planId);
      if (previous) {
        if (canonicalJson(previous) !== payload) fail('IMPORT_PLAN_STALE', 'Immutable plan ID cannot be reused for changed content.');
        return;
      }
      this.#db.prepare('INSERT INTO import_plans(plan_id,import_id,plan_digest,state_digest,payload_json,payload_sha256) VALUES(?,?,?,?,?,?)')
        .run(value.plan.planId, value.bundle.importId, value.plan.planDigest, value.stateDigest, payload, payloadDigest(payload));
    });
  }
  appendFingerprint(value: ImportFingerprint): void {
    this.#atomic(() => {
      this.requireOperation(value.operationKey);
      const old = this.fingerprint(value.key);
      if (old && old.factDigest === value.factDigest && old.recordId === value.recordId) return;
      this.#db.prepare('INSERT INTO import_fingerprints(key,fact_digest,record_id,operation_key) VALUES(?,?,?,?)').run(value.key, value.factDigest, value.recordId, value.operationKey);
    });
  }
}
