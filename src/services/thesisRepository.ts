import type { ThesisData, ThesisOwners, ThesisRevision, ThesisPreview } from '../types/thesis';
import type { StorageLike } from './watchlistRepository';
import { PersistedBaseGuard } from './persistedBaseGuard';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { thesisReadModel, emptyThesisData, validateThesisData, validateThesisOwners, previewThesis } from './thesis';
import { cloneClaim as cloneThesis, claimRequire as thesisRequire } from './verifiedClaim';
import { isPreciseInstant } from '../utils/dateTime';

export const THESIS_STORAGE_KEY = 'investment-research-dashboard.thesis.v1';
export const THESIS_BACKUP_FORMAT = 'investment-research-dashboard.thesis-backup.v1';
const keys = ['entries', 'revisions', 'confirmations'] as const;
type Collection = typeof keys[number];
export type ThesisAdditions = Partial<Pick<ThesisData, Collection>>;
export interface ThesisLoad { data: ThesisData; error: string | null; corruptedRaw: string | null; recoveryStatus: 'corrupt' | 'unsupported_version' | 'unavailable' | null }
export interface ThesisImportPreview { data: ThesisData; addCount: number; skipCount: number }
export interface ThesisRepository {
  load(): ThesisLoad;
  export(data: ThesisData): string;
  previewImport(raw: string, base: ThesisData): ThesisImportPreview;
  import(base: ThesisData, raw: string, confirmed: boolean): ThesisData;
  previewRecovery(raw: string, corruptedRaw: string): ThesisImportPreview;
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ThesisData;
}
const id = (row: ThesisData[Collection][number]) => 'confirmationId' in row ? row.confirmationId : 'revisionId' in row ? row.revisionId : row.thesisId;

