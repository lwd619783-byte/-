import { PrivateBlobStore } from './store.mjs';
import { ResearchStaging } from './domain.mjs';
import { bridgeConfig, checkOwner, verifyToken, oauthMetadata, authorizeParameters, newConsent, issueCode, exchangeCode } from './auth.mjs';
import { serveMcp } from './mcp.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const send = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
const configurationMessages = new Map([
  ['BRIDGE_DISABLED', '研究桥尚未启用，暂不能发送资料。'],
  ['BRIDGE_ORIGIN_NOT_CONFIGURED', '研究桥服务地址尚未配置完成，暂不能发送资料。'],
  ['BRIDGE_AUTH_NOT_CONFIGURED', '研究桥服务端认证尚未配置完成，暂不能发送资料。'],
  ['BRIDGE_STORAGE_NOT_CONFIGURED', '研究桥私有暂存尚未配置，暂不能发送资料。'],
  ['BRIDGE_REDIRECT_NOT_CONFIGURED', '研究桥 ChatGPT 授权连接尚未配置完成，暂不能发送资料。'],
]);
async function body(req) {
  if (req.body !== undefined) { const value = typeof req.body === 'string' ? req.body : String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded') ? new URLSearchParams(req.body).toString() : JSON.stringify(req.body); if (Buffer.byteLength(value) > 3 * 1024 * 1024) throw new Error('BODY_TOO_LARGE'); return value; }
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 3 * 1024 * 1024) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes).toString('utf8');
}

/** No request body/header/token/raw error logging in this server. */
export function createBridgeHandler({ env = process.env, store = new PrivateBlobStore() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    let config;
    try { config = bridgeConfig(env); }
    catch (error) { send(res, 503, { error: 'BRIDGE_NOT_CONFIGURED', message: configurationMessages.get(error?.message) ?? '研究桥暂时不可用，请稍后重试。' }); return; }
    try {
      const url = new URL(req.url, config.origin), action = req.query?.action ?? url.pathname.split('/').at(-1);
      if (req.headers.origin && req.headers.origin !== config.origin) { send(res, 403, { error: 'ORIGIN_REJECTED' }); return; }
      if (action === 'resource-metadata' || url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
        if (req.method !== 'GET') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
        send(res, 200, { resource: config.resource, authorization_servers: [config.origin], scopes_supported: ['research:read'], bearer_methods_supported: ['header'] }); return;
      }
      if (action === 'oauth-metadata' || url.pathname === '/.well-known/oauth-authorization-server') {
        if (req.method !== 'GET') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
        send(res, 200, oauthMetadata(config)); return;
      }
      if (action === 'authorize') {
        if (req.method === 'GET') {
          const params = authorizeParameters(url.searchParams, config), consent = newConsent(params, config);
          // Native form navigation under no-referrer sends Origin: null. Preserve
          // the origin without ever disclosing the consent URL path/query.
          res.setHeader('Referrer-Policy', 'strict-origin');
          res.setHeader('Set-Cookie', `bridge_consent=${consent.nonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/bridge/authorize; Max-Age=600`);
          res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${config.redirects.join(' ')}; frame-ancestors 'none'; base-uri 'none'`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>授权 ChatGPT 只读研究</title><style>body{max-width:560px;margin:8vh auto;padding:24px;font:16px/1.7 system-ui;background:#101923;color:#eef4fa}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:14px}p{color:#c0cdda}</style><h1>允许 ChatGPT 读取研究资料</h1><p>仅可读取你主动发送且未过期、未撤销的批次及所选文章；不能修改知识库。授权有效一小时，资料暂存最多24小时。</p><form method="post"><input type="hidden" name="ticket" value="${escape(consent.ticket)}"><label>研究桥访问密钥<input type="password" name="ownerSecret" autocomplete="off" required minlength="32"></label><button type="submit">确认授予只读访问</button></form></html>`); return;
        }
        if (req.method === 'POST') {
          if (req.headers.origin !== config.origin) throw new Error('INVALID_CONSENT');
          const params = new URLSearchParams(await body(req)), cookie = /(?:^|;\s*)bridge_consent=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
          const redirect = await issueCode(params.get('ticket'), cookie, params.get('ownerSecret'), config, store);
          res.writeHead(303, { Location: redirect, 'Set-Cookie': 'bridge_consent=; HttpOnly; Secure; SameSite=Lax; Path=/api/bridge/authorize; Max-Age=0' }); res.end(); return;
        }
      }
      if (action === 'token' && req.method === 'POST') { send(res, 200, await exchangeCode(new URLSearchParams(await body(req)), config, store)); return; }
      if (action === 'mcp') {
        try { verifyToken(req.headers.authorization?.replace(/^Bearer /, ''), config, 'access'); }
        catch { res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/api/mcp", scope="research:read"`); send(res, 401, { error: 'invalid_token' }); return; }
        await serveMcp(req, res, new ResearchStaging(store, config.subject)); return;
      }
      checkOwner(req.headers['x-bridge-owner-secret'], config);
      const staging = new ResearchStaging(store, config.subject);
      if (action === 'status' && req.method === 'GET') { send(res, 200, url.searchParams.has('stageId') ? await staging.status(url.searchParams.get('stageId')) : { status: 'configured', transport: 'streamable-http', endpoint: config.resource }); return; }
      if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (!String(req.headers['content-type']).startsWith('application/json')) { send(res, 415, { error: 'JSON_REQUIRED' }); return; }
      const value = JSON.parse(await body(req));
      switch (action) {
        case 'begin': send(res, 200, await staging.begin(value)); break;
        case 'source': await staging.putSource(value.stageId, value.source); send(res, 200, { saved: true }); break;
        case 'knowledge': await staging.putKnowledge(value.stageId, value.document); send(res, 200, { saved: true }); break;
        case 'publish': send(res, 200, await staging.publish(value.stageId)); break;
        case 'revoke': send(res, 200, await staging.revoke(value.stageId)); break;
        case 'revoke-batch': send(res, 200, await staging.revokeBatch(value.batchId)); break;
        default: send(res, 404, { error: 'NOT_FOUND' });
      }
    } catch (error) {
      // Do not reflect SDK errors (may contain private object URLs), content, or secrets.
      if (!res.headersSent) send(res, error?.message === 'UNAUTHORIZED' ? 401 : 400, { error: 'REQUEST_REJECTED', message: error?.message === 'UNAUTHORIZED' ? '研究桥访问密钥不正确，请核对后重试。' : '请求未通过认证、资料核验或私有存储检查；未发布不完整资料。' }); else res.end();
    }
  };
}
