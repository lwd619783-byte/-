// Real bundled read-only app plus explicitly isolated synthetic edge-state renders.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { reviewContext } from '../server/daily-review/context.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('data-cache/oil-observation/browser');
const harness = path.resolve('data-cache/oil-observation/harness');
await fs.mkdir(output, { recursive: true }); await fs.mkdir(harness, { recursive: true });
await fs.writeFile(path.join(harness, 'index.html'), '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><body><main id="root" style="padding:12px"></main><script type="module" src="./main.tsx"></script></body></html>');
await fs.writeFile(path.join(harness, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';
import {stocks} from '/src/data/stocks';import {syntheticFreight} from '/src/services/industryObservation.fixture';
import {OilShippingObservationContent} from '/src/components/industry/OilShippingObservation';
const mode=new URLSearchParams(location.search).get('mode');
const pool=stocks.filter(s=>s.industryId==='oil-shipping').map((s,k)=>{const points=Array.from({length:24},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),close:10+i+k,amount:null,pctChange:null}));return {...s,priceHistory:points,priceHistorySource:{id:s.id,points,quality:{source:'SYNTHETIC UI ONLY',status:'real',updatedAt:'2026-09-25T10:00:00+08:00'}}};});
if(mode==='partial')pool[1].priceHistorySource=undefined;
if(mode==='short')for(const s of pool){s.priceHistory.splice(0,23);}
if(mode==='conflict')pool[0].priceHistorySource.quality.status='conflicted';
if(mode==='stale')pool[0].priceHistorySource.quality.status='stale';
if(mode==='long')pool[0].name='很长的合成公司名称'.repeat(5);
const owner=syntheticFreight();
createRoot(document.getElementById('root')).render(<OilShippingObservationContent stocks={mode==='empty'?[]:pool} freightOwner={mode==='freight'?owner:null} asOf="2026-09-27" onOpenStock={()=>{}} onOpenMetrics={()=>{}}/>);
`);
const report = { scope: 'LOCAL_REAL_BUNDLED_AND_SEPARATE_SYNTHETIC_UI', checks: [], errors: [], consoleErrors: [], resourceErrors: [], screenshots: [] };
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const vite = await createServer({ cacheDir: 'data-cache/oil-observation/vite', optimizeDeps: { entries: ['index.html', 'data-cache/oil-observation/harness/index.html'] }, server: { host: '127.0.0.1', port: 4198, strictPort: true }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = 'http://127.0.0.1:4198';
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) report.resourceErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(origin + '/#/industry?industry=oil-shipping&segment=crude-shipping');
    await page.getByRole('heading', { name: '油运 · 动态观察' }).waitFor();
    check(await page.locator('vite-error-overlay').count() === 0, width + ': real app loaded without overlay');
    check(await page.getByText('运价不可用', { exact: true }).count() === 1, width + ': real freight explicitly blocked');
    check(await page.getByText('3 家公司 · 3 个证券', { exact: true }).count() === 1, width + ': real existing company pool');
    const observation = reviewContext(new Date().toISOString()), sample = observation.selectedSample;
    const expected = [sample.onePeriod, sample.fivePeriod, sample.twentyPeriod].map(s => (s.value >= 0 ? '+' : '') + s.value.toFixed(2) + '%');
    check(await page.getByText('1 / 5 / 20 期：' + expected.join(' / '), { exact: true }).isVisible(), width + ': real raw-close sample math agrees with context');
    check(await page.getByText(`上涨 ${sample.onePeriod.up} / 下跌 ${sample.onePeriod.down} / 持平 ${sample.onePeriod.flat}（证券）`, { exact: true }).isVisible(), width + ': real full denominator counts');
    const quality = await page.getByText(/样本质量限制：/).innerText();
    check(['过期', '复权口径未确认', '交易日覆盖未证明'].every(s => quality.includes(s)), width + ': real quality limits remain visible');
    check(await page.getByText('数据不足', { exact: true }).isVisible(), width + ': real relationship remains unavailable');
    const layout = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }));
    check(layout.body <= layout.viewport, width + ': real no horizontal viewport overflow');
    const shot = path.join(output, 'real-' + width + '.png'); await page.screenshot({ path: shot, fullPage: true }); report.screenshots.push(path.basename(shot));
    await page.getByRole('checkbox', { name: '对照中远海能' }).uncheck();
    check(await page.getByText('2 家公司 · 2 个证券', { exact: true }).count() === 1, width + ': selection');
    await page.getByRole('combobox', { name: '动态观察时间窗口' }).selectOption('30');
    check(await page.getByText('近 30 自然日 · 同一起止日比较', { exact: true }).count() === 1, width + ': window');
    await page.getByRole('region', { name: '公司表可横向滚动' }).getByRole('button', { name: /5期/ }).click();
    check(await page.locator('.oil-table-panel [aria-sort="descending"]').count() === 1, width + ': sort');
    const chart = page.getByRole('region', { name: '相关股票表现 · 基期 100' });
    await chart.locator('.recharts-wrapper').scrollIntoViewIfNeeded();
    const bounds = await chart.locator('.recharts-wrapper').boundingBox();
    check(!!bounds, width + ': real price chart rendered');
    await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + 80);
    await chart.locator('.recharts-tooltip-wrapper').waitFor({ state: 'visible' });
    check((await chart.locator('.recharts-tooltip-wrapper').innerText()).includes('基期100'), width + ': tooltip readable unit');
    await page.getByRole('region', { name: '运价趋势' }).getByRole('button', { name: '来源与证据' }).click();
    await page.getByRole('dialog').waitFor(); check(true, width + ': original Evidence Drawer');
    await page.getByRole('dialog').getByRole('button', { name: /关闭/ }).click();
    await page.locator('.oil-table-panel > details > summary').click();
    check(await page.locator('.oil-table-panel .chart-audit').count() === 2, width + ': stock Chart Audit');
    await page.getByRole('button', { name: '查看指标、事件与证据' }).click();
    check(await page.getByRole('tab', { name: '指标与变化' }).getAttribute('aria-selected') === 'true', width + ': auxiliary metrics retained');
    await page.getByRole('tab', { name: '产业链', exact: true }).click();
    check(await page.getByRole('tabpanel', { name: '产业链', exact: true }).isVisible(), width + ': chain retained');
    await page.getByRole('tab', { name: '研究概览' }).click();
    await page.getByRole('region', { name: '公司表可横向滚动' }).getByRole('button', { name: '招商南油', exact: true }).click();
    await page.getByRole('dialog', { name: '招商南油 · 快速预览' }).waitFor();
    await page.getByRole('button', { name: '打开完整研究', exact: true }).click();
    await page.waitForURL('**/company/cm-nanjing/**');
    check(page.url().includes('cm-nanjing'), width + ': existing company navigation');
    await context.close();
    for (const mode of ['partial', 'short', 'conflict', 'stale', 'empty', 'long', 'freight']) {
      const synthetic = await browser.newContext({ viewport: { width, height: 1000 } }), p = await synthetic.newPage();
      p.on('pageerror', error => report.errors.push(error.message));
      p.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
      p.on('response', response => { if (response.status() >= 400) report.resourceErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
      await p.goto(origin + '/data-cache/oil-observation/harness/index.html?mode=' + mode);
      await p.getByRole('heading', { name: '油运 · 动态观察' }).waitFor();
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), width + ': synthetic ' + mode + ' no overflow');
      check(await p.getByText('数据不足', { exact: true }).count() === 1, width + ': synthetic ' + mode + ' relation fail closed');
      if (mode === 'stale') {
        check(await p.getByText('上涨 3 / 下跌 0 / 持平 0（证券）', { exact: true }).isVisible(), width + ': stale complete-window counts remain visible');
        check(await p.getByText(/样本聚合不可用/).count() === 0 && (await p.getByText(/样本质量限制：/).innerText()).includes('过期'), width + ': stale math is distinct from quality');
      }
      if (mode === 'short' || mode === 'empty') check(await p.getByText('股票历史不足', { exact: true }).count() === 1, width + ': synthetic ' + mode + ' empty chart');
      if (mode === 'freight') check(await p.locator('.oil-chart-grid .recharts-wrapper').count() === 2, width + ': synthetic freight and stock charts');
      const name = 'synthetic-' + mode + '-' + width + '.png'; await p.screenshot({ path: path.join(output, name), fullPage: true }); report.screenshots.push(name);
      await synthetic.close();
    }
  }
  check(report.errors.length === 0, 'no page runtime errors');
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await vite.close();
  await fs.unlink(path.join(harness, 'index.html')); await fs.unlink(path.join(harness, 'main.tsx')); await fs.rmdir(harness);
}
console.log(JSON.stringify(report, null, 2));
