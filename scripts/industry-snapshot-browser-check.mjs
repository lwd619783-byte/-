/** Slice 5 actual retained owners, isolated Edge context, no user profile or live acquisition. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-2-slice-5/browser');
await fs.mkdir(output, { recursive: true });
const report = { base: '8497ac9199def1fbec420eecc6ad7b7305ce160d', generatedAt: new Date().toISOString(), sourceHashEncoding: 'UTF-8, CRLF normalized to LF (Git text blobs); retained raw captures use exact bytes in manifests', sourceSha256: {}, checks: [], errors: [], warnings: [], screenshots: [] };
const registry = JSON.parse(await fs.readFile('config/industry/industry-metric-registry.v1.json', 'utf8'));
for (const file of ['src/services/industryDimensions.mjs', 'src/services/industrySnapshot.ts', 'src/components/industry/IndustrySnapshotPanel.tsx', 'src/components/industry/IndustryTab.tsx', 'src/utils/displayLabels.ts', 'config/industry/industry-dimension-mapping.v1.json', 'config/industry/industry-metric-registry.v1.json', ...registry.entries.map(e => e.artifactRef.owner)]) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
const owners = new Map(await Promise.all(registry.entries.map(async e => [e.metricId, JSON.parse(await fs.readFile(e.artifactRef.owner, 'utf8'))])));
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const internal = /NOT_ADMITTED|\bunknown\b|releaseAvailableAt|SHA-256|CN_NBS_|US_EIA_|industry-dimension-mapping|industry-multi-factor/;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__writes = [];
    for (const method of ['setItem', 'removeItem', 'clear']) { const fn = Storage.prototype[method]; Storage.prototype[method] = function(...args) { window.__writes.push([method, args[0]]); return fn.apply(this, args); }; }
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') {
    if (message.location().url === `${origin}/favicon.ico` && message.text().includes('404')) report.warnings.push('Existing favicon.ico 404');
    else report.errors.push(message.text());
  } });
  const external = []; let downloads = 0;
  page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url()); });
  page.on('download', () => downloads++);
  const fits = async name => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `fits ${name}`);
  for (const theme of ['neon', 'pro', 'light']) for (const width of [320, 390, 1536]) {
    await page.setViewportSize({ width, height: 960 });
    for (const industry of ['oil-shipping', 'robotics']) {
      const name = `${industry}-${theme}-${width}`;
      await page.goto(`${origin}/#/industry?industry=${industry}`); await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: '研究概览', exact: true }).click();
      await page.getByLabel('外观', { exact: true }).selectOption(theme);
      const snapshot = page.getByRole('region', { name: '多因子基本面快照', exact: true });
      await snapshot.locator('article').first().waitFor();
      const text = await snapshot.innerText();
      check(text.includes('当前为多因子基本面快照，不构成行业景气评分或投资结论。'), `notice ${name}`);
      check(!internal.test(text), `Chinese default hides technical fields ${name}`);
      check(await snapshot.locator('article').count() === 4, `exact four rows ${name}`);
      check(text.includes('未接入维度（缺失）') && text.includes('不使用行情或研究文字补齐'), `missing dimensions ${name}`);
      check(text.includes('尚未准入') && text.includes('未证明') && text.includes('部分可用'), `limitations ${name}`);
      check(!/bullish|bearish|景气上行|景气下行|环比|周变化|相邻月留存值差额/.test(text), `no score trend delta ${name}`);
      if (industry === 'oil-shipping') {
        for (const group of ['供给', '需求 / 炼化', '贸易流', '库存']) check(await snapshot.getByRole('region', { name: `${group}维度`, exact: true }).count() === 1, `dimension ${group} ${name}`);
        for (const value of ['13,944', '4,831', '17,330', '423,429', '千桶/日', '2026-09-11', '11 / 11']) check(text.includes(value), `retained ${value} ${name}`);
      } else {
        check(await snapshot.getByRole('region').count() === 1, `robotics supply only ${name}`);
        check(['96,174', '34.6', '729,352', '29', '6 / 8'].every(v => text.includes(v)), `robotics values/bases ${name}`);
        check(!text.includes('美国'), `no oil fallback ${name}`);
      }
      await fits(name);
      if (['neon-1536', 'light-390', 'pro-320'].includes(`${theme}-${width}`)) {
        // Normal viewport capture on mobile keeps fixed navigation in its real position.
        // Click the heading to clear the previous keyboard focus before visual capture.
        await snapshot.locator('h2').click();
        if (width < 600) {
          await snapshot.evaluate(e => window.scrollTo({ top: window.scrollY + e.getBoundingClientRect().top - 130 }));
          await page.screenshot({ path: path.join(output, `${name}.png`) });
        } else await snapshot.screenshot({ path: path.join(output, `${name}.png`) });
        report.screenshots.push(`${name}.png`);
      }
      const writes = await page.evaluate(() => window.__writes.length);
      for (const row of await snapshot.locator('article').all()) {
        const heading = await row.locator('h4').innerText();
        const trigger = row.getByRole('button'); await trigger.click();
        const drawer = page.getByRole('dialog'); await drawer.waitFor();
        check(!internal.test(await drawer.innerText()), `Chinese evidence summary ${heading} ${name}`);
        const url = await drawer.getByRole('link').first().getAttribute('href');
        check(url.startsWith(industry === 'oil-shipping' ? 'https://www.eia.gov/' : 'https://www.stats.gov.cn/'), `official link ${heading} ${name}`);
        const advanced = drawer.locator('[data-advanced-audit]'); check(!await advanced.evaluate(e => e.open), `collapsed evidence ${heading} ${name}`);
        await advanced.locator('summary').click(); const evidence = await advanced.innerText();
        const owner = [...owners.values()].find(o => o.definition.canonicalName === heading);
        check(evidence.includes(owner.definition.id) && evidence.includes(owner.observations.at(-1).provenance.rawSha256) && evidence.includes('industry-dimension-mapping.v1'), `exact owner mapping raw digest ${heading} ${name}`);
        check(['publicationDateTime', 'releaseAvailableAt', 'candidate', 'NOT_ADMITTED'].every(v => evidence.includes(v)), `raw time/admission fields ${heading} ${name}`);
        await fits(`drawer ${name}`);
        await page.keyboard.press('Shift+Tab'); check(await drawer.evaluate(e => e.contains(document.activeElement)), `focus trapped ${heading} ${name}`);
        await page.keyboard.press('Escape'); check(await trigger.evaluate(e => e === document.activeElement), `focus restored ${heading} ${name}`);
      }
      // Existing exact metric selector/history surface, including robotics original delta policy.
      const select = page.getByLabel('正式指标', { exact: true });
      const expected = registry.entries.filter(e => e.industryId === industry);
      check(await select.locator('option').count() === expected.length, `exact metric count ${name}`);
      for (const entry of expected) {
        await select.selectOption(entry.metricId);
        const panel = page.getByRole('region', { name: '正式行业指标', exact: true }), owner = owners.get(entry.metricId);
        const value = owner.observations.filter(o => o.basis === owner.definition.basis[0]).at(-1).value.toLocaleString('zh-CN');
        check((await panel.innerText()).includes(value), `history value ${entry.metricId} ${name}`);
        check(await panel.locator('.recharts-line-curve').count() === 1, `chart ${entry.metricId} ${name}`);
        if (entry.presentation.delta === 'none') check(!(await panel.innerText()).includes('相邻月留存值差额'), `no new delta ${entry.metricId} ${name}`);
      }
      check(await page.evaluate(() => window.__writes.length) === writes, `read only ${name}`);
    }
    await page.goto(`${origin}/#/industry?industry=innovative-drug`); await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: '研究概览', exact: true }).click();
    const empty = page.getByRole('region', { name: '多因子基本面快照' });
    await empty.getByText('当前行业尚无已映射的正式基本面指标。').waitFor();
    check(await empty.locator('article').count() === 0 && !(await empty.innerText()).includes('美国'), `empty industry ${theme}-${width}`);
    await fits(`empty ${theme}-${width}`);
  }
  await page.goto(`${origin}/#/home`); await page.waitForLoadState('networkidle');
  check(await page.getByRole('region', { name: '研究收件箱', exact: true }).count() === 1, 'existing home Inbox renders');
  check(downloads === 0 && external.length === 0, 'no downloads or external data acquisition');
  check(report.errors.length === 0, 'no runtime errors');
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.ok), errors: report.errors, warnings: report.warnings, screenshots: report.screenshots.length }));
