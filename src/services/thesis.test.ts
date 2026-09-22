import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../contracts/thesis/v1/thesis.schema.json';
import { thesisFixture } from './thesis.fixture';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { cloneClaim, draftClaim } from './verifiedClaim';
import { CLAIM_STORAGE_KEY } from './verifiedClaimRepository';
import { BrowserClaimRepository } from './verifiedClaimRepository';
import { createIndustryClaimOwners } from './industryVerifiedClaimAdapter';
import { loadIndustrySignalClaims } from './industrySignalClaimProvider';
import { emptyThesisData, pinVerifiedClaim, previewThesis, thesisDiff, thesisReadModel, validateThesisData } from './thesis';
import { BrowserThesisRepository, THESIS_STORAGE_KEY } from './thesisRepository';
import type { ThesisData, ThesisOwners } from '../types/thesis';

async function setup() {
  const fixture = await thesisFixture(), storage = claimStorage(); let now = at(9);
  const repo = new BrowserThesisRepository(storage, fixture.owners, () => new Date(now));
  const data = repo.saveDraft(repo.load().data, fixture.revision);
  return { ...fixture, repo, storage, data, tick: (day: number) => { now = at(day); } };
}

describe('Thesis V1 exact Claim authority and local append-only service', () => {
  it('retains AI draft origin, requires explicit confirmation, and exposes formal history only after confirmation time', async () => {
    const f = await setup();
    expect(thesisReadModel(f.data, f.owners, at(9))[0].current).toBeNull();
    expect(f.repo.load().data.confirmations).toHaveLength(0);
    const preview = f.repo.prepareConfirmation(f.data, f.revision.revisionId);
    expect(preview.publishable).toBe(true);
    expect(() => f.repo.confirm(preview, 'Reviewed', false)).toThrow(/CONFIRMATION/);
    const confirmed = f.repo.confirm(preview, 'Explicit synthetic user confirmation', true);
    expect(confirmed.entries[0].origin).toBe('ai_draft'); expect(confirmed.revisions[0].origin).toBe('ai_draft');
    expect(confirmed.confirmations[0].actor).toBe('user');
    expect(confirmed.confirmations[0].userApprovalRef.approvalId).toBe(confirmed.confirmations[0].confirmationId);
    expect(thesisReadModel(confirmed, f.owners, at(8))[0].current).toBeNull();
    expect(thesisReadModel(confirmed, f.owners, at(9))[0].current?.revisionId).toBe(f.revision.revisionId);
    expect(thesisReadModel(confirmed, f.owners, at(7))).toEqual([]);
  });

  it('keeps confirmed current while a successor is draft, then appends confirmation without overwriting prior bytes', async () => {
    const f = await setup(), confirmed = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.revision.revisionId), 'Confirm first', true);
    const firstBytes = JSON.stringify(confirmed.revisions[0]), confirmationBytes = JSON.stringify(confirmed.confirmations[0]);
    f.tick(11);
    const next = { ...cloneClaim(f.revision), revisionId: 'synthetic-thesis-r2', supersedes: f.revision.revisionId, createdAt: at(10), asOf: at(10), statement: 'Synthetic revised scenario', confidence: 'low' as const };
    const data = f.repo.saveDraft(confirmed, next), row = thesisReadModel(data, f.owners, at(11))[0];
    expect(row.current?.revisionId).toBe(f.revision.revisionId); expect(row.draft?.revisionId).toBe(next.revisionId);
    expect(row.history).toHaveLength(2); expect(row.confirmations).toHaveLength(1);
    expect(thesisDiff(f.revision, next).map(change => change.field)).toEqual(expect.arrayContaining(['statement', 'confidence']));
    expect(thesisDiff(f.revision, cloneClaim(f.revision))).toEqual([]);
    expect(thesisDiff(null, f.revision).length).toBeGreaterThan(0);
    const second = f.repo.confirm(f.repo.prepareConfirmation(data, next.revisionId), 'Confirm second', true);
    expect(thesisReadModel(second, f.owners, at(11))[0].current?.revisionId).toBe(next.revisionId);
    expect(thesisReadModel(second, f.owners, at(9))[0].current?.revisionId).toBe(f.revision.revisionId);
    expect(JSON.stringify(second.revisions[0])).toBe(firstBytes); expect(JSON.stringify(second.confirmations[0])).toBe(confirmationBytes);
  });

  it('pins exact old Claim revision and review without following a newer Claim head', async () => {
    const f = await setup(), oldRef = cloneClaim(f.ref); f.tickClaim(11);
    const next = draftClaim(f.claim.binding, f.claim.owners, { revisionId: 'synthetic-claim-r2', createdAt: at(10), asOf: at(10), supersedes: f.claim.revision.revisionId, reason: 'Synthetic later draft', contexts: [] });
    const data = f.claimRepo.saveDraft(f.claimRepo.load().data, next);
    expect(data.revisions).toHaveLength(2);
    const gate = previewThesis(f.revision, f.owners);
    expect(gate.publishable).toBe(true); expect(gate.claims[0].revision?.revisionId).toBe(oldRef.revisionId);
    expect(f.revision.supportingClaims).toEqual([oldRef]);
    expect(() => pinVerifiedClaim(next, data.reviews[0])).toThrow();
  });

  it.each(['claimId', 'revisionId', 'reviewId', 'revisionBytes', 'reviewBytes'] as const)('rejects substituted exact Claim %s pins', async field => {
    const f = await setup(), changed = cloneClaim(f.revision);
    changed.supportingClaims[0][field] = 'foreign';
    expect(previewThesis(changed, f.owners).publishable).toBe(false);
  });

  it.each(['revision', 'review', 'missing', 'corrupt', 'future'])('fails closed when original Claim owner has %s drift', async mode => {
    const f = await setup(), p = f.repo.prepareConfirmation(f.data, f.revision.revisionId), original = f.claimRepo.load().data;
    if (mode === 'revision') original.revisions[0].reason = 'Changed original history';
    if (mode === 'review') original.reviews[0].note = 'Changed original review';
    if (mode === 'missing') { original.entries = []; original.revisions = []; original.reviews = []; }
    f.claimStore.setItem(CLAIM_STORAGE_KEY, mode === 'corrupt' ? '{broken' : mode === 'future' ? '{"schemaVersion":"verified-claim.v99"}' : JSON.stringify(original));
    expect(previewThesis(f.revision, f.owners).publishable).toBe(false);
    expect(() => f.repo.confirm(p, 'Cannot override original owner', true)).toThrow();
    expect(f.repo.load().data.confirmations).toHaveLength(0);
  });

  it('rechecks F2 evidence at confirmation and keeps historical formal data blocked without deleting confirmation', async () => {
    const f = await setup(), confirmed = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.revision.revisionId), 'Confirm available evidence', true);
    f.claim.graph.nodes[0].releaseAvailableAt = null;
    const row = thesisReadModel(confirmed, f.owners, at(9))[0];
    expect(row.current?.revisionId).toBe(f.revision.revisionId); expect(row.gate?.publishable).toBe(false);
    expect(confirmed.confirmations).toHaveLength(1);
    const target = new BrowserThesisRepository(claimStorage(), f.owners, () => new Date(at(12)));
    expect(() => target.previewImport(f.repo.export(confirmed), target.load().data)).toThrow();
    f.tick(12);
    expect(() => f.repo.saveDraft(confirmed, { ...cloneClaim(f.revision), revisionId: 'after-owner-loss', supersedes: f.revision.revisionId,
      createdAt: at(11), asOf: at(11) })).toThrow(/FORMAL_SUPPORT_BLOCKED/);
    expect(f.repo.load().data).toEqual(confirmed);
  });

  it('does not allow contexts or pin bytes to replace an absent VERIFIED Claim', async () => {
    const f = await setup(), contextual = cloneClaim(f.revision);
    contextual.contexts = [{ kind: 'notion', title: 'Synthetic background', url: 'https://example.com/context' }];
    const plain = previewThesis(f.revision, f.owners), context = previewThesis(contextual, f.owners);
    expect(context.publishable).toBe(plain.publishable); expect(context.claims).toEqual(plain.claims); expect(context.relationships).toEqual(plain.relationships);
    contextual.supportingClaims = []; contextual.macroIndustry = [];
    expect(previewThesis(contextual, f.owners).publishable).toBe(false);
    const draftOnly = f.claimRepo.load().data; draftOnly.reviews = [];
    f.claimStore.setItem(CLAIM_STORAGE_KEY, JSON.stringify(draftOnly));
    expect(previewThesis(f.revision, f.owners).publishable).toBe(false);
  });

  it('rejects cloned/mutated previews, replay, stale concurrent base and mutation of a loaded base', async () => {
    const f = await setup(), p = f.repo.prepareConfirmation(f.data, f.revision.revisionId);
    expect(() => f.repo.confirm(cloneClaim(p), 'Forged preview', true)).toThrow(/UNBOUND/);
    p.revision.statement = 'Changed draft'; expect(() => f.repo.confirm(p, 'Mutated preview', true)).toThrow(/MUTATED/);
    const fresh = f.repo.prepareConfirmation(f.data, f.revision.revisionId);
    const data = f.repo.confirm(fresh, 'Confirm exact saved revision', true);
    expect(() => f.repo.confirm(fresh, 'Replay', true)).toThrow();
    expect(() => f.repo.saveDraft(f.data, { ...f.revision, revisionId: 'stale-r2', supersedes: f.revision.revisionId })).toThrow();
    data.revisions[0].statement = 'Changed base';
    expect(() => f.repo.prepareConfirmation(data, f.revision.revisionId)).toThrow(/MUTATED/);
  });

  it('compares loaded storage exact raw bytes even when parsed values are unchanged', async () => {
    const f = await setup(), before = f.storage.getItem(THESIS_STORAGE_KEY)!;
    f.storage.setItem(THESIS_STORAGE_KEY, before + '\n');
    expect(() => f.repo.prepareConfirmation(f.data, f.revision.revisionId)).toThrow();
    expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(before + '\n');
  });

  it('requires Claim review availability by Thesis asOf, precise dates and confirmation chronology', async () => {
    const f = await setup();
    const beforeReview = cloneClaim(f.revision); beforeReview.asOf = at(6); beforeReview.macroIndustry = [];
    expect(previewThesis(beforeReview, f.owners).publishable).toBe(false);
    for (const value of ['invalid', at(30)]) {
      expect(() => f.repo.saveDraft(f.data, { ...cloneClaim(f.revision), revisionId: 'bad-time', supersedes: f.revision.revisionId, createdAt: value, asOf: value })).toThrow();
    }
    const confirmed = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.revision.revisionId), 'Confirm chronology', true);
    const early = cloneClaim(confirmed); early.confirmations[0].createdAt = at(7);
    expect(() => validateThesisData(early)).toThrow();
    expect(() => f.repo.saveDraft(confirmed, { ...cloneClaim(f.revision), revisionId: 'backdated-r2', supersedes: f.revision.revisionId, createdAt: at(9) })).toThrow();
  });

  it('distinguishes supported/unknown exposure and blocks unresolved or substituted exact identity', async () => {
    const f = await setup(); expect(previewThesis(f.revision, f.owners).relationships[0].status).toBe('supported');
    const unknown = cloneClaim(f.revision); unknown.macroIndustry[0].exposure = 'unknown'; unknown.macroIndustry[0].sensitivity = 'unknown'; unknown.macroIndustry[0].supportingClaims = [];
    const gate = previewThesis(unknown, f.owners); expect(gate.relationships[0].status).toBe('unknown'); expect(gate.publishable).toBe(true);
    const foreign = cloneClaim(f.revision); foreign.macroIndustry[0].industry.id = 'missing-industry';
    expect(previewThesis(foreign, f.owners).relationships[0].status).toBe('blocked'); expect(previewThesis(foreign, f.owners).publishable).toBe(false);
    const substitutingOwners: ThesisOwners = { ...f.owners, resolveIdentity() { return { owner: 'Industry', id: 'foreign' }; } };
    expect(previewThesis(f.revision, substitutingOwners).publishable).toBe(false);
    f.identities.push(cloneClaim(f.identities[0])); expect(previewThesis(f.revision, f.owners).publishable).toBe(false);
  });

  it('blocks foreign relationship support and future relationship asOf without manufacturing sensitivity numbers', async () => {
    const f = await setup(), foreign = cloneClaim(f.revision); foreign.macroIndustry[0].supportingClaims[0].reviewId = 'foreign';
    expect(previewThesis(foreign, f.owners).publishable).toBe(false);
    const future = cloneClaim(f.revision); future.macroIndustry[0].asOf = at(30);
    expect(previewThesis(future, f.owners).publishable).toBe(false);
    const numeric = cloneClaim(f.data); Object.assign(numeric.revisions[0].macroIndustry[0], { sensitivity: 0.5 }); expect(() => validateThesisData(numeric)).toThrow();
    const beforeReview = cloneClaim(f.revision); beforeReview.macroIndustry[0].asOf = at(6);
    expect(previewThesis(beforeReview, f.owners).relationships[0].status).toBe('blocked');
  });

  it('validates versioned schema and rejects forks, duplicate rows, orphan revisions, authority fields and invalid context', async () => {
    const f = await setup(), ajv = new Ajv2020({ strict: true, strictRequired: false }); addFormats(ajv); const validate = ajv.compile(schema);
    expect(validate(f.data)).toBe(true); expect(() => validateThesisData(emptyThesisData())).not.toThrow();
    const mutations: ((d: ThesisData) => void)[] = [
      d => { d.revisions.push({ ...cloneClaim(d.revisions[0]), revisionId: 'fork-root' }); },
      d => { d.entries.push(cloneClaim(d.entries[0])); },
      d => { d.revisions[0].supersedes = 'missing'; },
      d => { d.revisions[0].thesisId = 'foreign'; },
      d => { Object.assign(d.revisions[0], { origin: 'provider_fact' }); },
      d => { Object.assign(d, { schemaVersion: 'thesis.v99' }); },
      d => { Object.assign(d.revisions[0], { verified: true }); },
      d => { d.revisions[0].contexts = [{ kind: 'web', title: 'x', url: 'javascript:alert(1)' }]; },
      d => { d.revisions[0].contexts = [Object.assign({ kind: 'web' as const, title: 'x', url: 'https://example.com' }, { body: 'not allowed' })]; },
    ];
    for (const mutate of mutations) { const data = cloneClaim(f.data); mutate(data); expect(() => validateThesisData(data)).toThrow(); }
    const confirmed = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.revision.revisionId), 'Synthetic confirmation', true);
    const approval = cloneClaim(confirmed); approval.confirmations[0].userApprovalRef.approvalId = 'foreign'; expect(() => validateThesisData(approval)).toThrow();
    confirmed.confirmations.push({ ...cloneClaim(confirmed.confirmations[0]), confirmationId: 'duplicate', userApprovalRef: { owner: 'ThesisConfirmation', approvalId: 'duplicate' } });
    expect(() => validateThesisData(confirmed)).toThrow();
  });

  it('JSON import retains history, refuses conflicts and preserves exact pre-import and pre-recovery bytes', async () => {
    const f = await setup(), confirmed = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.revision.revisionId), 'Confirmed fixture', true), raw = f.repo.export(confirmed);
    const storage = claimStorage(), repo = new BrowserThesisRepository(storage, f.owners, () => new Date(at(12))), base = repo.load().data;
    expect(() => repo.import(base, raw, false)).toThrow(/CONFIRMATION/);
    const restored = repo.import(base, raw, true); expect(restored).toEqual(confirmed);
    expect([...storage.values.entries()].some(([key, value]) => key.includes('.pre-import.') && value === JSON.stringify(base))).toBe(true);
    expect(repo.previewImport(raw, restored).skipCount).toBe(3);
    const overwrite = JSON.parse(raw); overwrite.data.revisions[0].reason = 'History overwrite';
    expect(() => repo.import(restored, JSON.stringify(overwrite), true)).toThrow(/HISTORY_CONFLICT/);
    storage.setItem(THESIS_STORAGE_KEY, '{broken'); const loaded = repo.load(); expect(loaded.recoveryStatus).toBe('corrupt');
    expect(() => repo.saveDraft(loaded.data, f.revision)).toThrow(/UNBOUND/);
    expect(() => repo.recoverCorrupt(raw, '{broken', false)).toThrow(/CONFIRMATION/);
    expect(repo.previewRecovery(raw, '{broken').addCount).toBe(3);
    expect(repo.recoverCorrupt(raw, '{broken', true)).toEqual(confirmed);
    expect([...storage.values.entries()].some(([key, value]) => key.includes('.pre-recovery.') && value === '{broken')).toBe(true);
    storage.setItem(THESIS_STORAGE_KEY, '{"schemaVersion":"thesis.v99"}'); expect(repo.load().recoveryStatus).toBe('unsupported_version');
    expect(() => repo.recoverCorrupt(raw, storage.getItem(THESIS_STORAGE_KEY)!, true)).toThrow();
  });

  it('refuses changed corrupt bytes and stops import before writing when pre-backup fails', async () => {
    const f = await setup(), raw = f.repo.export(f.data); f.storage.setItem(THESIS_STORAGE_KEY, '{bad'); f.repo.load(); f.storage.setItem(THESIS_STORAGE_KEY, '{changed');
    expect(() => f.repo.recoverCorrupt(raw, '{bad', true)).toThrow();
    const values = new Map<string, string>(); const repo = new BrowserThesisRepository({ getItem: key => values.get(key) ?? null,
      setItem(key, value) { if (key.includes('.pre-import.')) throw Error('Synthetic backup quota'); values.set(key, value); }, removeItem: key => { values.delete(key); } }, f.owners, () => new Date(at(12)));
    expect(() => repo.import(repo.load().data, raw, true)).toThrow(/quota/); expect(values.has(THESIS_STORAGE_KEY)).toBe(false);
  });

  it('rejects non-head confirmations, import forks, changed confirmation history and future imports', async () => {
    const f = await setup(); f.tick(12);
    const second = { ...cloneClaim(f.revision), revisionId: 'r2', supersedes: f.revision.revisionId, createdAt: at(10), asOf: at(10) };
    const data = f.repo.saveDraft(f.data, second);
    expect(() => f.repo.prepareConfirmation(data, f.revision.revisionId)).toThrow(/NOT_OPEN/);
    const fork = cloneClaim(data); fork.revisions.push({ ...cloneClaim(second), revisionId: 'fork', createdAt: at(11) });
    expect(() => validateThesisData(fork)).toThrow(/FORK/);
    const confirmed = f.repo.confirm(f.repo.prepareConfirmation(data, second.revisionId), 'Confirm new head', true);
    const changed = JSON.parse(f.repo.export(confirmed)); changed.data.confirmations[0].note = 'Rewritten user note';
    expect(() => f.repo.import(confirmed, JSON.stringify(changed), true)).toThrow(/HISTORY_CONFLICT/);
    const future = JSON.parse(f.repo.export(confirmed)); future.data.confirmations[0].createdAt = at(30);
    expect(() => f.repo.previewImport(JSON.stringify(future), confirmed)).toThrow(/FUTURE/);
    expect(f.repo.load().data).toEqual(confirmed);
  });

  it('reports actual retained Industry separately: 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis', async () => {
    const state = await loadIndustrySignalClaims(); expect(state.status).toBe('available'); if (state.status !== 'available') throw Error(state.reason);
    const owners = await createIndustryClaimOwners(state.result), storage = claimStorage();
    const claimRepo = new BrowserClaimRepository(storage, owners, () => new Date(at(22))); let claims = claimRepo.load().data;
    let verifiable = 0;
    for (const [index, binding] of owners.bindings.entries()) {
      const revision = draftClaim(binding, owners, { revisionId: `actual-retained-r2-${index}`, createdAt: at(22), asOf: at(22), supersedes: null, reason: 'Actual retained R2 regression', contexts: [] });
      claims = claimRepo.saveDraft(claims, revision); const gate = claimRepo.prepareReview(claims, revision.revisionId);
      verifiable += Number(gate.verifiable); expect(gate.blockers).toEqual(expect.arrayContaining(['not_admitted', 'partial', 'unknown']));
    }
    const thesisOwners: ThesisOwners = { claims: () => ({ data: claimRepo.load().data, owners }), resolveIdentity() { throw Error('No identity required for empty real state'); } };
    const thesisRepo = new BrowserThesisRepository(storage, thesisOwners, () => new Date(at(22)));
    expect({ candidates: owners.bindings.length, verifiable, verified: claims.reviews.filter(review => review.decision === 'VERIFIED').length,
      formalThesis: thesisRepo.load().data.confirmations.length }).toEqual({ candidates: 5, verifiable: 0, verified: 0, formalThesis: 0 });
    expect(thesisReadModel(thesisRepo.load().data, thesisOwners, at(22))).toEqual([]);
  });

  it('reads and prepares previews without changing either Thesis or Claim raw storage bytes', async () => {
    const f = await setup(), thesisRaw = f.storage.getItem(THESIS_STORAGE_KEY), claimRaw = f.claimStore.getItem(CLAIM_STORAGE_KEY);
    thesisReadModel(f.data, f.owners, at(9)); f.repo.prepareConfirmation(f.data, f.revision.revisionId); previewThesis(f.revision, f.owners);
    expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(thesisRaw); expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBe(claimRaw);
  });
});
