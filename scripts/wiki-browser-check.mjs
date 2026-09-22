/** Disposable browser acceptance. Synthetic owner data; no user profile or external acquisition. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-3-slice-2/browser');
await fs.mkdir(output, { recursive: true });
const key = 'investment-research-dashboard.wiki.v1', creatorKey = 'investment-research-dashboard.creator-viewpoint.v1';
// Compile the existing synthetic fixture locally so acceptance works on a static build too.
// Only its data crosses into the disposable browser; no development modules are injected.
const fixtureModule = await build({ entryPoints: ['src/services/creatorViewpoint.fixture.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { creatorViewpointFixture } = await import(`data:text/javascript;base64,${Buffer.from(fixtureModule.outputFiles[0].text).toString('base64')}`);
const report = { runtimeSha: process.env.UI_REVIEW_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_DEPLOYMENT_ID || null, origin, testedAt: new Date().toISOString(), inputType: 'isolated-synthetic', checks: [], errors: [], warnings: [], externalRequests: [], screenshots: [], downloads: [], sourceSha256: {} };
for (const file of ['src/services/wiki.ts', 'src/services/wikiRepository.ts', 'src/services/wikiProjection.ts', 'src/services/wikiOwners.ts', 'src/components/research-memory/ResearchMemoryWorkspace.tsx', 'src/components/research-memory/WikiRevisionForm.tsx', 'src/components/research-memory/WikiBackupModal.tsx']) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); report.checks.push({ ok, name }); if (!ok) throw new Error(name); };
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'msedge', headless: true });
const contexts = [];
const fresh = async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1536, height: 960 }, acceptDownloads: true }); contexts.push(context);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { if (message.location().url.endsWith('/favicon.ico')) report.warnings.push('existing favicon.ico 404'); else report.errors.push(message.text()); } });
  page.on('request', request => { if (![origin, 'blob:', 'data:'].some(prefix => request.url().startsWith(prefix))) report.externalRequests.push(request.url()); });
  await page.goto(`${origin}/#/knowledge`); await page.getByRole('heading', { name: '文章库', exact: true }).waitFor(); await page.getByRole('button', { name: '更多操作', exact: true }).click();
  check(await page.locator('vite-error-overlay').count() === 0, 'no Vite overlay'); return page;
};
const workspace = page => page.getByRole('region', { name: '知识库文章区', exact: true });
const details = page => page.getByRole('article', { name: '文章详情' });
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const refresh = page => workspace(page).getByRole('button', { name: '刷新历史', exact: true }).click({ noWaitAfter: true });
const maintenance = async page => { const button = workspace(page).getByRole('button', { name: '更多操作', exact: true }); if (await button.getAttribute('aria-expanded') !== 'true') await button.click(); };
const navigate = async (page, name) => { const routes = { '原始资料': '#/sources', 'AI 整理': '#/sources?view=organize', '研究桥': '#/sources?view=bridge', '待审核': '#/tasks?view=review', '我的知识库': '#/knowledge' }; await page.evaluate(hash => { window.location.hash = hash; }, routes[name]); if (name === '我的知识库') await page.getByRole('heading', { name: '文章库', exact: true }).waitFor(); else if (name === '待审核') await page.getByRole('heading', { name: '审核 AI 建议' }).waitFor(); else await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed=true]')).waitFor(); };
const shot = async (page, name) => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false }); report.screenshots.push(`${name}.png`); };
const download = async (page, label, filename) => { const wait = page.waitForEvent('download'); await workspace(page).getByRole('button', { name: label, exact: true }).click({ noWaitAfter: true }); const file = await wait; check(await file.failure() === null, `${filename} downloaded`); const target = path.join(output, filename); await file.saveAs(target); report.downloads.push(filename); return target; };
const reviewDraft = async (page, title, decision = 'reviewed') => {
  const history = details(page).locator('details').filter({ has: page.locator('summary', { hasText: `${title} · 待审核` }) });
  await history.locator(':scope > summary').click({ noWaitAfter: true }); await history.getByRole('button', { name: decision === 'reviewed' ? '审核此修订' : '拒绝此修订', exact: true }).click({ noWaitAfter: true });
  const dialog = page.getByRole('dialog', { name: '确认文章审核' });
  check(await dialog.getByRole('button', { name: '确认追加审核记录' }).isDisabled(), 'review needs explicit note');
  await dialog.getByLabel('审核说明').fill('Synthetic browser quality review'); await dialog.getByRole('button', { name: '确认追加审核记录' }).click({ noWaitAfter: true }); await dialog.waitFor({ state: 'hidden' });
};
try {
  const page = await fresh(), w = workspace(page);
  check(await page.evaluate(key => localStorage.getItem(key) === null, key), 'empty read has no Wiki seed');
  await page.evaluate(({ creatorKey, fixture }) => { localStorage.setItem(creatorKey, JSON.stringify(fixture)); }, { creatorKey, fixture: creatorViewpointFixture() });
  const creatorBefore = await page.evaluate(key => localStorage.getItem(key), creatorKey); await refresh(page);
  await w.getByRole('button', { name: '手工新建文章', exact: true }).click({ noWaitAfter: true }); let dialog = page.getByRole('dialog', { name: '新建 文章草稿' });
  await dialog.getByLabel('文章标题', { exact: true }).fill('UI 合成框架'); await dialog.getByLabel('条目类型', { exact: true }).selectOption('FRAMEWORK'); await dialog.getByLabel('摘要', { exact: true }).fill('合成摘要，仅用于验收');
  await dialog.getByLabel('完整正文', { exact: true }).fill('## Synthetic body\n\nTraceable research memory.'); await dialog.getByLabel('作者来源').selectOption('ai'); await dialog.getByLabel('别名（逗号分隔）').fill('查找别名');
  await dialog.getByRole('group', { name: '原始资料', exact: true }).getByRole('checkbox').first().check(); await dialog.getByRole('group', { name: '提取内容', exact: true }).getByRole('checkbox').first().check();
  await dialog.getByRole('group', { name: '证据', exact: true }).getByRole('checkbox').first().check(); await dialog.getByRole('button', { name: '保存文章草稿' }).click({ noWaitAfter: true }); await dialog.waitFor({ state: 'hidden' });
  let saved = await read(page); const wikiId = saved.entries[0].wikiId, firstRevision = saved.revisions[0].revisionId;
  check(saved.reviews.length === 0, 'new revision is Draft'); check(await details(page).getByText('尚无已审核文章。草稿、拒绝或归档记录保留在下方历史。').count() === 1, 'draft cannot become Current');
  await reviewDraft(page, 'UI 合成框架'); saved = await read(page); const firstCutoff = saved.reviews[0].createdAt;
  check(await details(page).getByText(/当前已审核文章 ·/).count() === 1, 'reviewed Current rendered'); check(await details(page).getByText(/AI 整理，人工审核/).count() === 1, 'AI origin survives review');
  await details(page).getByRole('button', { name: '提取内容 · 已保存研究记录', exact: true }).click({ noWaitAfter: true }); await page.getByRole('dialog').getByText('合成测试摘录，不是任何真实博主观点。').waitFor(); check(await page.getByRole('dialog').getByText('合成测试摘录，不是任何真实博主观点。').count() === 1, 'Wiki to Extraction to Raw Source'); await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click({ noWaitAfter: true });
  await details(page).getByRole('button', { name: /^证据 ·/ }).first().click({ noWaitAfter: true }); await page.getByRole('dialog', { name: '证据核对', exact: true }).waitFor(); check(await page.getByRole('dialog', { name: '证据核对', exact: true }).count() === 1, 'existing Evidence Drawer reused'); await shot(page, 'evidence'); await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click({ noWaitAfter: true });
  await details(page).getByRole('button', { name: '追加修订' }).click({ noWaitAfter: true }); dialog = page.getByRole('dialog', { name: '修订文章' });
  await dialog.getByLabel('文章标题').fill('UI 待拒绝修订'); await dialog.getByLabel('修订原因').fill('Synthetic rejected change'); await dialog.getByRole('button', { name: '保存文章草稿' }).click({ noWaitAfter: true }); await dialog.waitFor({ state: 'hidden' });
  check(await details(page).getByRole('heading', { name: 'UI 合成框架', exact: true }).count() === 1, 'draft preserves previous title'); await reviewDraft(page, 'UI 待拒绝修订', 'rejected'); check(await details(page).getByRole('heading', { name: 'UI 合成框架', exact: true }).count() === 1, 'rejection preserves Current');
  await details(page).getByRole('button', { name: '追加修订' }).click({ noWaitAfter: true }); dialog = page.getByRole('dialog', { name: '修订文章' }); await dialog.getByLabel('文章标题').fill('UI 已审核改名'); await dialog.getByLabel('修订原因').fill('Synthetic title rename'); await dialog.getByRole('button', { name: '保存文章草稿' }).click({ noWaitAfter: true }); await dialog.waitFor({ state: 'hidden' }); await reviewDraft(page, 'UI 已审核改名');
  check((await read(page)).entries[0].wikiId === wikiId, 'rename preserves stable Wiki ID'); check((await read(page)).revisions.find(row => row.title === 'UI 已审核改名').evidenceRefs.length === 1, 'revision form preserves exact Evidence refs after canonical persistence');
  await w.getByRole('button', { name: '手工新建文章', exact: true }).click({ noWaitAfter: true }); dialog = page.getByRole('dialog', { name: '新建 文章草稿' }); await dialog.getByLabel('文章标题').fill('UI 关联概念'); await dialog.getByLabel('完整正文').fill('Synthetic related concept'); await dialog.getByRole('group', { name: '原始资料', exact: true }).getByRole('checkbox').first().check(); await dialog.getByRole('group', { name: '关联文章' }).getByRole('checkbox').check(); await dialog.getByRole('button', { name: '保存文章草稿' }).click({ noWaitAfter: true }); await dialog.waitFor({ state: 'hidden' }); await reviewDraft(page, 'UI 关联概念');
  await details(page).getByRole('button', { name: '关联 · UI 已审核改名', exact: true }).click({ noWaitAfter: true }); check(await details(page).getByRole('button', { name: '反向引用 · UI 关联概念' }).count() === 1, 'formal backlink derived');
  await w.getByRole('button', { name: '返回文章列表' }).click();
  await w.getByLabel('搜索知识库').fill('查找别名'); check(await w.getByLabel('文章列表', { exact: true }).getByRole('button').count() === 1, 'alias search'); await w.getByLabel('搜索知识库').fill('');
  const firstArticle = w.getByLabel('文章列表', { exact: true }).getByRole('button', { name: /UI 已审核改名/ });
  const secondArticle = w.getByLabel('文章列表', { exact: true }).getByRole('button', { name: /UI 关联概念/ });
  const secondWikiId = (await read(page)).revisions.find(row => row.title === 'UI 关联概念').wikiId;
  await firstArticle.click({ noWaitAfter: true }); await page.waitForURL(url => url.hash === `#/knowledge?wiki=${encodeURIComponent(wikiId)}`);
  check(await details(page).getByRole('heading', { name: 'UI 已审核改名', exact: true }).count() === 1, 'first article selection has exact Wiki deep link');
  await w.getByRole('button', { name: '返回文章列表' }).click();
  await secondArticle.click({ noWaitAfter: true }); await page.waitForURL(url => url.hash === `#/knowledge?wiki=${encodeURIComponent(secondWikiId)}`);
  check(await details(page).getByRole('heading', { name: 'UI 关联概念', exact: true }).count() === 1, 'second article selection has distinct exact Wiki deep link');
  await page.goBack({ waitUntil: 'domcontentloaded' }); await w.getByRole('heading', { name: '文章库', exact: true }).waitFor(); check(await firstArticle.isVisible() && await secondArticle.isVisible(), 'browser Back restores article list');
  await page.goBack({ waitUntil: 'domcontentloaded' }); await page.waitForURL(url => url.hash === `#/knowledge?wiki=${encodeURIComponent(wikiId)}`);
  await details(page).getByRole('heading', { name: 'UI 已审核改名', exact: true }).waitFor();
  check(await details(page).getByRole('heading', { name: 'UI 已审核改名', exact: true }).isVisible(), 'browser Back restores first Wiki object');
  await page.reload({ waitUntil: 'load' }); await details(page).getByRole('heading', { name: 'UI 已审核改名', exact: true }).waitFor({ timeout: 30000 });
  check(new URL(page.url()).hash === `#/knowledge?wiki=${encodeURIComponent(wikiId)}` && await details(page).getByRole('heading', { name: 'UI 已审核改名', exact: true }).isVisible(), 'reload preserves selected Wiki identity');
  await maintenance(page);
  await w.getByRole('textbox', { name: /历史查询时间/ }).fill(firstCutoff); await w.getByRole('button', { name: '应用时间视图' }).click({ noWaitAfter: true }); check(await details(page).getByText(new RegExp(firstRevision)).count() >= 1, 'historical exact first reviewed revision'); check(await w.getByRole('button', { name: '手工新建文章' }).isDisabled(), 'historical writes disabled');
  await w.getByRole('textbox', { name: /历史查询时间/ }).fill(''); await w.getByRole('button', { name: '应用时间视图' }).click({ noWaitAfter: true });
  const firstZip = await download(page, '导出到 Obsidian', 'wiki-vault-a.zip'); const secondZip = await download(page, '导出到 Obsidian', 'wiki-vault-b.zip'); check((await fs.readFile(firstZip)).equals(await fs.readFile(secondZip)), 'same read model byte-stable ZIP');
  const extracted = await fs.mkdtemp(path.join(output, 'export-'));
  execFileSync(process.env.UI_REVIEW_PYTHON || 'python', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])', firstZip, extracted]);
  const manifest = JSON.parse(await fs.readFile(path.join(extracted, 'research-wiki/manifest.json'), 'utf8')); check(manifest.pages.length === 2, 'manifest maps both stable IDs');
  const inspectInput = w.getByLabel('校验 Markdown 目录', { exact: true }); await inspectInput.setInputFiles(path.join(extracted, 'research-wiki')); await w.getByText(/与知识库一致 · 缺失 0/).waitFor(); check(true, 'actual exported directory matches Domain');
  const actualPage = path.join(extracted, manifest.pages[0].path); await fs.appendFile(actualPage, '\nExternal edit\n'); const domainBeforeEdit = JSON.stringify(await read(page)); await inspectInput.evaluate(input => { input.value = ''; }); await inspectInput.setInputFiles(path.join(extracted, 'research-wiki')); await w.getByText(/文件已修改或不完整/).waitFor(); check(JSON.stringify(await read(page)) === domainBeforeEdit, 'edited Markdown cannot write back');
  const backupPath = await download(page, '备份全部文章历史', 'wiki-full-backup.json'); const backupRaw = await fs.readFile(backupPath, 'utf8');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForLoadState('load'); await navigate(page, '我的知识库'); await w.waitFor(); check((await read(page)).revisions.length === 4, 'all revision history survives reload');
  for (const theme of ['light']) for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 }); check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), `${theme}/${width} single light appearance`); check(await page.getByLabel('外观', { exact: true }).count() === 0, `${theme}/${width} no appearance switch`);
    for (const view of ['原始资料', 'AI 整理', '研究桥', '待审核', '我的知识库']) { await navigate(page, view); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width}/${view} no horizontal overflow`); }
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), `${theme}/${width} reduced-motion retained`); await shot(page, `${theme}-${width}`);
  }
  await page.setViewportSize({ width: 1536, height: 960 }); await maintenance(page);
  check(await page.evaluate(key => localStorage.getItem(key), creatorKey) === creatorBefore, 'Wiki never writes Source/Extraction/Creator authority');
  await page.evaluate(key => localStorage.setItem(key, '{synthetic corrupt bytes'), key); await refresh(page); check(await w.getByRole('button', { name: '手工新建文章' }).isDisabled(), 'corrupt storage locks writes');
  await w.getByRole('button', { name: '恢复文章存储' }).click({ noWaitAfter: true }); dialog = page.getByRole('dialog', { name: '恢复文章存储' }); await dialog.getByLabel('文章备份内容').fill(backupRaw); await dialog.getByRole('button', { name: '校验文章备份' }).click({ noWaitAfter: true });
  check(await page.evaluate(key => localStorage.getItem(key), key) === '{synthetic corrupt bytes', 'recovery preview no write');
  const preDownload = page.waitForEvent('download'); await dialog.getByRole('button', { name: '备份当前字节并确认导入' }).click({ noWaitAfter: true }); await (await preDownload).saveAs(path.join(output, 'pre-recovery.json')); await dialog.waitFor({ state: 'hidden' });
  check((await read(page)).revisions.length === 4, 'JSON recovery restores full history'); check(await page.evaluate(key => Object.keys(localStorage).some(k => k.startsWith(`${key}.pre-recovery.`) && localStorage.getItem(k) === '{synthetic corrupt bytes'), key), 'corrupt original bytes retained');
  await page.evaluate(key => localStorage.setItem(key, '{"schemaVersion":"wiki.v99"}'), key); await refresh(page); check(await w.getByRole('button', { name: '导入文章备份', exact: true }).isDisabled(), 'future schema cannot be recovered over'); check(await w.getByRole('button', { name: '导出锁定原字节' }).isEnabled(), 'future raw bytes remain exportable');
  const home = await fresh(); await home.goto(`${origin}/#/home`); check(await home.getByRole('navigation', { name: '主要导航', exact: true }).count() === 1, 'home route remains usable');
  check(report.errors.length === 0, 'no browser runtime/console errors'); check(report.externalRequests.length === 0, 'no external requests');
} catch (error) { report.errors.push(error.message); await contexts[0]?.pages()[0]?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); process.exitCode = 1; }
finally { for (const context of contexts) await context.close(); await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(row => row.ok).length, errors: report.errors, warnings: [...new Set(report.warnings)], externalRequests: report.externalRequests.length, screenshots: report.screenshots.length, output })); }
