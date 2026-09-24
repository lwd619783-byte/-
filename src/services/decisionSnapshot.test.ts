import { it, expect } from 'vitest';
import { decisionFixture } from './decisionSnapshot.fixture';
import { buildDecisionSnapshot, decisionDigest } from './decisionSnapshot';
import { createDecisionPublisher } from './decisionPublish';
import { claimTime as at } from './verifiedClaim.fixture';
import { CLAIM_STORAGE_KEY } from './verifiedClaimRepository';
import { THESIS_STORAGE_KEY } from './thesisRepository';
import { EXPRESSION_STORAGE_KEY } from './expressionRepository';
import { validateDecisionSnapshot } from '../../shared/decision-snapshot.mjs';

it('projects exact formal revisions, F2 citations, lineage, uncertainty and valid Portfolio; no raw pins/Wiki', async () => {
  const f = await decisionFixture(), s = await buildDecisionSnapshot(f.runtime, f.projection, new Date(at(12)));
  expect(s.claims.rows[0].revisionId).toBe(f.claim.revision.revisionId); expect(s.claims.rows[0].status).toBe('verified');
  expect([...s.claims.rows[0].citationRefs].sort()).toEqual(['source', 'artifact', 'evidence', 'fact', 'derived_metric', 'claim'].sort());
  expect(s.theses.rows[0].lineage[0].revisionId).toBe(f.claim.revision.revisionId);
  expect(s.expressions.rows[0].lineage[0].revisionId).toBe(f.revision.revisionId);
  expect(s.expressions.rows[0].status).toBe('partial'); expect(s.expressions.rows[0].gate.unknowns).toContain('valuation');
  expect(s.portfolio.projection?.cohorts[0].total).toBe(300);
  expect(s.theses.rows[0].risks).toEqual(f.revision.risks); expect(s.theses.rows[0].invalidation).toEqual(f.revision.invalidation);
  expect(JSON.stringify(s)).not.toMatch(/revisionBytes|confirmationBytes|reviewBytes|bodyMarkdown|rawLocalStorage/);
});
it('unavailable Portfolio never becomes empty or zero; remote scope mismatch rejects', async () => {
  const f = await decisionFixture(), s = await buildDecisionSnapshot(f.runtime, null, new Date(at(12)));
  expect(s.portfolio.status).toBe('unavailable'); expect(s.portfolio.projection).toBeNull();
  expect(() => validateDecisionSnapshot({ ...s, scope: 'real', portfolio: { ...s.portfolio, status: 'partial', projection: f.projection } })).toThrow();
});
it('original F2 owner failure blocks previously verified Claim instead of promoting it', async () => {
  const f = await decisionFixture(); f.claim.graph.nodes[0].nodeId = 'drift';
  const s = await buildDecisionSnapshot(f.runtime, null, new Date(at(12)));
  expect(s.claims.rows[0].status).toBe('blocked'); expect(s.claims.rows[0].gate.verifiable).toBe(false);
  expect(s.theses.rows[0].status).toBe('blocked'); expect(s.expressions.rows[0].status).toBe('blocked');
});
it.each(['claim-corrupt', 'claim-future', 'thesis-corrupt', 'expression-future'])('formal owner %s fails closed', async variant => {
  const f = await decisionFixture(), store = variant.startsWith('claim') ? f.claimStore : variant.startsWith('thesis') ? f.thesisStore : f.storage;
  store.setItem(variant.startsWith('claim') ? CLAIM_STORAGE_KEY : variant.startsWith('thesis') ? THESIS_STORAGE_KEY : EXPRESSION_STORAGE_KEY, variant.endsWith('future') ? '{"schemaVersion":"v99"}' : '{bad');
  await expect(buildDecisionSnapshot(f.runtime, null, new Date(at(12)))).rejects.toThrow();
});
it('post-asOf Claim successor preserves exact historical refs with current stale warning', async () => {
  const f = await decisionFixture(); f.tickClaim(14);
  f.claimRepo.saveDraft(f.claimRepo.load().data, { ...f.claim.revision, revisionId: 'later', supersedes: f.claim.revision.revisionId, createdAt: at(13), asOf: at(13) });
  const s = await buildDecisionSnapshot(f.runtime, null, new Date(at(15)));
  expect(s.claims.rows).toEqual([]); expect(s.theses.rows[0].status).toBe('stale'); expect(s.theses.rows[0].lineage[0].revisionId).toBe(f.claim.revision.revisionId);
  expect(s.expressions.rows[0].status).toBe('stale'); expect(s.expressions.rows[0].blockers).toContain('CLAIM_UPDATED_REVIEW_REQUIRED');
  expect(s.theses.rows[0].citationRefs).toContain('source');
});
it.each(['mutation', 'clone', 'owner-drift', 'gate-drift', 'unconfirmed'])('explicit publish rejects %s without sending', async variant => {
  const f = await decisionFixture(), calls: string[] = [];
  const service = createDecisionPublisher(f.runtime, async () => { throw Error('PORTFOLIO_NOT_CONNECTED'); }, async action => { calls.push(action); return { generation: 0 }; }, () => new Date(at(12)));
  const p = await service.prepare('synthetic');
  if (variant === 'mutation') p.snapshot.theses.rows[0].statement = 'forged';
  if (variant === 'owner-drift') f.claimStore.setItem(CLAIM_STORAGE_KEY, '{bad');
  if (variant === 'gate-drift') f.claim.graph.nodes[0].nodeId = 'changed';
  await expect(service.publish(variant === 'clone' ? structuredClone(p) : p, 'synthetic', variant !== 'unconfirmed')).rejects.toThrow();
  expect(calls).toEqual(['status']);
});
it('publish sends validated canonical digest only after confirmation; replay rejected, revoke independent', async () => {
  const f = await decisionFixture(), calls: { action: string; body: unknown }[] = [];
  const service = createDecisionPublisher(f.runtime, async () => f.projection, async (action, _secret, body) => { calls.push({ action, body }); return { generation: 0 }; }, () => new Date(at(12)));
  const preview = await service.prepare('synthetic'); await service.publish(preview, 'synthetic', true);
  expect(calls[1].action).toBe('publish'); expect(preview.digest).toBe(await decisionDigest(preview.snapshot));
  await expect(service.publish(preview, 'synthetic', true)).rejects.toThrow();
  f.claimStore.setItem(CLAIM_STORAGE_KEY, '{bad'); await service.revoke('synthetic'); expect(calls.at(-1)?.action).toBe('revoke');
});
