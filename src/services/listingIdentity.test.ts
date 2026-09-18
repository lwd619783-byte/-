import { describe, expect, it } from 'vitest';
import { officialListingContext } from './listingIdentity';
import { getSymbolMapping } from '../utils/symbol';

const unitree = { id: 'unitree', name: '宇树科技', code: '688836', market: 'A股' };

describe('exact official listing context', () => {
  it('returns only the reviewed exchange identity, with unknown PIT availability intact', () => {
    expect(officialListingContext(unitree)).toMatchObject({ legalName: '宇树科技股份有限公司', standardSymbol: '688836.SH', exchange: 'SH', board: '科创板', listingDate: '2026-08-19', releaseAvailableAt: null });
    expect(officialListingContext(unitree)?.sourceUrl).toContain('https://www.sse.com.cn/disclosure/announcement/');
  });

  it('rejects foreign ID, code, display name, market or missing code without nearest mapping', () => {
    for (const change of [{ id: 'unknown' }, { code: '688999' }, { code: undefined }, { name: '另一家公司' }, { market: '未上市' }]) {
      expect(officialListingContext({ ...unitree, ...change })).toBeNull();
    }
  });

  it('rejects missing, duplicate, foreign exchange/name/market symbol mappings', () => {
    const symbol = getSymbolMapping('unitree')!;
    for (const symbols of [[], [symbol, symbol], [symbol, { ...symbol, id: 'foreign-id' }], [{ ...symbol, standardSymbol: '688836.SZ' }], [{ ...symbol, name: '其他公司' }], [{ ...symbol, market: '港股' as const }]]) {
      expect(officialListingContext(unitree, symbols)).toBeNull();
    }
  });
});
