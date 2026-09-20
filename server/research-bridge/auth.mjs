import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const equal = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export function bridgeConfig(env = process.env) {
  const origin = env.BRIDGE_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined), ownerSecret = env.BRIDGE_OWNER_SECRET, signingSecret = env.BRIDGE_SIGNING_SECRET;
  if (env.BRIDGE_ENABLED !== 'true' || !origin || !/^https:\/\/[^/]+$/.test(origin) || !ownerSecret || ownerSecret.length < 32 || !signingSecret || signingSecret.length < 32
    || !(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID)) throw new Error('BRIDGE_NOT_CONFIGURED');
  const redirects = (env.BRIDGE_OAUTH_REDIRECT_URIS ?? '').split(',').filter(Boolean);
  if (!redirects.length || redirects.some(uri => !/^https:\/\/chatgpt\.com\/(connector_platform_oauth_redirect|connector\/oauth\/[a-zA-Z0-9_-]+)$/.test(uri))) throw new Error('BRIDGE_REDIRECT_NOT_CONFIGURED');
  return { origin, resource: `${origin}/api/mcp`, ownerSecret, signingSecret, clientId: env.BRIDGE_OAUTH_CLIENT_ID || 'research-os-chatgpt', subject: 'personal-owner', redirects };
}
export function checkOwner(secret, config) { if (typeof secret !== 'string' || !equal(secret, config.ownerSecret)) throw new Error('UNAUTHORIZED'); return config.subject; }
export function signToken(payload, config) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', config.signingSecret).update(body).digest('base64url')}`;
}
export function verifyToken(token, config, kind, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 6000) throw new Error('UNAUTHORIZED');
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !equal(signature, createHmac('sha256', config.signingSecret).update(body).digest('base64url'))) throw new Error('UNAUTHORIZED');
  const value = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (value.kind !== kind || value.iss !== config.origin || value.aud !== config.resource || value.sub !== config.subject || !Number.isSafeInteger(value.exp) || value.exp * 1000 <= now
    || value.scope !== 'research:read') throw new Error('UNAUTHORIZED');
  return value;
}
export function authorizeParameters(params, config) {
  const value = Object.fromEntries(params);
  if (value.client_id !== config.clientId || !config.redirects.includes(value.redirect_uri) || value.response_type !== 'code' || value.code_challenge_method !== 'S256'
    || !/^[a-zA-Z0-9_-]{43}$/.test(value.code_challenge ?? '') || !value.state || value.state.length > 2000 || value.resource !== config.resource || value.scope !== 'research:read') throw new Error('INVALID_OAUTH_REQUEST');
  return value;
}
export function oauthMetadata(config) {
  return { issuer: config.origin, authorization_endpoint: `${config.origin}/api/bridge/authorize`, token_endpoint: `${config.origin}/api/bridge/token`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'], token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'], scopes_supported: ['research:read'], authorization_response_iss_parameter_supported: true };
}
export function newConsent(params, config, now = Date.now()) {
  const nonce = randomBytes(24).toString('base64url');
  return { nonce, ticket: signToken({ kind: 'consent', iss: config.origin, aud: config.resource, sub: config.subject, scope: 'research:read', exp: Math.floor(now / 1000) + 600, nonce, params }, config) };
}
export async function issueCode(ticket, cookie, ownerSecret, config, store, now = Date.now()) {
  checkOwner(ownerSecret, config);
  const consent = verifyToken(ticket, config, 'consent', now);
  if (!cookie || !equal(cookie, consent.nonce)) throw new Error('INVALID_CONSENT');
  const params = authorizeParameters(new URLSearchParams(consent.params), config), code = randomBytes(32).toString('base64url');
  await store.putNew(`research-bridge/oauth/consent/${createHash('sha256').update(consent.nonce).digest('hex')}.json`, { usedAt: now });
  await store.putNew(`research-bridge/oauth/codes/${createHash('sha256').update(code).digest('hex')}.json`, { ...params, expiresAt: now + 120000, subject: config.subject });
  const redirect = new URL(params.redirect_uri); redirect.searchParams.set('code', code); redirect.searchParams.set('state', params.state); redirect.searchParams.set('iss', config.origin); return redirect.toString();
}
export async function exchangeCode(params, config, store, now = Date.now()) {
  const value = Object.fromEntries(params);
  if (value.grant_type !== 'authorization_code' || value.client_id !== config.clientId || value.resource !== config.resource || !/^[a-zA-Z0-9_-]{43}$/.test(value.code ?? '')
    || !/^[a-zA-Z0-9._~-]{43,128}$/.test(value.code_verifier ?? '')) throw new Error('INVALID_GRANT');
  const codeHash = createHash('sha256').update(value.code).digest('hex'), code = await store.get(`research-bridge/oauth/codes/${codeHash}.json`);
  if (!code || code.expiresAt <= now || code.subject !== config.subject || code.client_id !== value.client_id || code.redirect_uri !== value.redirect_uri || code.resource !== value.resource
    || !equal(code.code_challenge, createHash('sha256').update(value.code_verifier).digest('base64url'))) throw new Error('INVALID_GRANT');
  // Blob create-if-absent is the durable single-use gate across serverless instances.
  await store.putNew(`research-bridge/oauth/used/${codeHash}.json`, { at: now });
  return { access_token: signToken({ kind: 'access', iss: config.origin, aud: config.resource, sub: config.subject, scope: 'research:read', exp: Math.floor(now / 1000) + 3600 }, config), token_type: 'Bearer', expires_in: 3600, scope: 'research:read' };
}
