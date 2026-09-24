import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DecisionStaging, snapshotDigest } from '../../server/os-domain/staging.mjs';
import { callDomainTool, domainToolSchemas } from '../../server/os-domain/tools.mjs';
import { domainConfig } from '../../server/os-domain/config.mjs';
import { createDomainHandler } from '../../server/os-domain/http.mjs';
import { bridgeConfig, signToken, verifyToken, newConsent, issueCode, exchangeCode, authorizeParameters } from '../../server/research-bridge/auth.mjs';
import { validateDecisionSnapshot, SNAPSHOT_TTL_MS } from '../../shared/decision-snapshot.mjs';
import { DecisionTestStore, domainTestEnv as env, emptyDecisionFixture } from './os-domain.fixture.mjs';
import { privateStoreFixture } from './private-blob.fixture.mjs';
import { domainRelayAllowed, osDomainSeam } from '../os-domain-seam.mjs';
const config = domainConfig(env);
async function seed(now = () => Date.now()) {
  const store = new DecisionTestStore(), staging = new DecisionStaging(store, config.subject, now, 'synthetic'), snapshot = emptyDecisionFixture(now());
  const published = await staging.publish({ snapshot, digest: snapshotDigest(snapshot), expectedGeneration: 0, consent: 'publish-current-decision-state' });
  return { store, staging, snapshot, ...published };
}
const token = (overrides = {}, cfg = config) => signToken({ kind: 'access', iss: cfg.issuer ?? cfg.origin, aud: cfg.resource, sub: cfg.subject, client_id: cfg.clientId, scope: cfg.scope ?? 'research:read', exp: Math.floor(Date.now() / 1000) + 3600, ...overrides }, cfg);
test('OAuth Domain exact issuer/audience/client/scope, S256, replay and Legacy separation', async () => {
  const params = { client_id: config.clientId, redirect_uri: config.redirects[0], response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update('v'.repeat(43)).digest('base64url'), state: 'synthetic', resource: config.resource, scope: 'os:read' };
  for (const [key, value] of [['scope', 'research:read'], ['scope', 'os:write'], ['client_id', 'wrong'], ['resource', `${config.origin}/api/mcp`], ['redirect_uri', 'https://example.com'], ['code_challenge_method', 'plain']]) assert.throws(() => authorizeParameters(new URLSearchParams({ ...params, [key]: value }), config));
  const store = new DecisionTestStore(), consent = newConsent(params, config);
  await assert.rejects(issueCode(consent.ticket, 'wrong', env.BRIDGE_OWNER_SECRET, config, store));
  const redirect = new URL(await issueCode(consent.ticket, consent.nonce, env.BRIDGE_OWNER_SECRET, config, store));
  assert.equal(redirect.searchParams.get('iss'), config.issuer);
  const exchange = { grant_type: 'authorization_code', code: redirect.searchParams.get('code'), client_id: config.clientId, redirect_uri: config.redirects[0], resource: config.resource, code_verifier: 'v'.repeat(43) };
  await assert.rejects(exchangeCode(new URLSearchParams({ ...exchange, code_verifier: 'w'.repeat(43) }), config, store));
  const result = await exchangeCode(new URLSearchParams(exchange), config, store);
  assert.equal(verifyToken(result.access_token, config, 'access').scope, 'os:read');
  await assert.rejects(exchangeCode(new URLSearchParams(exchange), config, store));
  const legacy = bridgeConfig({ ...env, BRIDGE_ENABLED: 'true' });
  assert.throws(() => verifyToken(token({}, legacy), config, 'access'));
  assert.throws(() => verifyToken(result.access_token, legacy, 'access'));
  assert.ok([...store.values.keys()].every(k => k.startsWith('os-domain/oauth/')));
});
test('schema fails closed for future/corrupt/raw storage/Wiki/payload bound', () => {
  for (const input of [null, {}, { ...emptyDecisionFixture(), schemaVersion: 'decision-snapshot.v99' }, { ...emptyDecisionFixture(), wiki: 'PRIVATE_BODY' }, { ...emptyDecisionFixture(), rawLocalStorage: '{}' }, { ...emptyDecisionFixture(), junk: 'x'.repeat(1024 * 1024) }]) assert.throws(() => validateDecisionSnapshot(input));
});
test('current-only exact binding, unavailable semantics, no writes or unknown arguments', async () => {
  const { staging, binding } = await seed();
  const summary = await callDomainTool(staging, 'decision_summary', {});
  assert.equal(summary.portfolio.status, 'unavailable');
  assert.equal((await callDomainTool(staging, 'portfolio_exposure', binding)).projection, null);
  for (const [name, input] of [['decision_summary', { asOf: '2000-01-01T00:00:00Z' }], ['decision_summary', { sql: 'SELECT' }], ['get_claim', { ...binding, id: 'missing', revisionId: 'missing' }], ['list_theses', { ...binding, limit: 21 }], ['write_claim', {}], ['search_wiki', {}]]) await assert.rejects(callDomainTool(staging, name, input));
  assert.equal(Object.keys(domainToolSchemas).length, 8);
});
test('digest, generation, scope, consent, freshness, future timestamp and replay rejected', async () => {
  const { staging, snapshot, binding } = await seed();
  for (const override of [{ digest: 'a'.repeat(64) }, { generation: 9 }, { snapshotId: crypto.randomUUID() }, { asOf: '2000-01-01T00:00:00Z' }]) await assert.rejects(staging.read({ ...binding, ...override }));
  const payload = { snapshot, digest: snapshotDigest(snapshot), expectedGeneration: binding.generation, consent: 'publish-current-decision-state' };
  for (const override of [{ digest: 'a'.repeat(64) }, { expectedGeneration: 0 }, { consent: 'implicit' }]) await assert.rejects(staging.publish({ ...payload, ...override }));
  for (const at of [Date.now() - 16 * 60000, Date.now() + 60000]) { const s = emptyDecisionFixture(at); await assert.rejects(staging.publish({ ...payload, snapshot: s, digest: snapshotDigest(s) })); }
  await assert.rejects(new DecisionStaging(new DecisionTestStore(), config.subject).publish(payload));
  await assert.rejects(staging.publish(payload));
});
test('revocation rejects all tools and stale generation cannot republish; explicit new generation can', async () => {
  const { staging, binding } = await seed(); await staging.revoke(binding.generation);
  for (const name of Object.keys(domainToolSchemas)) await assert.rejects(callDomainTool(staging, name, name === 'decision_summary' ? {} : { ...binding, ...(name.startsWith('get_') ? { id: 'x', revisionId: 'x' } : {}) }));
  const snapshot = emptyDecisionFixture();
  await assert.rejects(staging.publish({ snapshot, digest: snapshotDigest(snapshot), expectedGeneration: binding.generation, consent: 'publish-current-decision-state' }));
  await staging.publish({ snapshot, digest: snapshotDigest(snapshot), expectedGeneration: binding.generation + 1, consent: 'publish-current-decision-state' });
  assert.equal((await staging.read()).binding.generation, 3);
});
test('expiry, immutable object mutation, pointer drift and in-flight revoke reject', async () => {
  let now = Date.now(); const f = await seed(() => now);
  now += SNAPSHOT_TTL_MS + 1; await assert.rejects(f.staging.read()); now -= SNAPSHOT_TTL_MS + 1;
  const key = `${f.staging.prefix}snapshots/${f.snapshot.snapshotId}.json`, saved = await f.store.get(key);
  f.store.values.set(key, { ...saved, scope: 'real' }); await assert.rejects(f.staging.read()); f.store.values.set(key, saved);
  const original = f.store.get.bind(f.store); let revoke = true;
  f.store.get = async k => { const result = await original(k); if (k === key && revoke) { revoke = false; await f.staging.revoke(f.binding.generation); } return result; };
  await assert.rejects(f.staging.read());
});
test('concurrent publish/revoke use CAS and private namespace isolation', async () => {
  const { staging, store, binding } = await seed();
  const result = await Promise.allSettled([staging.revoke(binding.generation), staging.revoke(binding.generation)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  await assert.rejects(new DecisionStaging(store, 'different-owner', undefined, 'synthetic').read());
  assert.ok([...store.values.keys()].every(k => k.startsWith('os-domain/')));
});
test('production PrivateBlobStore transport uses private immutable content and conditional pointer writes', async () => {
  const { store, objects } = privateStoreFixture(), staging = new DecisionStaging(store, config.subject, undefined, 'synthetic');
  const snapshot = emptyDecisionFixture();
  const published = await staging.publish({ snapshot, digest: snapshotDigest(snapshot), expectedGeneration: 0, consent: 'publish-current-decision-state' });
  assert.equal((await staging.read(published.binding)).snapshot.snapshotId, snapshot.snapshotId);
  const second = emptyDecisionFixture();
  const results = await Promise.allSettled([staging.publish({ snapshot: second, digest: snapshotDigest(second), expectedGeneration: 1, consent: 'publish-current-decision-state' }), staging.revoke(1)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const status = await staging.status(); if (status.status === 'published') await staging.revoke(status.generation);
  await assert.rejects(staging.read()); assert.ok([...objects.keys()].every(k => k.startsWith('os-domain/')));
});
test('local relay rejects non-loopback, foreign/null Origin and missing owner header', () => {
  const req = { headers: { host: '127.0.0.1:4173', origin: 'http://127.0.0.1:4173', 'sec-fetch-site': 'same-origin', 'x-bridge-owner-secret': 'synthetic' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(domainRelayAllowed(req), true);
  for (const delta of [{ host: 'attacker.example:4173' }, { origin: 'null' }, { origin: 'https://foreign.example' }, { 'sec-fetch-site': 'cross-site' }, { 'x-bridge-owner-secret': undefined }]) assert.equal(domainRelayAllowed({ ...req, headers: { ...req.headers, ...delta } }), false);
  assert.equal(domainRelayAllowed({ ...req, socket: { remoteAddress: '192.168.1.1' } }), false);
});
test('loopback relay forwards only fixed explicit owner actions to configured HTTPS origin', async t => {
  const prior = process.env.OS_DOMAIN_REMOTE_ORIGIN, originalFetch = globalThis.fetch, forwarded = [];
  process.env.OS_DOMAIN_REMOTE_ORIGIN = 'https://synthetic.example';
  globalThis.fetch = async (url, options) => { forwarded.push({ url, options }); return new Response(JSON.stringify({ status: 'revoked', generation: 2 }), { status: 200 }); };
  let middleware; osDomainSeam().configureServer({ middlewares: { use(_path, fn) { middleware = fn; } } });
  const server = createServer((req, res) => { req.url = req.url.replace('/api/os-domain', ''); void middleware(req, res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { globalThis.fetch = originalFetch; if (prior === undefined) delete process.env.OS_DOMAIN_REMOTE_ORIGIN; else process.env.OS_DOMAIN_REMOTE_ORIGIN = prior; server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, headers = { Origin: base, 'Content-Type': 'application/json', 'X-Bridge-Owner-Secret': 'synthetic-local-secret' };
  const response = await originalFetch(`${base}/api/os-domain/revoke`, { method: 'POST', headers, body: '{"expectedGeneration":1}' });
  assert.equal(response.status, 200); assert.equal(forwarded[0].url, 'https://synthetic.example/api/os-domain/revoke');
  assert.equal(forwarded[0].options.headers.Origin, 'https://synthetic.example'); assert.equal(forwarded[0].options.redirect, 'error');
  for (const action of ['/mcp', '/query', '/status?url=https://foreign.example']) assert.equal((await originalFetch(`${base}/api/os-domain${action}`, { headers })).status, 404);
  assert.equal(forwarded.length, 1);
});
test('pointer generation inconsistency, schema-valid content tamper and unknown nested keys reject', async () => {
  const f = await seed(), key = `${f.staging.prefix}current.json`, p = await f.store.get(key);
  f.store.values.set(key, { ...p, generation: p.generation + 1 }); await assert.rejects(f.staging.read()); f.store.values.set(key, p);
  f.store.values.set(`${f.staging.prefix}snapshots/${f.snapshot.snapshotId}.json`, { ...f.snapshot, portfolio: { ...f.snapshot.portfolio, blockers: ['CHANGED'] } }); await assert.rejects(f.staging.read());
  assert.throws(() => validateDecisionSnapshot({ ...f.snapshot, claims: { ...f.snapshot.claims, wiki: 'private' } }));
});
test('real HTTP official MCP SDK client and owner publish/revoke; anonymous/wrong scope/expiry rejected', async t => {
  const store = new DecisionTestStore(), server = createServer(createDomainHandler({ env, store, scope: 'synthetic' }));
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`, endpoint = new URL(`${base}/api/os-mcp`);
  const headers = { 'content-type': 'application/json', Origin: config.origin, 'X-Bridge-Owner-Secret': env.BRIDGE_OWNER_SECRET };
  const snapshot = emptyDecisionFixture(), publish = await fetch(`${base}/api/os-domain/publish`, { method: 'POST', headers, body: JSON.stringify({ snapshot, digest: snapshotDigest(snapshot), expectedGeneration: 0, consent: 'publish-current-decision-state' }) });
  assert.equal(publish.status, 200); const { binding } = await publish.json();
  for (const bearer of [null, token({ scope: 'research:read' }), token({ scope: 'os:write' }), token({ exp: 1 }), token({ aud: `${config.origin}/api/mcp` }), token({ iss: config.origin }), token({ client_id: 'wrong' })]) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: '{}' });
    assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const metadata = await fetch(`${base}/api/os-domain/resource-metadata`);
  assert.deepEqual((await metadata.json()).authorization_servers, [config.issuer]);
  const client = new Client({ name: 'synthetic-domain-client', version: '1' }); t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token()}` } } }));
  const listed = await client.listTools(); assert.equal(listed.tools.length, 8); assert.ok(listed.tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
  assert.equal((await client.callTool({ name: 'decision_summary', arguments: {} })).isError, undefined);
  assert.equal((await client.callTool({ name: 'portfolio_exposure', arguments: binding })).structuredContent.result.status, 'unavailable');
  const write = await fetch(`${base}/api/os-domain/revoke`, { method: 'POST', headers: { 'content-type': 'application/json', Origin: config.origin, Authorization: `Bearer ${token()}` }, body: JSON.stringify({ expectedGeneration: 1 }) }); assert.equal(write.status, 401);
  const revoked = await fetch(`${base}/api/os-domain/revoke`, { method: 'POST', headers, body: JSON.stringify({ expectedGeneration: 1 }) }); assert.equal(revoked.status, 200);
  assert.equal((await client.callTool({ name: 'decision_summary', arguments: {} })).isError, true);
  assert.equal((await client.callTool({ name: 'create_claim', arguments: {} })).isError, true);
});
test('safe errors never return private URLs, SDK errors or secret and disabled service fails closed', async t => {
  for (const options of [{ env: {} }, { env, store: { versioned() { throw Error('SDK https://private.private.blob.vercel-storage.com/secret TOKEN'); } } }]) {
    const server = createServer(createDomainHandler(options)); await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/os-domain/status`, { headers: { 'X-Bridge-Owner-Secret': env.BRIDGE_OWNER_SECRET } });
    assert.ok([400, 503].includes(response.status)); assert.doesNotMatch(await response.text(), /private.blob|TOKEN|SDK|synthetic-owner/);
  }
});
