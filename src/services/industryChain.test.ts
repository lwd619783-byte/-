import { describe, expect, it } from 'vitest';
import { industries } from '../data/industries';
import { stocks } from '../data/stocks';
import { roboticsPrivateCompanies } from '../data/privateCompanies';
import { industryChainTopology, industryCompanyOverlay } from './industryChain';
import type { Stock } from '../types';

const robotics = industries.find(i => i.id === 'robotics')!;
const pool = stocks.filter(s => s.industryId === 'robotics');
const sample = pool.find(s => s.id === 'inovance')!;
const quote = { id: sample.id, latestPrice: 0, pctChange: 0, marketCap: 0, pe: null, pb: null, updatedAt: '2026-09-18T10:00:00+08:00', quality: { source: 'synthetic', status: 'stale' as const } };
describe('Industry chain context and Provider Fact isolation', () => {
  it('retains exact source stage/items and all literal multi-stage memberships', () => {
    const graph = industryChainTopology(robotics, [...pool, ...roboticsPrivateCompanies])!;
    expect(graph.nodes.map(({ stage, items }) => ({ stage, items }))).toEqual(robotics.chain);
    expect(graph.nodes.filter(n => n.companies.some(c => c.company.id === 'inovance')).map(n => n.stage)).toEqual(['上游', '中游']);
    expect(graph.nodes.find(n => n.stage === '下游')!.companies.some(c => c.company.id === 'unitree')).toBe(true);
    expect(graph.unpositioned.some(c => c.id === 'xinje')).toBe(true);
    for (const node of graph.nodes) for (const { company, segment } of node.companies) {
      if (segment) expect(segment.id).toBe(company.segmentId);
      expect(company.industryId).toBe(robotics.id);
    }
  });
  it('quote refresh cannot change topology; foreign/duplicate IDs do not leak through', () => {
    expect(industryChainTopology(robotics, [{ ...sample, quote } as Stock])).toEqual(industryChainTopology(robotics, [sample]));
    const graph = industryChainTopology(robotics, [sample, { ...sample }, { ...sample, id: 'foreign', industryId: 'foreign' }])!;
    expect(graph.nodes.every(n => !n.companies.length)).toBe(true);
    expect(graph.conflictedIds).toEqual([sample.id]);
  });
  it('does not invent structure or assign an unknown position to a middle node', () => {
    expect(industryChainTopology({ ...robotics, chain: [] }, pool)).toBeNull();
    const graph = industryChainTopology(robotics, [{ ...sample, chainPosition: 'unmapped' }])!;
    expect(graph.nodes.every(n => !n.companies.length)).toBe(true);
    expect(graph.unpositioned[0].id).toBe(sample.id);
  });
  it('preserves zero, stale and unknown as-of without using qualitative market cap', () => {
    const fact = industryCompanyOverlay({ ...sample, quote });
    expect(fact.marketCap).toBe(0);
    expect(fact.quoteStatus).toBe('stale');
    expect(fact.quoteAsOf).toBeNull();
    expect(fact.quoteUpdatedAt).toBe(quote.updatedAt);
    expect(industryCompanyOverlay({ ...sample, quote: { ...quote, updatedAt: undefined } }).quoteAsOf).toBeNull();
    expect(industryCompanyOverlay({ ...sample, quote: undefined }).marketCap).toBeNull();
  });
  it.each(['mock', 'conflicted', 'missing', 'source_unavailable', 'unknown'] as const)('does not label %s values as Provider Facts', status => {
    const fact = industryCompanyOverlay({ ...sample, quote: { ...quote, quality: { source: 'synthetic', status } } });
    expect(fact.marketCap).toBeNull();
    expect(fact.quoteStatus).toBe(status);
  });
  it('rejects foreign quote/financial/announcement owners', () => {
    const fact = industryCompanyOverlay({ ...sample, quote: { ...quote, id: 'foreign' }, realFinancial: { id: 'foreign', reportDate: '2099-12-31', quality: quote.quality }, announcements: { id: 'foreign', announcements: [{ title: 'foreign', date: '2099-12-31' }], quality: quote.quality } } as Stock);
    expect([fact.quoteStatus, fact.financialStatus, fact.announcementStatus]).toEqual(['conflicted', 'conflicted', 'conflicted']);
    expect([fact.marketCap, fact.reportPeriod, fact.announcementDate]).toEqual([null, null, null]);
  });
});
