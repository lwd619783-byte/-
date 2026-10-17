// Both sides use audited synthetic built assets; never load formal research data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { navigateDemo } from './demo-shell-navigation.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.SECURITY_DEMO_ROOT || 'dist-demo';
const output = process.env.SECURITY_VISUAL_OUTPUT || 'data-cache/security-visual';
await mkdir(output, { recursive: true });
const inventory = JSON.parse(await readFile(path.join(root, 'demo-asset-inventory.json'), 'utf8'));
const allowed = new Map(inventory.assets.map(a => ['/' + a.file, a]));
const server = createServer(async (req, res) => {
  const requested = new URL(req.url, 'http://localhost').pathname;
  const file = requested === '/' ? '/index.html' : requested;
  if (!allowed.has(file)) return res.writeHead(404).end();
  const bytes = await readFile(path.join(root, file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), allowed.get(file).sha256);
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/json'); res.end(bytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { codeSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), assetRoot: root, assets: inventory.assets, fixedSyntheticClock: '2026-10-17T03:00:00.000Z', screenshots: [], snapshots: [], errors: [], unexpectedRequests: [] };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
report.browser = browser.version();
try {
  for (const width of [1440, 1920, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin || !(url.pathname === '/' || allowed.has(url.pathname))) { report.unexpectedRequests.push('blocked non-asset request'); return route.abort(); } return route.continue(); });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.clock.setFixedTime(new Date(report.fixedSyntheticClock));
    await page.goto(origin); await page.locator('h1').waitFor();
    const capture = async name => {
      await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      await page.mouse.move(0, 0); await page.waitForTimeout(200);
      const snapshot = await page.locator('.demo-shell').evaluate(root => {
        const props = ['display','opacity','color','backgroundColor','borderTopColor','borderTopWidth','borderRadius','fontSize','fontWeight','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','boxShadow','outlineStyle','outlineWidth'];
        return [...root.querySelectorAll('*')].filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden').map(el => {
          const r = el.getBoundingClientRect(), s = getComputedStyle(el);
          return { tag: el.tagName, class: el.getAttribute('class'), rect: [r.x,r.y,r.width,r.height].map(n => Math.round(n * 100)/100), style: Object.fromEntries(props.map(p => [p,s[p]])) };
        });
      });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${name} overflow`);
      report.snapshots.push({ width, name, elements: snapshot });
      if (width >= 800 || name === 'overview') {
        const file = `${width}-${name}.png`; await page.screenshot({ path: path.join(output,file), fullPage: true });
        const bytes = await readFile(path.join(output,file));
        report.screenshots.push({ file, viewport: { width, height:960 }, capturedAt: new Date().toISOString(), sha256:createHash('sha256').update(bytes).digest('hex') });
      }
    };
    await capture('overview');
    if (await page.locator('.demo-sidebar-toggle').getAttribute('aria-expanded') === 'false') await page.locator('.demo-sidebar-toggle').click();
    await page.locator('.demo-group-toggle').filter({ hasText:'历史复盘' }).click(); await capture('expanded');
    await page.locator('.demo-sidebar-toggle').click(); await capture('collapsed');
    await navigateDemo(page,'SYN-01 · 合成公司 01','行业与个股'); await capture('decision');
    await page.getByRole('button',{name:'预览决策确认 · SYN-01',exact:true}).click(); await capture('confirmation');
    await page.getByRole('button',{name:'本人确认此版本合成建议及条件',exact:true}).click();
    await page.getByRole('button',{name:'演练建议更新 · SYN-01',exact:true}).click();
    await navigateDemo(page,'决策确认历史','历史复盘'); await capture('history');
    await navigateDemo(page,'知识库索引','行业与个股'); await capture('knowledge');
    await navigateDemo(page,'超跌模拟','超跌模拟'); await page.getByRole('button',{name:'新建合成轮次',exact:true}).click();
    for (let n=1;n<=20;n++) await page.getByRole('checkbox',{name:`选择 SYN-${String(n).padStart(2,'0')}`,exact:true}).check();
    await page.getByLabel('我确认本轮合成参数；不表示真实交易口径已获批准',{exact:true}).check(); await capture('selection');
    await page.getByRole('button',{name:'预览锁定20只',exact:true}).click(); await capture('lock-preview');
    await page.getByRole('button',{name:'确认本轮',exact:true}).click();
    for(let n=0;n<20;n++) await page.getByRole('button',{name:'推进下一合成交易日',exact:true}).click();
    await capture('pending-exit');
    await context.close();
  }
  assert.equal(report.errors.length,0); assert.equal(report.unexpectedRequests.length,0); report.status='passed';
} catch(e) { report.status='failed';report.failure=String(e);process.exitCode=1; }
finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({status:report.status,snapshots:report.snapshots.length,screenshots:report.screenshots.length,failure:report.failure,output}));
