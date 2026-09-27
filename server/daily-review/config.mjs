import { bridgeConfig, exchangeCode, verifyToken, signToken } from '../research-bridge/auth.mjs';
import { DailyReviewStore } from './store.mjs';

export function reviewConfig(env = process.env) {
  if (env.DAILY_REVIEW_ENABLED !== 'true') throw Error('REVIEW_DISABLED');
  if (env.DAILY_REVIEW_SCOPE && !['real','synthetic'].includes(env.DAILY_REVIEW_SCOPE)) throw Error('REVIEW_SCOPE_REQUIRED');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(env.DAILY_REVIEW_WORKSPACE ?? '')) throw Error('REVIEW_WORKSPACE_REQUIRED');
  const base = bridgeConfig({ ...env, BRIDGE_ENABLED: 'true' });
  return { ...base, scope: 'review:write', issuer: `${base.origin}/daily-review`, resource: `${base.origin}/api/review-mcp`,
    namespace: 'daily-review', authPath: '/api/daily-review', cookieName: 'daily_review_consent', workspace: env.DAILY_REVIEW_WORKSPACE };
}
export const ownerGrant = (config, scope = 'real') => ({ actor: 'owner', owner: config.subject, workspace: config.workspace, scope });
export function reviewAuth(scope = 'real', now = Date.now) {
  const repo = (config, store) => new DailyReviewStore(store, { owner: config.subject, workspace: config.workspace, scope, now });
  return {
    async exchange(params, config, store) {
      const epoch = (await repo(config, store).state()).value.epoch;
      const result = await exchangeCode(params, config, store, now());
      const base = verifyToken(result.access_token, config, 'access', now());
      if ((await repo(config, store).state()).value.epoch !== epoch) throw Error('REVIEW_AUTH_CHANGED');
      return { ...result, access_token: signToken({ ...base, reviewEpoch: epoch, workspace: config.workspace, dataScope: scope }, config) };
    },
    async authenticate(token, config, store) {
      const base = verifyToken(token, config, 'access', now());
      const grant = { actor: 'ai', owner: base.sub, workspace: base.workspace, scope: base.dataScope, epoch: base.reviewEpoch, expiresAt: base.exp * 1000 };
      await repo(config, store).checkedState(grant); return grant;
    },
  };
}
