/** Isolated context; real committed owners, no user browser or business-state writes. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-2-slice-3/browser');
await fs.mkdir(output, { recursive: true });
const report = { base: '086521d6bd305ea73cb5d4a426b9d4138e4a824b', generatedAt: new Date().toISOString(), sourceSha256: {}, checks: [], errors: [], screenshots: [], screenshotNote: 'Element captures hide the fixed mobile navigation only during screenshot; layout and navigation assertions use unmodified UI.' };
for (const file of ['src/services/industrySignals.ts', 'src/services/industryChain.ts', 'src/components/industry/IndustryChainDiagram.tsx', 'src/components/industry/industry-chain.css', 'src/components/industry/IndustryChangePanel.tsx', 'src/components/industry/IndustryTab.tsx', 'src/services/researchInbox.ts', 'src/data/industries.ts', 'src/data/stocks.ts', 'src/data/privateCompanies.ts', 'src/data/real/quotes.generated.json', 'src/data/real/a-share-financial-summaries.generated.json', 'src/data/real/a-share-announcement-summaries.generated.json']) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw new Error(name); };
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__writes = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) { window.__writes.push([method, args[0]]); return original.apply(this, args); };
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  const fits = async name => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name);
  for (const theme of ['neon', 'pro', 'light']) for (const width of [1536, 390, 320]) {
    const name = `${theme}-${width}`;
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${origin}/#/industry?industry=robotics&segment=__all__`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: '研究概览', exact: true }).click();
    await page.getByLabel('外观', { exact: true }).selectOption(theme);
    const event = page.getByRole('region', { name: '行业最新变化' });
    await event.getByRole('button', { name: '查看行业变化证据' }).waitFor();
    const text = await event.innerText();
    check(['96,174', '34.6', '729,352', '29', 'not_admitted', 'unknown'].every(value => text.includes(value)), `four readings and boundaries ${name}`);
    check(await event.locator('h3').count() === 1, `one release event ${name}`);
    const captureDetail = ['neon-1536', 'light-390', 'pro-320'].includes(name);
    if (captureDetail) { await event.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `event-${name}.png`) }); report.screenshots.push(`event-${name}.png`); }
    const writes = await page.evaluate(() => window.__writes.length);
    await event.getByRole('button').click();
    const drawer = page.getByRole('dialog');
    await drawer.locator('.chart-audit > summary').click();
    check((await drawer.innerText()).includes('releaseAvailableAt'), `event time audit ${name}`);
    await fits(`event evidence fits ${name}`);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: '产业链', exact: true }).click();
    const diagram = page.getByRole('region', { name: '产业链图', exact: true });
    check(await diagram.locator('svg:visible').count() === 1, `one readable responsive graph ${name}`);
    check(await diagram.locator('svg:visible text').evaluateAll(nodes => nodes.filter(n => ['上游', '中游', '下游'].includes(n.textContent)).length) === 3, `three original stages ${name}`);
    check((await diagram.innerText()).includes('位置待映射'), `no guessed placement ${name}`);
    await fits(`chain fits ${name}`);
    await diagram.screenshot({ path: path.join(output, `chain-${name}.png`), style: ".mobile-navigation{visibility:hidden}" }); report.screenshots.push(`chain-${name}.png`);
    if (name === 'light-390') {
      const figure = await diagram.evaluate(element => { const clone = element.cloneNode(true); clone.querySelectorAll('details,.chain-stage-details').forEach(n => n.remove()); return clone.outerHTML; });
      const css = await fs.readFile('src/components/industry/industry-chain.css', 'utf8');
      await fs.writeFile(path.join(output, 'robotics-chain.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>机器人产业链研究结构</title><style>body{margin:16px;max-width:1200px}*{box-sizing:border-box}${css}</style></head><body>${figure}</body></html>`);
    }
    await diagram.locator('[data-chain-stage="上游"] > summary').click();
    const card = diagram.locator('[data-chain-stage="上游"] [data-chain-company="inovance"]');
    check((await card.innerText()).includes('PROVIDER FACT'), `fact overlay labeled ${name}`);
    check((await card.innerText()).includes('行情源 as-of') && (await card.innerText()).includes('unknown（原 Provider 未留存）'), `no quote timestamp inference ${name}`);
    if (captureDetail) { await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `overlay-${name}.png`) }); report.screenshots.push(`overlay-${name}.png`); }
    await fits(`expanded facts fit ${name}`);
    await card.getByRole('button', { name: /汇川技术/ }).click();
    check((await page.getByRole('dialog').innerText()).includes('300124'), `exact company navigation ${name}`);
    await page.keyboard.press('Escape');
    await card.locator('[data-chain-segment="motor-drive-control"]').click();
    check(await page.getByLabel('选择细分板块').inputValue() === 'motor-drive-control', `exact segment navigation ${name}`);
    check(page.url().includes('segment=motor-drive-control'), `segment deep link ${name}`);
    check(await page.evaluate(() => window.__writes.length) === writes, `read-only flow ${name}`);
  }
  await page.goto(`${origin}/#/home`); await page.waitForLoadState('networkidle');
  const inbox = page.getByRole('region', { name: 'Research Inbox', exact: true });
  await inbox.waitFor();
  for (let i = 0; i < 100 && await inbox.getByRole('button', { name: /显示更多事件/ }).count(); i++) await inbox.getByRole('button', { name: /显示更多事件/ }).click();
  const eventCard = inbox.locator('article[data-inbox-id^="industry:industry-change:"]');
  check(await eventCard.count() === 1, 'Inbox contains exactly one industry release');
  await eventCard.getByRole('button', { name: '查看行业变化证据' }).click();
  check(await page.getByRole('dialog').count() === 1, 'Inbox opens existing EvidenceDrawer');
  await page.keyboard.press('Escape');
  await eventCard.getByRole('link', { name: '打开对应行业 / Metric' }).click();
  check(page.url().includes('industry=robotics'), 'Inbox exact industry link');
  await page.getByRole('tab', { name: '研究概览', exact: true }).click();
  check(await page.getByLabel('正式指标', { exact: true }).count() === 1, 'Inbox reaches formal metric owner');
  await page.goto(`${origin}/#/industry?industry=ai-computing`); await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: '研究概览', exact: true }).click();
  check((await page.getByRole('region', { name: '行业最新变化' }).innerText()).includes('unavailable'), 'industry without owner has no quote/qualitative event fallback');
  check(report.errors.length === 0, 'no runtime errors');
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors, screenshots: report.screenshots.length }));
