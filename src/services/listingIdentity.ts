import plan from '../../config/listing-status/tracked-pre-ipo.v1.json';
import { symbolMap, type SymbolMapping } from '../utils/symbol';

type ListingIdentity = { id: string; name: string; code?: string; market: string };

/** Exact reviewed exchange disclosure context, not a replacement Company/Entity owner. */
export function officialListingContext(company: ListingIdentity, symbols: readonly SymbolMapping[] = symbolMap) {
  const records = plan.tracked.filter(record => record.id === company.id);
  const exactSymbols = symbols.filter(symbol => symbol.id === company.id);
  if (records.length !== 1 || exactSymbols.length !== 1) return null;
  const record = records[0];
  const mapping = record.reviewedMapping;
  const symbol = exactSymbols[0];
  if (symbols.filter(candidate => candidate.standardSymbol === symbol.standardSymbol).length !== 1) return null;
  if (record.legalName !== mapping.legalName || mapping.id !== company.id
    || mapping.name !== company.name || mapping.code !== company.code || mapping.market !== company.market
    || symbol.name !== company.name || symbol.market !== company.market
    || symbol.standardSymbol !== `${mapping.code}.${mapping.exchange}`) return null;
  return {
    legalName: mapping.legalName,
    standardSymbol: symbol.standardSymbol,
    exchange: mapping.exchange,
    board: mapping.board,
    listingDate: mapping.listingDate,
    sourceName: '上海证券交易所',
    sourceUrl: record.sourceUrl,
    retainedProvenance: `config/listing-status/${record.retainedProvenance}`,
    releaseAvailableAt: null,
  };
}
