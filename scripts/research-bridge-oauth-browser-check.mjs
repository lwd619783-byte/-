/** Real browser form navigation; disposable profile, synthetic credentials/storage only. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createBridgeHandler } from '../server/research-bridge/http.mjs';
import { privateStoreFixture } from './tests/private-blob.fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = 'https://bridge.synthetic.test', redirect = 'https://chatgpt.com/connector_platform_oauth_redirect';
const env = { BRIDGE_ENABLED: 'true', BRIDGE_ORIGIN: origin, BRIDGE_OWNER_SECRET: 'synthetic-owner-'.repeat(4), BRIDGE_SIGNING_SECRET: 'synthetic-signing-'.repeat(4), BLOB_STORE_ID: 'synthetic', BRIDGE_OAUTH_REDIRECT_URIS: redirect };
const server = createServer(createBridgeHandler({ env, store: privateStoreFixture().store }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const local = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
// Redirects following route.fulfill may bypass routing. Offline mode prevents
// any real ChatGPT traffic; the emitted callback navigation is verified below.
await context.setOffline(true);
const verifier = 'v'.repeat(43), params = new URLSearchParams({ client_id: 'research-os-chatgpt', redirect_uri: redirect, response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), state: 'synthetic-browser-state', resource: `${origin}/api/mcp`, scope: 'research:read' });
let consentOrigin, consentReferer, consentStatus, callback;
try {
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'https://chatgpt.com') { await route.abort(); return; }
    assert.equal(url.origin, origin);
    const headers = await req.allHeaders(); delete headers.host;
    const res = await fetch(`${local}${url.pathname}${url.search}`, { method: req.method(), headers, body: req.postDataBuffer() ?? undefined, redirect: 'manual' });
    if (req.method() === 'POST' && url.pathname.endsWith('/authorize')) { consentOrigin = headers.origin; consentReferer = headers.referer; consentStatus = res.status; }
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  const page = await context.newPage();
  page.on('request', req => { const url = new URL(req.url()); if (url.origin + url.pathname === redirect && req.isNavigationRequest()) callback = url; });
  await page.goto(`${origin}/api/bridge/authorize?${params}`);
  await page.getByLabel('研究桥访问密钥').fill(env.BRIDGE_OWNER_SECRET);
  await Promise.all([page.waitForNavigation().catch(() => undefined), page.getByRole('button', { name: '确认授予只读访问' }).click()]);
  assert.equal(consentOrigin, origin, 'native form POST must retain the exact same-origin value');
  assert.equal(consentReferer, `${origin}/`, 'consent URL path and query must not be disclosed');
  assert.equal(consentStatus, 303);
  assert.equal(callback?.searchParams.get('state'), 'synthetic-browser-state');
  assert.equal(callback?.searchParams.get('iss'), origin);
  const tokenBody = new URLSearchParams({ grant_type: 'authorization_code', client_id: 'research-os-chatgpt', redirect_uri: redirect, resource: `${origin}/api/mcp`, code_verifier: verifier, code: callback.searchParams.get('code') });
  const token = await fetch(`${local}/api/bridge/token`, { method: 'POST', body: tokenBody });
  assert.equal(token.status, 200);
  const replay = await fetch(`${local}/api/bridge/token`, { method: 'POST', body: tokenBody }); assert.equal(replay.status, 400);
  for (const foreign of ['null', 'https://untrusted.synthetic.test']) {
    const denied = await fetch(`${local}/api/bridge/authorize`, { method: 'POST', headers: { Origin: foreign }, body: 'ticket=synthetic' }); assert.equal(denied.status, 403);
  }
  console.log('PASS browser native OAuth form, exact Origin, cookie consent, PKCE, callback issuer/state, replay and foreign/null Origin denial');
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
