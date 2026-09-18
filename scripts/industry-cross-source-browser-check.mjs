/** Actual registry artifacts, isolated browser context; no user profile. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-2-slice-4/browser');
await fs.mkdir(output,{recursive:true});
const report = { base:'2f2d707b8b222392a969327f10f9d5af5f021eab', generatedAt:new Date().toISOString(), sourceSha256:{}, checks:[], errors:[], screenshots:[] };
for (const file of ['src/services/industryMetricProvider.ts','src/services/industrySignals.ts','config/industry/industry-metric-registry.v1.json','src/data/real/industry-eia-commercial-crude-stocks.generated.json']) report.sourceSha256[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
const check = (ok,name) => { report.checks.push({ok,name}); if(!ok) throw Error(name); };
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  await context.addInitScript(() => {
    window.__writes=[];
    for(const method of ['setItem','removeItem','clear']) { const original=Storage.prototype[method]; Storage.prototype[method]=function(...args){window.__writes.push([method,args[0]]);return original.apply(this,args);}; }
  });
  const page = await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  let downloads=0; page.on('download',()=>downloads++);
  const external=[]; page.on('request',r=>{ if(!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url()); });
  for(const theme of ['neon','pro','light']) for(const width of [1536,390,320]) {
    const name=`${theme}-${width}`;
    await page.setViewportSize({width,height:960});
    await page.goto(`${origin}/#/industry?industry=oil-shipping`); await page.waitForLoadState('networkidle');
    await page.getByRole('tab',{name:'研究概览',exact:true}).click();
    await page.getByLabel('外观',{exact:true}).selectOption(theme);
    await page.getByLabel('正式指标',{exact:true}).waitFor();
    check(await page.getByLabel('正式指标',{exact:true}).inputValue()==='US_EIA_COMMERCIAL_CRUDE_STOCKS',`exact EIA selection ${name}`);
    const panel=page.getByRole('region',{name:'正式行业指标',exact:true});
    const text=await panel.innerText();
    check(text.includes('423,429 Thousand Barrels')&&text.includes('11 / 11'),`retained weekly value coverage ${name}`);
    check(!text.includes('相邻月留存值差额')&&!text.includes('1—2 月'),`no monthly semantics ${name}`);
    check(text.includes('NOT_ADMITTED')&&text.includes('unknown'),`uncertainty ${name}`);
    check(await page.getByLabel('指标口径').inputValue()==='week_ending',`weekly basis ${name}`);
    check(await panel.locator('.recharts-line-curve').count()===1,`real chart ${name}`);
    const tableSummary = panel.getByText('查看原始数据表',{exact:true});
    if (!await tableSummary.evaluate(e=>e.parentElement.open)) await tableSummary.click();
    check(await panel.locator('tbody tr').count()===11,`11 dated rows ${name}`);
    check((await panel.locator('tbody tr').first().innerText()).includes('2026-07-03'),`week-ending start ${name}`);
    const writes=await page.evaluate(()=>window.__writes.length);
    const trigger=panel.getByRole('button',{name:'查看指标证据'}); await trigger.click();
    const drawer=page.getByRole('dialog'); await drawer.locator('.chart-audit > summary').click();
    await drawer.locator('.chart-audit details > summary').first().click();
    const evidence=await drawer.innerText();
    check(['US_EIA_COMMERCIAL_CRUDE_STOCKS','candidate','releaseAvailableAt','publicationDateTime','acquiredAt','generatedAt','未提供 / unknown','WCESTUS1'].every(s=>evidence.includes(s)),`exact EIA evidence ${name}`);
    check((await drawer.getByRole('link').first().getAttribute('href')).startsWith('https://www.eia.gov/'),`official evidence URL ${name}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`drawer fits ${name}`);
    await page.keyboard.press('Shift+Tab'); check(await drawer.evaluate(e=>e.contains(document.activeElement)),`focus trapped ${name}`);
    await page.keyboard.press('Escape'); check(await trigger.evaluate(e=>e===document.activeElement),`focus restored ${name}`);
    const event=page.getByRole('region',{name:'行业最新变化'});
    check(await event.locator('h3').count()===1&&(await event.innerText()).includes('2026-09-11 周末'),`weekly event ${name}`);
    check(!(await event.innerText()).match(/bullish|bearish|景气改善|景气恶化|NaN/),`no investment conclusion ${name}`);
    await event.getByRole('button',{name:'查看行业变化证据'}).click();
    check((await page.getByRole('dialog').textContent()).includes('US_EIA_COMMERCIAL_CRUDE_STOCKS'),`event exact input ${name}`);
    await page.keyboard.press('Escape');
    check(await page.evaluate(()=>window.__writes.length)===writes,`read-only metric event operations ${name}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page fits ${name}`);
    if(['neon-1536','light-390','pro-320'].includes(name)) { await panel.scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(output,`${name}.png`)});report.screenshots.push(`${name}.png`); }
  }
  await page.setViewportSize({width:1536,height:960}); await page.goto(`${origin}/#/home`); await page.waitForLoadState('networkidle');
  const inbox=page.getByRole('region',{name:'Research Inbox',exact:true}); await inbox.waitFor();
  check(await inbox.locator('article[data-inbox-id^="industry:industry-change:oil-shipping:"]').count()===0,'unknown EIA publication is excluded from near-30-day filter');
  await inbox.getByLabel('日期范围').selectOption('all');
  for(let i=0;i<1000 && await inbox.getByRole('button',{name:/显示更多事件/}).count();i++) await inbox.getByRole('button',{name:/显示更多事件/}).click();
  const cards=inbox.locator('article[data-inbox-id^="industry:industry-change:"]');
  check(await cards.count()===2,'Inbox has separate NBS and EIA source events');
  const eia=cards.filter({hasText:'2026-09-11 周末'}); check(await eia.count()===1,'EIA appears exactly once in Inbox');
  await eia.getByRole('button',{name:'查看行业变化证据'}).click(); check((await page.getByRole('dialog').textContent()).includes('US_EIA_COMMERCIAL_CRUDE_STOCKS'),'Inbox exact EIA Evidence');await page.keyboard.press('Escape');
  await eia.getByRole('link',{name:'打开对应行业 / Metric'}).click(); check(page.url().includes('industry=oil-shipping'),'Inbox exact oil-shipping deep link');
  check(downloads===0&&external.length===0,'no downloads or external acquisition');
  check(report.errors.length===0,'no browser runtime errors');
} catch(e) {report.errors.push(e.message);process.exitCode=1;}
finally {await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({checks:report.checks.length,failures:report.checks.filter(c=>!c.ok),errors:report.errors,output}));
