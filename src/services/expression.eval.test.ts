import { expect, it } from 'vitest';
import { evaluateRequest, type EvalResult } from '../../scripts/research-eval/harness.mjs';
import { expressionFixture } from './expression.fixture';
import { expressionTrace, previewExpression } from './investmentExpression';
import { BrowserExpressionRepository, EXPRESSION_STORAGE_KEY } from './expressionRepository';
import { THESIS_STORAGE_KEY } from './thesisRepository';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { cloneClaim, previewClaim } from './verifiedClaim';
import type { ExpressionRevision } from '../types/investmentExpression';

// Independent R3 denominator. No changes to Frozen Foundation, Industry, R1 or R2 expected results.
const common: EvalResult = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
const supported: EvalResult = { ...common, outcome: 'supported', selectedRefs: ['synthetic-thesis-r1', 'synthetic-revision-1'], citationRefs: ['source', 'artifact', 'evidence', 'fact', 'derived_metric', 'claim'] };
const blocked: EvalResult = { ...common, conditions: ['missing_evidence'] };
const cases = [
  ...['ETF', 'Index', 'Equity', 'history', 'historical-asof'].map(variant => ({ variant, expected: supported })),
  ...['draft-thesis', 'missing-thesis', 'corrupt-thesis', 'future-thesis', 'superseded', 'preview-head-change', 'instrument-unresolved', 'instrument-ambiguous', 'context-only', 'stale', 'tamper', 'clone', 'replay', 'corrupt-store', 'future-store', 'import-conflict', 'synthetic-real'].map(variant => ({ variant, expected: blocked })),
];
it.each(cases)('Expression deterministic service R3 F3: $variant', async ({ variant, expected }) => {
  const f = await expressionFixture(variant === 'Index' ? 'Index' : variant === 'Equity' ? 'Equity' : 'ETF');
  const supplied = cloneClaim(f.expression);
  if (variant === 'draft-thesis') { const data = f.thesisRepo.load().data; data.confirmations = []; f.thesisStore.setItem(THESIS_STORAGE_KEY, JSON.stringify(data)); }
  if (variant === 'missing-thesis') { const data = f.thesisRepo.load().data; data.entries = []; data.revisions = []; data.confirmations = []; f.thesisStore.setItem(THESIS_STORAGE_KEY, JSON.stringify(data)); }
  if (variant === 'corrupt-thesis') f.thesisStore.setItem(THESIS_STORAGE_KEY, '{bad');
  if (variant === 'future-thesis') f.thesisStore.setItem(THESIS_STORAGE_KEY, '{"schemaVersion":"thesis.v99"}');
  const successor = () => { f.tick(13); f.thesisRepo.saveDraft(f.thesisRepo.load().data, { ...f.revision, revisionId: 'successor', supersedes: f.revision.revisionId, createdAt: at(12), asOf: at(12) }); };
  if (variant === 'superseded' || variant === 'historical-asof') { successor(); if (variant === 'superseded') { supplied.asOf = at(12); supplied.createdAt = at(12); } }
  if (variant === 'instrument-unresolved') supplied.instrument!.id = 'absent';
  if (variant === 'instrument-ambiguous') f.instruments.push(cloneClaim(f.instruments[0]));
  if (variant === 'context-only') { supplied.thesis = null; supplied.contexts = [{ kind: 'drive', title: 'Synthetic background', url: 'https://example.com/synthetic' }]; }
  if (variant === 'synthetic-real') f.expressionOwners.scope = 'real';
  const target = { targetId: 'investment-expression-v1-local-service', targetVersion: '1', targetKind: 'deterministic_service' as const, supportedOperations: ['assess_graph'],
    execute({ input }: { input: unknown }): EvalResult {
      const r = input as ExpressionRevision;
      try {
        const store = claimStorage(), repo = new BrowserExpressionRepository(store, f.expressionOwners, () => new Date(at(15)));
        if (variant === 'corrupt-store' || variant === 'future-store') store.setItem(EXPRESSION_STORAGE_KEY, variant === 'corrupt-store' ? '{bad' : '{"schemaVersion":"v99"}');
        const load = repo.load(); if (load.error) return { ...common, conditions: ['missing_evidence'] };
        const draft = repo.saveDraft(load.data, r), p = repo.prepareConfirmation(draft, r.revisionId);
        if (!p.publishable) return { ...common, conditions: ['missing_evidence'] };
        if (variant === 'preview-head-change') successor();
        if (variant === 'stale') store.setItem(EXPRESSION_STORAGE_KEY, JSON.stringify(draft, null, 2));
        if (variant === 'tamper') p.revision.role = 'leader';
        const formal = repo.confirm(variant === 'clone' ? cloneClaim(p) : p, 'Synthetic explicit F3 confirmation', true);
        if (formal.confirmations.length !== 1 || formal.revisions[0].origin !== r.origin) throw Error('CONFIRMATION_RESULT');
        if (variant === 'replay') repo.confirm(p, 'Replay denied', true);
        if (variant === 'import-conflict') { const raw = JSON.parse(repo.export(formal)); raw.data.revisions[0].reason = 'Conflicting bytes'; repo.previewImport(JSON.stringify(raw), formal); }
        if (variant === 'history') {
          const second = { ...r, revisionId: 'expression-r2', supersedes: r.revisionId, createdAt: at(16), asOf: at(16), reason: 'Synthetic revision' };
          const later = new BrowserExpressionRepository(store, f.expressionOwners, () => new Date(at(17))), next = later.saveDraft(later.load().data, second);
          const confirmed = later.confirm(later.prepareConfirmation(next, second.revisionId), 'Synthetic second confirmation', true);
          if (confirmed.confirmations.length !== 2 || JSON.stringify(confirmed.revisions[0]) !== JSON.stringify(formal.revisions[0])) throw Error('HISTORY_DRIFT');
        }
        const trace = expressionTrace(formal.revisions[0], f.expressionOwners);
        if (!trace.gate.publishable || !previewExpression(r, f.expressionOwners).publishable) throw Error('TRACE_BLOCKED');
        return { ...common, outcome: 'supported', selectedRefs: [trace.gate.thesis!.revisionId, ...trace.claims.map(c => c.ref.revisionId)],
          citationRefs: [...new Set(trace.claims.flatMap(c => c.revision ? previewClaim(c.revision, f.claim.owners).assessment.citationRefs : []))] };
      } catch { return { ...common, conditions: ['missing_evidence'] }; }
    },
  };
  const result = await evaluateRequest(target, { operation: 'assess_graph', request: {}, input: supplied }, expected);
  expect(result.semanticDiff).toEqual([]); expect(result.status).toBe('PASS');
});
