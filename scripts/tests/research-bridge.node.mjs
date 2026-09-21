import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ResearchStaging, callReadTool, STAGING_TTL_MS } from '../../server/research-bridge/domain.mjs';
import { bridgeConfig, signToken, verifyToken, newConsent, issueCode, exchangeCode, authorizeParameters } from '../../server/research-bridge/auth.mjs';
import { createBridgeHandler } from '../../server/research-bridge/http.mjs';
import { Readable } from 'node:stream';
import { privateStoreFixture } from './private-blob.fixture.mjs';

class Store {
  values = new Map();
  async get(k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; }
  async putNew(k, v) { if (this.values.has(k)) throw new Error('EXISTS'); this.values.set(k, structuredClone(v)); }
  async keys(prefix) { return [...this.values.keys()].filter(k => k.startsWith(prefix)); }
  async versioned(k) { const value = await this.get(k); return value ? { value, etag: JSON.stringify(value) } : null; }
  async compareExchange(k, etag, v) { if ((this.values.has(k) ? JSON.stringify(this.values.get(k)) : null) !== etag) return false; this.values.set(k, structuredClone(v)); return true; }
}
const sha = value => createHash('sha256').update(value).digest('hex');
const env = { BRIDGE_ENABLED: 'true', BRIDGE_ORIGIN: 'https://synthetic.example', BRIDGE_OWNER_SECRET: 'synthetic-owner-secret-only-for-tests-32', BRIDGE_SIGNING_SECRET: 'synthetic-signing-secret-only-for-tests-32', BLOB_STORE_ID: 'synthetic', BRIDGE_OAUTH_REDIRECT_URIS: 'https://chatgpt.com/connector_platform_oauth_redirect' };
const config = bridgeConfig(env);
const args = { client_id: config.clientId, redirect_uri: config.redirects[0], response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update('v'.repeat(43)).digest('base64url'), state: 'synthetic-state', resource: config.resource, scope: 'research:read' };
async function seed(store = new Store(), subject = 'personal-owner', clock) {
  const staging = new ResearchStaging(store, subject, clock), segments = [{ locator: 'page:1', label: '第 1 页', text: 'Synthetic optical research evidence.' }, { locator: 'page:2', label: '第 2 页', text: 'Second page; unknown publication.' }];
  const metadata = { sourceId: 'source-one', batchId: 'batch-one', filename: 'synthetic.pdf', mime: 'application/pdf', size: 100, sha256: sha('exact-source-placeholder'), capturedAt: '2026-01-01T00:00:00Z', kind: 'pdf', parsedTextSha256: sha(JSON.stringify(segments)) };
  const stage = await staging.begin({ batchId: 'batch-one', title: 'Synthetic test batch', sourceMetadata: [metadata], knowledgeIds: ['wiki-one'], consent: 'stage-selected-batch-and-knowledge' });
  await staging.putSource(stage.stageId, { metadata, segments });
  const r = { revisionId: 'revision-old', title: 'Synthetic article', summary: 'Synthetic', bodyMarkdown: 'Old full readable article', createdAt: '2026-01-01T00:00:00Z', asOf: '2026-01-01T00:00:00Z', sourceRefs: [], reviewId: 'review-old' };
  await staging.putKnowledge(stage.stageId, { wikiId: 'wiki-one', currentRevisionId: 'revision-new', revisions: [r, { ...r, revisionId: 'revision-new', bodyMarkdown: 'New full readable article', reviewId: 'review-new' }] });
  return { store, staging, stage, metadata, segments };
}
test('all eight tools honor publish, page window, digest, selected knowledge and complete history', async () => {
  const { staging, stage } = await seed(); assert.deepEqual(await staging.list(), []);
  await assert.rejects(callReadTool(staging, 'get_batch_manifest', { stageId: stage.stageId }));
  await staging.publish(stage.stageId);
  assert.equal((await callReadTool(staging, 'list_pending_batches', {})).batches.length, 1);
  const base = { stageId: stage.stageId }, source = { ...base, sourceId: 'source-one' };
  assert.equal((await callReadTool(staging, 'get_batch_manifest', base)).originalsCopied, false);
  assert.equal((await callReadTool(staging, 'get_source_metadata', source)).sha256.length, 64);
  const pages = await callReadTool(staging, 'read_source_pages', { ...source, start: 2, count: 1 }); assert.equal(pages.segments[0].locator, 'page:2'); assert.match(pages.segments[0].text, /Second/);
  assert.equal((await callReadTool(staging, 'search_source', { ...source, query: 'optical' })).hits[0].locator, 'page:1');
  assert.equal((await callReadTool(staging, 'search_knowledge', { ...base, query: 'readable' })).matches.length, 1);
  assert.equal((await callReadTool(staging, 'get_knowledge_document', { ...base, wikiId: 'wiki-one' })).bodyMarkdown, 'New full readable article');
  assert.equal((await callReadTool(staging, 'get_knowledge_document', { ...base, wikiId: 'wiki-one', revisionId: 'revision-old' })).bodyMarkdown, 'Old full readable article');
  assert.equal((await callReadTool(staging, 'get_knowledge_history', { ...base, wikiId: 'wiki-one' })).revisions.length, 2);
});
test('revoke, expiry, tenant isolation, unstaged refs, writes, path traversal and unknown params all fail closed', async () => {
  let now = Date.now(); const { staging, stage, store } = await seed(new Store(), 'personal-owner', () => now); await staging.publish(stage.stageId);
  for (const [name, args] of [['get_source_metadata', { stageId: stage.stageId, sourceId: 'not-staged' }], ['get_source_metadata', { stageId: '../manifest', sourceId: 'source-one' }], ['get_knowledge_document', { stageId: stage.stageId, wikiId: 'not-staged' }], ['submit_contribution_bundle', {}], ['read_source_pages', { stageId: stage.stageId, sourceId: 'source-one', count: 6 }], ['list_pending_batches', { sql: 'SELECT' }]]) await assert.rejects(callReadTool(staging, name, args));
  await assert.rejects(new ResearchStaging(store, 'another-user').manifest(stage.stageId));
  now += STAGING_TTL_MS + 1; assert.deepEqual(await staging.list(), []); await assert.rejects(staging.source(stage.stageId, 'source-one'));
  now -= STAGING_TTL_MS + 1; await staging.revoke(stage.stageId); await assert.rejects(staging.source(stage.stageId, 'source-one')); await assert.rejects(staging.knowledge(stage.stageId, 'wiki-one')); assert.deepEqual(await staging.list(), []);
});
test('partial upload cannot publish and bad text digest is rejected', async () => {
  const { staging, metadata, segments } = await seed(); const stage = await staging.begin({ batchId: 'batch-one', title: 'Partial', sourceMetadata: [metadata], knowledgeIds: [], consent: 'stage-selected-batch-and-knowledge' });
  await assert.rejects(staging.publish(stage.stageId)); await assert.rejects(staging.putSource(stage.stageId, { metadata, segments: [{ ...segments[0], text: 'tampered' }] }));
});
test('OAuth requires owner, consent cookie, exact redirect/resource, S256 and single-use code', async () => {
  const store = new Store(), consent = newConsent(args, config);
  await assert.rejects(issueCode(consent.ticket, 'wrong', env.BRIDGE_OWNER_SECRET, config, store));
  await assert.rejects(issueCode(consent.ticket, consent.nonce, 'wrong', config, store));
  const redirect = new URL(await issueCode(consent.ticket, consent.nonce, env.BRIDGE_OWNER_SECRET, config, store)); assert.equal(redirect.searchParams.get('iss'), config.origin);
  await assert.rejects(issueCode(consent.ticket, consent.nonce, env.BRIDGE_OWNER_SECRET, config, store));
  const tokenArgs = new URLSearchParams({ grant_type: 'authorization_code', code: redirect.searchParams.get('code'), client_id: config.clientId, redirect_uri: config.redirects[0], resource: config.resource, code_verifier: 'v'.repeat(43) });
  const wrong = new URLSearchParams(tokenArgs); wrong.set('code_verifier', 'w'.repeat(43)); await assert.rejects(exchangeCode(wrong, config, store));
  const token = await exchangeCode(tokenArgs, config, store); assert.equal(verifyToken(token.access_token, config, 'access').scope, 'research:read'); await assert.rejects(exchangeCode(tokenArgs, config, store));
  assert.throws(() => verifyToken(token.access_token + 'x', config, 'access')); assert.throws(() => verifyToken(token.access_token, { ...config, resource: 'https://other.example/mcp' }, 'access')); assert.throws(() => verifyToken(token.access_token, config, 'access', Date.now() + 3601000));
});
test('callback-ID allowlist is exact and preserves public-client S256 resource and scope checks', () => {
  const callback = 'https://chatgpt.com/connector/oauth/synthetic-exact-id', cfg = bridgeConfig({ ...env, BRIDGE_OAUTH_REDIRECT_URIS: callback });
  const params = new URLSearchParams({ ...args, redirect_uri: callback });
  assert.equal(authorizeParameters(params, cfg).redirect_uri, callback);
  for (const [key, value] of [['redirect_uri', `${callback}-other`], ['redirect_uri', config.redirects[0]], ['resource', 'https://other.example/api/mcp'], ['scope', 'research:write'], ['code_challenge_method', 'plain'], ['client_id', 'foreign']]) {
    const wrong = new URLSearchParams(params); wrong.set(key, value); assert.throws(() => authorizeParameters(wrong, cfg));
  }
  assert.throws(() => bridgeConfig({ ...env, BRIDGE_OAUTH_REDIRECT_URIS: 'https://chatgpt.com/connector/oauth/*' }));
});
test('real HTTP + official MCP client initialization/list/call, authentication and immediate revoke', async t => {
  const { store, staging, stage } = await seed(); await staging.publish(stage.stageId);
  const server = createServer(createBridgeHandler({ env, store })); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`, endpoint = new URL(`${origin}/api/mcp`);
  const anonymous = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(anonymous.status, 401); assert.match(anonymous.headers.get('www-authenticate'), /resource_metadata/);
  const metadata = await fetch(`${origin}/.well-known/oauth-protected-resource/api/mcp`); assert.equal((await metadata.json()).resource, config.resource);
  const token = signToken({ kind: 'access', iss: config.origin, aud: config.resource, sub: config.subject, scope: 'research:read', exp: Math.floor(Date.now() / 1000) + 3600 }, config);
  const client = new Client({ name: 'synthetic-contract-client', version: '1' }); t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const listed = await client.listTools(); assert.equal(listed.tools.length, 8); assert.ok(listed.tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
  const result = await client.callTool({ name: 'read_source_pages', arguments: { stageId: stage.stageId, sourceId: 'source-one', start: 1, count: 1 } }); assert.equal(result.isError, undefined); assert.match(result.content[0].text, /page:1/);
  await staging.revoke(stage.stageId); const revoked = await client.callTool({ name: 'read_source_pages', arguments: { stageId: stage.stageId, sourceId: 'source-one' } }); assert.equal(revoked.isError, true);
  const forbidden = await client.callTool({ name: 'submit_contribution_bundle', arguments: {} }); assert.equal(forbidden.isError, true);
});
test('missing remote configuration returns 503, never anonymous fallback or data', async t => {
  const server = createServer(createBridgeHandler({ env: {}, store: new Store() })); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/mcp`); assert.equal(response.status, 503); assert.equal((await response.json()).error, 'BRIDGE_NOT_CONFIGURED');
});

