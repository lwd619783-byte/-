/** Disposable profiles and synthetic fixtures only; real IndexedDB, PDF worker and UI review. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4175';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-3-slice-2-5/browser'); await fs.mkdir(output, { recursive: true });
const report = { checks: [], errors: [], externalRequests: [], screenshots: [] };
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw new Error(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
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
function bundle(s, id = 'browser-create', previous) {
  const source = s.sources[0], at = new Date().toISOString(), ref = { schemaVersion: 'research-source-ref.v1', sourceDomain: 'browser-source', sourceId: source.sourceId };
  const citation = { sourceRef: ref, locator: source.parse.segments[0].locator, quote: source.parse.segments[0].text };
  return { schemaVersion: 'knowledge-contribution.v1', bundleId: id, batchId: s.batches[0].batchId, createdAt: at, sourceRefs: [{ sourceRef: ref, sha256: source.sha256 }], extractions: [], knowledgeAtoms: [], conflicts: [], uncertainty: ['合成资料，不作投资依据'],
    proposals: [{ proposalId: 'proposal-1', action: previous ? 'UPDATE' : 'CREATE', wikiId: previous?.wikiId ?? null, baseRevisionId: previous?.revisionId ?? null, wikiType: 'INDUSTRY_KNOWLEDGE', document: { title: '光通信产业链', summary: id, bodyMarkdown: headings.map(h => `## ${h}\n\n${id} 完整研究内容，来自合成测试资料，需要进一步核验。`).join('\n\n') }, changes: [{ section: '核心判断', kind: previous ? 'MODIFY' : 'ADD', summary: '整理完整文章', citations: [citation] }], citations: [citation], extractionIds: [], linkedWikiIds: [], uncertainty: ['尚未核验'], rationale: '合成浏览器验收' }] };
}
const importBundle = async value => { await nav('AI 整理'); await page.getByLabel('选择研究贡献包').setInputFiles({ name: 'contribution-bundle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }); await page.getByRole('heading', { name: '审核 AI 建议' }).waitFor(); };
const accept = async (edit = false) => {
  await page.getByRole('button', { name: '查看与审核', exact: true }).click(); const dialog = page.getByRole('dialog');
  check(await dialog.getByRole('heading', { name: 'AI 建议的完整新版本' }).isVisible(), 'full proposed article shown');
  check(await dialog.getByRole('button', { name: '接受', exact: true }).isDisabled(), 'review requires note');
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
  for (const theme of ['neon', 'pro', 'light']) for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 }); await page.getByLabel('外观', { exact: true }).selectOption(theme);
    for (const name of ['原始资料', 'AI 整理', '待审核', '我的知识库']) { await nav(name); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width}/${name} no horizontal overflow`); }
    const filename = `${theme}-${width}.png`; await page.screenshot({ path: path.join(output, filename), fullPage: true }); report.screenshots.push(filename);
  }
  await page.setViewportSize({ width: 1280, height: 960 }); await nav('原始资料'); await page.getByLabel('选择多份文件').setInputFiles(files[0]); await page.getByRole('alert').filter({ hasText: '重复' }).waitFor(); check((await state()).sources.length === 10, 'duplicate upload no partial write');
  await page.getByLabel('选择多份文件').setInputFiles({ name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid PDF synthetic') }); await page.getByText('解析失败，原件已保存', { exact: false }).waitFor(); check((await state()).sources.length === 11, 'failed parsing retains original');
  check(report.errors.length === 0, 'no runtime errors'); check(report.externalRequests.length === 0, 'no external requests without explicit staging');
} catch (error) { report.failure = String(error); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); report.failureUi = await page.locator('body').innerText(); throw error; }
finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(c => c.ok).length, errors: report.errors, failure: report.failure, output })); }
