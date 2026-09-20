/** Real private staging + OAuth + official remote MCP client. Only synthetic data; never logs secrets/content. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const origin = new URL(process.argv[2]).origin;
assert.match(origin, /^https:\/\/[a-z0-9-]+\.vercel\.app$/);
const owner = process.env.BRIDGE_OWNER_SECRET;
delete process.env.BRIDGE_OWNER_SECRET;
assert.ok(owner?.length >= 32, 'Use the secure PowerShell wrapper to enter the owner key.');
const sha = value => createHash('sha256').update(value).digest('hex');
const report = { origin, at: new Date().toISOString(), checks: [], status: 'RUNNING' };
let step = 'configuration', stageId, batchId, client;
const passed = name => { report.checks.push(name); console.log(`PASS ${name}`); };
async function request(path, options = {}) {
  return fetch(`${origin}${path}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(60000) });
}
async function ownerCall(action, value) {
  const response = await request(`/api/bridge/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bridge-Owner-Secret': owner }, body: JSON.stringify(value) });
  assert.equal(response.status, 200); return response.json();
}
async function call(name, args = {}) {
  step = name;
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError); return JSON.parse(result.content[0].text);
}
try {
  step = 'anonymous access denied';
  const anonymous = await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(anonymous.status, 401); assert.match(anonymous.headers.get('www-authenticate'), /resource_metadata/); passed(step);
  step = 'OAuth discovery';
  const resource = await (await request('/.well-known/oauth-protected-resource/api/mcp')).json();
  assert.equal(resource.resource, `${origin}/api/mcp`);
  const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
  assert.equal(metadata.issuer, origin); passed(step);
  step = 'OAuth owner consent and PKCE';
  const verifier = randomBytes(32).toString('base64url'), state = randomBytes(16).toString('hex');
  const callback = 'https://chatgpt.com/connector_platform_oauth_redirect';
  const params = new URLSearchParams({ client_id: 'research-os-chatgpt', redirect_uri: callback, response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), state, resource: resource.resource, scope: 'research:read' });
  const consent = await request(`/api/bridge/authorize?${params}`);
  assert.equal(consent.status, 200);
  const cookie = consent.headers.get('set-cookie')?.split(';')[0], html = await consent.text();
  const ticket = /name="ticket" value="([^"]+)"/.exec(html)?.[1]; assert.ok(ticket && cookie);
  const authorized = await request('/api/bridge/authorize', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, Cookie: cookie }, body: new URLSearchParams({ ticket, ownerSecret: owner }).toString() });
  assert.equal(authorized.status, 303);
  const redirect = new URL(authorized.headers.get('location')); assert.equal(redirect.searchParams.get('state'), state); assert.equal(redirect.searchParams.get('iss'), origin);
  const tokenBody = new URLSearchParams({ client_id: 'research-os-chatgpt', redirect_uri: callback, grant_type: 'authorization_code', code: redirect.searchParams.get('code'), code_verifier: verifier, resource: resource.resource });
  const tokenResponse = await request('/api/bridge/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody.toString() });
  assert.equal(tokenResponse.status, 200); const token = await tokenResponse.json(); assert.ok(token.access_token); passed(step);
  step = 'OAuth code replay denied';
  assert.equal((await request('/api/bridge/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody.toString() })).status, 400); passed(step);
  step = 'ten-source private staging';
  const suffix = randomBytes(6).toString('hex'); batchId = `remote-test-${suffix}`;
  // PDF segments are an explicitly synthetic parsed projection; actual PDF byte parsing is covered by browser acceptance.
  const sources = Array.from({ length: 10 }, (_, i) => {
    const kind = i === 0 ? 'pdf' : i % 2 ? 'markdown' : 'text';
    const segments = [1, 2].map(n => ({ locator: `${kind === 'pdf' ? 'page' : 'line'}:${n}`, label: `合成验收 ${n}`, text: `Synthetic evidence ${i} optical page ${n}.` }));
    const raw = Buffer.from(segments.map(s => s.text).join('\n'));
    return { metadata: { sourceId: `remote-source-${suffix}-${i}`, batchId, filename: `synthetic-${i}.${kind === 'pdf' ? 'pdf' : kind === 'markdown' ? 'md' : 'txt'}`, mime: kind === 'pdf' ? 'application/pdf' : 'text/plain', size: raw.length, sha256: sha(raw), capturedAt: new Date().toISOString(), kind, parsedTextSha256: sha(JSON.stringify(segments)) }, segments };
  });
  const wikiId = `remote-wiki-${suffix}`;
  ({ stageId } = await ownerCall('begin', { batchId, title: '可重复远程验收（合成资料）', sourceMetadata: sources.map(s => s.metadata), knowledgeIds: [wikiId], consent: 'stage-selected-batch-and-knowledge' }));
  client = new Client({ name: 'research-os-remote-acceptance', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(resource.resource), { requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } } }));
  assert.ok(!(await call('list_pending_batches')).batches.some(b => b.stageId === stageId)); passed('unpublished batch hidden');
  for (const source of sources) await ownerCall('source', { stageId, source });
  const previous = { revisionId: 'remote-history-1', title: 'Synthetic optical article', summary: 'Synthetic', bodyMarkdown: 'Previous complete optical article.', createdAt: '2026-01-01T00:00:00Z', asOf: '2026-01-01T00:00:00Z', sourceRefs: [], reviewId: 'remote-review-1' };
  await ownerCall('knowledge', { stageId, document: { wikiId, currentRevisionId: 'remote-history-2', revisions: [previous, { ...previous, revisionId: 'remote-history-2', bodyMarkdown: 'Current complete optical article.', reviewId: 'remote-review-2' }] } });
  await ownerCall('publish', { stageId }); passed('ten-source private staging');
  step = 'only eight read-only tools';
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(t => t.name).sort(), ['list_pending_batches', 'get_batch_manifest', 'get_source_metadata', 'read_source_pages', 'search_source', 'search_knowledge', 'get_knowledge_document', 'get_knowledge_history'].sort());
  assert.ok(tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint)); passed(step);
  assert.ok((await call('list_pending_batches')).batches.some(b => b.stageId === stageId)); passed('published batch listed');
  const manifest = await call('get_batch_manifest', { stageId }); assert.equal(manifest.originalsCopied, false); passed('manifest and transport contract');
  const sourceArgs = { stageId, sourceId: sources[0].metadata.sourceId };
  assert.equal((await call('get_source_metadata', sourceArgs)).sha256, sources[0].metadata.sha256); passed('source digest retained');
  const pages = await call('read_source_pages', { ...sourceArgs, start: 2, count: 1 }); assert.equal(pages.segments[0].locator, 'page:2'); assert.equal(pages.segments[0].text, sources[0].segments[1].text); passed('selected PDF page and locator');
  assert.ok((await call('search_source', { ...sourceArgs, query: 'optical' })).hits.length); passed('source text search');
  assert.ok((await call('search_knowledge', { stageId, query: 'optical' })).matches.length); passed('selected knowledge search');
  assert.equal((await call('get_knowledge_document', { stageId, wikiId })).bodyMarkdown, 'Current complete optical article.'); passed('complete knowledge document');
  assert.equal((await call('get_knowledge_history', { stageId, wikiId })).revisions.length, 2);
  assert.equal((await call('get_knowledge_document', { stageId, wikiId, revisionId: previous.revisionId })).bodyMarkdown, previous.bodyMarkdown); passed('complete historical revision');
  step = 'unstaged source and write denied';
  assert.equal((await client.callTool({ name: 'get_source_metadata', arguments: { stageId, sourceId: 'local-only-not-staged' } })).isError, true);
  assert.equal((await client.callTool({ name: 'submit_contribution_bundle', arguments: {} })).isError, true); passed(step);
  step = 'batch revoke immediately denies source and knowledge';
  await ownerCall('revoke-batch', { batchId });
  assert.equal((await client.callTool({ name: 'read_source_pages', arguments: sourceArgs })).isError, true);
  assert.equal((await client.callTool({ name: 'get_knowledge_document', arguments: { stageId, wikiId } })).isError, true);
  assert.ok(!(await call('list_pending_batches')).batches.some(b => b.stageId === stageId)); passed('batch revoke immediately denies source and knowledge');
  report.status = 'PASS';
} catch {
  report.status = 'FAIL'; report.failedStep = step; process.exitCode = 1;
  console.error(`FAIL ${step} (request details intentionally omitted)`);
} finally {
  if (stageId) { try { await ownerCall('revoke', { stageId }); report.syntheticStageRevoked = true; } catch { report.syntheticStageRevoked = false; } }
  try { await client?.close(); } catch { /* no credentials in errors */ }
  await mkdir('data-cache/stage-4-3-slice-2-5', { recursive: true });
  await writeFile('data-cache/stage-4-3-slice-2-5/remote-acceptance.json', JSON.stringify(report, null, 2));
  console.log(`Remote acceptance: ${report.status}; ${report.checks.length} checks; safe report saved.`);
}
