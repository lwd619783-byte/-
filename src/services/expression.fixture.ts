/** SYNTHETIC ONLY. Frozen Evidence → real Claim review service → real Thesis confirmation service. */
import type { ExpressionOwners, ExpressionRevision, InstrumentRef } from '../types/investmentExpression';
import { thesisFixture } from './thesis.fixture';
import { claimStorage, claimTime as at } from './verifiedClaim.fixture';
import { BrowserThesisRepository } from './thesisRepository';
import { BrowserExpressionRepository } from './expressionRepository';
import { pinFormalThesis } from './investmentExpression';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { cloneClaim } from './verifiedClaim';

export async function expressionFixture(type: InstrumentRef['type'] = 'ETF') {
  const f = await thesisFixture(), thesisStore = claimStorage(), storage = claimStorage();
  let clock = at(9);
  const thesisRepo = new BrowserThesisRepository(thesisStore, f.owners, () => new Date(clock));
  const draft = thesisRepo.saveDraft(thesisRepo.load().data, f.revision);
  const formal = thesisRepo.confirm(thesisRepo.prepareConfirmation(draft, f.revision.revisionId), 'Synthetic explicit Thesis confirmation', true);
  const instruments: InstrumentRef[] = (['ETF', 'Index', 'Equity', 'Fund', 'CommodityProxy'] as const).map(type => ({ owner: type === 'Equity' ? 'Stock' : 'Asset', id: `synthetic-${type}`, type, market: 'global' }));
  const owners: ExpressionOwners = {
    scope: 'synthetic',
    theses() { const loaded = thesisRepo.load(); if (loaded.error) throw Error(loaded.error); return { data: loaded.data, owners: f.owners }; },
    resolveInstrument(ref) { const matches = instruments.filter(i => i.owner === ref.owner && i.id === ref.id); if (matches.length !== 1 || canonicalJson(matches[0]) !== canonicalJson(ref)) throw Error('EXPRESSION_INSTRUMENT_UNRESOLVED_OR_AMBIGUOUS'); return cloneClaim(matches[0]); },
  };
  clock = at(11);
  const unknown = () => ({ status: 'unknown' as const, rationale: 'Synthetic fixture: unknown, no invented numeric context' });
  const revision: ExpressionRevision = { expressionId: `synthetic-expression-${type}`, revisionId: `synthetic-expression-${type}-r1`, supersedes: null, createdAt: at(10), asOf: at(10), scope: 'synthetic', origin: 'ai_draft',
    thesis: pinFormalThesis(formal.revisions[0], formal.confirmations[0]), instrument: cloneClaim(instruments.find(i => i.type === type)!), role: 'direct',
    directness: { status: 'research_judgement', rationale: 'Synthetic conditional directness' }, correlation: unknown(), liquidity: unknown(), valuation: unknown(), sensitivity: unknown(), idiosyncraticRisk: unknown(), contexts: [], reason: 'Synthetic initial expression' };
  const repo = new BrowserExpressionRepository(storage, owners, () => new Date(clock));
  return { ...f, thesisRepo, thesisStore, expressionOwners: owners, instruments, expression: revision, storage, repo, tick: (day: number) => { clock = at(day); } };
}