/** Local Thesis owner reusing the existing exact-byte persistence and recovery pattern. */
export class BrowserThesisRepository implements ThesisRepository {
  private readonly guard: PersistedBaseGuard<ThesisData>;
  private readonly snapshots = new WeakMap<ThesisData, string>();
  private readonly previews = new WeakMap<ThesisPreview, { base: ThesisData; revisionId: string; snapshot: string }>();
  private corrupt: string | null = null;
  constructor(private readonly storage: StorageLike | null, private readonly owners: ThesisOwners, private readonly now: () => Date = () => new Date()) {
    this.guard = new PersistedBaseGuard(storage, THESIS_STORAGE_KEY);
  }
  private remember(data: ThesisData, raw: string | null): ThesisData {
    this.snapshots.set(data, canonicalJson(data)); return this.guard.remember(data, raw);
  }
  load(): ThesisLoad {
    let raw: string | null = null; let status: ThesisLoad['recoveryStatus'] = 'unavailable'; this.corrupt = null;
    try {
      thesisRequire(this.storage, 'THESIS_STORAGE_UNAVAILABLE'); raw = this.storage!.getItem(THESIS_STORAGE_KEY); status = 'corrupt';
      const parsed: unknown = raw === null ? emptyThesisData() : JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion !== 'thesis.v1') {
        status = 'unsupported_version'; throw new Error('THESIS_FUTURE_SCHEMA_LOCKED');
      }
      validateThesisData(parsed);
      return { data: this.remember(cloneThesis(parsed), raw), error: null, corruptedRaw: null, recoveryStatus: null };
    } catch (error) {
      if (status === 'corrupt') this.corrupt = raw;
      return { data: emptyThesisData(), error: String(error), corruptedRaw: raw, recoveryStatus: status };
    }
  }
  private authoritative(base: ThesisData): { data: ThesisData; raw: string | null } {
    const snapshot = this.snapshots.get(base);
    thesisRequire(snapshot !== undefined && snapshot === canonicalJson(base), 'THESIS_BASE_UNBOUND_OR_MUTATED');
    const raw = this.guard.assertCurrent(base);
    const data: unknown = JSON.parse(raw ?? snapshot!); validateThesisData(data);
    return { data, raw };
  }
  private append(base: ThesisData, additions: ThesisAdditions): ThesisData {
    canonicalJson(additions);
    thesisRequire(Object.keys(additions).every(key => (keys as readonly string[]).includes(key)), 'THESIS_APPEND_COLLECTION');
    const next = this.authoritative(base).data;
    for (const key of keys) {
      const rows = additions[key] ?? []; thesisRequire(Array.isArray(rows), 'THESIS_APPEND_ARRAY');
      (next[key] as unknown[]) = [...next[key], ...cloneThesis(rows)];
    }
    thesisRequire([...next.entries, ...next.revisions, ...next.confirmations].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'THESIS_FUTURE_WRITE');
    validateThesisOwners(next, this.owners);
    thesisReadModel(next, this.owners, this.now().toISOString());
    this.guard.write(next, base); return this.remember(next, JSON.stringify(next));
  }
  saveDraft(base: ThesisData, revision: ThesisRevision): ThesisData {
    const data = this.authoritative(base).data;
    const entry = data.entries.find(e => e.thesisId === revision.thesisId);
    thesisRequire(!data.confirmations.some(c => c.thesisId === revision.thesisId && Date.parse(c.createdAt) >= Date.parse(revision.createdAt)), 'THESIS_REVISION_AFTER_CONFIRMATION_REQUIRED');
    const entries = entry ? [] : [{ thesisId: revision.thesisId, origin: revision.origin, createdAt: revision.createdAt }];
    return this.append(base, { entries, revisions: [revision] });
  }
  prepareConfirmation(base: ThesisData, revisionId: string): ThesisPreview {
    const data = this.authoritative(base).data;
    const revision = data.revisions.find(r => r.revisionId === revisionId);
    thesisRequire(revision && !data.revisions.some(r => r.supersedes === revisionId) && !data.confirmations.some(c => c.revisionId === revisionId), 'THESIS_CONFIRMATION_NOT_OPEN');
    const preview = previewThesis(revision!, this.owners);
    this.previews.set(preview, { base, revisionId, snapshot: canonicalJson(preview) });
    return preview;
  }
  confirm(preview: ThesisPreview, note: string, confirmed: boolean): ThesisData {
    thesisRequire(confirmed, 'THESIS_USER_CONFIRMATION_REQUIRED');
    thesisRequire(typeof note === 'string' && note.trim().length > 0, 'THESIS_CONFIRMATION_NOTE_REQUIRED');
    const bound = this.previews.get(preview);
    thesisRequire(bound && bound.snapshot === canonicalJson(preview), 'THESIS_PREVIEW_UNBOUND_OR_MUTATED');
    const fresh = this.prepareConfirmation(bound!.base, bound!.revisionId);
    thesisRequire(fresh.publishable, 'THESIS_VERIFIED_CLAIM_GATE_BLOCKED');
    const confirmationId = globalThis.crypto.randomUUID();
    const data = this.append(bound!.base, { confirmations: [{ confirmationId, thesisId: fresh.revision.thesisId, revisionId: bound!.revisionId,
      actor: 'user', userApprovalRef: { owner: 'ThesisConfirmation', approvalId: confirmationId }, createdAt: this.now().toISOString(), note }] });
    this.previews.delete(preview); return data;
  }
  export(data: ThesisData): string {
    validateThesisData(data);
    return JSON.stringify({ format: THESIS_BACKUP_FORMAT, exportedAt: this.now().toISOString(), data }, null, 2) + '\n';
  }
  private parseBackup(raw: string): ThesisData {
    const value: unknown = JSON.parse(raw);
    thesisRequire(value && typeof value === 'object' && !Array.isArray(value), 'THESIS_BACKUP_FORMAT');
    const envelope = value as Record<string, unknown>;
    thesisRequire(Object.keys(envelope).sort().join(',') === 'data,exportedAt,format' && envelope.format === THESIS_BACKUP_FORMAT
      && typeof envelope.exportedAt === 'string' && isPreciseInstant(envelope.exportedAt), 'THESIS_BACKUP_FORMAT');
    validateThesisData(envelope.data);
    thesisRequire([...envelope.data.entries, ...envelope.data.revisions, ...envelope.data.confirmations].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'THESIS_FUTURE_IMPORT');
    validateThesisOwners(envelope.data, this.owners); return cloneThesis(envelope.data);
  }
  previewImport(raw: string, base: ThesisData): ThesisImportPreview {
    validateThesisData(base); const imported = this.parseBackup(raw), next = cloneThesis(base);
    let addCount = 0, skipCount = 0;
    for (const key of keys) {
      const prior = new Map(next[key].map(row => [id(row), row]));
      for (const row of imported[key]) {
        const existing = prior.get(id(row));
        if (existing) { thesisRequire(canonicalJson(existing) === canonicalJson(row), 'THESIS_IMPORT_HISTORY_CONFLICT'); skipCount++; }
        else { (next[key] as unknown[]).push(row); addCount++; }
      }
    }
    validateThesisOwners(next, this.owners); thesisReadModel(next, this.owners, this.now().toISOString()); return { data: next, addCount, skipCount };
  }
  private backup(kind: 'import' | 'recovery', raw: string, assertCurrent: () => void): void {
    const prefix = `${THESIS_STORAGE_KEY}.pre-${kind}.${this.now().toISOString()}`;
    let key = prefix, counter = 0;
    while (this.storage!.getItem(key) !== null) key = `${prefix}.${++counter}`;
    assertCurrent(); this.storage!.setItem(key, raw);
    thesisRequire(this.storage!.getItem(key) === raw, 'THESIS_PREWRITE_BACKUP_FAILED'); assertCurrent();
  }
  import(base: ThesisData, raw: string, confirmed: boolean): ThesisData {
    thesisRequire(confirmed, 'THESIS_IMPORT_CONFIRMATION_REQUIRED');
    const current = this.authoritative(base), { data } = this.previewImport(raw, current.data);
    this.backup('import', current.raw ?? JSON.stringify(current.data), () => { this.guard.assertCurrent(base); });
    this.guard.write(data, base); return this.remember(data, JSON.stringify(data));
  }
  private assertCorrupt(raw: string): void {
    thesisRequire(this.storage && this.corrupt !== null && this.corrupt === raw && this.storage.getItem(THESIS_STORAGE_KEY) === raw, 'THESIS_RECOVERY_NOT_OBSERVED_OR_CHANGED');
  }
  previewRecovery(raw: string, corruptedRaw: string): ThesisImportPreview {
    this.assertCorrupt(corruptedRaw); const data = this.parseBackup(raw); thesisReadModel(data, this.owners, this.now().toISOString()); this.assertCorrupt(corruptedRaw);
    return { data, addCount: keys.reduce((sum, key) => sum + data[key].length, 0), skipCount: 0 };
  }
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ThesisData {
    thesisRequire(confirmed, 'THESIS_RECOVERY_CONFIRMATION_REQUIRED');
    const { data } = this.previewRecovery(raw, corruptedRaw);
    this.backup('recovery', corruptedRaw, () => this.assertCorrupt(corruptedRaw));
    const expected = JSON.stringify(data); this.storage!.setItem(THESIS_STORAGE_KEY, expected);
    const reloaded = this.load();
    thesisRequire(reloaded.error === null && this.storage!.getItem(THESIS_STORAGE_KEY) === expected && canonicalJson(reloaded.data) === canonicalJson(data), 'THESIS_RECOVERY_READBACK_FAILED');
    return reloaded.data;
  }
}
