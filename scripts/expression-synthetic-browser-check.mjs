// Frozen synthetic-only temporary harness. Never imports into the production application.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_SYNTHETIC_ORIGIN || 'http://127.0.0.1:4174';
const output = path.resolve(process.env.UI_REVIEW_SYNTHETIC_OUTPUT || 'data-cache/stage-4-3-r3/synthetic-browser');
const harness = path.resolve('data-cache/stage-4-3-r3/browser-harness');
await fs.mkdir(output,{recursive:true}); await fs.mkdir(harness,{recursive:true});
await fs.writeFile(path.join(harness,'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await fs.writeFile(path.join(harness,'main.tsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client';
import '/src/index.css'; import '/src/styles/workspace-v2.css';
import { expressionFixture } from '/src/services/expression.fixture';
import { BrowserClaimRepository, CLAIM_STORAGE_KEY } from '/src/services/verifiedClaimRepository';
import { BrowserThesisRepository, THESIS_STORAGE_KEY } from '/src/services/thesisRepository';
import { BrowserExpressionRepository } from '/src/services/expressionRepository';
import { ExpressionWorkspacePanel } from '/src/components/research/ExpressionWorkspace';
const f=await expressionFixture();
if(localStorage.getItem(CLAIM_STORAGE_KEY)===null)localStorage.setItem(CLAIM_STORAGE_KEY,f.claimStore.getItem(CLAIM_STORAGE_KEY)!);
if(localStorage.getItem(THESIS_STORAGE_KEY)===null)localStorage.setItem(THESIS_STORAGE_KEY,f.thesisStore.getItem(THESIS_STORAGE_KEY)!);
const claimRepository=new BrowserClaimRepository(localStorage,f.claim.owners);
const thesisOwners={claims(){const loaded=claimRepository.load();if(loaded.error)throw Error(loaded.error);return {data:loaded.data,owners:f.claim.owners};},resolveIdentity:f.owners.resolveIdentity};
const thesisRepository=new BrowserThesisRepository(localStorage,thesisOwners);
const owners={scope:'synthetic' as const,theses(){const loaded=thesisRepository.load();if(loaded.error)throw Error(loaded.error);return {data:loaded.data,owners:thesisOwners};},resolveInstrument:f.expressionOwners.resolveInstrument};
const runtime={owners,repository:new BrowserExpressionRepository(localStorage,owners),instruments:f.instruments.map(ref=>({ref,label:ref.id})),thesisRuntime:{owners:thesisOwners,repository:thesisRepository,claimRepository,claimOwners:f.claim.owners,bindings:[f.claim.binding],identities:f.identities.map(ref=>({ref,label:ref.id})),evidence:()=>({title:'Synthetic frozen F2 original Evidence',scope:'synthetic-only',quality:[],rows:[{label:'Original graph',value:JSON.stringify(f.claim.graph)}],records:[],linkage:null})}};
function successor(){const data=thesisRepository.load().data,head=data.revisions.at(-1)!;thesisRepository.saveDraft(data,{...head,revisionId:'synthetic-thesis-successor',supersedes:head.revisionId,createdAt:new Date().toISOString(),asOf:new Date().toISOString(),reason:'Synthetic later successor'});}
createRoot(document.getElementById('root')!).render(<main style={{padding:12}}><p>SYNTHETIC ONLY · frozen F2 service acceptance</p><ExpressionWorkspacePanel runtime={runtime}/><button onClick={successor}>Synthetic Thesis successor</button></main>);
`);
const report={scope:'SYNTHETIC_FROZEN_F2_ONLY',checks:[],errors:[],consoleErrors:[],screenshots:[],sourceSha256:{}};
for(const file of ['contracts/investment-expression/v1/expression.schema.json','src/services/expressionValidator.generated.mjs','src/types/investmentExpression.ts','src/services/investmentExpression.ts','src/services/expressionRepository.ts','src/services/expression.fixture.ts','src/components/research/ExpressionWorkspace.tsx'])report.sourceSha256[file]=createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex');
const check=(ok,name)=>{report.checks.push({ok,name});if(!ok)throw Error(name);};
const browser=await chromium.launch({channel:'msedge',headless:true});
const bytes=page=>page.evaluate(()=>Object.fromEntries(['claim','thesis','expression'].map(k=>[k,localStorage.getItem('investment-research-dashboard.'+k+'.v1')])));
try{
  for(const width of [320,390,1536]){
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.consoleErrors.push(e.text());});
    await page.goto(origin+'/data-cache/stage-4-3-r3/browser-harness/index.html');
    const panel=page.getByRole('region',{name:'Investment Expression V1',exact:true});await panel.waitFor();
    const initial=await bytes(page);
    check(JSON.parse(initial.thesis).confirmations.length===1&&JSON.parse(initial.claim).reviews[0].decision==='VERIFIED',`original frozen service authority ${width}`);
    check(initial.expression===null,`no automatic Expression ${width}`);
    for(const [index,type] of ['ETF','Index','Equity'].entries()){
      await panel.getByRole('button',{name:'新建 Expression 草稿',exact:true}).click();
      await panel.getByLabel('正式 Thesis 精确版本').selectOption({index:1});
      await panel.getByLabel('投资标的',{exact:true}).selectOption({label:`synthetic-${type} · ${type} · ${type==='Equity'?'Stock':'Asset'}:synthetic-${type}`});
      await panel.getByLabel('表达角色',{exact:true}).selectOption('direct');
      await panel.getByLabel('直接性理由状态').selectOption('research_judgement');
      await panel.getByLabel('直接性理由',{exact:true}).fill(`Synthetic qualitative ${type} directness`);
      await panel.getByLabel('Expression 修订说明').fill(`Synthetic ${type} first revision`);
      await panel.getByRole('button',{name:'保存 Expression 草稿'}).click();
      const draft=await bytes(page),data=JSON.parse(draft.expression);
      check(data.confirmations.length===index&&data.revisions.length===index+1,`${type} draft not formal ${width}`);
      await panel.getByRole('button',{name:'生成 Expression 确认预览'}).click();
      check(await panel.getByRole('button',{name:'本人确认正式 Expression'}).isDisabled(),`${type} explicit note required ${width}`);
      check(JSON.stringify(await bytes(page))===JSON.stringify(draft),`${type} preview read only ${width}`);
      await panel.getByLabel('Expression 本人确认说明').fill(`Synthetic ${type} explicit confirmation`);
      await panel.getByRole('button',{name:'本人确认正式 Expression'}).click();
      const formal=await bytes(page),saved=JSON.parse(formal.expression);
      check(saved.confirmations.length===index+1,`${type} formal ${width}`);
      check(JSON.stringify(saved.revisions[index])===JSON.stringify(data.revisions[index]),`${type} immutable revision ${width}`);
      check(formal.claim===initial.claim&&formal.thesis===initial.thesis,`${type} no upstream writes ${width}`);
    }
    const formal=await bytes(page);
    await panel.getByText('Expression 版本历史与 diff（1）').first().click();
    await panel.getByRole('button',{name:'Expression → Thesis → Claim → Evidence',exact:true}).first().click();
    const modal=page.getByRole('dialog',{name:'Expression 精确引用链'});await modal.waitFor();
    check((await modal.innerText()).includes('synthetic-thesis-r1')&&(await modal.innerText()).includes('synthetic-revision-1'),`exact Thesis/Claim trace ${width}`);
    await modal.getByRole('button',{name:'查看 Expression 原始 Evidence'}).click();
    const drawer=page.getByRole('dialog',{name:'证据核对'});await drawer.waitFor();
    check((await drawer.innerText()).includes('Synthetic frozen F2 original Evidence'),`original Evidence drawer ${width}`);
    check(JSON.stringify(await bytes(page))===JSON.stringify(formal),`history/trace preserves all raw bytes ${width}`);
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await panel.getByRole('button',{name:'修订 Expression 为新草稿'}).first().click();
    await panel.getByLabel('表达角色',{exact:true}).selectOption('defensive');await panel.getByLabel('Expression 修订说明').fill('Synthetic second ETF revision');
    await panel.getByRole('button',{name:'保存 Expression 草稿'}).click();
    await panel.getByRole('button',{name:'生成 Expression 确认预览'}).click();await panel.getByLabel('Expression 本人确认说明').fill('Synthetic second confirmation');
    await panel.getByRole('button',{name:'本人确认正式 Expression'}).click();
    const second=await bytes(page),secondData=JSON.parse(second.expression),firstData=JSON.parse(formal.expression);
    check(secondData.revisions.length===4&&secondData.confirmations.length===4,`revision/confirmation append ${width}`);
    check(JSON.stringify(secondData.revisions.slice(0,3))===JSON.stringify(firstData.revisions)&&JSON.stringify(secondData.confirmations.slice(0,3))===JSON.stringify(firstData.confirmations),`old history immutable ${width}`);
    await page.reload();await panel.waitFor();check(JSON.stringify(await bytes(page))===JSON.stringify(second),`reload exact bytes ${width}`);
    // Prepare a valid historical preview, mutate original Thesis head, then attempt confirmation without refreshing.
    await panel.getByRole('button',{name:'修订 Expression 为新草稿'}).first().click();await panel.getByLabel('Expression 修订说明').fill('Synthetic authority race');await panel.getByRole('button',{name:'保存 Expression 草稿'}).click();
    await panel.getByRole('button',{name:'生成 Expression 确认预览'}).click();await panel.getByLabel('Expression 本人确认说明').fill('Must recheck authority');
    const race=await bytes(page);await page.getByRole('button',{name:'Synthetic Thesis successor',exact:true}).click();await panel.getByRole('button',{name:'本人确认正式 Expression'}).click();
    check((await panel.getByRole('alert').innerText()).includes('读取或操作已阻断'),`preview head change denied ${width}`);
    check((await bytes(page)).expression===race.expression,`race writes no confirmation ${width}`);
    await panel.getByRole('button',{name:'重新载入 Expression'}).click();
    check(await panel.getByText('基础 Thesis 已有新版本 / 需复核；历史精确引用保持不变。').count()===3,`all historical expressions marked for review ${width}`);
    check(await panel.getByTestId('expression-counts').innerText()==='3 formal Expression',`historical formal preserved ${width}`);
    // Replace only the pending draft, using current asOf: the old pin must now block.
    await panel.getByRole('button',{name:'修订 Expression 为新草稿'}).first().click();await panel.getByLabel('Expression 修订说明').fill('Synthetic post-successor asOf');await panel.getByRole('button',{name:'保存 Expression 草稿'}).click();
    await panel.getByRole('button',{name:'生成 Expression 确认预览'}).click();await panel.getByLabel('Expression 本人确认说明').fill('Denied superseded pin');
    check(await panel.getByRole('button',{name:'本人确认正式 Expression'}).isDisabled(),`superseded asOf confirmation blocked ${width}`);
    check((await panel.innerText()).includes('基础 Thesis 在此 asOf 已有后续版本'),`superseded explanation ${width}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`viewport fits ${width}`);
    check(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),`reduced motion ${width}`);
    const file=`expression-synthetic-${width}.png`;await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);
    await context.close();
  }
  check(report.errors.length===0,'zero runtime errors');report.status='PASS';
}catch(e){report.status='FAIL';report.failure=String(e);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,output}));
