import { expect, it } from 'vitest';
import { evaluateRequest, type EvalResult } from '../../scripts/research-eval/harness.mjs';
import type { ThesisRevision } from '../types/thesis';
import { thesisFixture } from './thesis.fixture';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { cloneClaim, previewClaim } from './verifiedClaim';
import { previewThesis } from './thesis';
import { BrowserThesisRepository } from './thesisRepository';

// Independent R2 denominator: expected literals remain outside the deterministic service adapter.
// This extends neither Frozen Foundation nor Industry expected/registry and mints no real coverage.
const common: EvalResult = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
const supported: EvalResult = { ...common, outcome: 'supported', selectedRefs: ['synthetic-revision-1'], citationRefs: ['source', 'artifact', 'evidence', 'fact', 'derived_metric', 'claim'] };
const blocked: EvalResult = { ...common, conditions: ['missing_evidence'] };

it.each([
  { name: 'synthetic-explicit-formal-confirmation', variant: 'supported', projection: 'thesis', expected: supported },
  { name: 'synthetic-context-isolation', variant: 'context', projection: 'thesis', expected: supported },
  { name: 'synthetic-supported-macro-industry', variant: 'supported', projection: 'relationship', expected: supported },
  { name: 'synthetic-unknown-edge-remains-unknown', variant: 'unknown', projection: 'relationship', expected: { ...common, conditions: ['unknown'] } },
  { name: 'synthetic-unknown-edge-does-not-invent-sensitivity', variant: 'unknown', projection: 'thesis', expected: supported },
  { name: 'synthetic-review-not-available-asof', variant: 'early', projection: 'thesis', expected: blocked },
  { name: 'synthetic-missing-authoritative-claim', variant: 'missing', projection: 'thesis', expected: blocked },
  { name: 'synthetic-replaced-exact-reference', variant: 'replaced', projection: 'thesis', expected: blocked },
  { name: 'synthetic-unresolved-identity', variant: 'identity', projection: 'relationship', expected: blocked },
  { name: 'synthetic-original-f2-unavailable', variant: 'evidence', projection: 'thesis', expected: blocked },
])('Thesis service independent R2 F3: $name', async ({ variant, projection, expected }) => {
  const fixture = await thesisFixture(), revision = cloneClaim(fixture.revision);
  if (variant === 'context') revision.contexts = [{ kind: 'drive', title: 'Synthetic context only', url: 'https://example.com/synthetic-context' }];
  if (variant === 'unknown') { revision.macroIndustry[0].exposure = 'unknown'; revision.macroIndustry[0].sensitivity = 'unknown'; revision.macroIndustry[0].supportingClaims = []; }
  if (variant === 'early') { revision.asOf = at(6); revision.macroIndustry = []; }
  if (variant === 'missing') { revision.supportingClaims = []; revision.macroIndustry = []; }
  if (variant === 'replaced') revision.supportingClaims[0].reviewId = 'foreign-review';
  if (variant === 'identity') revision.macroIndustry[0].industry.id = 'unresolved';
  if (variant === 'evidence') fixture.claim.graph.nodes[0].releaseAvailableAt = null;
  const target = {
    targetId: 'thesis-v1-local-service', targetVersion: '1', targetKind: 'deterministic_service' as const, supportedOperations: ['assess_graph'],
    execute({ input, request }: { input: unknown; request: unknown }): EvalResult {
      const supplied = input as ThesisRevision, gate = previewThesis(supplied, fixture.owners);
      const result: EvalResult = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
      if (!gate.publishable) return { ...result, conditions: ['missing_evidence'] };
      if ((request as { projection: string }).projection === 'relationship' && gate.relationships.some(edge => edge.status === 'unknown')) return { ...result, conditions: ['unknown'] };
      const repo = new BrowserThesisRepository(claimStorage(), fixture.owners, () => new Date(at(9)));
      const draft = repo.saveDraft(repo.load().data, supplied);
      if (draft.confirmations.length !== 0) throw Error('R2_AI_AUTO_CONFIRMATION');
      const confirmed = repo.confirm(repo.prepareConfirmation(draft, supplied.revisionId), 'Synthetic F3 explicit user confirmation', true);
      if (confirmed.confirmations.length !== 1 || confirmed.revisions[0].origin !== supplied.origin) throw Error('R2_CONFIRMATION_RESULT');
      const original = fixture.owners.claims();
      const citationRefs = [...new Set(gate.claims.flatMap(claim => claim.revision ? previewClaim(claim.revision, original.owners).assessment.citationRefs : []))];
      return { ...result, outcome: 'supported', selectedRefs: gate.claims.filter(claim => claim.usable).map(claim => claim.ref.revisionId), citationRefs };
    },
  };
  const result = await evaluateRequest(target, { operation: 'assess_graph', request: { projection }, input: revision }, expected);
  expect(result.semanticDiff).toEqual([]); expect(result.status).toBe('PASS');
});
