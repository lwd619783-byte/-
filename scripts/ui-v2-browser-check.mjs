/** UI V2 navigation in a disposable context. No user profile, credentials, or formal review. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4191';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/ui-v2/browser');
await fs.mkdir(output, { recursive: true });
const report = { runtimeSha: process.env.UI_REVIEW_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_DEPLOYMENT_ID || null, origin, testedAt: new Date().toISOString(), inputType: 'isolated-synthetic', profile: 'disposable browser context; no persisted login', checks: [], errors: [], screenshots: [], routes: [], externalRequests: [], limits: ['Browser checks do not establish full WCAG conformance.', 'CSS zoom and 320 CSS px reflow are recorded separately from native browser zoom.', 'Formal knowledge approval and authenticated remote Bridge acceptance are not performed.'] };
const check = (ok, name) => { report.checks.push({ ok, name }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw new Error(name); };
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
const page = await context.newPage(); page.setDefaultTimeout(20000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => { const url = request.url(); if (/^https?:/.test(url) && new URL(url).origin !== new URL(origin).origin) report.externalRequests.push(url); });
const ready = async () => { await page.locator('main').waitFor(); await page.getByRole('navigation', { name: '主要导航', exact: true, includeHidden: true }).waitFor({ state: 'attached' }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
const visit = async hash => { await page.goto(`${origin}/${hash}`); await ready(); report.routes.push(hash); };
const noOverflow = async label => {
  const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  check(sizes.document <= sizes.width + 1 && sizes.body <= sizes.width + 1, `${label} no page horizontal overflow (${sizes.document}/${sizes.width})`);
};
try {
  await visit('#/home');
  const appearanceKey = 'investment-dashboard.ui.v1.appearance', sentinelKey = 'ui-v2-synthetic-unrelated';
  for (const theme of ['neon', 'pro']) {
    await page.evaluate(({ appearanceKey, sentinelKey, theme }) => { localStorage.setItem(appearanceKey, theme); localStorage.setItem(sentinelKey, 'retained synthetic bytes'); }, { appearanceKey, sentinelKey, theme });
    await page.reload(); await ready();
    check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), `legacy ${theme} preference renders light`);
    check(await page.evaluate(({ appearanceKey, sentinelKey, theme }) => localStorage.getItem(appearanceKey) === theme && localStorage.getItem(sentinelKey) === 'retained synthetic bytes', { appearanceKey, sentinelKey, theme }), `legacy ${theme} and unrelated storage bytes retained`);
  }
  check(await page.getByLabel('外观', { exact: true }).count() === 0, 'appearance selector removed');
  check(await page.getByRole('button', { name: '添加资料', exact: true }).count() === 1, 'one add-material main action');
  check(await page.getByText(/当前尚未记录阅读历史|最近阅读|从一个问题/).count() === 0, 'unimplemented reading history and research hero absent');
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByRole('dialog', { name: '添加资料', exact: true }).waitFor();
  check(new URL(page.url()).hash === '#/sources?view=add', 'add material opens actual source flow');
  await page.keyboard.press('Escape');

  const routes = ['home', 'macro', 'industry', 'stocks', 'watchlist', 'verification', 'expectations', 'creators', 'memory', 'research', 'knowledge', 'portfolio', 'tasks', 'sources', 'settings'];
  for (const route of routes) {
    await visit(`#/${route}`);
    check(await page.locator('main').innerText().then(text => text.trim().length > 20), `route ${route} renders content`);
    check(await page.getByRole('heading', { name: '找不到研究对象或页面' }).count() === 0, `route ${route} is recognized`);
    await page.reload(); await ready();
    check(new URL(page.url()).hash === `#/${route}`, `route ${route} survives reload`);
  }
  await visit('#/memory');
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  check(await page.getByLabel('选择多份文件').count() === 1, 'legacy memory retains upload through add-material flow');
  await page.keyboard.press('Escape');
  for (const hash of ['#/industry?industry=synthetic%2Findustry&segment=synthetic%3Fsegment', '#/verification?event=synthetic%2Fevent%3Fone', '#/memory?view=sources&wiki=synthetic%2Fwiki']) {
    await visit(hash); await page.reload(); await ready();
    check(new URL(page.url()).hash === hash, `deep link preserves exact encoded query ${hash}`);
  }

  await visit('#/stocks');
  const company = page.locator('main [data-stock-id]:visible').first();
  await company.waitFor(); const stockId = await company.getAttribute('data-stock-id');
  check(Boolean(stockId), 'company identity obtained from loaded research pool');
  await company.click();
  const preview = page.getByRole('dialog'); await preview.waitFor();
  check(await preview.locator('[data-stock-id]').getAttribute('data-stock-id') === stockId, 'quick preview retains selected company identity');
  await preview.getByRole('button', { name: '打开完整研究', exact: true }).click({ noWaitAfter: true });
  await page.waitForURL(url => url.hash === `#/company/${encodeURIComponent(stockId)}/overview?from=stocks`);
  check(new URL(page.url()).hash === `#/company/${encodeURIComponent(stockId)}/overview?from=stocks`, 'company action preserves exact identity and return origin');
  for (const tab of ['overview', 'financials', 'valuation', 'expectations', 'evidence']) {
    await page.locator(`#company-tab-${tab}`).click();
    check(new URL(page.url()).hash === `#/company/${encodeURIComponent(stockId)}/${tab}?from=stocks`, `company ${tab} keeps identity`);
    await page.reload(); await ready();
    check(await page.locator(`#company-tab-${tab}`).getAttribute('aria-selected') === 'true', `company ${tab} remains selected after reload`);
  }
  await page.getByRole('button', { name: '返回研究入口', exact: true }).click();
  await page.waitForURL(url => url.hash === '#/stocks'); check(true, 'company returns to original research page after reload');

  await visit('#/home');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: '搜索', exact: true }); await dialog.waitFor();
  check(await dialog.evaluate(element => element.contains(document.activeElement)), 'search modal receives keyboard focus');
  check(await dialog.getByLabel('搜索页面、公司或代码').evaluate(element => element === document.activeElement), 'search input receives initial focus');
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); check(await dialog.evaluate(element => element.contains(document.activeElement)), `search Tab focus remains within modal ${i + 1}`); }
  await page.keyboard.press('Shift+Tab'); check(await dialog.evaluate(element => element.contains(document.activeElement)), 'search reverse Tab remains in modal');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  check(await page.getByRole('button', { name: /搜索页面或公司/ }).evaluate(element => element === document.activeElement), 'search Esc returns focus to trigger');
  await page.keyboard.press('Control+k'); await dialog.getByLabel('搜索页面、公司或代码').fill('宏观');
  const result = dialog.getByRole('button').filter({ has: page.locator('strong', { hasText: '宏观' }) }); await result.focus(); await page.keyboard.press('Enter');
  check(new URL(page.url()).hash === '#/macro', 'search result supports keyboard navigation');
  await page.keyboard.press('Control+k'); await dialog.getByLabel('搜索页面、公司或代码').fill('zzzxnomatch');
  await dialog.getByRole('button', { name: '在公司研究池查找“zzzxnomatch”', exact: true }).click({ noWaitAfter: true });
  await page.waitForURL(url => url.hash === '#/stocks');
  await page.getByText('没有匹配个股', { exact: true }).waitFor();
  check(await page.locator('main [data-stock-id]:visible').count() === 0, 'unmatched global company search has no company rows');
  await page.getByRole('button', { name: '清除研究池筛选', exact: true }).click();
  await page.locator('main [data-stock-id]:visible').first().waitFor();
  check(await page.getByText('没有匹配个股', { exact: true }).count() === 0, 'clearing global company filter restores loaded companies');

  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['home', 'macro', 'industry', 'stocks', 'watchlist', 'verification', 'expectations', 'creators', 'knowledge', 'tasks', 'sources', 'portfolio', 'settings']) { await visit(`#/${route}`); await noOverflow(`${width}/${route}`); }
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), `${width} reduced motion requested`);
    await visit('#/home');
    const shot = `home-${width}.png`; await page.screenshot({ path: path.join(output, shot), fullPage: true }); report.screenshots.push(shot);
    const toggle = page.getByRole('button', { name: '导航', exact: true });
    if (await toggle.isVisible()) {
      await toggle.focus(); await page.keyboard.press('Enter'); check(await toggle.getAttribute('aria-expanded') === 'true', `${width} keyboard opens navigation`);
      await page.keyboard.press('Escape'); check(await toggle.getAttribute('aria-expanded') === 'false', `${width} Esc closes navigation`);
      check(await toggle.evaluate(element => element === document.activeElement), `${width} navigation returns focus`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 }); await visit('#/home');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); await noOverflow('home 200 percent CSS zoom');
  const zoomShot = 'home-css-zoom-200.png'; await page.screenshot({ path: path.join(output, zoomShot), fullPage: true }); report.screenshots.push(zoomShot);
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await visit('#/portfolio'); check(await page.locator('main').innerText().then(text => /未连接|尚未|尚无/.test(text)), 'portfolio exposes unavailable capability honestly');
  await visit('#/tasks'); check(await page.getByRole('button', { name: /运行 Agent|启动 Agent|开始执行/ }).count() === 0, 'no unimplemented Agent execution action');
  await visit('#/sources'); check(await page.getByRole('navigation', { name: '资料分类' }).count() === 1, 'source access retains its three contextual views');
  check(report.errors.length === 0, 'no browser runtime errors');
} catch (error) { report.errors.push(error.message); process.exitCode = 1; await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); }
finally { await context.close(); await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ output, checks: report.checks.length, passed: report.checks.filter(row => row.ok).length, errors: report.errors })); }
