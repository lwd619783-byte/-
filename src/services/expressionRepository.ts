import type { ExpressionData, ExpressionOwners, ExpressionRevision, ExpressionPreview } from '../types/investmentExpression';
import type { StorageLike } from './watchlistRepository';
import { PersistedBaseGuard } from './persistedBaseGuard';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { expressionReadModel, emptyExpressionData, validateExpressionData, validateExpressionOwners, validateExpressionScope, previewExpression } from './investmentExpression';
import { cloneClaim as cloneExpression, claimRequire as expressionRequire } from './verifiedClaim';
import { isPreciseInstant } from '../utils/dateTime';

export const EXPRESSION_STORAGE_KEY = 'investment-research-dashboard.expression.v1';
export const EXPRESSION_BACKUP_FORMAT = 'investment-research-dashboard.expression-backup.v1';
const keys = ['entries', 'revisions', 'confirmations'] as const;
type Collection = typeof keys[number];
export type ExpressionAdditions = Partial<Pick<ExpressionData, Collection>>;
export interface ExpressionLoad { data: ExpressionData; error: string | null; corruptedRaw: string | null; recoveryStatus: 'corrupt' | 'unsupported_version' | 'unavailable' | null }
export interface ExpressionImportPreview { data: ExpressionData; addCount: number; skipCount: number }
export interface ExpressionRepository {
  load(): ExpressionLoad;
  export(data: ExpressionData): string;
  previewImport(raw: string, base: ExpressionData): ExpressionImportPreview;
  import(base: ExpressionData, raw: string, confirmed: boolean): ExpressionData;
  previewRecovery(raw: string, corruptedRaw: string): ExpressionImportPreview;
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ExpressionData;
}
const id = (row: ExpressionData[Collection][number]) => 'confirmationId' in row ? row.confirmationId : 'revisionId' in row ? row.revisionId : row.expressionId;

