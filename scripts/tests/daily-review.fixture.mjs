import { domainTestEnv } from './os-domain.fixture.mjs';
export const reviewTestEnv = { ...domainTestEnv, DAILY_REVIEW_ENABLED: 'true', DAILY_REVIEW_WORKSPACE: 'synthetic-workspace' };
export function reviewFixture(now = Date.now()) {
  const asOf = new Date(now - 2000).toISOString();
  return { schemaVersion: 'daily-review.v1', subjectType: 'industry', subjectId: 'oil-shipping',
    reviewDate: new Date(now - 2000 + 8*3600000).toISOString().slice(0,10), asOf, dataAsOf: asOf, generatedAt: new Date(now - 1000).toISOString(),
    generator: { type: 'ai', name: 'Synthetic test (not ChatGPT acceptance)' },
    sources: [{ id: 'freight', kind: 'os', title: '合成测试：油运运价接入状态', locator: 'os:industry:oil-shipping:freight', revision: 'oil-observation.v1', sourceDate: null, asOf, availableAt: null, availability: 'blocked', relationToOS: 'os_state' }],
    previousReviewId: null, previousRevision: null, status: 'AI_PUBLISHED', summary: '合成测试：运价不可用，运价与股价关系无法确认。',
    observations: [{ kind: 'interpretation', text: '不能由缺失运价推导上涨或共振；股票留存状态仍需读取原 owner。', sourceIds: ['freight'] }],
    delta: [], supports: [], challenges: [], risks: [{ text: '运价数据缺口仍未闭合。', sourceIds: ['freight'] }],
    watchNext: [{ condition: '先核对运价使用授权与数据准入', metric: 'CT1', currentState: 'blocked', direction: 'available', horizon: '下一观察日', sourceIds: ['freight'] }],
    confidence: 'unknown', uncertainty: ['数据不足，无法形成运价方向结论。'], formalDecisionImpact: 'none' };
}
export const publication = (now = Date.now()) => ({ review: reviewFixture(now), idempotencyKey: 'synthetic-review-key-0001', expectedRevision: 0 });
