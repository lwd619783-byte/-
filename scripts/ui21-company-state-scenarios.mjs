import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Complete production App. Replay committed public provider bytes through its
// normal checksum/schema loader; storage entries/faults are explicitly synthetic.
export async function runCompanyStateScenarios({ browser, contexts, report, check, run, route, raw, fingerprint, openExpectation, origin, output }) {
 const key = 'investment-research-dashboard.earnings-expectation.v1';
 const providerDir = 'data/a-share-company-guidance-expectations/';
 const workflow = JSON.parse(await fs.readFile(`public/${providerDir}workflow-index.generated.json`, 'utf8'));
 const providerIds = workflow.records.filter(r => r.snapshot.stockId === 'fii').map(r => r.snapshot.id).sort();
 const company = (id = 'beigene', tab = 'expectations') => `#/company/${id}/${tab}?from=research`;
 const panel = p => p.getByRole('heading', { name: '业绩预期', exact: true }).locator('../..');
 const text = p => panel(p).innerText();
 const articles = p => panel(p).locator('article').allTextContents();
 const snapshot = async p => ({ text: await text(p), articles: await articles(p), route: new URL(p.url()).hash });
 async function page() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' }); contexts.push(context);
  // IO fixtures are public files, not user data. No service/selector/component mock.
  await context.route('**/data/**', async r => {
   const relative = new URL(r.request().url()).pathname;
   if (!/^\/data\/[a-zA-Z0-9_./-]+\.json$/.test(relative) || relative.includes('..')) return r.abort();
   try { const body = await fs.readFile(`public${relative}`); await r.fulfill({ status: 200, contentType: 'application/json', body }); }
   catch { await r.fulfill({ status: 404, body: 'Isolated fixture absent' }); }
  });
  const p = await context.newPage(); p.setDefaultTimeout(15000); p.on('dialog', d => d.accept());
  p.on('pageerror', e => report.errors.push({ scenario: 'P2', message: e.message }));
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) report.console.push({ scenario: 'P2', type: m.type(), text: m.text().slice(0, 1000) }); });
  await p.goto(`${origin}/${company('fii')}`);
  await p.getByText('数据提供方只读', { exact: true }).first().waitFor();
  await settle(p, 'fii');
  return p;
 }
 async function settle(p, id = 'beigene') {
  await route(p, company(id));
  await p.waitForFunction(() => !document.body.textContent.includes('公司官方指引按需加载中'));
  await p.getByRole('heading', { name: '业绩预期', exact: true }).waitFor();
 }
 async function save(p, lower, upper, title = `UI21-P2 isolated synthetic expectation ${lower}-${upper}`) {
  const d = await openExpectation(p, 'beigene'); await d.getByLabel('区间下限', { exact: true }).fill(lower); await d.getByLabel('区间上限', { exact: true }).fill(upper);
  await d.getByLabel('来源标题', { exact: true }).fill(title); await d.getByRole('button', { name: '保存不可变快照', exact: true }).click(); return d;
 }
 async function close(d) { await d.getByRole('button', { name: '取消', exact: true }).click(); await d.waitFor({ state: 'hidden' }); }
 async function shot(p, state) {
  for (const width of [1440, 390]) {
   await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
   const file = `P2-company-${state}-${width}.png`; await p.screenshot({ path: path.join(output, file), fullPage: true });
   report.screenshots.push({ file, kind: report.deploymentId ? 'PROTECTED_PREVIEW' : 'LOCAL_BUILD', origin, runtimeSha: report.runtimeSha, viewport: { width, height: width === 390 ? 844 : 1000 }, route: new URL(p.url()).hash, state, capturedAt: new Date().toISOString(), input: 'isolated synthetic local owner; committed public provider fixture replay; mixed mode; no personal profile', sha256: createHash('sha256').update(await fs.readFile(path.join(output, file))).digest('hex') });
   check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `P2 ${state} ${width} no whole-page horizontal overflow`);
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
 }
 await run('P2 C healthy empty / invalid / zero / write recovery', async () => {
  const p = await page(); await settle(p);
  check((await text(p)).includes('当前公司尚无可靠公司指引'), 'P2 healthy settled empty is a normal empty state');
  await shot(p, 'healthy-empty');
  let d = await save(p, '200', '100'); await d.getByRole('alert').waitFor(); check(await raw(p, key) === null, 'P2 invalid range writes no bytes'); await close(d); await settle(p);
  check(!(await text(p)).includes('本地预期暂不可读') && await panel(p).getByRole('button', { name: '添加业绩预期' }).isEnabled(), 'P2 ordinary rejection does not lock company owner');
  d = await save(p, '0', '0'); await d.waitFor({ state: 'hidden' }); await settle(p);
  check((await text(p)).includes('0 至 0'), 'P2 legitimate numeric zero remains visible');
  const bytes = await raw(p, key);
  await p.evaluate(key => { const set = Storage.prototype.setItem; window.__p2Restore = () => { Storage.prototype.setItem = set; }; Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('P2 synthetic quota fault', 'QuotaExceededError'); return set.call(this, k, v); }; }, key);
  d = await save(p, '100', '200'); await d.getByRole('alert').waitFor(); await close(d); await settle(p);
  check(await raw(p, key) === bytes && !(await text(p)).includes('本地预期暂不可读'), 'P2 write-only rejection preserves confirmed readable company snapshot');
  await p.evaluate(() => window.__p2Restore()); d = await save(p, '100', '200'); await d.waitFor({ state: 'hidden' }); await settle(p);
  check((await text(p)).includes('100 至 200') && JSON.parse(await raw(p, key)).snapshots.length === 2, 'P2 subsequent legal write succeeds without reload');
 });
 for (const variant of ['corrupt', 'future', 'read-failure', 'changed-base']) await run(`P2 A/D ${variant}`, async () => {
  const p = await page(); const d0 = await save(p, '100', '200'); await d0.waitFor({ state: 'hidden' }); await settle(p);
  check((await text(p)).includes('100 至 200'), `P2 ${variant} original synthetic local record visible before fault`);
  if (variant === 'read-failure') await p.context().addInitScript(key => { const get = Storage.prototype.getItem; window.__p2Raw = k => get.call(localStorage, k); Storage.prototype.getItem = function(k) { if (k === key) throw new Error('P2 synthetic local read denied'); return get.call(this, k); }; }, key);
  else await p.evaluate(({key, variant}) => {
   const value = variant === 'corrupt' ? '{P2 synthetic corrupt owner' : variant === 'future' ? JSON.stringify({schemaVersion:999, synthetic:true}) : JSON.stringify({...JSON.parse(localStorage.getItem(key)), updatedAt:'2026-09-22T04:00:00.000Z'});
   localStorage.setItem(key, value);
  }, {key, variant});
  const bytes = await raw(p, key);
  if (variant !== 'changed-base') { await p.reload(); await p.getByRole('heading', {name:'业绩预期', exact:true}).waitFor(); await settle(p, 'fii'); await p.getByText('数据提供方只读', {exact:true}).first().waitFor(); }
  // A real form failure makes App validate both load health and captured base.
  const d = await save(p, '150', '250'); await d.getByRole('alert').waitFor(); await close(d); await settle(p);
  const checkLocked = async label => {
   const value = await text(p);
   check(value.includes('本地预期暂不可读') && value.includes('范围不完整'), `P2 ${variant} ${label} local missing scope visible`);
   check(value.includes('当前没有可展示的已读取记录') && !value.includes('当前公司尚无可靠公司指引'), `P2 ${variant} ${label} unknown local count is not normal empty`);
   check(await panel(p).getByRole('button', {name:'添加业绩预期'}).isDisabled(), `P2 ${variant} ${label} local write control disabled`);
  };
  await checkLocked('after close');
  if (variant === 'corrupt') {
   const reason = p.getByText('查看本地预期不可读原因', { exact: true });
   check(await reason.count() === 1, 'P2 local failure has accessible concrete reason entry');
   if (await reason.count()) { await reason.focus(); await reason.press('Enter'); check(await reason.locator('..').getAttribute('open') !== null && (await reason.locator('..').innerText()).length > '查看本地预期不可读原因'.length, 'P2 keyboard opens concrete local read error'); await reason.press('Enter'); }
   else check(false, 'P2 keyboard opens concrete local read error');
  }
  await p.getByRole('tab', {name:'财务与估值', exact:false}).count().then(async count => { if (count) await p.getByRole('tab', {name:'财务与估值', exact:false}).click(); else await route(p, company('beigene','financials')); });
  check(await p.getByRole('tab', {selected:true}).count() > 0, `P2 ${variant} financial chapter remains accessible`);
  await settle(p); await checkLocked('after chapter navigation');
  await p.getByRole('button', {name:'返回研究入口'}).click(); await settle(p); await checkLocked('after return');
  if (variant !== 'changed-base') { await p.reload(); await settle(p,'fii'); await p.getByText('数据提供方只读',{exact:true}).first().waitFor(); await settle(p); await checkLocked('after reload'); }
  // A new App may load a legitimate externally changed base; only a stale App's
  // captured base stays locked. Corrupt/future/read-denied cannot recover by reload.
  const after = variant === 'read-failure' ? await p.evaluate(key => window.__p2Raw(key),key) : await raw(p,key);
  check(after === bytes, `P2 ${variant} exact source bytes preserved`); report.storage.push({scenario:`P2 ${variant}`, before:fingerprint(bytes), after:fingerprint(after)});
  check(await p.getByRole('heading',{name:'业绩验证',exact:true}).count() === 1 && await p.getByRole('button',{name:'观察记录已锁定'}).count() === 0, `P2 ${variant} independent verification/watch not locked`);
  report.states.push({scenario:`P2 ${variant}`, ...await snapshot(p)});
  if (variant === 'corrupt') await shot(p,'local-locked');
 });
 await run('P2 B official provider retained', async () => {
  const p = await page(), before = await articles(p);
  check(providerIds.every(id => before.some(t => t.includes(id))), 'P2 official stable IDs visible through real loader');
  const bytes = '{P2 synthetic corrupt local source'; await p.evaluate(({key,bytes}) => localStorage.setItem(key,bytes),{key,bytes}); await p.reload(); await p.getByText('数据提供方只读',{exact:true}).first().waitFor(); await settle(p,'fii');
  const after = await articles(p), value = await text(p);
  check(JSON.stringify(after) === JSON.stringify(before), 'P2 healthy provider article IDs/count/source/comparisons remain byte-identical');
  check(value.includes('本地预期暂不可读') && value.includes('范围不完整'), 'P2 provider readable but local missing scope explicit');
  check(await panel(p).getByRole('button',{name:'添加新快照'}).isDisabled(), 'P2 retained provider does not enable locked local writes');
  check(await panel(p).getByRole('button',{name:'创建纠正快照'}).count() === 0, 'P2 official provider remains read-only');
  check(await raw(p,key) === bytes, 'P2 provider read never rewrites local bytes');
  report.states.push({scenario:'P2 provider retained',providerIds,...await snapshot(p)}); await shot(p,'provider-retained');
 });
}
