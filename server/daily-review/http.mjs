import { createAuthenticatedReadHandler } from '../shared/read-only-http.mjs';
import { reviewConfig, reviewAuth, ownerGrant } from './config.mjs';
import { DailyReviewStore } from './store.mjs';
import { serveReviewMcp } from './mcp.mjs';
import { MAX_REVIEW_BYTES } from '../../shared/daily-review.mjs';

export function createReviewHandler({ env = process.env, store, now = Date.now, scope = env.DAILY_REVIEW_SCOPE ?? 'real' } = {}) {
  const configFactory = reviewConfig;
  const handler = createAuthenticatedReadHandler({ env, store, configFactory, ...reviewAuth(scope, now),
    service: 'review', credentialLabel: '复盘访问凭据（Review access credential）',
    unauthorizedMessage: '复盘访问凭据不正确，请核对后重试。', rejectedMessage: '每日复盘请求未通过认证、内容或持久存储检查；未发布新版本。',
    stagingFactory: (store, owner) => new DailyReviewStore(store, { owner, workspace: reviewConfig(env).workspace, scope, now }),
    serve: serveReviewMcp, consentTitle: '投研 OS 每日复盘 · ChatGPT 复盘写入授权', consentAction: '授权读取与发布 AI 复盘',
    consentDescription: '允许读取复盘和自动保存、展示 AI_PUBLISHED 复盘（未人工确认），保留历史版本。不能确认复盘或修改 Claim / Thesis / Expression / Portfolio，不能交易。授权有效一小时，可在每日复盘区域撤销全部写授权；复盘历史长期保留。平台要求的单次操作确认仍须遵守。',
    async ownerAction({ req, res, action, url, staging, config, send, body }) {
      const grant = ownerGrant(config, scope);
      const query = () => Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'action').map(([k,v]) => [k, ['revision','before','limit'].includes(k) ? Number(v) : v]));
      if (req.method === 'GET' && action === 'current') { send(res, 200, await staging.read(query(), grant)); return; }
      if (req.method === 'GET' && action === 'history') { send(res, 200, await staging.history(query(), grant)); return; }
      if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (req.headers.origin !== config.origin || !String(req.headers['content-type']).startsWith('application/json')) { send(res, 403, { error: 'REVIEW_ORIGIN_OR_TYPE_REJECTED' }); return; }
      const input = JSON.parse(await body(req));
      if (action === 'transition') { send(res, 200, await staging.ownerTransition(input, grant)); return; }
      if (action === 'revoke' && Object.keys(input).length === 0) { send(res, 200, await staging.revoke(grant)); return; }
      send(res, 404, { error: 'REVIEW_ACTION_NOT_ALLOWED' });
    },
  });
  // Bound the transport before SDK parsing, including unknown tools and batched JSON.
  return async (req, res) => {
    try {
      if (req.method === 'POST') {
        let raw;
        if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        else { const chunks = []; let size = 0; for await (const c of req) { const b = Buffer.from(c); size += b.length; if (size > MAX_REVIEW_BYTES + 8192) throw Error(); chunks.push(b); } raw = Buffer.concat(chunks).toString(); }
        if (Buffer.byteLength(raw) > MAX_REVIEW_BYTES + 8192) throw Error();
        req.body = String(req.headers['content-type']).startsWith('application/json') ? JSON.parse(raw) : raw;
      }
      await handler(req, res);
    } catch { if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: 'REVIEW_REQUEST_REJECTED' })); }
  };
}