async function request(store, action, chunks, parsedBody) {
  const req = Readable.from(chunks ?? []); req.method = 'POST'; req.url = `/api/bridge/${action}`;
  req.headers = { 'content-type': 'application/json', 'x-bridge-owner-secret': env.BRIDGE_OWNER_SECRET }; req.body = parsedBody;
  let status, result;
  const res = { setHeader() {}, writeHead(code) { status = code; }, end(value) { result = JSON.parse(value); } };
  await createBridgeHandler({ env, store })(req, res); return { status, result };
}

test('actual revoke-batch HTTP path bypasses 501+ objects, blocks legacy/repeated stages and knowledge, preserves other batches', async () => {
  const { store, objects } = privateStoreFixture(); const { staging, stage, metadata, segments } = await seed(store);
  await staging.publish(stage.stageId);
  // Simulate pre-upgrade data without the additive generation field.
  const key = staging.path(stage.stageId, 'manifest'), legacy = objects.get(key);
  const old = JSON.parse(legacy.body); delete old.accessGeneration; legacy.body = JSON.stringify(old);
  const repeat = await seed(store); await staging.publish(repeat.stage.stageId);
  const otherMetadata = { ...metadata, batchId: 'other-batch' };
  const other = await staging.begin({ batchId: 'other-batch', title: 'Other', sourceMetadata: [otherMetadata], knowledgeIds: [], consent: 'stage-selected-batch-and-knowledge' });
  await staging.putSource(other.stageId, { metadata: otherMetadata, segments }); await staging.publish(other.stageId);
  for (let i = 0; i < 510; i++) {
    const stageId = `expired-${i}`;
    await store.putNew(staging.path(stageId, 'manifest'), { ...old, stageId, expiresAt: '2000-01-01T00:00:00Z' });
    if (i % 2) await store.putNew(staging.path(stageId, 'revoked'), { at: '2000-01-01T00:00:00Z' });
  }
  await assert.rejects(staging.list(), /STAGING_LIST_LIMIT/);
  assert.ok(await staging.source(stage.stageId, metadata.sourceId)); assert.ok(await staging.knowledge(stage.stageId, 'wiki-one'));
  const result = await request(store, 'revoke-batch', [Buffer.from(JSON.stringify({ batchId: 'batch-one' }))]);
  assert.equal(result.status, 200); assert.equal(result.result.status, 'revoked');
  for (const stageId of [stage.stageId, repeat.stage.stageId]) {
    assert.equal((await staging.status(stageId)).status, 'revoked');
    for (const name of ['get_batch_manifest', 'get_source_metadata', 'read_source_pages', 'search_source', 'search_knowledge', 'get_knowledge_document', 'get_knowledge_history']) {
      const args = name === 'get_batch_manifest' ? { stageId } : ['search_knowledge'].includes(name) ? { stageId, query: 'article' } : name.includes('knowledge') ? { stageId, wikiId: 'wiki-one' } : { stageId, sourceId: metadata.sourceId, ...(name === 'search_source' ? { query: 'optical' } : {}) };
      await assert.rejects(callReadTool(staging, name, args), /STAGING_NOT_AVAILABLE/);
    }
  }
  assert.ok(await staging.source(other.stageId, metadata.sourceId));
  const resent = await seed(store); await staging.publish(resent.stage.stageId);
  assert.ok(await staging.source(resent.stage.stageId, metadata.sourceId));
  await assert.rejects(staging.source(stage.stageId, metadata.sourceId));
  assert.equal((await request(store, 'revoke-batch', [], { batchId: 'batch-one' })).status, 200);
  await assert.rejects(staging.knowledge(resent.stage.stageId, 'wiki-one'));
});

