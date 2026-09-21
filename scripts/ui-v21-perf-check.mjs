/** Same browser, alternating dev-server samples; these are local measurements, not remote SLAs. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const targets = [{name:'before',origin:'http://127.0.0.1:4200',runtimeSha:'cebe97fda751c58c3d2c5a14e167452226e53cbe'}, {name:'after',origin:process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4201',runtimeSha:process.env.UI_REVIEW_RUNTIME_SHA || null}];
const browser = await chromium.launch({channel:'chrome',headless:true});
const report = {testedAt:new Date().toISOString(),browser:browser.version(),inputType:'bundled public defaults; empty personal owners; disposable contexts',environment:'same host / browser; alternating local Vite dev servers; fresh context each sample; no network throttling',definition:'navigation start until main is visible plus two animation frames; provider background completion excluded',limits:'Six samples per route/version; normal local scheduling noise; not a claim about remote Preview latency.',samples:[],summary:[]};
try {
 for (const route of ['home','knowledge']) for (let i=-1;i<6;i++) for (const target of (i%2 ? targets : [...targets].reverse())) {
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  try { const page=await context.newPage();const start=performance.now();await page.goto(`${target.origin}/#/${route}`,{waitUntil:'domcontentloaded'});await page.locator('main').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const elapsedMs=performance.now()-start;const observed=await page.evaluate(async()=>({nodes:document.querySelectorAll('body *').length,bodyLength:document.querySelector('main').textContent.length,indexedDbNames:(await indexedDB.databases()).map(db=>db.name),knowledgeMounted:!!document.querySelector('[aria-label="研究记忆工作区"]')}));
   if(i>=0) report.samples.push({...target,route,sample:i+1,elapsedMs,...observed});
  } finally {await context.close();}
 }
 for(const target of targets) for(const route of ['home','knowledge']) { const rows=report.samples.filter(x=>x.name===target.name&&x.route===route),values=rows.map(x=>x.elapsedMs).sort((a,b)=>a-b);report.summary.push({...target,route,samples:rows.length,medianMs:(values[2]+values[3])/2,minMs:values[0],maxMs:values.at(-1),medianNodes:rows.map(x=>x.nodes).sort((a,b)=>a-b)[3],homepageKnowledgeMounted:route==='home'?rows.some(x=>x.knowledgeMounted):null}); }
} finally {await browser.close();await fs.mkdir('data-cache/ui-v2-1',{recursive:true});await fs.writeFile('data-cache/ui-v2-1/performance.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.summary));
