/** UI21-P1-01: real App/forms/services, disposable contexts; faults affect only synthetic local storage. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4201';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/ui21-p1-01/browser');
const WATCH = 'investment-research-dashboard.watchlist.v2', EXPECT = 'investment-research-dashboard.earnings-expectation.v1';
await fs.mkdir(output, { recursive: true });
const report = { runtimeSha: process.env.UI_REVIEW_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_DEPLOYMENT_ID || null, origin, testedAt: new Date().toISOString(), inputType: 'isolated full production App with synthetic form entries and storage faults', scriptSha256: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'), checks: [], errors: [], console: [], httpErrors: [], screenshots: [], states: [], storage: [], limits: ['No personal browser profile or formal knowledge approval.', 'Negative storage fixtures and setItem faults exist only in disposable contexts.', 'Ordinary rejection must not become global owner lock; genuine persistence faults must remain visible.', 'Mock provider intentionally emits no research events. Nonempty event fixtures come from legal synthetic expectation forms; healthy watch tasks come from an explicit overdue review date.'] };
const sourceFiles = ['src/App.tsx', 'src/components/home/HomePage.tsx', 'src/components/stock/StockDetailDrawer.tsx', 'src/components/watchlist/StockWatchlistPanel.tsx', 'src/components/watchlist/WatchlistTab.tsx', 'src/components/expectation/EarningsExpectationCenter.tsx', 'src/components/home/ResearchWorkbench.tsx', 'src/components/home/ResearchInbox.tsx', 'src/services/watchlistStore.ts', 'src/services/watchlistRepository.ts', 'src/services/earningsExpectationStore.ts', 'src/services/earningsExpectationRepository.ts'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
report.sourceSha256AtStart = await sourceHashes();
const check = (ok, name, detail) => { report.checks.push({ ok: Boolean(ok), name, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'chrome', headless: true });
const contexts = [];
async function newPage() {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' }); contexts.push(context);
 const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('dialog', dialog => dialog.accept());
 page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ status: response.status(), url: response.url() }); });
 page.on('pageerror', e => report.errors.push({ type: 'pageerror', message: e.message })); page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.console.push({ type: message.type(), text: message.text().slice(0, 1500), location: message.location() }); });
 await page.goto(`${origin}/#/watchlist`); await page.locator('main').waitFor(); await page.getByLabel('数据模式', { exact: true }).selectOption('mock'); return page;
}
async function route(page, hash) { await page.evaluate(hash => { location.hash = hash; }, hash); await page.waitForURL(url => url.hash === hash); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
const raw = (page, key) => page.evaluate(key => localStorage.getItem(key), key);
function fingerprint(value) { return value === null ? null : { bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') }; }
async function shot(page, name) { check(await page.getByLabel('数据模式', { exact: true }).inputValue() === 'mock', `${name} screenshot provider input remains explicitly mock`); for (const width of [1440, 390]) { await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); const file = `${name}-${width}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file); } await page.setViewportSize({ width: 1440, height: 1000 }); }
async function eventIds(page) { return page.locator('main .inbox-event-row').evaluateAll(rows => rows.map(row => row.getAttribute('data-inbox-id')).sort()); }
async function captureEventIdentities(page) {
 const identities = {};
 for (const hash of ['#/research', '#/tasks?view=verify']) { await route(page, hash); const date = page.getByLabel('日期范围', { exact: true }); if (await date.count()) await date.selectOption('all'); identities[hash] = await eventIds(page); }
 return identities;
}
async function inspectRoutes(page, prefix, shouldLock, expectedEvents) {
 for (const hash of ['#/home', '#/research', '#/tasks?view=replay', '#/tasks?view=verify']) {
  await route(page, hash); const main = page.locator('main'); const date = page.getByLabel('日期范围', { exact: true }); if (expectedEvents && await date.count()) await date.selectOption('all'); const text = await main.innerText();
  const alerts = await main.locator('[role=alert]').allTextContents(); const lock = /已锁定|读取失败|写入失败|保存本地.*失败|数据未就绪|本地研究记录尚未可靠载入/.test(text);
  const rows = await main.locator('.ui-v21-watch-list li,.inbox-event-row,.inbox-review-row').count();
  const ids = await eventIds(page); const dataState = await main.locator('.research-inbox').first().getAttribute('data-state');
  report.states.push({ prefix, hash, alerts, lock, rows, eventIds: ids, dataState, text: text.slice(0, 16000) });
  check(shouldLock ? lock || alerts.length > 0 : !lock && !/该公司已经存在活跃观察项|区间下限不得大于上限/.test(text), `${prefix} ${hash} ${shouldLock ? 'real storage fault visible' : 'ordinary rejection does not lock owner'}`);
  if (expectedEvents?.[hash]) check(JSON.stringify(ids) === JSON.stringify(expectedEvents[hash]), `${prefix} ${hash} exact healthy event identities and count retained`, { expected: expectedEvents[hash], actual: ids });
  if (shouldLock && (hash === '#/research' || hash === '#/tasks?view=verify')) check(dataState === 'partial', `${prefix} ${hash} unavailable owner produces partial scope, not global lock`);
  if (prefix.startsWith('C-expectation') && hash === '#/home') check(await main.locator('.ui-v21-watch-list li').count() === 1, `${prefix} healthy observation owner remains readable`);
  if (prefix.startsWith('C-expectation') && hash === '#/tasks?view=replay') check(await main.locator('.inbox-review-row').count() > 0, `${prefix} healthy overdue review remains readable`);
  if (prefix.startsWith('C-watch') && hash === '#/tasks?view=replay') check((await page.getByRole('tab', { name: /^研究复盘/ }).innerText()).includes('已锁定'), `${prefix} unreadable watch owner does not report false zero review count`);
  if (!shouldLock && hash === '#/home') check(await main.locator('.ui-v21-watch-list li').count() > 0, `${prefix} observations remain readable`);
  await shot(page, `${prefix}-${hash.replace(/[^a-z]/gi, '-')}`);
 }
}
async function openWatch(page, stockId) {
 await route(page, '#/watchlist'); await page.getByRole('button', { name: '添加观察项', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '添加观察项', exact: true }); await dialog.waitFor();
 if (stockId) await dialog.getByLabel('公司', { exact: true }).selectOption(stockId);
 return dialog;
}
async function openExpectation(page, stockId, invalid = false) {
 await route(page, '#/expectations'); await page.getByRole('button', { name: '添加业绩预期', exact: true }).click(); const d = page.getByRole('dialog', { name: '添加业绩预期', exact: true }); await d.waitFor();
 await d.getByLabel('公司', { exact: true }).selectOption(stockId); await d.getByLabel('报告期', { exact: true }).fill('2026-06-30'); await d.getByLabel('预期形成日期', { exact: true }).fill('2026-06-01');
 await d.getByLabel('来源标题', { exact: true }).fill('UI21 isolated synthetic expectation');
 await d.getByLabel('预测形态', { exact: true }).selectOption('range'); await d.getByLabel('区间下限', { exact: true }).fill(invalid ? '200' : '100'); await d.getByLabel('区间上限', { exact: true }).fill(invalid ? '100' : '200'); return d;
}
async function addHealthyExpectation(page, stockId, title) {
 const d = await openExpectation(page, stockId); await d.getByLabel('预期形成日期', { exact: true }).fill('2026-09-01'); await d.getByLabel('来源标题', { exact: true }).fill(title); await d.getByRole('button', { name: '保存不可变快照', exact: true }).click(); await d.waitFor({ state: 'hidden' });
 const identities = await captureEventIdentities(page); check(identities['#/research'].length > 0, `${title} real App derives nonempty research events from legal form input`); check(identities['#/tasks?view=verify'].length > 0, `${title} real selector exposes actual verification events`); return identities;
}
async function run(name, action) { try { await action(); } catch (e) { report.errors.push({ scenario: name, message: e.message }); check(false, `${name} completed`, e.message); } await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
let mainPage, stockId, secondStockId;
await run('A duplicate watch', async () => {
 mainPage = await newPage(); let d = await openWatch(mainPage); const options = await d.getByLabel('公司', { exact: true }).locator('option').evaluateAll(items => items.map(i => i.value)); stockId = options[0]; secondStockId = options[1];
 await d.getByLabel('关注理由', { exact: true }).fill('UI21 isolated synthetic observation'); await d.getByLabel('投资假设', { exact: true }).fill('Synthetic state regression; not investment research'); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.waitFor({ state: 'hidden' });
 const before = await raw(mainPage, WATCH); check(JSON.parse(before).watchItems.length === 1, 'A real form creates one observation');
 const identities = await addHealthyExpectation(mainPage, secondStockId, 'UI21 A independent healthy synthetic expectation'); const expectationBefore = await raw(mainPage, EXPECT);
 d = await openWatch(mainPage, stockId); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.getByText('该公司已经存在活跃观察项，请打开现有记录。', { exact: true }).waitFor(); await shot(mainPage, 'A-duplicate-inline-error');
 check(await raw(mainPage, WATCH) === before, 'A rejected duplicate preserves exact owner bytes'); await d.getByRole('button', { name: '取消', exact: true }).click(); await d.waitFor({ state: 'hidden' }); await inspectRoutes(mainPage, 'A', false, identities); check(await raw(mainPage, EXPECT) === expectationBefore, 'A unrelated healthy expectation bytes unchanged');
 check(await raw(mainPage, WATCH) === before, 'A SPA navigation preserves owner bytes'); report.storage.push({ scenario: 'A', before: fingerprint(before), after: fingerprint(await raw(mainPage, WATCH)) });
});
await run('B invalid expectation range', async () => {
 if (!stockId) throw Error('A setup unavailable'); mainPage = await newPage(); const setup = await openWatch(mainPage, stockId); await setup.getByLabel('关注理由', { exact: true }).fill('UI21 B independent synthetic observation'); await setup.getByRole('button', { name: '保存', exact: true }).click(); await setup.waitFor({ state: 'hidden' }); const before = await raw(mainPage, EXPECT), watchBefore = await raw(mainPage, WATCH);
 const d = await openExpectation(mainPage, stockId, true); await d.getByRole('button', { name: '保存不可变快照', exact: true }).click(); await d.getByText('区间下限不得大于上限。', { exact: false }).first().waitFor(); await shot(mainPage, 'B-range-inline-error'); check(await raw(mainPage, EXPECT) === before, 'B rejected range preserves exact expectation bytes');
 await d.getByRole('button', { name: '取消', exact: true }).click(); await d.waitFor({ state: 'hidden' }); await inspectRoutes(mainPage, 'B', false); check(await raw(mainPage, WATCH) === watchBefore, 'B unrelated observations bytes unchanged'); report.storage.push({ scenario: 'B', before: fingerprint(before), after: fingerprint(await raw(mainPage, EXPECT)) });
});
console.log('BASELINE_A_B_COMPLETED');
await run('D subsequent legitimate operations', async () => {
 let d = await openWatch(mainPage, secondStockId); await d.getByLabel('关注理由', { exact: true }).fill('UI21 second legitimate synthetic observation'); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.waitFor({ state: 'hidden' }); check(JSON.parse(await raw(mainPage, WATCH)).watchItems.length === 2, 'D subsequent legitimate watch create succeeds');
 d = await openExpectation(mainPage, stockId, false); await d.getByRole('button', { name: '保存不可变快照', exact: true }).click(); await d.waitFor({ state: 'hidden' }); check(JSON.parse(await raw(mainPage, EXPECT)).snapshots.length === 1, 'D subsequent legitimate expectation succeeds'); await inspectRoutes(mainPage, 'D', false);
});
if (process.env.UI21_AB_ONLY !== '1') {
 for (const [owner, key] of [['watch', WATCH], ['expectation', EXPECT]]) for (const variant of ['corrupt', 'future']) await run(`C ${owner} ${variant}`, async () => {
  const p = await newPage(), value = variant === 'corrupt' ? '{synthetic invalid json' : JSON.stringify({ schemaVersion: 999, synthetic: true });
  let identities;
  if (owner === 'watch') identities = await addHealthyExpectation(p, secondStockId, `UI21 C ${variant} independent healthy expectation`);
  else { const d = await openWatch(p, stockId); await d.getByLabel('关注理由', { exact: true }).fill('UI21 healthy owner survives unrelated expectation fault'); await d.getByLabel('下一次复盘日期', { exact: true }).fill('2026-01-01'); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.waitFor({ state: 'hidden' }); identities = await captureEventIdentities(p); check(identities['#/research'].length === 0 && identities['#/tasks?view=verify'].length === 0, `C expectation ${variant} mock provider honestly has zero events before fault`); }
  const healthyKey = owner === 'watch' ? EXPECT : WATCH, healthyBefore = await raw(p, healthyKey);
  await p.evaluate(({ key, value }) => localStorage.setItem(key, value), { key, value }); await p.reload(); await p.locator('main').waitFor(); await p.getByLabel('数据模式', { exact: true }).selectOption('mock'); await inspectRoutes(p, `C-${owner}-${variant}`, true, identities); check(await raw(p, key) === value, `C ${owner} ${variant} original bytes retained`); check(await raw(p, healthyKey) === healthyBefore, `C ${owner} ${variant} independent healthy owner bytes retained`);
 });
 await run('C write failure', async () => {
  const p = await newPage(); let d = await openWatch(p, stockId); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.waitFor({ state: 'hidden' }); const before = await raw(p, WATCH);
  await p.evaluate(key => { const real = Storage.prototype.setItem; window.__ui21RestoreStorage = () => { Storage.prototype.setItem = real; }; Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('UI21 isolated write fault', 'QuotaExceededError'); return real.call(this, k, v); }; }, WATCH);
  d = await openWatch(p, secondStockId); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.getByText(/保存本地观察清单失败/).first().waitFor(); await shot(p, 'C-write-error'); check(await raw(p, WATCH) === before, 'C failed write preserves exact bytes'); await d.getByRole('button', { name: '取消', exact: true }).click(); await inspectRoutes(p, 'C-write', false);
  await p.evaluate(() => window.__ui21RestoreStorage()); d = await openWatch(p, secondStockId); await d.getByRole('button', { name: '保存', exact: true }).click(); await d.waitFor({ state: 'hidden' }); check(JSON.parse(await raw(p, WATCH)).watchItems.length === 2, 'C recovery succeeds through legal write after fault removal with no reload');
 });
 await run('E real empty local owners and known zero', async () => {
  const p = await newPage(); check(await raw(p, WATCH) === null && await raw(p, EXPECT) === null, 'E local owners start with absent persisted bytes');
  await route(p, '#/home'); check(await p.getByRole('heading', { name: '还没有观察项', exact: true }).count() === 1, 'E readable empty watch owner has explicit empty state'); check(await p.locator('.ui-v21-watch-list li').count() === 0, 'E empty owner does not fabricate observations'); await shot(p, 'E-empty-home');
  await route(p, '#/tasks?view=replay'); const reviewTab = p.getByRole('tab', { name: /^研究复盘/ }); check((await reviewTab.innerText()).trim().endsWith('0'), 'E known empty review queue reports legitimate zero');
  const knowledgeTab = p.getByRole('tab', { name: /^知识待审/ }); report.states.push({ prefix: 'E', kind: 'knowledge-before-readiness', text: await knowledgeTab.innerText(), note: 'Observed actual owner state; no artificial loading injected. It may already be ready.' });
  await knowledgeTab.click(); await p.waitForFunction(() => [...document.querySelectorAll('[role=tab]')].some(e => /^知识待审\s*0$/.test(e.textContent?.trim() ?? '')), null, { timeout: 15000 });
  check((await p.getByRole('tab', { name: /^知识待审/ }).innerText()).trim().endsWith('0'), 'E real knowledge owner eventually confirms legitimate zero'); await shot(p, 'E-empty-knowledge');
 });
}
await Promise.all(contexts.map(c => c.close())); await browser.close();
report.finishedAt = new Date().toISOString(); report.sourceSha256AtEnd = await sourceHashes(); check(JSON.stringify(report.sourceSha256AtStart) === JSON.stringify(report.sourceSha256AtEnd), 'production source bytes unchanged throughout browser run'); report.failedAssertions = report.checks.filter(c => !c.ok); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks: report.checks.length, failures: report.failedAssertions.length, errors: report.errors, output })); if (report.failedAssertions.length || report.errors.length) process.exitCode = 1;


