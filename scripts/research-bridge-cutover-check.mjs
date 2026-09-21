/** Credential values only enter through the process environment; report contains outcomes, never tokens. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const credentials = Object.fromEntries(['BRIDGE_OWNER_SECRET', 'BRIDGE_SIGNING_SECRET', 'BRIDGE_OLD_OWNER_SECRET', 'BRIDGE_OLD_ACCESS_TOKEN'].map(key => {
  const value = process.env[key]; delete process.env[key]; return [key, value];
}));
const [origin, deploymentId, runtimeSha, output] = process.argv.slice(2);
const report = { origin, deploymentId, runtimeSha, testedAt: new Date().toISOString(), inputType: 'security-negative-checks', checks: [], status: 'RUNNING' };
let step = 'configuration';
const request = (route, options = {}) => fetch(`${origin}${route}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(30000) });
const passed = name => report.checks.push(name);
try {
  assert.match(origin, /^https:\/\/[a-z0-9-]+\.vercel\.app$/);
  assert.match(deploymentId, /^dpl_[A-Za-z0-9]+$/); assert.match(runtimeSha, /^[a-f0-9]{40}$/);
  assert.ok(output && Object.values(credentials).every(value => typeof value === 'string' && value.length >= 32));
  step = 'new owner accepted, previous owner rejected';
  assert.equal((await request('/api/bridge/status', { headers: { 'X-Bridge-Owner-Secret': credentials.BRIDGE_OWNER_SECRET } })).status, 200);
  assert.equal((await request('/api/bridge/status', { headers: { 'X-Bridge-Owner-Secret': credentials.BRIDGE_OLD_OWNER_SECRET } })).status, 401);
  passed(step);
  step = 'discovery issuer and resource exact origin';
  const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
  const resource = await (await request('/.well-known/oauth-protected-resource/api/mcp')).json();
  assert.equal(metadata.issuer, origin); assert.equal(resource.resource, `${origin}/api/mcp`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']); assert.deepEqual(metadata.token_endpoint_auth_methods_supported, ['none']);
  passed(step);
  step = 'previous unexpired access token denied';
  const old = credentials.BRIDGE_OLD_ACCESS_TOKEN, [body, signature] = old.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url'));
  assert.equal(payload.kind, 'access'); assert.ok(payload.exp * 1000 > Date.now(), 'old token must remain unexpired during this check');
  assert.equal((await request('/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${old}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  report.oldTokenRemainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
  report.oldIssuer = payload.iss;
  passed(step);
  step = 'new signing key differs cryptographically from previous signature';
  // This HMAC comparison is independent of issuer/audience rejection at the new origin.
  assert.notEqual(createHmac('sha256', credentials.BRIDGE_SIGNING_SECRET).update(body).digest('base64url'), signature);
  passed(step);
  step = 'runtime accepts new signing key with correct issuer and scope';
  const signedBody = Buffer.from(JSON.stringify({ kind: 'access', iss: origin, aud: `${origin}/api/mcp`, sub: 'personal-owner', scope: 'research:read', exp: Math.floor(Date.now() / 1000) + 120 })).toString('base64url');
  const signed = `${signedBody}.${createHmac('sha256', credentials.BRIDGE_SIGNING_SECRET).update(signedBody).digest('base64url')}`;
  const response = await request('/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${signed}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).result.tools.length, 8);
  passed(step);
  step = 'anonymous MCP denied';
  assert.equal((await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  passed(step);
  report.status = 'PASS';
} catch { report.status = 'FAIL'; report.failedStep = step; process.exitCode = 1; }
finally {
  for (const key of Object.keys(credentials)) credentials[key] = undefined;
  if (output) { await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failedStep: report.failedStep }));
}