test('batch revoke CAS serializes competing revokes, covers in-flight sends and fails closed on storage errors', async () => {
  const { store } = privateStoreFixture(); const { staging, stage, metadata } = await seed(store);
  await staging.publish(stage.stageId);
  const put = store.putNew.bind(store); let entered, release;
  const reached = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  let delayed = true;
  store.putNew = async (key, value) => { if (delayed && key.endsWith('/manifest.json')) { delayed = false; entered(); await blocked; } return put(key, value); };
  const sending = staging.begin({ batchId: 'batch-one', title: 'Concurrent', sourceMetadata: [metadata], knowledgeIds: [], consent: 'stage-selected-batch-and-knowledge' });
  const rejected = assert.rejects(sending, /STAGING_NOT_AVAILABLE/);
  await reached;
  const revokes = await Promise.all([staging.revokeBatch('batch-one'), staging.revokeBatch('batch-one')]);
  assert.notEqual(revokes[0].generation, revokes[1].generation);
  const pointer = (await staging.batchAccess('batch-one')).value;
  assert.ok(revokes.some(r => r.generation === pointer.previousGeneration));
  release(); await rejected;
  await assert.rejects(staging.publish(stage.stageId));
  // New explicit send after the revoke uses the new generation; old content stays denied.
  const fresh = await seed(store); await staging.publish(fresh.stage.stageId);
  await assert.rejects(staging.knowledge(stage.stageId, 'wiki-one'));
  const exchange = store.compareExchange.bind(store); store.compareExchange = async () => { throw new Error('QUOTA'); };
  assert.equal((await request(store, 'revoke-batch', [], { batchId: 'batch-one' })).status, 400);
  assert.ok(await staging.source(fresh.stage.stageId, metadata.sourceId)); // no false success
  store.compareExchange = async () => false;
  await assert.rejects(staging.revokeBatch('batch-one'), /STAGING_REVOKE_CONFLICT/);
  store.compareExchange = exchange;
  await staging.revokeBatch('batch-one'); await assert.rejects(staging.source(fresh.stage.stageId, metadata.sourceId));
});

