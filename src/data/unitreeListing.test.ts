import { describe, expect, it } from 'vitest';
import { stocks } from './stocks';
import { roboticsPrivateCompanies } from './privateCompanies';
import { unitreeHistoricalResearch } from './unitreeHistoricalResearch';
import { symbolMap, getSymbolMapping } from '../utils/symbol';
import universe from './real/stock-universe.generated.json';

describe('reviewed Unitree listing migration', () => {
  it('includes the listing once in generated Universe without nested Evidence identities', () => {
    const matches = universe.items.filter(item => item.id === 'unitree' || item.standardSymbol === '688836.SH');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: 'unitree', code: '688836', exchange: 'SH', market: 'A股', standardSymbol: '688836.SH' });
    expect(universe.warnings).toEqual([]);
    expect(universe.total).toBe(universe.items.length);
    expect(universe.privateCompanies.ids).not.toContain('unitree');
    expect(universe.items.some(item => item.id.startsWith('unitree-'))).toBe(false);
  });

  it('keeps exact stable identity in one listed seed and mapping only', () => {
    const matching = stocks.filter(stock => stock.id === 'unitree' || stock.code === '688836');
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({ id: 'unitree', name: '宇树科技', code: '688836', market: 'A股', industryId: 'robotics', segmentId: 'robot-oem', chainPosition: '下游' });
    expect(symbolMap.filter(symbol => symbol.id === 'unitree' || symbol.standardSymbol === '688836.SH')).toHaveLength(1);
    expect(getSymbolMapping('unitree')).toMatchObject({ standardSymbol: '688836.SH', market: 'A股', aStockDataStatus: 'supported' });
    expect(roboticsPrivateCompanies.some(company => company.id === 'unitree')).toBe(false);
  });

  it('removes stale current status while preserving original research claims as historical evidence', () => {
    const stock = stocks.find(item => item.id === 'unitree')!;
    expect([stock.thesis, ...stock.risks, ...stock.themeTags!, ...stock.trackingMetrics].join(' ')).not.toMatch(/未上市|待上市|IPO/);
    const originals = unitreeHistoricalResearch[0].evidenceItems!;
    expect(unitreeHistoricalResearch[0].market).toBe('未上市');
    expect(originals.map(item => item.id)).toEqual(['unitree-official-products', 'unitree-ipo-tracking']);
    for (const original of originals) {
      const retained = stock.evidenceItems!.find(item => item.id === original.id)!;
      expect(retained.claim).toBe(original.claim);
      expect(retained.note).toContain('历史迁移前 pre-IPO 研究记录');
      expect(retained.sourceDate).toBeUndefined();
      expect(retained.verificationStatus).toBe('待验证');
    }
    expect(stock.evidenceItems!.find(item => item.id === 'unitree-sse-listing-20260818')).toMatchObject({ sourceDate: '2026-08-18', verificationStatus: '已验证', sourceType: '公告' });
    expect(stock.verificationStatus).toBe('部分验证');
  });
});
