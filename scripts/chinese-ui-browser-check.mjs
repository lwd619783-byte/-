/** Chinese display acceptance against a local build, isolated profiles, no provider refresh. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/chinese-ui-browser');
await fs.mkdir(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [] };
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const internal = /NOT_ADMITTED|\bunknown\b|\bfreshness\b|releaseAvailableAt|SHA-256|\bpin\b|CN_NBS_|US_EIA_|"schemaVersion"|Evidence Drawer|Research Inbox/;
try {
 const context = await browser.newContext({ reducedMotion: 'reduce' });
 await context.addInitScript(() => {
  window.__writes = [];
  for (const method of ['setItem', 'removeItem', 'clear']) { const fn = Storage.prototype[method]; Storage.prototype[method] = function(...args) { window.__writes.push([method, args[0]]); return fn.apply(this, args); }; }
 });
 const page = await context.newPage();
 page.on('pageerror', e => report.errors.push(e.message));
 let downloads = 0; page.on('download', () => downloads++);
 const external = []; page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url()); });
 async function fits(name) { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `layout ${name}`); }
 async function drawerCheck(name, rawMarker) {
  const drawer = page.getByRole('dialog'); await drawer.waitFor();
  check(!internal.test(await drawer.innerText()), `default hides engineering ${name}`);
  const advanced = drawer.locator('[data-advanced-audit]').first();
  check(!await advanced.evaluate(el => el.open), `collapsed ${name}`);
  await advanced.locator('summary').click();
  check((await advanced.innerText()).includes(rawMarker), `raw preserved ${name}`);
  await fits(`advanced ${name}`);
  await advanced.locator('summary').click();
  await fits(`drawer ${name}`);
  if (name.includes('light-390') || name.includes('neon-1536') || name.includes('pro-320')) {
   await drawer.locator('.modal-content').evaluate(el => { el.scrollTop = 0; });
   const file = `${name}.png`; await page.screenshot({ path: path.join(output, file) }); report.screenshots.push(file);
  }
  await page.keyboard.press('Escape');
 }
 for (const width of [320, 390, 1536]) for (const theme of ['neon', 'pro', 'light']) {
  const name = `${theme}-${width}`; await page.setViewportSize({ width, height: 960 });
  for (const industry of ['oil-shipping', 'robotics']) {
   await page.goto(`${origin}/#/industry?industry=${industry}`); await page.waitForLoadState('networkidle');
   await page.getByRole('tab', { name: '研究概览', exact: true }).click();
   await page.getByLabel('外观', { exact: true }).selectOption(theme);
   await page.getByLabel('正式指标', { exact: true }).waitFor();
   const panel = page.getByRole('region', { name: '正式行业指标', exact: true });
   const text = await panel.innerText();
   check(!internal.test(text), `Chinese metric ${industry}-${name}`);
   check(text.includes(industry === 'oil-shipping' ? '423,429 千桶' : '96,174 套'), `value/unit ${industry}-${name}`);
   check(text.includes('尚未准入') && text.includes('未确认'), `uncertainty ${industry}-${name}`);
   const writes = await page.evaluate(() => window.__writes.length);
   const trigger = panel.getByRole('button', { name: '查看指标证据' }); await trigger.click();
   const drawer = page.getByRole('dialog');
   check((await drawer.getByRole('link').first().getAttribute('href')).startsWith(industry === 'oil-shipping' ? 'https://www.eia.gov/' : 'https://www.stats.gov.cn/'), `official link ${industry}-${name}`);
   await drawerCheck(`metric-${industry}-${name}`, 'SHA-256');
   check(await trigger.evaluate(el => el === document.activeElement), `focus restored ${industry}-${name}`);
   const changes = page.getByRole('region', { name: '行业最新变化' });
   check(!internal.test(await changes.innerText()), `Chinese changes ${industry}-${name}`);
   await changes.getByRole('button', { name: '查看行业变化证据' }).click();
   await drawerCheck(`event-${industry}-${name}`, 'observation');
   check(await page.evaluate(() => window.__writes.length) === writes, `read-only ${industry}-${name}`);
   await panel.locator('.chart-audit > summary').click();
   check(!internal.test(await panel.innerText()), `chart public audit ${industry}-${name}`);
   await fits(`industry ${industry}-${name}`);
  }
  for (const profile of ['full', 'empty', 'degraded']) {
   await page.goto(`${origin}/?ui-review=1&profile=${profile}#/home`); await page.waitForLoadState('networkidle');
   await page.getByLabel('外观', { exact: true }).selectOption(theme);
   check(await page.getByRole('region', { name: '研究收件箱', exact: true }).count() === 1, `Chinese Inbox ${profile}-${name}`);
   await fits(`home ${profile}-${name}`);
   if (profile !== 'empty') {
    await page.getByRole('button', { name: /查看证据/ }).first().click();
    await drawerCheck(`research-${profile}-${name}`, 'ui-review-event');
   }
  }
 }
 // Main navigation smoke scan at mobile and desktop widths.
 for (const width of [320, 1536]) for (const route of ['macro', 'stocks', 'watchlist', 'verification', 'expectations']) {
  await page.setViewportSize({ width, height: 960 });
  await page.goto(`${origin}/?ui-review=1&profile=full#/${route}`); await page.waitForLoadState('networkidle');
  check((await page.locator('main').innerText()).length > 20, `route renders ${route}-${width}`);
  await fits(`${route}-${width}`);
 }
 check(downloads === 0 && external.length === 0, 'no downloads or external acquisition');
 check(report.errors.length === 0, 'no runtime errors');
} catch (e) { report.errors.push(e.message); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.ok), errors: report.errors, screenshots: report.screenshots.length }));
