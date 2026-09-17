/** Real retained pilot in an isolated browser context. Never touches the user's browser profile. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-2-slice-1/browser');
await fs.mkdir(output, { recursive: true });
const report = { base: 'd50e39fcea201b1c3f139881ba7ed83d2d6d4b38', generatedAt: new Date().toISOString(), sourceSha256: {}, checks: [], errors: [], screenshots: [] };
for (const file of ['src/services/industryMetricProvider.ts', 'src/components/industry/IndustryMetricPanel.tsx', 'src/components/industry/IndustryTab.tsx', 'src/components/research/EvidenceDrawer.tsx', 'src/components/charts/ChartAuditPanel.tsx', 'src/data/real/industry-robotics.generated.json']) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
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
  page.on('pageerror', e => report.errors.push(e.message));
  const fits = async name => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name);
  const route = '/#/industry?industry=robotics&segment=__all__';
  for (const theme of ['neon', 'pro', 'light']) for (const width of [1536, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(origin + route); await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: '研究概览' }).click();
    await page.getByLabel('外观', { exact: true }).selectOption(theme);
    const name = `${theme}-${width}`, panel = page.getByRole('region', { name: '正式行业指标' });
    check((await panel.innerText()).includes('96,174 套'), `actual latest ${name}`);
    check((await panel.innerText()).includes('-2,503 套'), `actual delta ${name}`);
    check(await panel.locator('.recharts-line-curve').count() === 1, `real SVG chart ${name}`);
    check((await panel.innerText()).includes('NOT_ADMITTED'), `admission ${name}`);
    await fits(`page fits ${name}`);
    const tableSummary = panel.getByText('查看原始数据表', { exact: true });
    if (!await tableSummary.evaluate(e => e.parentElement.open)) await tableSummary.click();
    const rows = panel.locator('tbody tr');
    check(await rows.count() === 8 && (await rows.nth(0).innerText()).includes('暂缺') && (await rows.nth(1).innerText()).includes('暂缺'), `monthly gaps ${name}`);
    const writes = await page.evaluate(() => window.__writes.length);
    await page.getByLabel('指标口径').selectOption('year_to_date');
    check((await panel.innerText()).includes('729,352 套') && (await panel.innerText()).includes('不比较累计口径'), `basis switch ${name}`);
    await page.getByLabel('指标口径').selectOption('monthly');
    const trigger = panel.getByRole('button', { name: '查看指标证据' }); await trigger.click();
    const drawer = page.getByRole('dialog');
    await drawer.locator('.chart-audit > summary').click();
    await drawer.locator('.chart-audit details > summary').first().click();
    const evidence = await drawer.innerText();
    check(['candidate', 'releaseAvailableAt', 'acquiredAt', 'generatedAt', 'publicationDateTime', 'NOT_ADMITTED', '未提供 / unknown'].every(s => evidence.includes(s)), `exact source and temporal evidence ${name}`);
    check((await drawer.getByRole('link').first().getAttribute('href')).startsWith('https://www.stats.gov.cn/'), `official link ${name}`);
    await fits(`drawer fits ${name}`);
    await page.keyboard.press('Shift+Tab'); check(await drawer.evaluate(e => e.contains(document.activeElement)), `focus trapped ${name}`);
    await page.keyboard.press('Escape'); check(await drawer.count() === 0 && await trigger.evaluate(e => e === document.activeElement), `focus restored ${name}`);
    check(await page.evaluate(() => window.__writes.length) === writes, `metric operations no storage writes ${name}`);
    if ((theme === 'neon' && width === 1536) || (theme === 'light' && width === 390) || (theme === 'pro' && width === 320)) {
      await panel.evaluate(e => e.scrollIntoView({ block: 'start' })); const filename = `${name}.png`; await page.screenshot({ path: path.join(output, filename) }); report.screenshots.push(filename);
    }
    await page.getByRole('tab', { name: '细分比较' }).click();
    check(await page.getByLabel('选择细分板块').inputValue() === '__all__', `original robotics selection ${name}`);
    await page.getByRole('tab', { name: '产业链' }).click();
    check((await page.getByRole('tabpanel', { name: '产业链' }).innerText()).includes('未上市'), `chain retained ${name}`);
  }
  for (const id of ['ai-computing', 'innovative-drug', 'oil-shipping']) {
    await page.goto(`${origin}/#/industry?industry=${id}`); await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: '研究概览' }).click();
    check((await page.getByRole('region', { name: '正式行业指标' }).innerText()).includes('not_implemented'), `no proxy for ${id}`);
    check(await page.getByLabel('指标口径').count() === 0, `no formal number for ${id}`);
  }
  await page.goto(origin + route); await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: '细分比较' }).click();
  const segment = page.getByLabel('选择细分板块');
  const value = await segment.locator('option').nth(1).getAttribute('value');
  await segment.selectOption(value); await page.reload(); await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: '细分比较' }).click();
  check(await page.getByLabel('选择细分板块').inputValue() === value, 'segment deep link reload');
  await page.getByRole('button', { name: '公司比较表', exact: true }).click();
  const company = page.getByRole('tabpanel', { name: '细分比较' }).locator('button[data-stock-id]').first();
  const companyName = await company.innerText(); await company.click();
  check((await page.getByRole('dialog').innerText()).includes(companyName), 'company pool preserves exact company navigation');
  await page.keyboard.press('Escape');
  check(report.errors.length === 0, 'no browser runtime errors');
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.ok), errors: report.errors, output }));
