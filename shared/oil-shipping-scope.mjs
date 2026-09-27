/** Current frozen runtime admission, shared by observation UI and Review context. */
// Extracted from the existing stock seed identities, not a new Entity registry.
export const oilShippingPilot = Object.freeze([
  Object.freeze({ id: 'cosco-energy', code: '600026', name: '中远海能', market: 'A股' }),
  Object.freeze({ id: 'cm-energy', code: '601872', name: '招商轮船', market: 'A股' }),
  Object.freeze({ id: 'cm-nanjing', code: '601975', name: '招商南油', market: 'A股' }),
]);
export const freightRuntime = Object.freeze({ availability: 'blocked', revision: 'oil-observation.v1', relationship: 'unavailable' });
export const freightCandidate = Object.freeze({ name: 'CT1 · 中东湾—宁波', scope: 'VLCC · 270000MT · WS',
  sourceUrl: 'https://www.sse.net.cn/index/singleIndex?indexType=ctfi', licenseUrl: 'https://www.sse.net.cn/indexIntro?indexName=copyright',
  reason: '运价尚未接入：系统使用授权、历史覆盖及定义版本待核验。' });
