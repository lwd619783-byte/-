import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { expressionFixture } from './expression.fixture';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { cloneClaim, draftClaim, previewClaim } from './verifiedClaim';
import { emptyExpressionData, expressionDiff, expressionReadModel, expressionThesisChoices, expressionTrace, previewExpression, validateExpressionData } from './investmentExpression';
import { BrowserExpressionRepository, EXPRESSION_STORAGE_KEY } from './expressionRepository';
import { THESIS_STORAGE_KEY } from './thesisRepository';
import { createExpressionWorkspace } from './expressionWorkspace';
import { createThesisWorkspace } from './thesisWorkspace';
import type { Stock } from '../types';

async function setup() { const f = await expressionFixture(); const data = f.repo.saveDraft(f.repo.load().data, f.expression); return { ...f, data }; }
describe('Investment Expression V1 contract/domain/repository', () => {
  it.each(['ETF', 'Index', 'Equity', 'Fund', 'CommodityProxy'] as const)('explicit formal %s resolves original frozen Evidence through exact Thesis/Claim', async type => {
    const f = await expressionFixture(type), base = f.repo.saveDraft(f.repo.load().data, f.expression), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY);
    const p = f.repo.prepareConfirmation(base, f.expression.revisionId);
    expect(p.publishable).toBe(true); expect(base.confirmations).toHaveLength(0); expect(p.unknowns).toContain('liquidity');
    expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
    expect(() => f.repo.confirm(p, 'Synthetic', false)).toThrow(/CONFIRMATION_REQUIRED/);
    const confirmed = f.repo.confirm(p, 'Synthetic explicit confirmation', true);
    expect(confirmed.confirmations).toHaveLength(1); expect(confirmed.revisions[0]).toEqual(f.expression);
    const trace = expressionTrace(confirmed.revisions[0], f.expressionOwners);
    expect(trace.gate.thesis?.revisionId).toBe(f.revision.revisionId); expect(trace.gate.confirmation?.actor).toBe('user');
    expect(trace.claims[0].ref).toEqual(f.ref); expect(trace.claims[0].review?.decision).toBe('VERIFIED'); expect(trace.claims[0].evidenceBinding).toEqual(f.claim.binding);
    expect(f.repo.load().data).toEqual(confirmed); expect(confirmed.revisions[0].origin).toBe('ai_draft');
  });
  it('retains immutable history/diff/current formal when a successor is draft', async () => {
    const f = await setup(), formal = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.expression.revisionId), 'First', true), bytes = canonicalJson(formal);
    f.tick(13); const next = { ...cloneClaim(f.expression), revisionId: 'r2', supersedes: f.expression.revisionId, asOf: at(12), createdAt: at(12), role: 'defensive' as const, reason: 'Second' };
    const draft = f.repo.saveDraft(formal, next), row = expressionReadModel(draft, f.expressionOwners, at(13))[0];
    expect(row.current).toEqual(f.expression); expect(row.draft).toEqual(next); expect(row.history).toHaveLength(2);
    const second = f.repo.confirm(f.repo.prepareConfirmation(draft, next.revisionId), 'Second', true);
    expect(expressionReadModel(second, f.expressionOwners, at(11))[0].current).toEqual(f.expression);
    expect(canonicalJson({ ...second, revisions: [second.revisions[0]], confirmations: [second.confirmations[0]] })).toBe(bytes);
    expect(expressionDiff(f.expression, next).map(d => d.field)).toContain('role'); expect(expressionDiff(f.expression, f.expression)).toEqual([]);
  });
  it.each([true, false])('Thesis successor confirmed=%s blocks inclusively at asOf but preserves historical expression', async confirmed => {
    const f = await setup(), formal = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.expression.revisionId), 'Historical', true), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY);
    f.tick(13); const next = { ...cloneClaim(f.revision), revisionId: 'thesis-r2', supersedes: f.revision.revisionId, asOf: at(12), createdAt: at(12) };
    const thesisDraft = f.thesisRepo.saveDraft(f.thesisRepo.load().data, next);
    if (confirmed) f.thesisRepo.confirm(f.thesisRepo.prepareConfirmation(thesisDraft, next.revisionId), 'Synthetic successor', true);
    expect(previewExpression(f.expression, f.expressionOwners).publishable).toBe(true);
    for (const asOf of [at(12), at(13)]) expect(previewExpression({ ...f.expression, asOf, createdAt: asOf }, f.expressionOwners).blockers).toContain('EXPRESSION_THESIS_SUPERSEDED_ASOF');
    expect(expressionThesisChoices(f.expressionOwners, at(10))[0].ref).toEqual(f.expression.thesis);
    expect(expressionThesisChoices(f.expressionOwners, at(13)).map(c => c.ref.revisionId)).toEqual(confirmed ? [next.revisionId] : []);
    expect(expressionReadModel(formal, f.expressionOwners, at(13))[0].thesisUpdated).toBe(true);
    expect(expressionReadModel(formal, f.expressionOwners, at(11))[0].thesisUpdated).toBe(false);
    expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
  });
  it('rechecks changed Thesis head after preview even when historical cutoff remains valid', async () => {
    const f = await setup(), p = f.repo.prepareConfirmation(f.data, f.expression.revisionId), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY);
    f.tick(13); f.thesisRepo.saveDraft(f.thesisRepo.load().data, { ...f.revision, revisionId: 'new-thesis', supersedes: f.revision.revisionId, createdAt: at(12), asOf: at(12) });
    expect(() => f.repo.confirm(p, 'Stale authority', true)).toThrow(/AUTHORITY_CHANGED/); expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
    const fresh = f.repo.prepareConfirmation(f.data, f.expression.revisionId); expect(fresh.publishable).toBe(true);
    expect(f.repo.confirm(fresh, 'Rechecked historical', true).confirmations).toHaveLength(1);
  });
  it.each(['missing', 'draft', 'corrupt', 'future', 'changed', 'early'] as const)('fails closed for %s original Thesis', async mode => {
    const f = await setup(), source = f.thesisRepo.load().data;
    if (mode === 'missing') { source.entries = []; source.revisions = []; source.confirmations = []; }
    if (mode === 'draft') source.confirmations = [];
    if (mode === 'changed') source.revisions[0].statement = 'changed original bytes';
    f.thesisStore.setItem(THESIS_STORAGE_KEY, mode === 'corrupt' ? '{bad' : mode === 'future' ? '{"schemaVersion":"thesis.v99"}' : JSON.stringify(source));
    const r = mode === 'early' ? { ...f.expression, asOf: at(8) } : f.expression;
    expect(previewExpression(r, f.expressionOwners).publishable).toBe(false);
    if (mode !== 'early') expect(() => f.repo.confirm(f.repo.prepareConfirmation(f.data, r.revisionId), 'Denied', true)).toThrow(/GATE_BLOCKED/);
  });
  it.each(['unresolved', 'ambiguous', 'wrong-type', 'wrong-market'] as const)('rejects %s instrument', async mode => {
    const f = await expressionFixture(), r = cloneClaim(f.expression);
    if (mode === 'unresolved') r.instrument!.id = 'missing';
    if (mode === 'ambiguous') f.instruments.push(cloneClaim(f.instruments[0]));
    if (mode === 'wrong-type') r.instrument!.type = 'Equity';
    if (mode === 'wrong-market') r.instrument!.market = 'A';
    expect(previewExpression(r, f.expressionOwners).blockers).toContain('EXPRESSION_INSTRUMENT_UNRESOLVED_OR_AMBIGUOUS');
  });
  it('context-only cannot create authority and F2 remains fail closed', async () => {
    const f = await expressionFixture(); const contexts = [{ kind: 'notion' as const, title: 'Synthetic context', url: 'https://example.com/synthetic' }];
    expect(previewExpression({ ...f.expression, thesis: null, contexts }, f.expressionOwners).blockers).toContain('EXPRESSION_NO_FORMAL_THESIS');
    expect(previewExpression({ ...f.expression, contexts }, f.expressionOwners).publishable).toBe(true);
    f.claim.graph.nodes[0].releaseAvailableAt = null;
    expect(previewExpression(f.expression, f.expressionOwners).publishable).toBe(false);
  });
  it.each(['clone', 'tamper', 'replay', 'stale', 'base-tamper'] as const)('rejects %s preview/base', async mode => {
    const f = await setup(), p = f.repo.prepareConfirmation(f.data, f.expression.revisionId);
    if (mode === 'clone') expect(() => f.repo.confirm(cloneClaim(p), 'Denied', true)).toThrow(/UNBOUND/);
    if (mode === 'tamper') { p.revision.role = 'leader'; expect(() => f.repo.confirm(p, 'Denied', true)).toThrow(/MUTATED/); }
    if (mode === 'replay') { f.repo.confirm(p, 'First', true); expect(() => f.repo.confirm(p, 'Replay', true)).toThrow(/UNBOUND/); }
    if (mode === 'stale') { f.storage.setItem(EXPRESSION_STORAGE_KEY, JSON.stringify(f.data, null, 2)); expect(() => f.repo.confirm(p, 'Stale', true)).toThrow(/已变化/); }
    if (mode === 'base-tamper') { f.data.revisions[0].reason = 'tampered'; expect(() => f.repo.confirm(p, 'Denied', true)).toThrow(/MUTATED/); }
  });
  it('imports append-only with explicit confirmation, deterministic bytes and pre-import backup', async () => {
    const f = await setup(), formal = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.expression.revisionId), 'Synthetic', true), raw = f.repo.export(formal);
    expect(f.repo.export(cloneClaim(formal))).toBe(raw);
    const storage = claimStorage(), repo = new BrowserExpressionRepository(storage, f.expressionOwners, () => new Date(at(13))), base = repo.load().data;
    expect(repo.previewImport(raw, base).addCount).toBe(3); expect(storage.getItem(EXPRESSION_STORAGE_KEY)).toBeNull();
    expect(() => repo.import(base, raw, false)).toThrow(/CONFIRMATION_REQUIRED/);
    const imported = repo.import(base, raw, true); expect(imported).toEqual(formal);
    expect(storage.getItem(`${EXPRESSION_STORAGE_KEY}.pre-import.${at(13)}`)).toBe(canonicalJson(emptyExpressionData()));
    expect(repo.previewImport(raw, imported).skipCount).toBe(3);
    const conflict = JSON.parse(raw); conflict.data.revisions[0].reason = 'changed';
    expect(() => repo.previewImport(JSON.stringify(conflict), imported)).toThrow(/HISTORY_CONFLICT/);
  });
  it('backs up observed corruption before recovery and locks future versions', async () => {
    const f = await setup(), backup = f.repo.export(f.data);
    f.storage.setItem(EXPRESSION_STORAGE_KEY, '{bad'); const loaded = f.repo.load(); expect(loaded.recoveryStatus).toBe('corrupt');
    expect(() => f.repo.recoverCorrupt(backup, '{bad', false)).toThrow(/CONFIRMATION_REQUIRED/);
    expect(f.repo.recoverCorrupt(backup, '{bad', true)).toEqual(f.data);
    expect(f.storage.getItem(`${EXPRESSION_STORAGE_KEY}.pre-recovery.${at(11)}`)).toBe('{bad');
    f.storage.setItem(EXPRESSION_STORAGE_KEY, '{"schemaVersion":"future"}'); expect(f.repo.load().recoveryStatus).toBe('unsupported_version');
    expect(() => f.repo.recoverCorrupt(backup, '{"schemaVersion":"future"}', true)).toThrow(/NOT_OBSERVED/);
  });
  it('rejects synthetic data at real load, draft, import and formal paths', async () => {
    const f = await setup(), owners = { ...f.expressionOwners, scope: 'real' as const }, repo = new BrowserExpressionRepository(f.storage, owners, () => new Date(at(11)));
    expect(repo.load().error).toContain('SCOPE_MISMATCH'); expect(previewExpression(f.expression, owners).publishable).toBe(false);
    const clean = new BrowserExpressionRepository(claimStorage(), owners, () => new Date(at(11))), base = clean.load().data;
    expect(() => clean.saveDraft(base, f.expression)).toThrow(/SCOPE_MISMATCH/); expect(() => clean.previewImport(f.repo.export(f.data), base)).toThrow(/SCOPE_MISMATCH/);
  });
  it.each(['A股', '港股', '美股'] as const)('runtime resolves exact real Stock market %s without ticker/name inference', async market => {
    const storage = claimStorage(), thesis = await createThesisWorkspace({ stocks: [], industries: [], macroIndicators: [] }, storage);
    const stock = { id: 'exact-owner', code: 'not-used', name: 'Same label', market, dataMode: 'real' } as Stock;
    const runtime = createExpressionWorkspace(thesis, [stock], storage), ref = runtime.instruments[0].ref;
    expect(ref.market).toBe(market === 'A股' ? 'A' : market === '港股' ? 'H' : 'US'); expect(runtime.owners.resolveInstrument(ref)).toEqual(ref);
    expect(() => runtime.owners.resolveInstrument({ ...ref, id: stock.code })).toThrow(/UNRESOLVED/);
    const duplicate = createExpressionWorkspace(thesis, [stock, stock], storage); expect(() => duplicate.owners.resolveInstrument(ref)).toThrow(/AMBIGUOUS/);
    expect(createExpressionWorkspace(thesis, [{ ...stock, dataMode: 'mock' }], storage).instruments).toEqual([]);
  });
  it('failed pre-import backup preserves original store and confirmation is never implicit', async () => {
    const f = await setup(), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY), backup = f.repo.export(f.data);
    const storage = { ...f.storage, setItem(key: string, value: string) { if (key.includes('.pre-import.')) throw Error('quota'); f.storage.setItem(key, value); } };
    const repo = new BrowserExpressionRepository(storage, f.expressionOwners, () => new Date(at(13))), base = repo.load().data;
    expect(() => repo.import(base, backup, true)).toThrow('quota'); expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
  });
  it('rejects corrupt/future import, future writes and changed observed recovery bytes', async () => {
    const f = await setup(), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY), backup = JSON.parse(f.repo.export(f.data));
    backup.data.schemaVersion = 'investment-expression.v99'; expect(() => f.repo.previewImport(JSON.stringify(backup), f.data)).toThrow(/SCHEMA/);
    expect(() => f.repo.previewImport('{bad', f.data)).toThrow();
    expect(() => f.repo.saveDraft(f.data, { ...f.expression, revisionId: 'future', supersedes: f.expression.revisionId, createdAt: at(20) })).toThrow(/FUTURE_WRITE/);
    expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
    f.storage.setItem(EXPRESSION_STORAGE_KEY, '{bad'); f.repo.load(); f.storage.setItem(EXPRESSION_STORAGE_KEY, '{other');
    expect(() => f.repo.previewRecovery(f.repo.export(f.data), '{bad')).toThrow(/CHANGED/);
  });
  it('existing formal history remains readable when original authority fails and append/import fail closed', async () => {
    const f = await setup(), formal = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.expression.revisionId), 'Synthetic', true), backup = f.repo.export(formal), raw = f.storage.getItem(EXPRESSION_STORAGE_KEY);
    f.thesisStore.setItem(THESIS_STORAGE_KEY, '{bad');
    expect(expressionReadModel(f.repo.load().data, f.expressionOwners, at(13))[0].gate?.publishable).toBe(false);
    f.tick(13); expect(() => f.repo.saveDraft(formal, { ...f.expression, revisionId: 'next', supersedes: f.expression.revisionId, createdAt: at(12), asOf: at(12) })).toThrow(/FORMAL_SUPPORT_BLOCKED/);
    expect(() => f.repo.previewImport(backup, formal)).toThrow(/FORMAL_SUPPORT_BLOCKED/); expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
  });
  it.each(['quantity', 'expectedReturn', 'targetPrice', 'score', 'probability', 'position', 'targetAllocation'])('closed contract rejects %s', async field => {
    const f = await setup(); (f.data.revisions[0] as unknown as Record<string, unknown>)[field] = 1; expect(() => validateExpressionData(f.data)).toThrow(/SCHEMA/);
  });
  it('rejects revision forks, origin mutation, backdating, duplicate confirmation and altered pins', async () => {
    const f = await setup();
    for (const patch of [{ supersedes: 'foreign' }, { origin: 'user_judgement' }, { asOf: at(12) }]) {
      const data = cloneClaim(f.data); Object.assign(data.revisions[0], patch); expect(() => validateExpressionData(data)).toThrow();
    }
    const altered = cloneClaim(f.expression); altered.thesis!.revisionId = 'different'; expect(previewExpression(altered, f.expressionOwners).publishable).toBe(false);
    const formal = f.repo.confirm(f.repo.prepareConfirmation(f.data, f.expression.revisionId), 'Synthetic', true);
    formal.confirmations.push({ ...formal.confirmations[0], confirmationId: 'duplicate', userApprovalRef: { owner: 'ExpressionConfirmation', approvalId: 'duplicate' } });
    expect(() => validateExpressionData(formal)).toThrow(/DUPLICATE/);
  });
  it('keeps real retained data at 5 / 0 / 0 / 0 / 0 and has no real ETF/Index fallback', async () => {
    const storage = claimStorage(), thesis = await createThesisWorkspace({ stocks: [], industries: [], macroIndicators: [] }, storage), runtime = createExpressionWorkspace(thesis, [], storage);
    expect(thesis.bindings).toHaveLength(5);
    expect(thesis.bindings.filter(b => previewClaim(draftClaim(b, thesis.claimOwners, { revisionId: 'readonly', createdAt: at(22), asOf: at(22), supersedes: null, reason: 'Read only', contexts: [] }), thesis.claimOwners).verifiable)).toHaveLength(0);
    expect(thesis.owners.claims().data.reviews).toHaveLength(0); expect(expressionThesisChoices(runtime.owners, at(22))).toEqual([]);
    expect(runtime.repository.load().data.confirmations).toEqual([]); expect(runtime.instruments).toEqual([]);
    const f = await expressionFixture(); expect(previewExpression({ ...f.expression, scope: 'real' }, runtime.owners).publishable).toBe(false);
  });
});
