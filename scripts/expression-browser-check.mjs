// Real retained runtime; isolated temporary browser storage only.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-3-r3/real-browser');
const report = { scope: 'ISOLATED_REAL_RETAINED', checks: [], errors: [], screenshots: [], real: null, sourceSha256: {} };
for (const file of ['contracts/investment-expression/v1/expression.schema.json','src/services/expressionValidator.generated.mjs','src/types/investmentExpression.ts','src/services/investmentExpression.ts','src/services/expressionRepository.ts','src/services/expressionWorkspace.ts','src/components/research/ExpressionWorkspace.tsx','src/components/research/ThesisWorkspace.tsx']) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex');
await fs.mkdir(output, { recursive: true });
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const key = 'investment-research-dashboard.expression.v1';
const bytes = page => page.evaluate(() => Object.fromEntries(['claim','thesis','expression'].map(k => [k,localStorage.getItem(`investment-research-dashboard.${k}.v1`)])));
try {
  for (const width of [320,390,1536]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' }), page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${origin}/#/watchlist`);
    const panel = page.getByRole('region', { name: 'Investment Expression V1', exact: true }); await panel.waitFor();
    check(await page.getByTestId('thesis-counts').innerText() === '5 candidates / 0 verifiable / 0 verified / 0 formal Thesis', `real 5/0/0/0 ${width}`);
    check(await panel.getByTestId('expression-counts').innerText() === '0 formal Expression', `real 0 Expression ${width}`);
    report.real = { candidates: 5, verifiable: 0, verified: 0, formalThesis: 0, formalExpression: 0 };
    const original = await bytes(page); check(original.expression === null, `read preserves absent store ${width}`);
    await panel.getByRole('button', { name: '新建 Expression 草稿', exact: true }).click();
    check(await panel.getByLabel('正式 Thesis 精确版本').locator('option').count() === 1, `no invented Thesis choice ${width}`);
    const options = await panel.getByLabel('投资标的', { exact: true }).locator('option').allTextContents();
    check(!options.some(o => /ETF|Index|synthetic/.test(o)), `no fake ETF/Index or synthetic owner ${width}`);
    await panel.getByLabel('Expression 修订说明').fill('Synthetic acceptance text in isolated real runtime; blocked draft only');
    await panel.getByRole('button', { name: '保存 Expression 草稿' }).click();
    const saved = await bytes(page), data = JSON.parse(saved.expression);
    check(data.confirmations.length === 0 && data.revisions.length === 1 && data.revisions[0].scope === 'real', `draft only ${width}`);
    check(saved.claim === original.claim && saved.thesis === original.thesis, `no Claim/Thesis writes ${width}`);
    await panel.getByRole('button', { name: '生成 Expression 确认预览' }).click();
    await panel.getByLabel('Expression 本人确认说明').fill('Cannot bypass missing formal support');
    check(await panel.getByRole('button', { name: '本人确认正式 Expression' }).isDisabled(), `formal confirmation blocked ${width}`);
    check(JSON.stringify(await bytes(page)) === JSON.stringify(saved), `preview read-only ${width}`);
    await panel.getByText('Expression 版本历史与 diff（1）').click();
    check(JSON.stringify(await bytes(page)) === JSON.stringify(saved), `history read-only ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `viewport fits ${width}`);
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), `reduced motion ${width}`);
    const file = `expression-real-${width}.png`; await page.screenshot({path: path.join(output,file),fullPage:true}); report.screenshots.push(file);
    await page.reload(); await panel.waitFor(); check(JSON.stringify(await bytes(page)) === JSON.stringify(saved), `reload exact bytes ${width}`);
    check(JSON.parse(await page.evaluate(k => localStorage.getItem(k),key)).confirmations.length === 0, `no formal on reload ${width}`);
    await context.close();
  }
  check(report.errors.length === 0, 'zero runtime errors'); report.status = 'PASS';
} catch(e) { report.status='FAIL';report.failure=String(e);process.exitCode=1; }
finally { await browser.close(); await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,output}));
