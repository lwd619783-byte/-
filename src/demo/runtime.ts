import seed from './fixture.json';
import { claimFixture, claimStorage } from '../services/verifiedClaim.fixture';
import { BrowserClaimRepository, CLAIM_STORAGE_KEY } from '../services/verifiedClaimRepository';
import { BrowserThesisRepository, THESIS_STORAGE_KEY } from '../services/thesisRepository';
import { BrowserExpressionRepository, EXPRESSION_STORAGE_KEY } from '../services/expressionRepository';
import { validateClaimOwners } from '../services/verifiedClaim';
import { validateThesisOwners } from '../services/thesis';
import { validateExpressionOwners } from '../services/investmentExpression';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import type { ThesisIdentity } from '../types/thesis';
import type { InstrumentRef } from '../types/investmentExpression';
import type { ThesisWorkspaceRuntime } from '../services/thesisWorkspace';
import type { ExpressionWorkspaceRuntime } from '../services/expressionWorkspace';

/** Frozen synthetic pins allow export/import after reload. Never reads user storage. */
export async function createDemoRuntime() {
  const fixture = await claimFixture(), storage = claimStorage();
  if (seed.synthetic !== true) throw Error('DEMO_SYNTHETIC_LABEL_REQUIRED');
  storage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(seed.claims));
  storage.setItem(THESIS_STORAGE_KEY, JSON.stringify(seed.theses));
  storage.setItem(EXPRESSION_STORAGE_KEY, JSON.stringify(seed.expressions));
  const claimRepository = new BrowserClaimRepository(storage, fixture.owners);
  const identities = seed.identities as ThesisIdentity[];
  const owners = {
    claims() { const loaded = claimRepository.load(); if (loaded.error) throw Error(loaded.error); return { data: loaded.data, owners: fixture.owners }; },
    resolveIdentity(ref: ThesisIdentity) {
      const match = identities.filter(identity => canonicalJson(identity) === canonicalJson(ref));
      if (match.length !== 1) throw Error('DEMO_SYNTHETIC_IDENTITY_REQUIRED');
      return { ...match[0] };
    },
  };
  const repository = new BrowserThesisRepository(storage, owners);
  const thesis: ThesisWorkspaceRuntime = {
    repository, owners, claimRepository, claimOwners: fixture.owners, bindings: [fixture.binding],
    identities: identities.map(ref => ({ ref, label: `合成样本 · ${ref.id}` })),
    evidence: () => ({ title: '合成合同样本 · 非真实研究', scope: 'synthetic-only', quality: [],
      rows: [{ label: 'Original frozen graph', value: JSON.stringify(fixture.graph) }], records: [], linkage: null }),
  };
  const instruments = seed.instruments as InstrumentRef[];
  const expressionOwners = {
    scope: 'synthetic' as const,
    theses() { const loaded = repository.load(); if (loaded.error) throw Error(loaded.error); return { data: loaded.data, owners }; },
    resolveInstrument(ref: InstrumentRef) {
      const match = instruments.filter(instrument => canonicalJson(instrument) === canonicalJson(ref));
      if (match.length !== 1) throw Error('DEMO_SYNTHETIC_INSTRUMENT_REQUIRED');
      return { ...match[0] };
    },
  };
  const expression: ExpressionWorkspaceRuntime = {
    thesisRuntime: thesis, owners: expressionOwners, repository: new BrowserExpressionRepository(storage, expressionOwners),
    instruments: instruments.map(ref => ({ ref, label: `合成标的 · ${ref.type}` })),
  };
  // Re-run original schema and source validation, including exact frozen F2 pins.
  validateClaimOwners(claimRepository.load().data, fixture.owners);
  validateThesisOwners(repository.load().data, owners);
  validateExpressionOwners(expression.repository.load().data, expressionOwners);
  return { thesis, expression };
}
