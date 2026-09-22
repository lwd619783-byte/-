import type { ClaimData, ClaimOwners, ClaimRevision, ClaimReview, ClaimPreview } from '../types/verifiedClaim';
import type { StorageLike } from './watchlistRepository';
import { PersistedBaseGuard } from './persistedBaseGuard';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { claimReadModel, cloneClaim, emptyClaimData, validateClaimData, validateClaimOwners, claimRequire, previewClaim } from './verifiedClaim';
import { isPreciseInstant } from '../utils/dateTime';

export const CLAIM_STORAGE_KEY = 'investment-research-dashboard.claim.v1';
export const CLAIM_BACKUP_FORMAT = 'investment-research-dashboard.claim-backup.v1';
const keys = ['entries', 'revisions', 'reviews'] as const;
type Collection = typeof keys[number];
export type ClaimAdditions = Partial<Pick<ClaimData, Collection>>;
export interface ClaimLoad { data: ClaimData; error: string | null; corruptedRaw: string | null; recoveryStatus: 'corrupt' | 'unsupported_version' | 'unavailable' | null }
export interface ClaimImportPreview { data: ClaimData; addCount: number; skipCount: number }
export interface ClaimRepository {
  load(): ClaimLoad;
  export(data: ClaimData): string;
  previewImport(raw: string, base: ClaimData): ClaimImportPreview;
  import(base: ClaimData, raw: string, confirmed: boolean): ClaimData;
  previewRecovery(raw: string, corruptedRaw: string): ClaimImportPreview;
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ClaimData;
}
const id = (row: ClaimData[Collection][number]) => 'reviewId' in row ? row.reviewId : 'revisionId' in row ? row.revisionId : row.claimId;

