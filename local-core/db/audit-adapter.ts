import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AuditRepository, ContractRegistry } from '../ports/index.js';
import type { BridgeAuditEvent, StoredAudit } from '../domain/types.js';
import { canonicalJson } from '../domain/canonical-json.js';
import { fail, LocalCoreError } from '../domain/errors.js';
import type { Atomic } from './entity-adapter.js';

export function payloadDigest(payload: string): string { return createHash('sha256').update(payload, 'utf8').digest('hex'); }
interface AuditRow {
  event_id: string; request_id: string; timestamp: string; actor_json: string; client_json: string;
  operation: string; success: number; payload_json: string; payload_sha256: string; created_at: string;
}
export class SqliteAuditRepository implements AuditRepository {
  readonly #db: Database.Database;
  readonly #contracts: ContractRegistry;
  readonly #atomic: Atomic;
  constructor(db: Database.Database, contracts: ContractRegistry, atomic: Atomic) {
    this.#db = db; this.#contracts = contracts; this.#atomic = atomic;
  }
  append(event: BridgeAuditEvent): StoredAudit {
    return this.#atomic(() => {
      const payload = canonicalJson(event);
      const safeEvent = JSON.parse(payload) as BridgeAuditEvent;
      this.#contracts.validate('bridge-audit-event.v1', safeEvent);
      // V1 is metadata only. Reject recognizable secret material; callers must use
      // references/identifiers, never free-form request bodies or database dumps.
      if (/\bBearer\s+\S+|\b(?:access[_-]?token|refresh[_-]?token|password|credential|backup[_-]?key)\s*[:=]|-----BEGIN .*PRIVATE KEY-----|\b(?:sk|ghp)-[A-Za-z0-9]{12,}|\b(?:CREATE TABLE|INSERT INTO)\b/i.test(payload)) fail('CONTRACT_INVALID', 'Audit metadata must not contain credentials or raw database content.');
      const eventId = randomUUID();
      const createdAt = new Date().toISOString();
      const digest = payloadDigest(payload);
      try {
        this.#db.prepare(`INSERT INTO audit_events(event_id, request_id, timestamp, actor_json, client_json, operation, success, payload_json, payload_sha256, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eventId, safeEvent.requestId, safeEvent.timestamp, canonicalJson(safeEvent.actor), canonicalJson(safeEvent.client), safeEvent.operation, Number(safeEvent.success), payload, digest, createdAt);
      } catch {
        fail('AUDIT_APPEND_FAILED', 'Audit append failed; the audited transaction cannot succeed.');
      }
      return { eventId, event: safeEvent, payloadSha256: digest, createdAt };
    });
  }
  private decode(row: AuditRow): StoredAudit {
    try {
      const event = JSON.parse(row.payload_json) as BridgeAuditEvent;
      this.#contracts.validate('bridge-audit-event.v1', event);
      if (canonicalJson(event) !== row.payload_json || payloadDigest(row.payload_json) !== row.payload_sha256 || event.requestId !== row.request_id || event.timestamp !== row.timestamp || canonicalJson(event.actor) !== row.actor_json || canonicalJson(event.client) !== row.client_json || event.operation !== row.operation || Number(event.success) !== row.success) fail('DATABASE_INTEGRITY_FAILED', 'Audit payload or indexed metadata failed verification.');
      return { eventId: row.event_id, event, payloadSha256: row.payload_sha256, createdAt: row.created_at };
    } catch { return fail('DATABASE_INTEGRITY_FAILED', 'Audit history verification failed.'); }
  }
  get(eventId: string): StoredAudit {
    try {
      const row = this.#db.prepare('SELECT * FROM audit_events WHERE event_id=?').get(eventId) as AuditRow | undefined;
      if (!row) return fail('ENTITY_NOT_FOUND', 'Audit event does not exist.');
      return this.decode(row);
    } catch (error) {
      if (error instanceof LocalCoreError) throw error;
      return fail('DATABASE_INTEGRITY_FAILED', 'Audit read failed.');
    }
  }
  listByRequest(requestId: string): StoredAudit[] {
    try {
      return (this.#db.prepare('SELECT * FROM audit_events WHERE request_id=? ORDER BY created_at, event_id').all(requestId) as AuditRow[]).map((row) => this.decode(row));
    } catch (error) {
      if (error instanceof LocalCoreError) throw error;
      return fail('DATABASE_INTEGRITY_FAILED', 'Audit read failed.');
    }
  }
}
