import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ResearchStaging, callReadTool, STAGING_TTL_MS } from '../../server/research-bridge/domain.mjs';
import { bridgeConfig, signToken, verifyToken, newConsent, issueCode, exchangeCode } from '../../server/research-bridge/auth.mjs';
import { createBridgeHandler } from '../../server/research-bridge/http.mjs';

class Store {
  values = new Map();
  async get(k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; }
  async putNew(k, v) { if (this.values.has(k)) throw new Error('EXISTS'); this.values.set(k, structuredClone(v)); }
  async keys(prefix) { return [...this.values.keys()].filter(k => k.startsWith(prefix)); }
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
