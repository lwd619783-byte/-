import type { Industry, Stock } from '../types';
import type { DataQualityMeta } from '../types/dataSource';

export type ChainCompany = Pick<Stock, 'id' | 'name' | 'industryId' | 'segmentId' | 'chainPosition' | 'verificationStatus'> & { market: string; code?: string };

/** A read-only projection of research context. No quote/financial field participates. */
export function industryChainTopology(industry: Industry, companies: ChainCompany[]) {
  const stages = industry.chain.filter(stage => stage.items.length > 0);
  if (!stages.length || new Set(stages.map(s => s.stage)).size !== stages.length) return null;
  const pool = companies.filter(company => company.industryId === industry.id).map(({ id, name, industryId, segmentId, chainPosition, verificationStatus, market, code }) => ({ id, name, industryId, segmentId, chainPosition, verificationStatus, market, code }));
  const unique = pool.filter(company => pool.filter(c => c.id === company.id).length === 1);
  const nodes = stages.map(stage => ({ ...stage, companies: unique.flatMap(company => {
    // Literal containment in the retained research text; no synonyms, segment guesses or middle-stage fallback.
    const matchedItems = stage.items.filter(item => company.chainPosition.includes(item));
    if (company.chainPosition !== stage.stage && !matchedItems.length) return [];
    return [{ company, matchedItems, segment: industry.segments.find(s => s.industryId === industry.id && s.id === company.segmentId) }];
  }) }));
  const positioned = new Set(nodes.flatMap(node => node.companies.map(c => c.company.id)));
  return { nodes, unpositioned: unique.filter(c => !positioned.has(c.id)), conflictedIds: [...new Set(pool.filter(c => !unique.includes(c)).map(c => c.id))] };
}

const readable = (quality?: DataQualityMeta) => !!quality && ['real', 'generated_real', 'partial', 'stale'].includes(quality.status);
const state = (quality?: DataQualityMeta) => quality?.status ?? 'missing';

/** Exact company owner only; unavailable facts are never taken from qualitative stock.financial. */
export function industryCompanyOverlay(stock: Stock) {
  const quote = stock.quote?.id === stock.id ? stock.quote : undefined;
  const financial = stock.aShareFinancialSummary?.id === stock.id && stock.aShareFinancialSummary.stockCode === stock.code ? stock.aShareFinancialSummary : undefined;
  const generalFinancial = stock.realFinancial?.id === stock.id ? stock.realFinancial : undefined;
  const announcement = stock.aShareAnnouncementSummary?.stockId === stock.id && stock.aShareAnnouncementSummary.stockCode === stock.code ? stock.aShareAnnouncementSummary : undefined;
  const series = stock.announcements?.id === stock.id ? stock.announcements : undefined;
  const financialQuality = financial?.quality ?? generalFinancial?.quality;
  const announcementQuality = announcement?.quality ?? series?.quality;
  const financialConflict = !!((stock.aShareFinancialSummary && !financial) || (stock.realFinancial && !generalFinancial));
  const announcementConflict = !!((stock.aShareAnnouncementSummary && !announcement) || (stock.announcements && !series));
  return {
    // Existing quote updatedAt is the fetch clock, not an exchange observation timestamp.
    quoteAsOf: null,
    quoteUpdatedAt: readable(quote?.quality) ? quote?.updatedAt ?? null : null,
    marketCap: readable(quote?.quality) && Number.isFinite(quote?.marketCap) ? quote!.marketCap : null,
    quoteStatus: stock.quote && !quote ? 'conflicted' : state(quote?.quality),
    quoteSource: quote?.quality.source ?? null,
    reportPeriod: !financialConflict && readable(financialQuality) ? financial ? financial.latestReportPeriod : generalFinancial?.reportDate ?? null : null,
    financialStatus: financialConflict ? 'conflicted' : state(financialQuality),
    financialSource: financialQuality?.source ?? null,
    announcementDate: !announcementConflict && readable(announcementQuality) ? announcement ? announcement.latestAnnouncementDate : series?.announcements.map(a => a.date).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d)).sort().at(-1) ?? null : null,
    announcementStatus: announcementConflict ? 'conflicted' : state(announcementQuality),
    announcementSource: announcementQuality?.source ?? null,
  };
}
