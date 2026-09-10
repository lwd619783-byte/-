/** Run against a local production preview. Uses an installed Playwright module only.
 * UI_REVIEW_PLAYWRIGHT_MODULE may select the bundled runtime; no install is performed.
 * All stored values below are synthetic sentinels in a fresh browser context. */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_REVIEW_ORIGIN || "http://127.0.0.1:4173";
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || "data-cache/ui-v1-1/browser");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  const get = Storage.prototype.getItem;
  window.__storageAudit = { reads: [], writes: [] };
  window.__storageSnapshot = () => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, get.call(localStorage, key)]));
  Storage.prototype.getItem = function(key) { window.__storageAudit.reads.push(key); return get.call(this, key); };
  for (const name of ["setItem", "removeItem", "clear"]) { const original = Storage.prototype[name]; Storage.prototype[name] = function(...args) { window.__storageAudit.writes.push({ operation: name, key: args[0] }); return original.apply(this, args); }; }
});
const page = await context.newPage();
const result = { base: "a419607ebc9d7b4413bedd8786cf814394b3c00d", generatedAt: new Date().toISOString(), checks: [], scroll: [], themes: [], isolation: {}, failures: [], pageErrors: [], screenshots: [] };
const sourcePaths = ["src/Application.tsx","src/main.tsx","src/index.css","src/components/home/HomePage.tsx","src/components/layout/Appearance.tsx","src/components/stock/StockDetailDrawer.tsx","src/components/stock/StockPriceHistoryChart.tsx","src/components/watchlist/WatchlistTab.tsx","src/ui-review/config.ts","src/ui-review/fixtures.ts","src/ui-review/UiReviewApp.tsx"];
result.sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,createHash("sha256").update(await fs.readFile(file)).digest("hex")])));
result.buildAssets = (await fs.readdir("dist/assets")).filter(file=>/\.(js|css)$/.test(file));
let phase = "before";
const requests = { before: [], review: [], after: [] };
page.on("pageerror", error => result.pageErrors.push(error.message));
page.on("request", request => requests[phase].push({ path: new URL(request.url()).pathname, type: request.resourceType() }));
let downloads = 0;
page.on("download", () => downloads++);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function storageHash() { return hash(await page.evaluate(() => window.__storageSnapshot())); }
async function settle() { await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready); }
async function shot(name, fullPage = false) { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage }); result.screenshots.push(`${name}.png`); }
function check(ok, name, detail) { if (!ok) result.failures.push({ name, detail }); }
async function geometry() { return page.evaluate(() => [...document.querySelectorAll("main h1, main h2, main [role=tab], main table, main [role=img], .home-research-grid > *")].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect(); return { tag:el.tagName,text:el.getAttribute("aria-label") || el.textContent?.slice(0,70), x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height) };})); }
try {
  await page.goto(`${origin}/#/home`); await settle();
  await page.evaluate(() => {
    localStorage.setItem("investment-research-dashboard.watchlist.v2", JSON.stringify({schemaVersion:2,updatedAt:"2026-09-01T00:00:00Z",watchItems:[{ id:"persistent-watch-sentinel",stockId:"persistent-stock-sentinel",createdAt:"2026-08-01T00:00:00Z",updatedAt:"2026-09-01T00:00:00Z",status:"观察",priority:"high",tags:["synthetic"],reason:"持久化隔离验收原文",thesis:"不可改写的合成假设",validationCriteria:["保留原始空白"],riskCriteria:[],nextReviewAt:null,lastReviewedAt:"2026-09-01",archivedAt:null,source:"user",schemaVersion:2 }],reviewEntries:[{id:"persistent-review-sentinel",watchItemId:"persistent-watch-sentinel",createdAt:"2026-09-01T00:00:00Z",triggerType:"manual",triggerEventIds:[],beforeSnapshot:{status:"观察",thesis:"旧合成假设",validationCriteria:[],riskCriteria:[]},afterSnapshot:{status:"观察",thesis:"不可改写的合成假设",validationCriteria:["保留原始空白"],riskCriteria:[]},summary:"合成历史不可覆写",rationale:"验收原文",evidenceRefs:[],decision:"观察",nextReviewAt:null,correctsReviewEntryId:null}],reviewTaskStates:[],settings:{longUnreviewedDays:30}},null,2));
    localStorage.setItem("investment-research-dashboard.earnings-expectation.v1", ' { "syntheticSentinel": "损坏原文也不能覆盖\\n" } ');
    localStorage.setItem("investment-research-dashboard.watchlist.backup.ui-review-sentinel", "  synthetic historical bytes\n");
    localStorage.setItem("investment-dashboard.ui.v1.appearance", "neon");
  });
  requests.before = [];
  await page.reload(); await settle();
  const before = await storageHash();
  check(await page.locator("[data-ui-review]").count()===0,"ordinary URL hides review");
  phase = "review";
  const routes = ["home","macro","industry","stocks","watchlist","verification","expectations",...['overview','financials','valuation','expectations','evidence'].map(tab=>`company/ui-review-company-1/${tab}`)];
  for (const width of [1536,1280,390,320]) {
    await page.setViewportSize({width,height:1000});
    for (const profile of ["full","empty","degraded"]) {
      for (const route of routes) {
        const name = `${profile}-${route.replaceAll('/','-')}-${width}`;
        await page.goto(`${origin}/?ui-review=1&profile=${profile}#/${route}`); await settle();
        await page.locator("[data-ui-review]").waitFor();
        await page.getByLabel("外观",{exact:true}).selectOption("neon");
        const size = await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,reads:window.__storageAudit.reads,writes:window.__storageAudit.writes}));
        check(size.width<=width,`overflow ${name}`,size);
        check(size.reads.length===0 && size.writes.length===0,`storage access ${name}`,size);
        check(await storageHash()===before,`storage bytes ${name}`);
        result.checks.push({name,viewport:width,scrollWidth:size.width,storageReadCount:size.reads.length,storageWriteCount:size.writes.length});
        const capture = width===1536 || (width===390 && profile==="full") || (width===320 && ["home","company/ui-review-company-1/overview"].includes(route));
        if(capture) await shot(`${name}-neon`, ["home","verification","expectations"].includes(route));
        if(width===1536 && profile==="full") {
          const baseline = await geometry();
          for(const theme of ["pro","light"]) {
            await page.getByLabel("外观",{exact:true}).selectOption(theme);
            const same = JSON.stringify(await geometry())===JSON.stringify(baseline);
            result.themes.push({route,theme,sameGeometry:same});check(same,`theme geometry ${route} ${theme}`);
            await shot(`${name}-${theme}`);
          }
        }
        if(route==="home") {
          const layout=await page.evaluate(()=>{ const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,height:r.height,bottom:r.bottom};};return {priority:rect('.home-priorities'),price:rect('.home-price'),events:rect('.home-events'),eventCount:document.querySelectorAll('.home-events article').length}; });
          check(layout.eventCount<=3,`event limit ${name}`,layout);
          if(width>=1280) {check(Math.abs(layout.price.top-layout.events.top)<1,`main row top ${name}`,layout);check(Math.abs(layout.price.bottom-layout.events.bottom)<1,`main row bottom ${name}`,layout);}
          if(profile==="empty" && width>=1280) check(layout.priority.height<130,`compact empty ${name}`,layout);
          result.checks[result.checks.length-1].homeLayout=layout;
        }
      }
      console.log(`Checked ${width}px ${profile}: ${routes.length} routes`);
    }
  }
  for(const width of [1536,1280,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${origin}/?ui-review=1#/company/ui-review-company-1/overview`);await settle();
    await shot(`company-before-scroll-${width}`);
    await page.evaluate(()=>window.scrollTo(0,document.querySelector('[role=tablist]').getBoundingClientRect().top+scrollY+300));
    await shot(`company-summary-scrolled-${width}`);
    const scrolled=await page.evaluate(()=>({headerBottom:document.querySelector('.research-header').getBoundingClientRect().bottom,rail:document.querySelector('[role=tablist]').getBoundingClientRect().toJSON(),headerPosition:getComputedStyle(document.querySelector('.research-header')).position}));
    check(scrolled.headerBottom<0,`summary scrolls away ${width}`,scrolled);check(scrolled.headerPosition==='static',`summary static ${width}`,scrolled);check(scrolled.rail.height<70,`compact rail ${width}`,scrolled);
    await page.getByRole('tab',{name:'经营与财务',exact:true}).click();
    const chapter=await page.evaluate(()=>({railBottom:document.querySelector('[role=tablist]').getBoundingClientRect().bottom,panelTop:document.querySelector('[role=tabpanel]').getBoundingClientRect().top}));
    check(chapter.panelTop>=chapter.railBottom,`new chapter not covered ${width}`,chapter);
    await shot(`company-new-chapter-${width}`);result.scroll.push({width,scrolled,chapter});
  }
  await page.setViewportSize({width:1600,height:1000});
  for(const profile of ['full','empty']) {await page.goto(`${origin}/?ui-review=1&profile=${profile}#/home`);await settle();const sw=await page.evaluate(()=>document.documentElement.scrollWidth);check(sw<=1600,`overflow home ${profile} 1600`);await shot(`home-${profile}-1600`,true);}
  await page.goto(`${origin}/?ui-review=1#/watchlist`);await settle();await page.getByRole('button',{name:'备份 / 导入',exact:true}).click();check(await page.getByRole('dialog').count()===0,'review backup blocked');
  await page.goto(`${origin}/?ui-review=1#/expectations`);await settle();await page.getByRole('button',{name:'导出 / 快照导入',exact:true}).click();check(await page.getByRole('dialog').count()===0,'review export blocked');
  await page.goto(`${origin}/?ui-review=1#/home`);await settle();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200 percent text zoom home');await shot('home-text-200-percent');
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  const reviewData=requests.review.filter(r=>['fetch','xhr'].includes(r.type)||r.path.includes('/data/'));
  const reviewBusinessChunks=requests.review.filter(r=>/^App-/.test(path.basename(r.path)));
  check(reviewData.length===0,'no review data requests',reviewData);check(reviewBusinessChunks.length===0,'no business App chunk in review',reviewBusinessChunks);check(downloads===0,'no review export download');
  phase='after';await page.getByRole('link',{name:'退出界面验收',exact:true}).click();await settle();
  const afterExit=await storageHash();check(before===afterExit,'storage bytes after exit');await page.reload();await settle();const afterRefresh=await storageHash();check(before===afterRefresh,'storage bytes after ordinary refresh');
  const dataPaths=values=>[...new Set(values.filter(r=>['fetch','xhr'].includes(r.type)||r.path.includes('/data/')).map(r=>r.path))].sort();
  const beforeRequests=dataPaths(requests.before),afterRequests=dataPaths(requests.after);
  check(JSON.stringify(beforeRequests)===JSON.stringify(afterRequests),'ordinary data request set unchanged',{beforeRequests,afterRequests});
  check(result.pageErrors.length===0,'browser runtime errors',result.pageErrors);
  result.isolation={before,afterExit,afterRefresh,reviewDataRequestCount:reviewData.length,reviewBusinessChunkCount:reviewBusinessChunks.length,downloads,beforeRequests,afterRequests};
  // Normal production components with their existing local data path, after isolation measurements.
  await page.setViewportSize({width:1536,height:1000});await page.goto(`${origin}/#/stocks`);await settle();
  const stockId=await page.locator('[data-stock-id]').first().getAttribute('data-stock-id');
  await page.goto(`${origin}/#/company/${encodeURIComponent(stockId)}/overview`);await settle();await shot('ordinary-company-before-scroll');
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('[role=tablist]').getBoundingClientRect().top+scrollY+300));
  await shot('ordinary-company-summary-scrolled');
  const normal=await page.evaluate(()=>({headerBottom:document.querySelector('.research-header').getBoundingClientRect().bottom,railHeight:document.querySelector('[role=tablist]').getBoundingClientRect().height}));
  check(normal.headerBottom<0 && normal.railHeight<70,'ordinary company summary scroll',normal);
  result.ordinaryCompany={stockId,...normal};check(await storageHash()===before,'ordinary company inspection preserves storage');check(result.pageErrors.length===0,'ordinary browser runtime errors',result.pageErrors);

} catch(error) {
  result.failures.push({name:'browser runner error',detail:error.message});
} finally {
  result.status=result.failures.length ? 'FAIL' : 'PASS';
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,checks:result.checks.length,failures:result.failures,scroll:result.scroll,isolation:result.isolation},null,2));
  await browser.close();
}
if(result.failures.length)process.exitCode=1;