test('raw HTTP UTF-8 decodes once at every byte boundary, preserves JSON, source digest and parsed-body paths', async () => {
  const segments = [{ locator: 'line:1', label: '第一行', text: '光通信研究😀📚 中文与 emoji' }];
  const metadata = { sourceId: 'unicode-source', batchId: 'unicode-batch', filename: '中文😀.txt', mime: 'text/plain', size: 41, sha256: sha('原始字节😀'), capturedAt: '2026-01-01T00:00:00Z', kind: 'text', parsedTextSha256: sha(JSON.stringify(segments)) };
  const input = { batchId: metadata.batchId, title: '中文😀', sourceMetadata: [metadata], knowledgeIds: [], consent: 'stage-selected-batch-and-knowledge' };
  const store = new Store(), staging = new ResearchStaging(store, config.subject);
  const encoded = Buffer.from(JSON.stringify({ stageId: `stage-${'0'.repeat(36)}`, source: { metadata, segments } }));
  // Every byte boundary of the actual source JSON, including all multibyte characters.
  for (let split = 1; split < encoded.length; split++) {
    const stage = await staging.begin(input), bytes = Buffer.from(JSON.stringify({ stageId: stage.stageId, source: { metadata, segments } }));
    const boundary = Math.min(split, bytes.length - 1);
    const response = await request(store, 'source', [bytes.subarray(0, boundary), bytes.subarray(boundary)]);
    assert.equal(response.status, 200, `split ${boundary}`); await staging.publish(stage.stageId);
    const actual = await staging.source(stage.stageId, metadata.sourceId);
    assert.deepEqual(actual.segments, segments); assert.equal(actual.metadata.sha256, metadata.sha256); assert.equal(sha(JSON.stringify(actual.segments)), metadata.parsedTextSha256);
  }
  for (const body of [input, JSON.stringify(input)]) assert.equal((await request(store, 'begin', [], body)).status, 200);
  const stage = await staging.begin(input), json = Buffer.from(JSON.stringify({ stageId: stage.stageId, source: { metadata, segments } }));
  assert.equal((await request(store, 'source', [...json].map(byte => Buffer.from([byte])))).status, 200);
});

test('raw and parsed HTTP bodies enforce the actual 3 MiB bound before unbounded consumption', async () => {
  const store = new Store(); let consumed = 0;
  async function* chunks() { for (let i = 0; i < 100; i++) { consumed++; yield Buffer.alloc(1024 * 1024, 32); } }
  assert.equal((await request(store, 'begin', chunks())).status, 400); assert.ok(consumed <= 5, 'stream stopped at limit plus at most one prefetched chunk');
  assert.equal((await request(store, 'begin', [], '中'.repeat(1024 * 1024 + 1))).status, 400);
  assert.equal((await request(store, 'begin', [], { title: '😀'.repeat(800000) })).status, 400);
  assert.equal(store.values.size, 0);
});
