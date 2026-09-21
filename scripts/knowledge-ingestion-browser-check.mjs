/** Disposable profiles and synthetic fixtures only; real IndexedDB, PDF worker and UI review. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { createServer } from 'node:http';
import { createBridgeHandler } from '../server/research-bridge/http.mjs';
import { ResearchStaging } from '../server/research-bridge/domain.mjs';
import { privateStoreFixture } from './tests/private-blob.fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4175';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-3-slice-2-5/browser'); await fs.mkdir(output, { recursive: true });
const report = { runtimeSha: process.env.UI_REVIEW_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_DEPLOYMENT_ID || null, origin, testedAt: new Date().toISOString(), inputType: 'isolated-synthetic', checks: [], errors: [], externalRequests: [], screenshots: [] };
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw new Error(name); };
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
let bridgeServer;
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', req => { if (!req.url().startsWith(origin) && !/^(blob:|data:)/.test(req.url())) report.externalRequests.push(req.url()); });
const nav = name => page.getByRole('navigation', { name: '研究记忆视图' }).getByRole('button', { name, exact: true }).click();
const state = () => page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('investment-research-dashboard.knowledge-ingestion.v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const value = await new Promise(resolve => { const r = db.transaction('state').objectStore('state').get('current'); r.onsuccess = () => resolve(r.result); }); db.close(); return value; });
const wiki = () => page.evaluate(() => JSON.parse(localStorage.getItem('investment-research-dashboard.wiki.v1')));
function pdf() {
  const stream1 = deflateSync(Buffer.from('BT /F1 16 Tf 50 700 Td (Synthetic optical first page) Tj /F2 16 Tf 0 -24 Td <414243> Tj ET'));
  const stream2 = deflateSync(Buffer.from('BT /F1 16 Tf 50 700 Td (Second page evidence) Tj ET'));
  const cmap = Buffer.from('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Synthetic) /Ordering (UCS) /Supplement 0 >> def /CMapName /SyntheticUnicode def /CMapType 2 def 1 begincodespacerange <00> <ff> endcodespacerange 3 beginbfchar <41> <5149> <42> <901a> <43> <4fe1> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 8 0 R >> >> /Contents 6 0 R >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', ...[stream1, stream2].map(b => Buffer.concat([Buffer.from(`<< /Length ${b.length} /Filter /FlateDecode >>\nstream\n`), b, Buffer.from('\nendstream')])), '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 65 /LastChar 67 /Widths [600 600 600] /ToUnicode 9 0 R >>', Buffer.concat([Buffer.from(`<< /Length ${cmap.length} >>\nstream\n`), cmap, Buffer.from('\nendstream')])];
  const pieces = [Buffer.from('%PDF-1.4\n')], offsets = [0]; let size = pieces[0].length;
  objects.forEach((obj, i) => { offsets.push(size); const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.from(obj), Buffer.from('\nendobj\n')]); pieces.push(chunk); size += chunk.length; });
  pieces.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`)); return Buffer.concat(pieces);
}
const headings = ['核心判断', '产业与主题结构', '近期变化', '关键公司与环节', '风险与待验证问题', '来源'];
const markdownFixture = '\n\n**中文重点**与*待验证假设*。\n\n- 材料环节\n- 光电器件\n\n1. 核对来源\n2. 保留未知\n\n> 这是合成引用。\n\n[公开链接](https://example.com/source) 与 `inline < code`\n\n```js\nwindow.__wikiExecuted = true;\n```\n\n<script>window.__wikiExecuted = true</script>\n\n<img src="https://example.com/tracker" onerror="window.__wikiExecuted=true">\n\n![图片说明](https://example.com/image.png)\n\n| ' + Array.from({ length: 12 }, (_, i) => `指标${i}`).join(' | ') + ' |\n| ' + Array(12).fill('---').join(' | ') + ' |\n| ' + Array(12).fill('很长的中文证据').join(' | ') + ' |';
function bundle(s, id = 'browser-create', previous) {
  const source = s.sources[0], at = new Date().toISOString(), ref = { schemaVersion: 'research-source-ref.v1', sourceDomain: 'browser-source', sourceId: source.sourceId };
  const citation = { sourceRef: ref, locator: source.parse.segments[0].locator, quote: source.parse.segments[0].text };
  return { schemaVersion: 'knowledge-contribution.v1', bundleId: id, batchId: s.batches[0].batchId, createdAt: at, sourceRefs: [{ sourceRef: ref, sha256: source.sha256 }], extractions: [], knowledgeAtoms: [], conflicts: [], uncertainty: ['合成资料，不作投资依据'],
    proposals: [{ proposalId: 'proposal-1', action: previous ? 'UPDATE' : 'CREATE', wikiId: previous?.wikiId ?? null, baseRevisionId: previous?.revisionId ?? null, wikiType: 'INDUSTRY_KNOWLEDGE', document: { title: '光通信产业链', summary: id, bodyMarkdown: headings.map((h, i) => `## ${h}\n\n${id} 完整研究内容，来自合成测试资料，需要进一步核验。${i === 0 ? markdownFixture : ''}`).join('\n\n') }, changes: [{ section: '核心判断', kind: previous ? 'MODIFY' : 'ADD', summary: '整理完整文章', citations: [citation] }], citations: [citation], extractionIds: [], linkedWikiIds: [], uncertainty: ['尚未核验'], rationale: '合成浏览器验收' }] };
}
async function checkMarkdown(container, label) {
  check(await container.getByRole('heading', { name: '核心判断', exact: true }).count() > 0, `${label} Markdown heading`);
  check(await container.locator('strong').filter({ hasText: '中文重点' }).count() > 0 && await container.locator('em').filter({ hasText: '待验证假设' }).count() > 0, `${label} Chinese emphasis`);
  check(await container.locator('ul li').count() >= 2 && await container.locator('ol li').count() >= 2, `${label} semantic lists`);
  check(await container.locator('blockquote').filter({ hasText: '这是合成引用' }).count() > 0 && await container.locator('pre code').count() > 0, `${label} quote and code`);
  check(await container.locator('img, iframe, script').count() === 0 && await page.evaluate(() => !window.__wikiExecuted), `${label} hostile HTML and code inert`);
  const region = container.getByRole('region', { name: '正文表格（可横向滚动）' }).first();
  check(await region.getByRole('columnheader').count() === 12, `${label} GFM table`);
  await page.setViewportSize({ width: 390, height: 844 });
  check(await region.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto'), `${label} table scrolls independently`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} narrow page stays within viewport`);
  await page.setViewportSize({ width: 1536, height: 960 });
}
const importBundle = async value => { await nav('AI 整理'); await page.getByLabel('选择研究贡献包').setInputFiles({ name: 'contribution-bundle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }); await page.getByRole('heading', { name: '审核 AI 建议' }).waitFor(); };
const accept = async (edit = false) => {
  await page.getByRole('button', { name: '查看与审核', exact: true }).click(); const dialog = page.getByRole('dialog');
  check(await dialog.getByRole('heading', { name: 'AI 建议的完整新版本' }).isVisible(), 'full proposed article shown');
  check(await dialog.getByRole('button', { name: '接受', exact: true }).isDisabled(), 'review requires note');
  await checkMarkdown(dialog, edit ? 'UPDATE review' : 'CREATE review');
  if (edit) { await dialog.getByRole('button', { name: '修改后接受', exact: true }).click(); await dialog.getByLabel('文章摘要', { exact: true }).fill('用户核对后的完整新版本'); }
  await dialog.getByLabel('审核说明').fill('已核对合成原文与文章'); await dialog.getByRole('button', { name: edit ? '接受修改后的版本' : '接受', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
};
try {
  await page.goto(`${origin}/#/memory`); await page.getByLabel('选择多份文件').waitFor();
  check(await page.getByText('① 添加资料 → ② AI 整理 → ③ 审核建议 → ④ 进入知识库').isVisible(), 'empty profile first-use steps visible');
  check(await page.getByRole('heading', { name: '添加资料', exact: true }).isVisible(), 'add material is primary first action');
  const files = [{ name: 'two-pages.pdf', mimeType: 'application/pdf', buffer: pdf() }, ...Array.from({ length: 9 }, (_, i) => ({ name: `中文研究-${i}.${i % 2 ? 'txt' : 'md'}`, mimeType: i % 2 ? 'text/plain' : 'text/markdown', buffer: Buffer.from(`合成资料 ${i}\r\n光通信测试内容`) }))];
  await page.getByLabel('选择多份文件').setInputFiles(files);
  await page.getByText('已保存 10 份原件。', { exact: false }).waitFor({ timeout: 60000 });
  let s = await state(); check(s.batches.length === 1 && s.sources.length === 10, 'ten files form one batch');
  check(s.sources.every(row => row.parse.status === 'parsed'), 'PDF MD TXT parsed successfully');
  check(s.sources[0].parse.segments.length === 2 && s.sources[0].parse.segments[1].locator === 'page:2' && s.sources[0].parse.segments[1].text.includes('Second page'), 'compressed PDF page extraction locators');
  check(s.sources[0].parse.segments[0].text.replace(/\s/g, '').includes('光通信'), 'embedded Unicode mapping extracts Chinese PDF text');
  for (let i = 0; i < files.length; i++) check(s.sources[i].sha256 === createHash('sha256').update(files[i].buffer).digest('hex'), `exact raw byte digest ${i}`);
  await page.reload(); await page.getByText('two-pages.pdf', { exact: true }).waitFor(); s = await state(); check(s.sources.length === 10, 'raw originals retained after reload');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '下载原件', exact: true }).first().click(); const d = await download; const downloaded = await d.path(); check((await fs.readFile(downloaded)).equals(files[0].buffer), 'downloaded PDF byte equality after reload');
  await nav('AI 整理'); check(await page.getByText('AI 分析服务尚未连接', { exact: true }).isVisible(), 'no fake provider results'); check(await page.getByRole('button', { name: '发送给 ChatGPT', exact: true }).isDisabled(), 'staging requires explicit credential and click');
  const first = bundle(s); await importBundle(first); check((await wiki()) === null, 'unreviewed proposal never creates Wiki'); await accept();
  let w = await wiki(); check(w.entries.length === 1 && w.revisions.length === 1 && w.reviews.length === 1, 'accept uses existing revision/review authority');
  await nav('我的知识库'); await page.getByRole('heading', { name: '光通信产业链', exact: true }).waitFor(); check(await page.getByRole('heading', { name: '核心判断', exact: true }).isVisible(), 'full article readable');
  const second = bundle(s, 'browser-update', w.revisions[0]); await importBundle(second); await accept(true); w = await wiki();
  check(w.entries.length === 1 && w.revisions.length === 2 && w.reviews.length === 2, 'UPDATE preserves identity and full history'); check(w.revisions[1].summary === '用户核对后的完整新版本' && w.revisions[0].bodyMarkdown === first.proposals[0].document.bodyMarkdown, 'edit then accept retains old complete document');
  await nav('我的知识库'); await page.getByRole('heading', { name: '时间与版本演化' }).waitFor();
  await checkMarkdown(page.getByRole('article', { name: '文章详情' }), 'Wiki detail');
  const history = page.getByRole('article', { name: '文章详情' }).locator('details').filter({ has: page.locator('summary', { hasText: '光通信产业链 · 已审核' }) }).first();
  await history.locator('summary').click(); await checkMarkdown(history, 'Wiki history'); await history.locator('summary').click();
  for (const theme of ['light']) for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 }); check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), `${theme}/${width} single light appearance`); check(await page.getByLabel('外观', { exact: true }).count() === 0, `${theme}/${width} no appearance switch`);
    for (const name of ['原始资料', 'AI 整理', '待审核', '我的知识库']) { await nav(name); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width}/${name} no horizontal overflow`); }
    const filename = `${theme}-${width}.png`; await page.screenshot({ path: path.join(output, filename), fullPage: true }); report.screenshots.push(filename);
  }
  await page.setViewportSize({ width: 1280, height: 960 }); await nav('原始资料'); await page.getByLabel('选择多份文件').setInputFiles(files[0]); await page.getByRole('alert').filter({ hasText: '重复' }).waitFor(); check((await state()).sources.length === 10, 'duplicate upload no partial write');
  await page.getByLabel('选择多份文件').setInputFiles({ name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid PDF synthetic') }); await page.getByText('解析失败，原件已保存', { exact: false }).waitFor(); check((await state()).sources.length === 11, 'failed parsing retains original');
  // Audit R2: real UI + IndexedDB + production HTTP/domain/repository with isolated synthetic Blob transport.
  const mixedFiles = [...Array.from({ length: 9 }, (_, i) => ({ name: `混合资料-${i}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`混合恢复研究 ${i} 光通信😀`) })), { name: '混合失败.pdf', mimeType: 'application/pdf', buffer: Buffer.from('mixed invalid PDF synthetic') }];
  mixedFiles[0] = { name: '混合资料-0.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([pdf(), Buffer.from('\n% distinct synthetic original')]) };
  await page.getByLabel('选择多份文件').setInputFiles(mixedFiles); await page.getByText('已保存 10 份原件。', { exact: false }).waitFor();
  s = await state(); const mixedBatch = s.batches.at(-1), mixedSources = s.sources.filter(row => row.batchId === mixedBatch.batchId);
  check(mixedSources.filter(row => row.parse.status === 'parsed').length === 9 && mixedSources[9].parse.status === 'failed', 'mixed batch nine parsed one failed');
  await page.reload(); await page.getByText('混合失败.pdf', { exact: true }).waitFor();
  const failedDownload = page.waitForEvent('download'); await page.getByRole('listitem').filter({ has: page.getByRole('button', { name: '混合失败.pdf', exact: true }) }).getByRole('button', { name: '下载原件', exact: true }).click({ noWaitAfter: true });
  check((await fs.readFile(await (await failedDownload).path())).equals(mixedFiles[9].buffer), 'failed PDF exact bytes downloadable after reopening');
  const { store } = privateStoreFixture(), staging = new ResearchStaging(store, 'personal-owner');
  const syntheticSecret = 'synthetic-browser-only-owner-secret-32';
  const testEnv = { BRIDGE_ENABLED: 'true', BRIDGE_ORIGIN: 'https://synthetic.example', BRIDGE_OWNER_SECRET: syntheticSecret, BRIDGE_SIGNING_SECRET: 'synthetic-browser-only-signing-secret-32', BLOB_STORE_ID: 'synthetic', BRIDGE_OAUTH_REDIRECT_URIS: 'https://chatgpt.com/connector/oauth/synthetic-test' };
  bridgeServer = createServer(createBridgeHandler({ env: testEnv, store })); await new Promise(resolve => bridgeServer.listen(0, '127.0.0.1', resolve));
  const sent = [];
  await page.route('**/api/bridge/**', async route => {
    const req = route.request(), url = new URL(req.url()); sent.push({ action: url.pathname, value: req.postDataJSON() });
    const response = await fetch(`http://127.0.0.1:${bridgeServer.address().port}${url.pathname}${url.search}`, { method: req.method(), headers: { 'content-type': 'application/json', 'x-bridge-owner-secret': syntheticSecret }, body: req.postData() ?? undefined });
    if (!response.ok) report.bridgeFailedAction = url.pathname;
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  await nav('AI 整理'); await page.getByLabel('研究桥访问密钥', { exact: true }).fill(syntheticSecret);
  check(await page.getByRole('button', { name: '发送给 ChatGPT', exact: true }).isDisabled(), 'selection is explicit even with valid credential');
  await page.getByRole('button', { name: '选择全部已解析资料', exact: true }).click();
  check(await page.getByRole('checkbox', { name: '混合失败.pdf（解析失败，原件保留）', exact: true }).isDisabled(), 'failed PDF cannot be selected');
  await page.getByRole('checkbox', { name: '混合资料-8.txt（已解析）', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: '光通信产业链（含已审核历史版本）', exact: true }).check();
  check(await page.getByText('未发送清单：混合资料-8.txt、混合失败.pdf', { exact: true }).isVisible(), 'omitted successful and failed files explicitly disclosed');
  check(sent.length === 0 && await page.getByRole('button', { name: '发送给 ChatGPT', exact: true }).isDisabled(), 'nothing sent before list confirmation');
  await page.getByRole('checkbox', { name: '我已核对清单，仅发送所选 8 份资料，保留 2 份不发送', exact: true }).check();
  await page.getByRole('button', { name: '发送给 ChatGPT', exact: true }).click(); await page.getByText('所选 8 份资料已可供 ChatGPT 只读研究；2 份未发送。', { exact: false }).waitFor();
  const stageId = await page.evaluate(id => localStorage.getItem(`research-bridge.stage.v1:${id}`), mixedBatch.batchId), manifest = await staging.manifest(stageId);
  check(manifest.batchId === mixedBatch.batchId && manifest.sourceMetadata.length === 8 && manifest.sourceMetadata.every(m => mixedSources.some(s => s.sourceId === m.sourceId && s.sha256 === m.sha256)), 'subset manifest preserves original batch source identities and digest');
  check((await staging.source(stageId, mixedSources[0].sourceId)).segments[1].locator === 'page:2', 'actual browser parsed PDF page survives staging digest validation');
  check(!JSON.stringify(sent).includes(mixedSources[8].sourceId) && !JSON.stringify(sent).includes(mixedSources[9].sourceId), 'unselected source identities and content never transmitted');
  for (const source of mixedSources.slice(8)) { let denied = false; try { await staging.source(stageId, source.sourceId); } catch { denied = true; } check(denied, `omitted source unreadable ${source.filename}`); }
  check((await staging.knowledge(stageId, w.entries[0].wikiId)).revisions.length === 2, 'selected knowledge includes full reviewed history');
  const returned = bundle({ sources: mixedSources, batches: [mixedBatch] }, 'mixed-return', w.revisions[1]);
  await importBundle(returned); check((await wiki()).revisions.length === 2, 'subset contribution remains pending'); await accept();
  check((await wiki()).entries.length === 1 && (await wiki()).revisions.length === 3, 'subset contribution accepted with original identity and full revision');
  check((await state()).sources.filter(row => row.batchId === mixedBatch.batchId).length === 10, 'subset sending and accepting preserve all ten originals');
  await nav('AI 整理'); await page.getByLabel('研究桥访问密钥', { exact: true }).fill(syntheticSecret);
  await page.getByRole('button', { name: '撤销 ChatGPT 访问', exact: true }).click(); await page.getByText('已撤销本批此前全部暂存的资料与知识访问。', { exact: false }).waitFor();
  check((await staging.status(stageId)).status === 'revoked' && sent.some(row => row.action.endsWith('/revoke-batch')), 'real user revoke-batch action denies known stage');
  for (const theme of ['light']) for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 }); check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), `${theme}/${width} single light appearance`); check(await page.getByLabel('外观', { exact: true }).count() === 0, `${theme}/${width} no appearance switch`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width} mixed selection no horizontal overflow`);
    const filename = `mixed-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, filename), fullPage: true }); report.screenshots.push(filename);
  }
  check(report.errors.length === 0, 'no runtime errors'); check(report.externalRequests.length === 0, 'no external requests without explicit staging');
} catch (error) { report.failure = String(error); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); report.failureUi = await page.locator('body').innerText(); throw error; }
finally { bridgeServer?.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(c => c.ok).length, errors: report.errors, failure: report.failure, output })); }
