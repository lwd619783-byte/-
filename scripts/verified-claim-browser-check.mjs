// Isolated real-retained Industry acceptance. No user profile, external requests or true Verified sample.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-3-r1/claim-browser');
const report = { base: execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim(), generatedAt: new Date().toISOString(),
  sourceSha256: {}, checks: [], errors: [], screenshots: [], scope: 'ISOLATED_RETAINED_INDUSTRY_NO_ADMISSION' };
for (const file of ['src/services/verifiedClaim.ts', 'src/services/verifiedClaimRepository.ts', 'src/services/industryVerifiedClaimAdapter.ts',
  'src/services/verifiedClaimValidator.generated.mjs', 'src/services/evidenceGraph.mjs', 'src/services/industrySignalClaim.mjs',
  'src/components/industry/IndustrySignalClaimPanel.tsx', 'src/components/research/ClaimVerificationModal.tsx']) {
  report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
}
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await fs.mkdir(output, { recursive: true });
try {
  for (const theme of ['light']) for (const width of [320, 390, 1536]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    for (const industry of ['oil-shipping', 'robotics']) {
      const name = `${industry}-${theme}-${width}`;
      await page.goto(`${origin}/#/industry?industry=${industry}`);
      await page.getByRole('tab', { name: '指标与变化', exact: true }).click();
      check(await page.locator('html').getAttribute('data-theme') === 'light', 'current single-light appearance');
      const panel = page.getByRole('region', { name: '派生信号与景气判断资格', exact: true });
      await panel.locator('article').first().waitFor();
      const candidates = panel.getByRole('button', { name: '验证主张与历史' });
      check(await candidates.count() === (industry === 'oil-shipping' ? 4 : 1), `candidate count ${name}`);
      // Every retained candidate is exercised on the desktop; mobile covers each industry and theme.
      const count = width === 1536 ? await candidates.count() : 1;
      for (let i = 0; i < count; i++) {
        await candidates.nth(i).click();
        const modal = page.getByRole('dialog', { name: '主张验证与历史' }); await modal.waitFor();
        check((await modal.innerText()).includes('阻断，不可确认为已验证'), `blocked gate ${name}-${i}`);
        check(!await modal.locator('[data-advanced-audit]').evaluate(e => e.open), `collapsed pins ${name}-${i}`);
        check(await page.evaluate(() => localStorage.getItem('investment-research-dashboard.claim.v1')) === null || i > 0 || industry === 'robotics', `opening is read only ${name}-${i}`);
        await modal.getByRole('button', { name: '查看原始证据' }).click();
        const drawer = page.getByRole('dialog').filter({ hasNot: page.getByRole('heading', { name: '主张验证与历史', exact: true }) }); await drawer.waitFor();
        check((await drawer.innerText()).includes('候选结论 → 派生信号'), `original Drawer ${name}-${i}`);
        await page.keyboard.press('Escape');
        await modal.getByLabel('背景标题').fill('Synthetic browser context');
        await modal.getByLabel('背景链接').fill('https://example.com/synthetic-browser-context');
        await modal.getByLabel('修订或审核说明').fill('Synthetic local acceptance; actual retained blockers remain.');
        await modal.getByRole('button', { name: '保存候选草稿' }).click();
        await modal.getByRole('button', { name: '生成验证预览' }).click();
        check(await modal.getByRole('button', { name: '本人确认已验证' }).isDisabled(), `user cannot override ${name}-${i}`);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `viewport fits ${name}-${i}`);
        check(await modal.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `modal fits ${name}-${i}`);
        if (i === 0 && industry === 'oil-shipping' && [320, 390, 1536].includes(width)) {
          const file = `${name}.png`; await page.screenshot({ path: path.join(output, file) }); report.screenshots.push(file);
        }
        await modal.getByRole('button', { name: '本人确认拒绝' }).click();
        check((await modal.innerText()).includes('当前主张：已拒绝'), `rejection history ${name}-${i}`);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('investment-research-dashboard.claim.v1')));
        check(stored.reviews.every(r => r.decision === 'REJECTED') && stored.revisions.every(r => r.origin === 'ai_draft' && r.generation === 'TEMPLATE'), `zero verified and origin retained ${name}-${i}`);
        await page.keyboard.press('Escape');
        await candidates.nth(i).click(); await modal.waitFor();
        check((await modal.innerText()).includes('当前主张：已拒绝'), `reload history ${name}-${i}`);
        await page.keyboard.press('Escape');
      }
    }
    await context.close();
  }
  check(report.errors.length === 0, 'no runtime errors');
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.ok), errors: report.errors, screenshots: report.screenshots.length }));
