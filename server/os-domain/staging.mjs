import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateDecisionSnapshot, SNAPSHOT_TTL_MS, PUBLISH_MAX_AGE_MS } from '../../shared/decision-snapshot.mjs';

export const snapshotDigest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const bindingSchema = z.object({ snapshotId: z.string().uuid(), digest: hash, generation: z.number().int().positive().safe(), asOf: z.string().datetime({ offset: true }) }).strict();
const pointerSchema = z.object({ generation: z.number().int().nonnegative().safe(), revoked: z.boolean(), binding: bindingSchema.nullable(), expiresAt: z.number().int().nonnegative().safe() }).strict();
const publishSchema = z.object({ snapshot: z.unknown(), digest: hash, expectedGeneration: z.number().int().nonnegative().safe(), consent: z.literal('publish-current-decision-state') }).strict();
export class DecisionStaging {
  constructor(store, subject, now = () => Date.now(), scope = 'real') { this.store = store; this.now = now; this.scope = scope; this.prefix = `os-domain/${createHash('sha256').update(subject).digest('hex')}/`; }
  async pointer() {
    const stored = await this.store.versioned(`${this.prefix}current.json`);
    return { value: stored ? pointerSchema.parse(stored.value) : { generation: 0, revoked: true, binding: null, expiresAt: 0 }, etag: stored?.etag ?? null };
  }
  async status() {
    const { value } = await this.pointer();
    return { generation: value.generation, status: value.revoked ? 'revoked' : value.expiresAt <= this.now() ? 'expired' : 'published', binding: value.revoked || value.expiresAt <= this.now() ? null : value.binding, expiresAt: value.expiresAt };
  }
  async publish(input) {
    const value = publishSchema.parse(input), snapshot = validateDecisionSnapshot(value.snapshot), digest = snapshotDigest(snapshot), now = this.now();
    if (snapshot.scope !== this.scope || digest !== value.digest || now < Date.parse(snapshot.generatedAt) || now - Date.parse(snapshot.generatedAt) > PUBLISH_MAX_AGE_MS) throw Error('SNAPSHOT_INVALID_OR_STALE');
    const prior = await this.pointer();
    if (value.expectedGeneration !== prior.value.generation) throw Error('GENERATION_DRIFT');
    const binding = { snapshotId: snapshot.snapshotId, digest, generation: prior.value.generation + 1, asOf: snapshot.asOf };
    // Immutable content first; only the CAS pointer grants access. Orphans never grant reads.
    await this.store.putNew(`${this.prefix}snapshots/${snapshot.snapshotId}.json`, snapshot);
    const expiresAt = now + SNAPSHOT_TTL_MS;
    if (!await this.store.compareExchange(`${this.prefix}current.json`, prior.etag, { binding, generation: binding.generation, revoked: false, expiresAt })) throw Error('GENERATION_DRIFT');
    return { binding, expiresAt, authority: 'private-temporary-staging' };
  }
  async revoke(expectedGeneration) {
    z.number().int().nonnegative().safe().parse(expectedGeneration);
    const prior = await this.pointer();
    if (prior.value.generation !== expectedGeneration) throw Error('GENERATION_DRIFT');
    if (!await this.store.compareExchange(`${this.prefix}current.json`, prior.etag, { generation: expectedGeneration + 1, revoked: true, binding: null, expiresAt: 0 })) throw Error('GENERATION_DRIFT');
    return { status: 'revoked', generation: expectedGeneration + 1 };
  }
  async read(requested) {
    const prior = await this.pointer(), p = prior.value;
    if (p.revoked || p.expiresAt <= this.now() || !p.binding || p.generation !== p.binding.generation) throw Error('SNAPSHOT_UNAVAILABLE');
    if (requested && canonicalJson(bindingSchema.parse(requested)) !== canonicalJson(p.binding)) throw Error('SNAPSHOT_BINDING_DRIFT');
    const snapshot = validateDecisionSnapshot(await this.store.get(`${this.prefix}snapshots/${p.binding.snapshotId}.json`));
    if (snapshot.scope !== this.scope || snapshot.snapshotId !== p.binding.snapshotId || snapshot.asOf !== p.binding.asOf || snapshotDigest(snapshot) !== p.binding.digest) throw Error('SNAPSHOT_DIGEST_DRIFT');
    const after = await this.pointer();
    if (after.etag !== prior.etag || canonicalJson(after.value) !== canonicalJson(p) || p.expiresAt <= this.now()) throw Error('SNAPSHOT_ACCESS_CHANGED');
    return { snapshot, binding: p.binding, expiresAt: p.expiresAt };
  }
}
