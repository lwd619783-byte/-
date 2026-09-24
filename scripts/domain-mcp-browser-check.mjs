// Isolated profiles, synthetic formal-owner fixture + real HTTP handler + official SDK.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createVite } from 'vite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createDomainHandler } from '../server/os-domain/http.mjs';
import { domainConfig } from '../server/os-domain/config.mjs';
import { signToken } from '../server/research-bridge/auth.mjs';
import { DecisionTestStore, domainTestEnv as env } from './tests/os-domain.fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-5/browser'), harness = path.resolve('data-cache/stage-4-5/browser-harness');
await fs.mkdir(output, { recursive: true }); await fs.mkdir(harness, { recursive: true });
await fs.writeFile(path.join(harness, 'index.html'), '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><body><main id="root" style="padding:16px;max-width:960px;margin:auto"></main><script type="module" src="./main.tsx"></script></body></html>');
await fs.writeFile(path.join(harness, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';
import {DecisionSharePanel} from '/src/components/research/DecisionSharePanel';
import {createDecisionPublisher} from '/src/services/decisionPublish';import {decisionFixture} from '/src/services/decisionSnapshot.fixture';
import {claimTime as at} from '/src/services/verifiedClaim.fixture';
const f=await decisionFixture();window.domainTest={drift(){f.claim.graph.nodes[0].nodeId='changed';}};
const service=createDecisionPublisher(f.runtime,async()=>{if(new URLSearchParams(location.search).get('portfolio')==='1')return f.projection;throw Error('PORTFOLIO_NOT_CONNECTED');},undefined,()=>new Date(at(12)));
createRoot(document.getElementById('root')).render(<DecisionSharePanel dataset={{stocks:[],industries:[],macroIndicators:[]}} createPublisher={async()=>service}/>);
`);
const report = { scope: 'SYNTHETIC_ISOLATED_ONLY', checks: [], errors: [], screenshots: [] };
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const vite = await createVite({ cacheDir: 'data-cache/stage-4-5/vite-cache', optimizeDeps: { holdUntilCrawlEnd: false, entries: ['index.html', 'data-cache/stage-4-5/browser-harness/index.html'] }, server: { host: '127.0.0.1', port: 4195, strictPort: true }, logLevel: 'error' });
await vite.listen(); const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
const store = new DecisionTestStore(), config = domainConfig(env), server = createServer(createDomainHandler({ env, store, scope: 'synthetic', now: () => Date.parse('2026-09-12T00:00:00.000Z') }));
await new Promise(r => server.listen(0, '127.0.0.1', r)); const api = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  // First verify real app navigation and entry availability, with no private local data.
  const realContext = await browser.newContext(), real = await realContext.newPage(); real.on('pageerror', e => report.errors.push(e.message));
  await real.goto(origin + '/'); await real.locator('body').filter({ hasText: '研究' }).waitFor();
  check(await real.locator('vite-error-overlay').count() === 0, 'home no Vite overlay');
  await real.goto(origin + '/#/settings'); await real.getByRole('heading', { name: '共享当前正式投资状态给 ChatGPT' }).waitFor();
  check(await real.getByRole('button', { name: '生成并校验共享预览' }).isDisabled(), 'real empty profile has no implicit publish');
  await realContext.close();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message)); const calls = [];
    await page.route('**/api/os-domain/**', async route => {
      const req = route.request(), action = new URL(req.url()).pathname; calls.push(action);
      const response = await fetch(api + action, { method: req.method(), headers: { 'Content-Type': 'application/json', Origin: config.origin, 'X-Bridge-Owner-Secret': env.BRIDGE_OWNER_SECRET }, ...(req.method() === 'POST' ? { body: req.postData() } : {}) });
      await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    });
    await page.goto(origin + '/data-cache/stage-4-5/browser-harness/index.html');
    await page.getByLabel('共享访问密钥').fill(env.BRIDGE_OWNER_SECRET);
    await page.getByRole('button', { name: '生成并校验共享预览' }).click(); await page.getByText('组合：不可读取，不含组合数据').waitFor();
    check(!calls.some(c => c.endsWith('/publish')), `no upload before consent ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow ${width}`);
    await page.screenshot({ path: path.join(output, `preview-${width}.png`), fullPage: true }); report.screenshots.push(`preview-${width}.png`);
    await page.getByRole('button', { name: '确认共享上述正式状态' }).click(); await page.getByText(/已共享经校验/).waitFor();
    check(calls.filter(c => c.endsWith('/publish')).length === 1, `one explicit publish ${width}`);
    const access = signToken({ kind: 'access', iss: config.issuer, aud: config.resource, sub: config.subject, client_id: config.clientId, scope: config.scope, exp: Math.floor(Date.now() / 1000) + 3600 }, config);
    const client = new Client({ name: 'synthetic-browser-verifier', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(api + '/api/os-mcp'), { requestInit: { headers: { Authorization: `Bearer ${access}` } } }));
    const summary = (await client.callTool({ name: 'decision_summary', arguments: {} })).structuredContent.result;
    const binding = Object.fromEntries(['snapshotId', 'digest', 'generation', 'asOf'].map(k => [k, summary[k]]));
    const claims = (await client.callTool({ name: 'list_verified_claims', arguments: binding })).structuredContent.result;
    check(claims.rows[0].revisionId === 'synthetic-revision-1', `official client sees exact locally published Claim ${width}`);
    await page.getByRole('button', { name: '撤销当前共享' }).click(); await page.getByText(/已撤销共享/).waitFor();
    check((await client.callTool({ name: 'decision_summary', arguments: {} })).isError, `UI revoke rejects SDK read ${width}`);
    await client.close();
    await page.getByRole('button', { name: '生成并校验共享预览' }).click(); await page.getByRole('button', { name: '确认共享上述正式状态' }).waitFor();
    await page.evaluate(() => window.domainTest.drift()); await page.getByRole('button', { name: '确认共享上述正式状态' }).click(); await page.getByText(/操作未完成/).waitFor();
    check(calls.filter(c => c.endsWith('/publish')).length === 1, `changed owner never uploaded ${width}`);
    check(await page.evaluate(() => localStorage.length === 0), `credentials never persisted ${width}`);
    await page.goto(origin + '/data-cache/stage-4-5/browser-harness/index.html?portfolio=1');
    await page.getByLabel('共享访问密钥').fill(env.BRIDGE_OWNER_SECRET);
    await page.getByRole('button', { name: '生成并校验共享预览' }).click();
    await page.getByText('资产：合成资产 a', { exact: true }).waitFor();
    check(await page.getByText('账户：合成测试账户；账户状态：活跃', { exact: true }).count() === 2, `every account and status visible ${width}`);
    check(await page.getByText('数量：10', { exact: true }).count() === 2 && await page.getByText('市值：100 CNY', { exact: true }).isVisible() && await page.getByText('市值：200 CNY', { exact: true }).isVisible(), `every quantity/value/currency visible ${width}`);
    check(await page.getByText('快照日期：2026-09-11', { exact: true }).count() === 2, `position dates visible ${width}`);
    await page.getByText('Thesis 记录与风险、失效条件（1）', { exact: true }).click();
    await page.getByText('投资表达与未知项（1）', { exact: true }).click();
    check(await page.getByText('Synthetic demand reversal', { exact: true }).isVisible() && await page.getByText('Synthetic supporting condition ceases', { exact: true }).isVisible(), `actual Thesis risks/invalidation visible ${width}`);
    check(await page.getByText('未知项', { exact: true }).isVisible() && await page.getByText(/标的：synthetic-ETF/).isVisible(), `actual Expression instrument/unknowns visible ${width}`);
    check(await page.getByText(/访问最长有效24小时.*不代表.*物理删除/).isVisible(), `access TTL is not deletion SLA ${width}`);
    check(calls.filter(c => c.endsWith('/publish')).length === 1, `non-empty financial preview requires a new confirmation ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `expanded financial preview has no overflow ${width}`);
    await page.screenshot({ path: path.join(output, `portfolio-preview-${width}.png`), fullPage: true }); report.screenshots.push(`portfolio-preview-${width}.png`);
    await context.close();
  }
  check(report.errors.length === 0, 'zero page runtime errors'); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1; }
finally {
  await browser.close(); await vite.close(); await new Promise(r => server.close(r));
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (path.dirname(harness) !== path.resolve('data-cache/stage-4-5') || path.basename(harness) !== 'browser-harness') throw Error('CLEANUP_PATH');
  await fs.rm(harness, { recursive: true, force: true });
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure }));
