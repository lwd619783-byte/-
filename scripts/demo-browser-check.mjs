import { navigateDemo } from './demo-shell-navigation.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exerciseDemoResearchLinks } from './demo-navigation-scenarios.mjs';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.DEMO_BROWSER_OUTPUT || 'data-cache/synthetic-demo-browser');
await mkdir(output, { recursive: true });
const inventory = JSON.parse(await readFile('dist-demo/demo-asset-inventory.json', 'utf8'));
const allowed = new Map(inventory.assets.map(asset => ['/' + asset.file, asset]));
const hits = [];
// Serve the audited build only. No source tree, user files, SQLite or API handlers.
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  hits.push(pathname);
  const file = pathname === '/' ? '/index.html' : pathname;
  if (!allowed.has(file)) { response.writeHead(404).end(); return; }
  const bytes = await readFile(path.join('dist-demo', file.slice(1)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), allowed.get(file).sha256);
  response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/json');
  response.end(bytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { testedSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, worktreeBefore: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean), navigationCases: [], popups: [], scope: 'synthetic-only-built-artifacts', checks: [], pageErrors: [], unexpectedRequests: [], consoleErrors: [], screenshots: [], assets: inventory.assets };
const check = (ok, name) => { report.checks.push({ name, ok }); assert(ok, name); };
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.DEMO_BROWSER_EXECUTABLE ? { executablePath: process.env.DEMO_BROWSER_EXECUTABLE } : {}) });
  report.browser = browser.version();
  for (const width of [320, 390, 1536]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce', acceptDownloads: true });
    await context.addInitScript(() => {
      localStorage.setItem('investment-research-dashboard.thesis.v1', 'SYNTHETIC_USER_STORAGE_SENTINEL');
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || !(url.pathname === '/' || allowed.has(url.pathname))) {
        report.unexpectedRequests.push({ width, path: url.origin === origin ? url.pathname : 'external' });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    context.on('page', popup => { report.popups.push({ width }); void popup.waitForLoadState().catch(() => {}).finally(() => popup.close()); });
    let probingCsp = false;
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !probingCsp) report.consoleErrors.push(message.text()); });
    const overflow = async name => {
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        panels: [...document.querySelectorAll('.decision-workspace,[role="dialog"]')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })) }));
      check(dimensions.document <= dimensions.viewport + 1 && dimensions.panels.every(p => p.scroll <= p.client + 1), `${name}: no horizontal overflow at ${width}`);
    };
    const screenshot = async name => {
      if (process.env.DEMO_BROWSER_SCREENSHOTS === '0') return;
      if (process.env.DEMO_BROWSER_COMPACT === '1' && !name.endsWith('-initial') && !(width === 320 && name.endsWith('-policy'))) return;
      const file = `${width}-${name}.png`;
      await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file);
    };
    const choose = async kind => { await navigateDemo(page, `${kind} 演练`, '历史复盘'); await page.getByText('演示范围与数据保存说明', { exact: true }).click(); };
    const exported = async kind => {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: `导出 ${kind} JSON 备份`, exact: true }).click();
      const download = await pending;
      return JSON.parse(await readFile(await download.path(), 'utf8'));
    };
    for (const kind of ['Thesis', 'Expression']) {
      await page.goto(origin); await choose(kind);
      check(await page.getByRole('region', { name: '演示服务边界' }).getByRole('button', { disabled: true }).count() === 4, `${kind}: all service actions disabled at ${width}`);
      await overflow(`${kind} initial`); await screenshot(`${kind}-initial`);
      if (kind === 'Expression') {
        await page.getByRole('button', { name: 'Expression → Thesis → Claim → Evidence', exact: true }).first().click();
        await overflow('Expression trace'); await screenshot('Expression-trace');
        await page.getByRole('button', { name: '查看 Expression 原始 Evidence', exact: true }).click();
        check(await page.getByRole('dialog', { name: '证据核对', exact: true }).count() === 1, `original synthetic evidence opens at ${width}`);
        await overflow('Evidence drawer');
        await page.getByRole('dialog', { name: '证据核对', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
      }
      await page.getByRole('button', { name: kind === 'Thesis' ? '修订为新草稿' : '修订 Expression 为新草稿', exact: true }).click();
      await page.getByLabel(`${kind} 修订说明`, { exact: true }).fill(`Synthetic browser roundtrip ${width}`);
      if (kind === 'Thesis') await page.getByLabel('论点陈述', { exact: true }).fill('SyntheticOnly'.repeat(20));
      await overflow(`${kind} editor`); await screenshot(`${kind}-editor`);
      await page.getByRole('button', { name: `保存 ${kind} 草稿`, exact: true }).click();
      const source = await exported(kind);
      check(source.data.revisions.length === 2, `${kind}: edited revision saved at ${width}`);
      await page.reload(); await choose(kind);
      const before = await exported(kind);
      check(before.data.revisions.length === 1, `${kind}: reload resets memory at ${width}`);
      await page.getByRole('button', { name: `导入或恢复 ${kind} 备份`, exact: true }).click();
      const textarea = page.getByLabel(`${kind} 备份 JSON`, { exact: true });
      const invalid = structuredClone(source); invalid.data.schemaVersion = 'unsupported.v999';
      await textarea.fill(JSON.stringify(invalid));
      await page.getByRole('button', { name: `校验 ${kind} 备份并预览`, exact: true }).click();
      check(await page.getByRole('button', { name: `备份当前字节并确认导入 ${kind}`, exact: true }).count() === 0, `${kind}: invalid schema blocked at ${width}`);
      check(JSON.stringify((await exported(kind)).data) === JSON.stringify(before.data), `${kind}: rejected import preserves bytes at ${width}`);
      await textarea.fill(JSON.stringify(source));
      await page.getByRole('button', { name: `校验 ${kind} 备份并预览`, exact: true }).click();
      check(JSON.stringify((await exported(kind)).data) === JSON.stringify(before.data), `${kind}: preview has no write at ${width}`);
      await overflow(`${kind} import preview`);
      await page.getByRole('button', { name: `备份当前字节并确认导入 ${kind}`, exact: true }).click();
      check(JSON.stringify((await exported(kind)).data) === JSON.stringify(source.data), `${kind}: confirmed import roundtrips exact data at ${width}`);
      await page.getByRole('button', { name: `生成 ${kind} 确认预览`, exact: true }).click();
      check(await page.getByRole('button', { name: `本人确认正式 ${kind}`, exact: true }).isDisabled(), `${kind}: explicit confirmation note required at ${width}`);
      await overflow(`${kind} confirmation preview`); await screenshot(`${kind}-confirmation`);
    }
    const navigation = await exerciseDemoResearchLinks(page, screenshot);
    report.navigationCases.push({ width, links: navigation });
    await overflow('Research context policy');
    check(navigation.every(link => link.tag === 'SPAN' && link.href === null && link.target === null && link.disabled === 'true' && link.samePage), `Thesis and portaled Claim links are non-navigational at ${width}`);
    check(report.popups.length === 0, `no popup from click, Ctrl-click, middle-click or Enter at ${width}`);
    check(await page.evaluate(() => localStorage.getItem('investment-research-dashboard.thesis.v1')) === 'SYNTHETIC_USER_STORAGE_SENTINEL', `formal browser storage untouched at ${width}`);
    check(report.unexpectedRequests.length === 0, `no unexpected requests during workflows at ${width}`);
    probingCsp = true;
    const blocked = await page.evaluate(async () => (await Promise.allSettled([fetch('/api/portfolio-projection'), fetch('https://example.invalid/synthetic-csp-probe')])).every(result => result.status === 'rejected'));
    check(blocked && !hits.some(url => url.startsWith('/api/')), `CSP prevents same-origin service and external fetch at ${width}`);
    await context.close();
  }
  check(report.pageErrors.length === 0, 'zero page errors');
  check(report.consoleErrors.length === 0, 'zero unexpected console errors');
  check(report.unexpectedRequests.length === 0, 'zero unexpected request attempts');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }, null, 2));
}
