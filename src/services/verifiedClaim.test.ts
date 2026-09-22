import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../contracts/verified-claim/v1/claim.schema.json';
import shared from '../../contracts/financial-research/v1/shared.schema.json';
import generated from './verifiedClaimValidator.generated.mjs';
import { claimFixture, claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { claimReadModel, cloneClaim, draftClaim, previewClaim, validateClaimData } from './verifiedClaim';
import { BrowserClaimRepository, CLAIM_STORAGE_KEY } from './verifiedClaimRepository';
import { createIndustryClaimOwners } from './industryVerifiedClaimAdapter';
import { loadIndustrySignalClaims } from './industrySignalClaimProvider';

const setup = async () => {
  const f = await claimFixture(), storage = claimStorage(); let now = at(7);
  const repo = new BrowserClaimRepository(storage, f.owners, () => new Date(now));
  const data = repo.saveDraft(repo.load().data, f.revision);
  return { ...f, storage, repo, data, tick: (day: number) => { now = at(day); } };
};
describe('Verified Claim exact F2 / local owner', () => {
  it('requires explicit confirmation, persists AI/template origin, reads historical decisions and never inherits VERIFIED', async () => {
    const f = await setup(), preview = f.repo.prepareReview(f.data, f.revision.revisionId);
    expect(preview.verifiable).toBe(true);
    expect(() => f.repo.confirmReview(preview, 'VERIFIED', 'checked', false)).toThrow(/CONFIRMATION/);
    const verified = f.repo.confirmReview(preview, 'VERIFIED', 'checked', true);
    expect(claimReadModel(verified, f.owners, at(6))[0].status).toBe('DRAFT');
    expect(claimReadModel(verified, f.owners, at(7))[0].status).toBe('VERIFIED');
    expect(verified.entries[0].origin).toBe('ai_draft'); expect(verified.revisions[0].generation).toBe('TEMPLATE');
    f.tick(9);
    const next = draftClaim(f.binding, f.owners, { revisionId: 'r2', createdAt: at(8), asOf: at(8), supersedes: f.revision.revisionId, reason: 'new context', contexts: [{ kind: 'notion', title: 'Synthetic context', url: 'https://example.com/synthetic-context' }] });
    const updated = f.repo.saveDraft(verified, next);
    expect(claimReadModel(updated, f.owners, at(9))[0].status).toBe('DRAFT');
    expect(claimReadModel(updated, f.owners, at(7))[0].status).toBe('VERIFIED');
    const rejected = f.repo.confirmReview(f.repo.prepareReview(updated, 'r2'), 'REJECTED', 'review rejected', true);
    expect(claimReadModel(rejected, f.owners, at(9))[0].status).toBe('REJECTED');
    expect(rejected.reviews).toHaveLength(2); expect(rejected.revisions[0]).toEqual(f.revision);
  });
  it.each(['partial', 'stale', 'unknown', 'not_admitted', 'conflicted', 'missing_evidence'])('cannot override F2 %s with confirmation or context', async condition => {
    const f = await claimFixture(g => { g.nodes[0].conditions = [condition as 'partial']; g.nodes[0].conditionSourceRefs = [g.nodes[0].ref]; });
    f.revision.contexts = [{ kind: 'drive', title: 'Reviewed synthetic report', url: 'https://example.com/synthetic-report' }];
    const repo = new BrowserClaimRepository(claimStorage(), f.owners, () => new Date(at(7)));
    const data = repo.saveDraft(repo.load().data, f.revision), preview = repo.prepareReview(data, f.revision.revisionId);
    expect(preview.blockers).toContain(condition); expect(preview.verifiable).toBe(false);
    expect(() => repo.confirmReview(preview, 'VERIFIED', 'user cannot override', true)).toThrow(/F2_BLOCKED/);
    expect(repo.confirmReview(preview, 'REJECTED', 'blocked', true).reviews[0].decision).toBe('REJECTED');
  });
  it.each(['statement','scope','origin','generation'] as const)('rejects changed %s even when evidence supports the original', async key => {
    const f = await setup(), revision = cloneClaim(f.revision); Object.assign(revision, { [key]: 'different' });
    expect(previewClaim(revision, f.owners).verifiable).toBe(false);
    expect(() => f.repo.saveDraft(f.data, revision)).toThrow();
  });
  it.each(['graphId','graphRevision','graphSha256','targetNodeId','adapter'] as const)('rejects foreign binding %s', async key => {
    const f = await setup(), revision = cloneClaim(f.revision); Object.assign(revision.binding, { [key]: key === 'graphRevision' ? 2 : 'foreign' });
    expect(previewClaim(revision, f.owners).verifiable).toBe(false);
  });
  it('rejects A preview used to save B, cloned preview, replay, mutated base and stale concurrent base', async () => {
    const f = await setup(), p = f.repo.prepareReview(f.data, f.revision.revisionId);
    expect(() => f.repo.confirmReview(cloneClaim(p), 'VERIFIED', 'forged', true)).toThrow(/UNBOUND/);
    p.revision.statement = 'B'; expect(() => f.repo.confirmReview(p, 'VERIFIED', 'changed', true)).toThrow(/MUTATED/);
    const fresh = f.repo.prepareReview(f.data, f.revision.revisionId);
    f.repo.confirmReview(fresh, 'VERIFIED', 'checked', true);
    expect(() => f.repo.confirmReview(fresh, 'VERIFIED', 'replay', true)).toThrow();
    expect(() => f.repo.saveDraft(f.data, { ...f.revision, revisionId: 'r2', supersedes: f.revision.revisionId })).toThrow();
    const loaded = f.repo.load().data; loaded.entries[0].origin = 'user_judgement';
    expect(() => f.repo.prepareReview(loaded, f.revision.revisionId)).toThrow(/MUTATED/);
  });
  it('rechecks owner after preview and refuses restored VERIFIED with unavailable owner', async () => {
    const f = await setup(), preview = f.repo.prepareReview(f.data, f.revision.revisionId);
    f.graph.nodes[0].releaseAvailableAt = null;
    expect(() => f.repo.confirmReview(preview, 'VERIFIED', 'stale preview', true)).toThrow(/F2_BLOCKED/);
    expect(f.repo.load().data.reviews).toHaveLength(0);
  });
  it.each(['cycle', 'dangling', 'foreign-pin', 'future-release', 'missing-support', 'counter-evidence'])('R1 carries through original F2 %s rejection', async mode => {
    const f = await claimFixture(graph => {
      if (mode === 'cycle') graph.edges.push({ ...graph.edges[0], relationId: 'synthetic-cycle', from: 'claim', to: 'source' });
      if (mode === 'dangling') graph.edges[0].from = 'foreign-node';
      if (mode === 'foreign-pin') graph.nodes[0].ref.sha256 = '0'.repeat(64);
      if (mode === 'future-release') graph.nodes[0].releaseAvailableAt = at(30);
      if (mode === 'missing-support') graph.edges = graph.edges.filter(edge => edge.to !== 'claim');
      if (mode === 'counter-evidence') graph.edges.push({ ...graph.edges.find(e => e.to === 'claim')!, relationId: 'synthetic-counter', type: 'contradicts' });
    });
    const gate = previewClaim(f.revision, f.owners);
    expect(gate.verifiable).toBe(false);
    if (mode === 'counter-evidence') expect(gate.assessment.outcome).toBe('conflicted');
  });
  it('historical VERIFIED becomes explicitly BLOCKED when original owner cannot be resolved', async () => {
    const f = await setup(), verified = f.repo.confirmReview(f.repo.prepareReview(f.data, f.revision.revisionId), 'VERIFIED', 'checked', true);
    expect(claimReadModel(verified, { resolve() { throw Error('offline'); } }, at(8))[0].status).toBe('BLOCKED');
    expect(verified.reviews[0].decision).toBe('VERIFIED');
  });
  it('rejects revision forks, duplicate reviews, foreign approval, provider_fact, unknown context fields and URL schemes', async () => {
    const f = await setup(); const ajv = new Ajv2020({ strict: true, strictRequired: false }); addFormats(ajv); ajv.addSchema(shared); const validate = ajv.compile(schema);
    expect(validate(f.data)).toBe(true); expect(generated(f.data)).toBe(true);
    const mutations = [
      (d: typeof f.data) => { d.revisions.push({ ...d.revisions[0], revisionId: 'fork' }); },
      (d: typeof f.data) => { Object.assign(d.revisions[0], { origin: 'provider_fact' }); },
      (d: typeof f.data) => { Object.assign(d, { schemaVersion: 'verified-claim.v2' }); },
      (d: typeof f.data) => { d.revisions[0].contexts = [Object.assign({ kind: 'web' as const, title: 'x', url: 'https://example.com' }, { body: 'not permitted' })]; },
      (d: typeof f.data) => { d.revisions[0].contexts = [{ kind: 'web', title: 'x', url: 'javascript:alert(1)' }]; },
    ];
    for (const mutate of mutations) { const d = cloneClaim(f.data); mutate(d); expect(generated(d)).toBe(validate(d)); expect(() => validateClaimData(d)).toThrow(); }
    const reviewed = f.repo.confirmReview(f.repo.prepareReview(f.data, f.revision.revisionId), 'VERIFIED', 'checked', true);
    const badApproval = cloneClaim(reviewed); badApproval.reviews[0].userApprovalRef.approvalId = 'foreign'; expect(() => validateClaimData(badApproval)).toThrow();
    reviewed.reviews.push({ ...reviewed.reviews[0], reviewId: 'duplicate', userApprovalRef: { owner: 'ClaimReview', approvalId: 'duplicate' } }); expect(() => validateClaimData(reviewed)).toThrow();
  });
  it('JSON roundtrip retains complete history, rejects overwrite and requires backup before import / corruption recovery', async () => {
    const f = await setup(), verified = f.repo.confirmReview(f.repo.prepareReview(f.data, f.revision.revisionId), 'VERIFIED', 'checked', true), raw = f.repo.export(verified);
    const storage = claimStorage(), repo = new BrowserClaimRepository(storage, f.owners, () => new Date(at(9))), base = repo.load().data;
    expect(() => repo.import(base, raw, false)).toThrow(/CONFIRMATION/);
    const restored = repo.import(base, raw, true); expect(restored).toEqual(verified);
    expect([...storage.values.keys()].some(k => k.includes('.pre-import.'))).toBe(true);
    expect(repo.previewImport(raw, restored).skipCount).toBe(3);
    const changed = JSON.parse(raw); changed.data.revisions[0].reason = 'history rewrite';
    expect(() => repo.import(restored, JSON.stringify(changed), true)).toThrow(/HISTORY_CONFLICT/);
    storage.setItem(CLAIM_STORAGE_KEY, '{broken'); const load = repo.load(); expect(load.recoveryStatus).toBe('corrupt');
    expect(() => repo.saveDraft(load.data, f.revision)).toThrow(/UNBOUND/);
    expect(repo.recoverCorrupt(raw, '{broken', true)).toEqual(verified);
    expect([...storage.values.entries()].some(([k,v]) => k.includes('.pre-recovery.') && v === '{broken')).toBe(true);
    storage.setItem(CLAIM_STORAGE_KEY, '{"schemaVersion":"verified-claim.v99"}'); expect(repo.load().recoveryStatus).toBe('unsupported_version');
    expect(() => repo.recoverCorrupt(raw, storage.getItem(CLAIM_STORAGE_KEY)!, true)).toThrow(/NOT_OBSERVED/);
  });
  it('recovery refuses changed corrupt bytes, storage failure and forged imported VERIFIED', async () => {
    const f = await setup(), raw = f.repo.export(f.data); f.storage.setItem(CLAIM_STORAGE_KEY, '{bad'); f.repo.load(); f.storage.setItem(CLAIM_STORAGE_KEY, '{changed');
    expect(() => f.repo.recoverCorrupt(raw, '{bad', true)).toThrow();
    const locked = new BrowserClaimRepository({ getItem: () => null, setItem() { throw Error('quota'); }, removeItem() { throw Error('not supported'); } }, f.owners);
    expect(() => locked.import(locked.load().data, raw, true)).toThrow(/quota/);
    const blocked = await claimFixture(g => { g.nodes[0].releaseAvailableAt = null; }), repo = new BrowserClaimRepository(claimStorage(), blocked.owners, () => new Date(at(9)));
    const data = repo.saveDraft(repo.load().data, blocked.revision);
    data.reviews.push({ reviewId: 'forged', claimId: blocked.revision.claimId, revisionId: blocked.revision.revisionId, decision: 'VERIFIED', reviewerType: 'user', userApprovalRef: { owner: 'ClaimReview', approvalId: 'forged' }, createdAt: at(8), note: 'forged' });
    expect(() => repo.previewImport(repo.export(data), repo.load().data)).toThrow(/VERIFIED_GATE_BLOCKED/);
  });
  it('context is excluded from F2 assessment, and duplicate/orphan/cycle/future times fail closed', async () => {
    const f = await setup(), before = previewClaim(f.revision, f.owners);
    f.revision.contexts = [{ kind: 'report', title: 'Synthetic researcher says supported', url: 'https://example.com/synthetic' }];
    expect(previewClaim(f.revision, f.owners).assessment).toEqual(before.assessment);
    for (const timestamp of ['invalid', '2026-09-30T00:00:00Z']) expect(() => f.repo.saveDraft(f.data, { ...f.revision, revisionId: 'future', supersedes: f.revision.revisionId, createdAt: timestamp })).toThrow();
  });
  it('actual retained Industry remains 5 candidates / 0 verifiable / 0 verified with unchanged blockers', async () => {
    const state = await loadIndustrySignalClaims(); expect(state.status).toBe('available'); if (state.status !== 'available') throw Error(state.reason);
    const owners = await createIndustryClaimOwners(state.result); expect(owners.bindings).toHaveLength(5);
    const repo = new BrowserClaimRepository(claimStorage(), owners, () => new Date(at(22))); let data = repo.load().data;
    for (const [index, binding] of owners.bindings.entries()) {
      const revision = draftClaim(binding, owners, { revisionId: `industry-${index}`, createdAt: at(22), asOf: at(22), supersedes: null, reason: 'actual retained regression', contexts: [] });
      data = repo.saveDraft(data, revision); const p = repo.prepareReview(data, revision.revisionId);
      expect(p.verifiable).toBe(false); expect(p.blockers).toEqual(expect.arrayContaining(['not_admitted','partial','unknown']));
      expect(() => repo.confirmReview(p, 'VERIFIED', 'must refuse', true)).toThrow(/F2_BLOCKED/);
    }
    expect(data.revisions).toHaveLength(5); expect(data.reviews).toHaveLength(0);
    expect(claimReadModel(data, owners, at(22)).filter(r => r.status === 'VERIFIED')).toHaveLength(0);
  });
});
