/** Isolated SDK -> production handler/store -> actual React page acceptance.
 * Only synthetic workspace/credentials; no user browser profile or production writes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createReviewHandler } from '../server/daily-review/http.mjs';
import { reviewConfig } from '../server/daily-review/config.mjs';
import { signToken } from '../server/research-bridge/auth.mjs';
import { DecisionTestStore } from './tests/os-domain.fixture.mjs';
import { PrivateBlobStore } from '../server/research-bridge/store.mjs';
import { DailyReviewStore } from '../server/daily-review/store.mjs';
import { publication, reviewTestEnv } from './tests/daily-review.fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('data-cache/daily-review/browser'), harness = path.resolve('data-cache/daily-review/harness');
await fs.mkdir(output,{recursive:true});await fs.mkdir(harness,{recursive:true});
const live = process.env.REVIEW_BROWSER_LIVE_BLOB === '1';
if(live)process.loadEnvFile('data-cache/daily-review/preview.env');
const runtimeEnv=live?{...reviewTestEnv,DAILY_REVIEW_WORKSPACE:'browser-'+randomUUID()}:reviewTestEnv;
const report={scope:live?'SYNTHETIC_SDK_HTTP_REAL_PRIVATE_BLOB_UI':'SYNTHETIC_LOCAL_SDK_HTTP_STORE_UI',workspace:runtimeEnv.DAILY_REVIEW_WORKSPACE,checks:[],errors:[],screenshots:[]};
const check=(ok,name)=>{report.checks.push({ok,name});if(!ok)throw Error(name)};
const store=live?new PrivateBlobStore():new DecisionTestStore(),config=reviewConfig(runtimeEnv),handler=createReviewHandler({env:runtimeEnv,store,scope:'synthetic'});
const vite=await createServer({cacheDir:'data-cache/daily-review/vite',plugins:[{name:'isolated-review-test',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(!req.url?.startsWith('/api/daily-review')&&!req.url?.startsWith('/api/review-mcp'))return next();
  // Test-only origin translation: the real handler still enforces the configured origin.
  if(req.headers.origin==='http://127.0.0.1:4197')req.headers.origin=config.origin;
  void handler(req,res);
});}}],server:{host:'127.0.0.1',port:4197,strictPort:true},logLevel:'error'});
await fs.writeFile(path.join(harness,'index.html'),'<html lang="zh-CN"><meta name="viewport" content="width=device-width"><body><div id="root" style="padding:16px"></div><script type="module" src="./main.tsx"></script></body></html>');
await vite.listen();const origin='http://127.0.0.1:4197';
const token=signToken({kind:'access',iss:config.issuer,aud:config.resource,sub:config.subject,scope:config.scope,client_id:config.clientId,exp:Math.floor(Date.now()/1000)+3600,reviewEpoch:0,workspace:config.workspace,dataScope:'synthetic'},config);
const client=new Client({name:'review-browser-acceptance',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/api/review-mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
const call=async(name,args)=>(await client.callTool({name,arguments:args})).structuredContent.result;
const p=publication();const first=await call('publish_daily_review',p);check(first.record.revision===1,'SDK create');check((await call('publish_daily_review',p)).replay,'SDK retry');
const asOf=new Date().toISOString();const second=await call('publish_daily_review',{...p,expectedRevision:1,idempotencyKey:'browser-synthetic-revision-002',review:{...p.review,asOf,generatedAt:asOf,sources:p.review.sources.map(s=>({...s,asOf})),previousReviewId:first.record.reviewId,previousRevision:1,summary:'合成测试第二版：运价仍不可用，等待授权与来源核验。'}});check(second.record.revision===2,'SDK revision');
await fs.writeFile(path.join(harness,'main.tsx'),`
import React from 'react';import{createRoot}from'react-dom/client';import'/src/index.css';import{DailyReviewCard}from'/src/components/industry/DailyReviewPanel';
const record=${JSON.stringify(first.record)};const mode=new URLSearchParams(location.search).get('mode');
if(mode==='confirmed')record.status='USER_CONFIRMED';if(mode==='stale')record.content.asOf='2020-01-01T00:00:00Z';if(mode==='missing')record.content.sources[0].availability='missing';
if(mode==='long'){record.content.summary='有限数据的合成观察说明。'.repeat(40);record.content.supports=[{text:'支持证据仅供研究参考。'.repeat(30),sourceIds:[]}];}
createRoot(document.getElementById('root')).render(<DailyReviewCard value={{record:mode==='empty'?null:record,effectiveStatus:mode==='empty'?null:record.status,isCurrent:true,scope:'synthetic'}}/>);
`);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(origin+'/#/industry?industry=oil-shipping&segment=crude-shipping');await page.getByRole('heading',{name:'每日复盘',exact:true}).waitFor();
    await page.getByLabel('复盘访问密钥').fill(config.ownerSecret);await page.getByRole('button',{name:'连接复盘'}).click();
    await page.getByText(second.record.content.summary,{exact:true}).waitFor();check(true,`${width}: actual page reads SDK committed current`);
    const region=page.getByRole('region',{name:'每日复盘'});await region.locator('summary').filter({hasText:'历史版本'}).click();
    await region.getByRole('button',{name:new RegExp('v1 · 历史版本')}).click();await page.getByText(first.record.content.summary,{exact:true}).waitFor();check(true,`${width}: exact old version history interaction`);
    await region.getByRole('button',{name:'查看当前复盘'}).click();await page.getByText(second.record.content.summary,{exact:true}).waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: full app no horizontal overflow`);
    await region.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-90));const shot=`sdk-app-${width}.png`;await region.screenshot({path:path.join(output,shot)});report.screenshots.push(shot);
    await region.locator('summary').filter({hasText:'人工复核'}).click();await region.getByRole('button',{name:'人工确认此版本'}).click();
    check(await region.getByRole('button',{name:'确认操作'}).isVisible(),`${width}: owner confirmation gate`);await region.getByRole('button',{name:'取消',exact:true}).click();
    for(const mode of ['empty','confirmed','stale','missing','long']){
      await page.goto(origin+'/data-cache/daily-review/harness/index.html?mode='+mode);await page.locator('#root').waitFor();
      await page.getByText(mode==='empty'?'暂无每日复盘。授权 ChatGPT 发布后会在这里展示。':mode==='confirmed'?'AI 复盘 / 已人工确认':'AI 复盘 / 未人工确认',{exact:true}).waitFor();
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: ${mode} bounded layout`);
      if(mode==='stale')check(await page.getByText(/复盘已过期/).count()===1,`${width}: stale warning`);
      const name=`${mode}-${width}.png`;await page.screenshot({path:path.join(output,name),fullPage:true});report.screenshots.push(name);
    }
    await context.close();
  }
  check(report.errors.length===0,'no page runtime errors');
  if(live){const repo=new DailyReviewStore(store,{workspace:config.workspace,scope:'synthetic'});const owner={actor:'owner',owner:config.subject,workspace:config.workspace,scope:'synthetic'};await repo.revoke(owner);await repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:2,action:'withdraw',confirmation:'confirm-exact-review-only'},owner);check(true,'live synthetic data withdrawn and grants revoked; history retained');}
}finally{
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await client.close();await vite.close();
  await fs.unlink(path.join(harness,'main.tsx'));await fs.unlink(path.join(harness,'index.html'));await fs.rmdir(harness);
}
console.log(JSON.stringify(report));