/** Claim owner; same Local-first exact-byte guard and recovery pattern as Wiki/Creator. */
export class BrowserClaimRepository implements ClaimRepository {
  private readonly guard: PersistedBaseGuard<ClaimData>;
  private readonly snapshots = new WeakMap<ClaimData, string>();
  private readonly previews = new WeakMap<ClaimPreview, { base: ClaimData; revisionId: string; snapshot: string }>();
  private corrupt: string | null = null;
  constructor(private readonly storage: StorageLike | null, private readonly owners: ClaimOwners, private readonly now: () => Date = () => new Date()) {
    this.guard = new PersistedBaseGuard(storage, CLAIM_STORAGE_KEY);
  }
  private remember(data: ClaimData, raw: string | null): ClaimData {
    this.snapshots.set(data, canonicalJson(data)); return this.guard.remember(data, raw);
  }
  load(): ClaimLoad {
    let raw: string | null = null; let status: ClaimLoad['recoveryStatus'] = 'unavailable'; this.corrupt = null;
    try {
      claimRequire(this.storage, 'CLAIM_STORAGE_UNAVAILABLE'); raw = this.storage!.getItem(CLAIM_STORAGE_KEY); status = 'corrupt';
      const parsed: unknown = raw === null ? emptyClaimData() : JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion !== 'verified-claim.v1') {
        status = 'unsupported_version'; throw new Error('CLAIM_FUTURE_SCHEMA_LOCKED');
      }
      validateClaimData(parsed);
      return { data: this.remember(cloneClaim(parsed), raw), error: null, corruptedRaw: null, recoveryStatus: null };
    } catch (error) {
      if (status === 'corrupt') this.corrupt = raw;
      return { data: emptyClaimData(), error: String(error), corruptedRaw: raw, recoveryStatus: status };
    }
  }
  private authoritative(base: ClaimData): { data: ClaimData; raw: string | null } {
    const snapshot = this.snapshots.get(base);
    claimRequire(snapshot !== undefined && snapshot === canonicalJson(base), 'CLAIM_BASE_UNBOUND_OR_MUTATED');
    const raw = this.guard.assertCurrent(base);
    const data: unknown = JSON.parse(raw ?? snapshot!); validateClaimData(data);
    return { data, raw };
  }
  private append(base: ClaimData, additions: ClaimAdditions): ClaimData {
    canonicalJson(additions);
    claimRequire(Object.keys(additions).every(key => (keys as readonly string[]).includes(key)), 'CLAIM_APPEND_COLLECTION');
    const next = this.authoritative(base).data;
    for (const key of keys) {
      const rows = additions[key] ?? []; claimRequire(Array.isArray(rows), 'CLAIM_APPEND_ARRAY');
      (next[key] as unknown[]) = [...next[key], ...cloneClaim(rows)];
    }
    claimRequire([...next.entries, ...next.revisions, ...next.reviews].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'CLAIM_FUTURE_WRITE');
    validateClaimOwners(next, this.owners);
    claimReadModel(next, this.owners, this.now().toISOString());
    this.guard.write(next, base); return this.remember(next, JSON.stringify(next));
  }
  saveDraft(base: ClaimData, revision: ClaimRevision): ClaimData {
    const data = this.authoritative(base).data;
    const entry = data.entries.find(e => e.claimId === revision.claimId);
    claimRequire(!data.reviews.some(r => r.claimId === revision.claimId && Date.parse(r.createdAt) >= Date.parse(revision.createdAt)), 'CLAIM_REVISION_AFTER_REVIEW_REQUIRED');
    const entries = entry ? [] : [{ claimId: revision.claimId, adapter: revision.binding.adapter, candidateId: revision.binding.candidateRef.objectId,
      origin: revision.origin, generation: revision.generation, createdAt: revision.createdAt }];
    return this.append(base, { entries, revisions: [revision] });
  }
  prepareReview(base: ClaimData, revisionId: string): ClaimPreview {
    const data = this.authoritative(base).data;
    const revision = data.revisions.find(r => r.revisionId === revisionId);
    claimRequire(revision && !data.revisions.some(r => r.supersedes === revisionId) && !data.reviews.some(r => r.revisionId === revisionId), 'CLAIM_REVIEW_NOT_OPEN');
    const preview = previewClaim(revision!, this.owners);
    this.previews.set(preview, { base, revisionId, snapshot: canonicalJson(preview) });
    return preview;
  }
  confirmReview(preview: ClaimPreview, decision: ClaimReview['decision'], note: string, confirmed: boolean): ClaimData {
    claimRequire(confirmed, 'CLAIM_USER_CONFIRMATION_REQUIRED');
    const bound = this.previews.get(preview);
    claimRequire(bound && bound.snapshot === canonicalJson(preview), 'CLAIM_PREVIEW_UNBOUND_OR_MUTATED');
    const fresh = this.prepareReview(bound!.base, bound!.revisionId);
    claimRequire(decision !== 'VERIFIED' || fresh.verifiable, 'CLAIM_F2_BLOCKED');
    const reviewId = globalThis.crypto.randomUUID();
    const data = this.append(bound!.base, { reviews: [{ reviewId, claimId: fresh.revision.claimId, revisionId: bound!.revisionId,
      decision, reviewerType: 'user', userApprovalRef: { owner: 'ClaimReview', approvalId: reviewId }, createdAt: this.now().toISOString(), note }] });
    this.previews.delete(preview); return data;
  }
  export(data: ClaimData): string {
    validateClaimData(data);
    return JSON.stringify({ format: CLAIM_BACKUP_FORMAT, exportedAt: this.now().toISOString(), data }, null, 2) + '\n';
  }
  private parseBackup(raw: string): ClaimData {
    const value: unknown = JSON.parse(raw);
    claimRequire(value && typeof value === 'object' && !Array.isArray(value), 'CLAIM_BACKUP_FORMAT');
    const envelope = value as Record<string, unknown>;
    claimRequire(Object.keys(envelope).sort().join(',') === 'data,exportedAt,format' && envelope.format === CLAIM_BACKUP_FORMAT
      && typeof envelope.exportedAt === 'string' && isPreciseInstant(envelope.exportedAt), 'CLAIM_BACKUP_FORMAT');
    validateClaimData(envelope.data);
    claimRequire([...envelope.data.entries, ...envelope.data.revisions, ...envelope.data.reviews].every(r => Date.parse(r.createdAt) <= this.now().getTime()), 'CLAIM_FUTURE_IMPORT');
    validateClaimOwners(envelope.data, this.owners); return cloneClaim(envelope.data);
  }
  previewImport(raw: string, base: ClaimData): ClaimImportPreview {
    validateClaimData(base); const imported = this.parseBackup(raw), next = cloneClaim(base);
    let addCount = 0, skipCount = 0;
    for (const key of keys) {
      const prior = new Map(next[key].map(row => [id(row), row]));
      for (const row of imported[key]) {
        const existing = prior.get(id(row));
        if (existing) { claimRequire(canonicalJson(existing) === canonicalJson(row), 'CLAIM_IMPORT_HISTORY_CONFLICT'); skipCount++; }
        else { (next[key] as unknown[]).push(row); addCount++; }
      }
    }
    validateClaimOwners(next, this.owners); claimReadModel(next, this.owners, this.now().toISOString()); return { data: next, addCount, skipCount };
  }
  private backup(kind: 'import' | 'recovery', raw: string, assertCurrent: () => void): void {
    const prefix = `${CLAIM_STORAGE_KEY}.pre-${kind}.${this.now().toISOString()}`;
    let key = prefix, counter = 0;
    while (this.storage!.getItem(key) !== null) key = `${prefix}.${++counter}`;
    assertCurrent(); this.storage!.setItem(key, raw);
    claimRequire(this.storage!.getItem(key) === raw, 'CLAIM_PREWRITE_BACKUP_FAILED'); assertCurrent();
  }
  import(base: ClaimData, raw: string, confirmed: boolean): ClaimData {
    claimRequire(confirmed, 'CLAIM_IMPORT_CONFIRMATION_REQUIRED');
    const current = this.authoritative(base), { data } = this.previewImport(raw, current.data);
    this.backup('import', current.raw ?? JSON.stringify(current.data), () => { this.guard.assertCurrent(base); });
    this.guard.write(data, base); return this.remember(data, JSON.stringify(data));
  }
  private assertCorrupt(raw: string): void {
    claimRequire(this.storage && this.corrupt !== null && this.corrupt === raw && this.storage.getItem(CLAIM_STORAGE_KEY) === raw, 'CLAIM_RECOVERY_NOT_OBSERVED_OR_CHANGED');
  }
  previewRecovery(raw: string, corruptedRaw: string): ClaimImportPreview {
    this.assertCorrupt(corruptedRaw); const data = this.parseBackup(raw); claimReadModel(data, this.owners, this.now().toISOString()); this.assertCorrupt(corruptedRaw);
    return { data, addCount: keys.reduce((sum, key) => sum + data[key].length, 0), skipCount: 0 };
  }
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): ClaimData {
    claimRequire(confirmed, 'CLAIM_RECOVERY_CONFIRMATION_REQUIRED');
    const { data } = this.previewRecovery(raw, corruptedRaw);
    this.backup('recovery', corruptedRaw, () => this.assertCorrupt(corruptedRaw));
    const expected = JSON.stringify(data); this.storage!.setItem(CLAIM_STORAGE_KEY, expected);
    const reloaded = this.load();
    claimRequire(reloaded.error === null && this.storage!.getItem(CLAIM_STORAGE_KEY) === expected && canonicalJson(reloaded.data) === canonicalJson(data), 'CLAIM_RECOVERY_READBACK_FAILED');
    return reloaded.data;
  }
}
