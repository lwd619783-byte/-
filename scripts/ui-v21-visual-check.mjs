/** Local exact-SHA visual inventory. Disposable profiles and synthetic records only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium }=createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4200';
const phase=process.env.UI_REVIEW_PHASE || 'before';
const output=path.resolve(process.env.UI_REVIEW_OUTPUT || `data-cache/ui-v2-1/${phase}`);
await fs.mkdir(output,{recursive:true});
const report={schemaVersion:'ui-v21-visual.v1',phase,runtimeSha:process.env.UI_REVIEW_RUNTIME_SHA||null,deploymentId:null,origin,testedAt:new Date().toISOString(),inputType:'disposable-profile; bundled-public-defaults plus explicitly synthetic local records',screenshots:[],errors:[],checks:[]};
const browser=await chromium.launch({channel:process.env.UI_REVIEW_BROWSER_CHANNEL||'chrome',headless:true});
const routes=['home','research','knowledge','tasks','sources','settings','portfolio','macro','industry','stocks','watchlist','verification','expectations','creators','sources?view=organize','sources?view=bridge','tasks?view=review','tasks?view=replay','tasks?view=verify'];
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(30000);
page.on('pageerror',error=>report.errors.push(error.message));
async function ready(){await page.locator('main').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function shot(name,scenario,route){
  console.log(`capture ${scenario} ${route} ${page.viewportSize().width}`);
  await page.evaluate(()=>window.scrollTo(0,0));
  const file=`${scenario}-${name}-${page.viewportSize().width}.png`;
  await page.screenshot({path:path.join(output,file),fullPage:true,timeout:20000});
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,main:document.querySelector('main')?.getBoundingClientRect().toJSON(),columns:[...document.querySelectorAll('[aria-label="研究收件箱"] .grid,[aria-label="知识库文章区"] .grid')].map(el=>({template:getComputedStyle(el).gridTemplateColumns,rect:el.getBoundingClientRect().toJSON()})),rows:[...document.querySelectorAll('[data-inbox-id]')].slice(0,8).map(el=>el.getBoundingClientRect().toJSON())}));
  report.screenshots.push({file,scenario,route,viewport:page.viewportSize(),geometry});
}
async function visit(route){console.log(`visit ${route}`);await page.goto(`${origin}/?capture=${encodeURIComponent(route)}#/${route}`,{waitUntil:'networkidle',timeout:30000});await ready();}
try{
 await visit('home');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?900:844});
  for(const route of routes){await visit(route);await shot(route.replaceAll(/[?=&/]/g,'-'),'default-local-empty-owners',route);}
 }
 await page.setViewportSize({width:1440,height:900});await visit('home');
 const fixture=await page.evaluate(async()=>{
   const [{buildDashboardDataset},{WatchlistRepository},{createReviewFixtures},{creatorViewpointFixture},{BrowserWikiRepository},{wikiFixture,wikiFixtureOwners},{IndexedDbBrowserSourceRepository},{contributionFixture}]=await Promise.all([
    import('/src/services/dataProvider.ts'),import('/src/services/watchlistRepository.ts'),import('/src/ui-review/fixtures.ts'),import('/src/services/creatorViewpoint.fixture.ts'),import('/src/services/wikiRepository.ts'),import('/src/services/wiki.fixture.ts'),import('/src/services/browserSourceRepository.ts'),import('/src/services/knowledgeIngestion.fixture.ts')]);
   const stocks=buildDashboardDataset('mock').stocks;
   const review=createReviewFixtures('full');const repo=new WatchlistRepository(localStorage),base=repo.load().data;
   const result=repo.save({...base,watchItems:review.watchItems.map((w,i)=>({...w,source:'user',stockId:stocks[i].id,reason:'合成观察：'+w.reason}))},base);if(!result.ok)throw Error(result.error);
   localStorage.setItem('investment-research-dashboard.creator-viewpoint.v1',JSON.stringify(creatorViewpointFixture()));
   const wiki=wikiFixture();wiki.revisions[0].title='合成知识：长标题、六章正文与来源限制的完整阅读验收';
   wiki.revisions[0].bodyMarkdown=['核心判断','产业与主题结构','近期变化','关键公司与环节','风险与待验证问题','来源'].map((title,i)=>`## ${title}\n\n${'这是隔离合成资料，尚未独立核验。来源日期未知时保留未知，不形成真实投资判断。\n\n'.repeat(9)}${i===1?'| '+Array.from({length:12},(_,j)=>'合成指标'+j).join(' | ')+' |\n| '+Array(12).fill('---').join(' | ')+' |\n| '+Array(12).fill('来源未核验').join(' | ')+' |':''}`).join('\n\n');
   const wr=new BrowserWikiRepository(localStorage,wikiFixtureOwners());wr.append(wr.load().data,{entries:wiki.entries,revisions:wiki.revisions,reviews:wiki.reviews});
   const source=new IndexedDbBrowserSourceRepository();const batch=await source.saveBatch(Array.from({length:15},(_,i)=>new File([`合成原件 ${i}，内容未核验。\n第二行资料。`],`合成资料-${i}-用于长列表与完整文件名显示测试.txt`)),'合成长列表批次');await source.parseBatch(batch.batchId);
   const contribution=contributionFixture(await source.load(),'visual-synthetic');contribution.proposals[0].document.bodyMarkdown=wiki.revisions[0].bodyMarkdown;await source.importBundle(JSON.stringify(contribution));
   return {stockId:stocks[0].id,wikiId:wiki.entries[0].wikiId};
 });
 const populated=[...routes,`knowledge?wiki=${fixture.wikiId}`,...['overview','financials','valuation','expectations','evidence'].map(tab=>`company/${encodeURIComponent(fixture.stockId)}/${tab}?from=stocks`)];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?900:844});
  for(const route of populated){await visit(route);await shot(route.replaceAll(/[?=&/]/g,'-'),'populated-synthetic',route);}
  await visit('tasks?view=review');const open=page.getByRole('button',{name:'查看与审核',exact:true});await open.first().waitFor();await open.first().click();await page.getByRole('dialog').waitFor();await shot('knowledge-draft','populated-synthetic','tasks?view=review');await page.keyboard.press('Escape');
 }
 for(const state of ['locked-wiki','error-source']){
  await page.evaluate(state=>{
    if(state==='locked-wiki')localStorage.setItem('investment-research-dashboard.wiki.v1','{"schemaVersion":"wiki.v99"}');
  },state);
  if(state==='error-source')await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('investment-research-dashboard.knowledge-ingestion.v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({schemaVersion:'synthetic-invalid'},'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();});
  for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?900:844});const route=state==='locked-wiki'?'knowledge':'sources';await visit(route);await shot(route,state,route);}
 }
 report.status='CAPTURED';
}catch(error){report.status='FAIL';report.errors.push(error.message);process.exitCode=1;}
finally{await context.close();await browser.close();report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'index.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,screenshots:report.screenshots.length,errors:report.errors,output}));}
