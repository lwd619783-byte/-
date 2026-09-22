import { expect, it } from 'vitest';
import { evaluateRequest, type EvalResult } from '../../scripts/research-eval/harness.mjs';
import { claimFixture, claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { cloneClaim, previewClaim } from './verifiedClaim';
import { BrowserClaimRepository } from './verifiedClaimRepository';
import type { ClaimRevision } from '../types/verifiedClaim';

// Independent R1 regression denominator. No edits to Frozen Foundation / Industry expected or registry.
const common: EvalResult = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
const supported: EvalResult = { ...common, outcome: 'supported', selectedRefs: ['claim'], citationRefs: ['source','artifact','evidence','fact','derived_metric','claim'] };
it.each([
  { name: 'synthetic-supported-confirmation', variant: 'supported', expected: supported },
  { name: 'synthetic-context-isolation', variant: 'context', expected: supported },
  { name: 'synthetic-release-unknown', variant: 'unknown', expected: { ...common, conditions: ['unknown'] } },
  { name: 'synthetic-statement-mismatch', variant: 'mismatch', expected: { ...common, conditions: ['missing_evidence'] } },
])('Claim service F3: $name', async ({ variant, expected }) => {
  const fixture = await claimFixture(variant === 'unknown' ? graph => { graph.nodes[0].releaseAvailableAt = null; } : undefined);
  const revision = cloneClaim(fixture.revision);
  if (variant === 'context') revision.contexts = [{ kind: 'notion', title: 'Synthetic background only', url: 'https://example.com/synthetic-background' }];
  if (variant === 'mismatch') revision.statement = 'Unsupported replacement statement';
  const target = { targetId: 'verified-claim-v1-local-service', targetVersion: '1', targetKind: 'deterministic_service' as const, supportedOperations: ['assess_graph'],
    execute({ input }: { input: unknown }) {
      const supplied = input as ClaimRevision;
      const gate = previewClaim(supplied, fixture.owners);
      if (gate.verifiable) {
        const repo = new BrowserClaimRepository(claimStorage(), fixture.owners, () => new Date(at(7)));
        const base = repo.saveDraft(repo.load().data, supplied);
        const result = repo.confirmReview(repo.prepareReview(base, supplied.revisionId), 'VERIFIED', 'Synthetic F3 user confirmation', true);
        if (result.reviews.length !== 1 || result.revisions[0].origin !== 'ai_draft') throw Error('CLAIM_SERVICE_RESULT');
      }
      return { ...common, ...gate.assessment };
    } };
  const evaluated = await evaluateRequest(target, { operation: 'assess_graph', request: {}, input: revision }, expected);
  expect(evaluated.semanticDiff).toEqual([]); expect(evaluated.status).toBe('PASS');
});