/** Local Expression owner reusing the existing exact-byte persistence and recovery pattern. */
export class BrowserExpressionRepository implements ExpressionRepository {
  private readonly guard: PersistedBaseGuard<ExpressionData>;
  private readonly snapshots = new WeakMap<ExpressionData, string>();
  private readonly previews = new WeakMap<ExpressionPreview, { base: ExpressionData; revisionId: string; snapshot: string }>();
  private corrupt: string | null = null;
  constructor(private readonly storage: StorageLike | null, private readonly owners: ExpressionOwners, private readonly now: () => Date = () => new Date()) {
    this.guard = new PersistedBaseGuard(storage, EXPRESSION_STORAGE_KEY);
  }
  private remember(data: ExpressionData, raw: string | null): ExpressionData {
    this.snapshots.set(data, canonicalJson(data)); return this.guard.remember(data, raw);
  }
  load(): ExpressionLoad {
    let raw: string | null = null; let status: ExpressionLoad['recoveryStatus'] = 'unavailable'; this.corrupt = null;
    try {
      expressionRequire(this.storage, 'EXPRESSION_STORAGE_UNAVAILABLE'); raw = this.storage!.getItem(EXPRESSION_STORAGE_KEY); status = 'corrupt';
      const parsed: unknown = raw === null ? emptyExpressionData() : JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion !== 'investment-expression.v1') {
        status = 'unsupported_version'; throw new Error('EXPRESSION_FUTURE_SCHEMA_LOCKED');
      }
      validateExpressionData(parsed); validateExpressionScope(parsed, this.owners);
      return { data: this.remember(cloneExpression(parsed), raw), error: null, corruptedRaw: null, recoveryStatus: null };
    } catch (error) {
      if (status === 'corrupt') this.corrupt = raw;
      return { data: emptyExpressionData(), error: String(error), corruptedRaw: raw, recoveryStatus: status };
    }
  }
  private authoritative(base: ExpressionData): { data: ExpressionData; raw: string | null } {
    const snapshot = this.snapshots.get(base);
    expressionRequire(snapshot !== undefined && snapshot === canonicalJson(base), 'EXPRESSION_BASE_UNBOUND_OR_MUTATED');
    const raw = this.guard.assertCurrent(base);
    const data: unknown = JSON.parse(raw ?? snapshot!); validateExpressionData(data);
    return { data, raw };
  }
  private append(base: ExpressionData, additions: ExpressionAdditions): ExpressionData {
    canonicalJson(additions);
    expressionRequire(Object.keys(additions).every(key => (keys as readonly string[]).includes(key)), 'EXPRESSION_APPEND_COLLECTION');
    const next = this.authoritative(base).data;
    for (const key of keys) {
      const rows = additions[key] ?? []; expressionRequire(Array.isArray(rows), 'EXPRESSION_APPEND_ARRAY');
      (next[key] as unknown[]) = [...next[key], ...cloneExpression(rows)];
    }
    expressionRequire([...next.entries, ...next.revisions, ...next.confirmations].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'EXPRESSION_FUTURE_WRITE');
    validateExpressionOwners(next, this.owners);
    expressionReadModel(next, this.owners, this.now().toISOString());
    this.guard.write(next, base); return this.remember(next, JSON.stringify(next));
  }
  saveDraft(base: ExpressionData, revision: ExpressionRevision): ExpressionData {
    const data = this.authoritative(base).data;
    const entry = data.entries.find(e => e.expressionId === revision.expressionId);
    expressionRequire(!data.confirmations.some(c => c.expressionId === revision.expressionId && Date.parse(c.createdAt) >= Date.parse(revision.createdAt)), 'EXPRESSION_REVISION_AFTER_CONFIRMATION_REQUIRED');
    const entries = entry ? [] : [{ expressionId: revision.expressionId, origin: revision.origin, scope: revision.scope, createdAt: revision.createdAt }];
    return this.append(base, { entries, revisions: [revision] });
  }
  prepareConfirmation(base: ExpressionData, revisionId: string): ExpressionPreview {
    const data = this.authoritative(base).data;
    const revision = data.revisions.find(r => r.revisionId === revisionId);
    expressionRequire(revision && !data.revisions.some(r => r.supersedes === revisionId) && !data.confirmations.some(c => c.revisionId === revisionId), 'EXPRESSION_CONFIRMATION_NOT_OPEN');
    const preview = previewExpression(revision!, this.owners);
    this.previews.set(preview, { base, revisionId, snapshot: canonicalJson(preview) });
    return preview;
  }
  confirm(preview: ExpressionPreview, note: string, confirmed: boolean): ExpressionData {
    expressionRequire(confirmed, 'EXPRESSION_USER_CONFIRMATION_REQUIRED');
    expressionRequire(typeof note === 'string' && note.trim().length > 0, 'EXPRESSION_CONFIRMATION_NOTE_REQUIRED');
    const bound = this.previews.get(preview);
    expressionRequire(bound && bound.snapshot === canonicalJson(preview), 'EXPRESSION_PREVIEW_UNBOUND_OR_MUTATED');
    const fresh = this.prepareConfirmation(bound!.base, bound!.revisionId);
    expressionRequire(fresh.publishable, 'EXPRESSION_FORMAL_THESIS_GATE_BLOCKED');
    expressionRequire(fresh.authorityToken === preview.authorityToken, 'EXPRESSION_THESIS_AUTHORITY_CHANGED');
    const confirmationId = globalThis.crypto.randomUUID();
    const data = this.append(bound!.base, { confirmations: [{ confirmationId, expressionId: fresh.revision.expressionId, revisionId: bound!.revisionId,
      actor: 'user', userApprovalRef: { owner: 'ExpressionConfirmation', approvalId: confirmationId }, createdAt: this.now().toISOString(), note }] });
    this.previews.delete(preview); return data;
  }
  export(data: ExpressionData): string {
    validateExpressionData(data);
    return canonicalJson({ format: EXPRESSION_BACKUP_FORMAT, exportedAt: this.now().toISOString(), data }) + '\n';
  }
  private parseBackup(raw: string): ExpressionData {
    const value: unknown = JSON.parse(raw);
    expressionRequire(value && typeof value === 'object' && !Array.isArray(value), 'EXPRESSION_BACKUP_FORMAT');
    const envelope = value as Record<string, unknown>;
    expressionRequire(Object.keys(envelope).sort().join(',') === 'data,exportedAt,format' && envelope.format === EXPRESSION_BACKUP_FORMAT
      && typeof envelope.exportedAt === 'string' && isPreciseInstant(envelope.exportedAt), 'EXPRESSION_BACKUP_FORMAT');
    validateExpressionData(envelope.data);
    expressionRequire([...envelope.data.entries, ...envelope.data.revisions, ...envelope.data.confirmations].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'EXPRESSION_FUTURE_IMPORT');
    validateExpressionOwners(envelope.data, this.owners); return cloneExpression(envelope.data);
  }
  previewImport(raw: string, base: ExpressionData): ExpressionImportPreview {
    validateExpressionData(base); const imported = this.parseBackup(raw), next = cloneExpression(base);
    let addCount = 0, skipCount = 0;
    for (const key of keys) {
      const prior = new Map(next[key].map(row => [id(row), row]));
      for (const row of imported[key]) {
        const existing = prior.get(id(row));
        if (existing) { expressionRequire(canonicalJson(existing) === canonicalJson(row), 'EXPRESSION_IMPORT_HISTORY_CONFLICT'); skipCount++; }
        else { (next[key] as unknown[]).push(row); addCount++; }
      }
    }
    validateExpressionOwners(next, this.owners); expressionReadModel(next, this.owners, this.now().toISOString()); return { data: next, addCount, skipCount };
  }
  private backup(kind: 'import' | 'recovery', raw: string, assertCurrent: () => void): void {
    const prefix = `${EXPRESSION_STORAGE_KEY}.pre-${kind}.${this.now().toISOString()}`;
    let key = prefix, counter = 0;
    while (this.storage!.getItem(key) !== null) key = `${prefix}.${++counter}`;
    assertCurrent(); this.storage!.setItem(key, raw);
    expressionRequire(this.storage!.getItem(key) === raw, 'EXPRESSION_PREWRITE_BACKUP_FAILED'); assertCurrent();
  }
  import(base: ExpressionData, raw: string, confirmed: boolean): ExpressionData {
    expressionRequire(confirmed, 'EXPRESSION_IMPORT_CONFIRMATION_REQUIRED');
    const current = this.authoritative(base), { data } = this.previewImport(raw, current.data);
    this.backup('import', current.raw ?? JSON.stringify(current.data), () => { this.guard.assertCurrent(base); });
    this.guard.write(data, base); return this.remember(data, JSON.stringify(data));
  }
  private assertCorrupt(raw: string): void {
    expressionRequire(this.storage && this.corrupt !== null && this.corrupt === raw && this.storage.getItem(EXPRESSION_STORAGE_KEY) === raw, 'EXPRESSION_RECOVERY_NOT_OBSERVED_OR_CHANGED');
  }
  previewRecovery(raw: string, corruptedRaw: string): ExpressionImportPreview {
    this.assertCorrupt(corruptedRaw); const data = this.parseBackup(raw); expressionReadModel(data, this.owners, this.now().toISOString()); this.assertCorrupt(corruptedRaw);
    return { data, addCount: keys.reduce((sum, key) => sum + data[key].length, 0), skipCount: 0 };
  }
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ExpressionData {
    expressionRequire(confirmed, 'EXPRESSION_RECOVERY_CONFIRMATION_REQUIRED');
    const { data } = this.previewRecovery(raw, corruptedRaw);
    this.backup('recovery', corruptedRaw, () => this.assertCorrupt(corruptedRaw));
    const expected = JSON.stringify(data); this.storage!.setItem(EXPRESSION_STORAGE_KEY, expected);
    const reloaded = this.load();
    expressionRequire(reloaded.error === null && this.storage!.getItem(EXPRESSION_STORAGE_KEY) === expected && canonicalJson(reloaded.data) === canonicalJson(data), 'EXPRESSION_RECOVERY_READBACK_FAILED');
    return reloaded.data;
  }
}
