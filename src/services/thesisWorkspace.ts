import type { Industry, MacroIndicator, Stock } from '../types';
import type { ThesisIdentity, ThesisOwners } from '../types/thesis';
import type { ClaimBinding, ClaimOwners } from '../types/verifiedClaim';
import type { ChartAuditView } from './chartAudit';
import type { StorageLike } from './watchlistRepository';
import { loadIndustrySignalClaims, industryClaimAudit } from './industrySignalClaimProvider';
import { createIndustryClaimOwners } from './industryVerifiedClaimAdapter';
import { BrowserClaimRepository } from './verifiedClaimRepository';
import { BrowserThesisRepository } from './thesisRepository';

export interface ThesisIdentityOption { ref: ThesisIdentity; label: string }
export interface ThesisWorkspaceRuntime {
  owners: ThesisOwners; repository: BrowserThesisRepository; claimRepository: BrowserClaimRepository;
  claimOwners: ClaimOwners; bindings: ClaimBinding[]; identities: ThesisIdentityOption[];
  evidence(binding: ClaimBinding): ChartAuditView | null;
}
export interface ThesisWorkspaceDataset { industries: Industry[]; stocks: Stock[]; macroIndicators: MacroIndicator[] }

/** Composition only: each read uses the original Claim repository and its F2 owners. */
export async function createThesisWorkspace(dataset: ThesisWorkspaceDataset, storage: StorageLike | null): Promise<ThesisWorkspaceRuntime> {
  const state = await loadIndustrySignalClaims();
  if (state.status !== 'available') throw new Error(state.reason);
  const claimOwners = await createIndustryClaimOwners(state.result);
  const claimRepository = new BrowserClaimRepository(storage, claimOwners);
  const identities: ThesisIdentityOption[] = [
    ...dataset.macroIndicators.map(row => ({ ref: { owner: 'MacroIndicator' as const, id: row.id }, label: row.name })),
    ...dataset.industries.map(row => ({ ref: { owner: 'Industry' as const, id: row.id }, label: row.name })),
    ...dataset.stocks.map(row => ({ ref: { owner: 'Stock' as const, id: row.id }, label: row.name })),
  ];
  const owners: ThesisOwners = {
    claims() { const loaded = claimRepository.load(); if (loaded.error) throw new Error(loaded.error); return { data: loaded.data, owners: claimOwners }; },
    resolveIdentity(ref) {
      const matches = identities.filter(row => row.ref.owner === ref.owner && row.ref.id === ref.id);
      if (matches.length !== 1) throw new Error('THESIS_IDENTITY_UNRESOLVED_OR_AMBIGUOUS');
      return { ...matches[0].ref };
    },
  };
  return { owners, repository: new BrowserThesisRepository(storage, owners), claimRepository, claimOwners, bindings: claimOwners.bindings, identities,
    evidence(binding) {
      const candidate = state.result.derived.claims.find(row => row.id === binding.candidateRef.objectId);
      return candidate ? industryClaimAudit(state.result, state.provider, candidate.signalId) : null;
    },
  };
}
