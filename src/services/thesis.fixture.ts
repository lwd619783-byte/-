/** Synthetic-only fixture. Positive authority is created by the real R1 review service over frozen F2. */
import type { ThesisIdentity, ThesisOwners, ThesisRevision } from '../types/thesis';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { claimFixture, claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { BrowserClaimRepository } from './verifiedClaimRepository';
import { cloneClaim } from './verifiedClaim';
import { pinVerifiedClaim } from './thesis';

export async function thesisFixture() {
  const claim = await claimFixture(), claimStore = claimStorage();
  let claimNow = at(7);
  const claimRepo = new BrowserClaimRepository(claimStore, claim.owners, () => new Date(claimNow));
  const draft = claimRepo.saveDraft(claimRepo.load().data, claim.revision);
  const verified = claimRepo.confirmReview(claimRepo.prepareReview(draft, claim.revision.revisionId), 'VERIFIED', 'Synthetic frozen F2 user review', true);
  const ref = pinVerifiedClaim(verified.revisions[0], verified.reviews[0]);
  const identities: ThesisIdentity[] = [{ owner: 'MacroIndicator', id: 'synthetic-macro' }, { owner: 'Industry', id: 'synthetic-industry' }, { owner: 'Stock', id: 'synthetic-company' }];
  const owners: ThesisOwners = {
    claims() {
      const loaded = claimRepo.load();
      if (loaded.error) throw Error(loaded.error);
      return { data: loaded.data, owners: claim.owners };
    },
    resolveIdentity(input) {
      const matches = identities.filter(identity => canonicalJson(identity) === canonicalJson(input));
      if (matches.length !== 1) throw Error('SYNTHETIC_IDENTITY_UNRESOLVED');
      return cloneClaim(matches[0]);
    },
  };
  const revision: ThesisRevision = {
    thesisId: 'synthetic-thesis', revisionId: 'synthetic-thesis-r1', supersedes: null,
    createdAt: at(8), asOf: at(8), origin: 'ai_draft', statement: 'Synthetic thesis for service acceptance only',
    bull: 'Synthetic upside scenario', base: 'Synthetic base scenario', bear: 'Synthetic downside scenario',
    keyDrivers: ['Synthetic demand condition'], catalysts: ['Synthetic release'], risks: ['Synthetic demand reversal'],
    invalidation: ['Synthetic supporting condition ceases'], confidence: 'unknown', supportingClaims: [cloneClaim(ref)],
    relatedEntities: cloneClaim(identities), macroIndustry: [{ relationshipId: 'synthetic-macro-industry', macroDriver: cloneClaim(identities[0]),
      industry: cloneClaim(identities[1]), exposure: 'direct', sensitivity: 'qualitative', rationale: 'Synthetic conditional exposure',
      asOf: at(8), conditions: ['Synthetic evidence remains available'], supportingClaims: [cloneClaim(ref)] }],
    contexts: [], reason: 'Synthetic initial draft',
  };
  return { claim, claimRepo, claimStore, ref, identities, owners, revision, tickClaim: (day: number) => { claimNow = at(day); } };
}
