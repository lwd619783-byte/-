import type { Stock } from '../types';
import type { ExpressionOwners, InstrumentRef } from '../types/investmentExpression';
import type { StorageLike } from './watchlistRepository';
import type { ThesisWorkspaceRuntime } from './thesisWorkspace';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { BrowserExpressionRepository } from './expressionRepository';

export interface InstrumentOption { ref: InstrumentRef; label: string }
export interface ExpressionWorkspaceRuntime {
  owners: ExpressionOwners; repository: BrowserExpressionRepository; instruments: InstrumentOption[];
  thesisRuntime: ThesisWorkspaceRuntime;
}
/** Composition of existing owners; no registry, quote store, ledger or fixture fallback. */
export function createExpressionWorkspace(thesisRuntime: ThesisWorkspaceRuntime, stocks: Stock[], storage: StorageLike | null): ExpressionWorkspaceRuntime {
  const instruments: InstrumentOption[] = stocks.filter(s => s.dataMode === 'real').map(s => ({
    ref: { owner: 'Stock', id: s.id, type: 'Equity', market: s.market === 'A股' ? 'A' : s.market === '港股' ? 'H' : s.market === '美股' ? 'US' : 'unknown' }, label: s.name,
  }));
  const owners: ExpressionOwners = {
    scope: 'real',
    theses() { const loaded = thesisRuntime.repository.load(); if (loaded.error) throw Error(loaded.error); return { data: loaded.data, owners: thesisRuntime.owners }; },
    resolveInstrument(ref) {
      const matches = instruments.filter(o => o.ref.owner === ref.owner && o.ref.id === ref.id);
      if (matches.length !== 1 || canonicalJson(matches[0].ref) !== canonicalJson(ref)) throw Error('EXPRESSION_INSTRUMENT_UNRESOLVED_OR_AMBIGUOUS');
      return { ...matches[0].ref };
    },
  };
  return { owners, instruments, thesisRuntime, repository: new BrowserExpressionRepository(storage, owners) };
}
