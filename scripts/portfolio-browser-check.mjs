// Isolated browser profiles and synthetic harness only. No private data or broker access.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const {chromium}=createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE||'playwright');
const real=process.env.UI_REVIEW_ORIGIN||'http://127.0.0.1:4183',dev=process.env.UI_REVIEW_SYNTHETIC_ORIGIN||'http://127.0.0.1:4184';
const output=path.resolve('data-cache/stage-4-4/browser'),harness=path.resolve('data-cache/stage-4-4/browser-harness');
await fs.mkdir(output,{recursive:true});await fs.mkdir(harness,{recursive:true});
await fs.writeFile(path.join(harness,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><main id="root" style="padding:16px;max-width:1100px;margin:auto"></main><script type="module" src="./main.tsx"></script></body></html>');
await fs.writeFile(path.join(harness,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';import '/src/styles/workspace-v2.css';
import {PortfolioWorkspacePanel} from '/src/components/portfolio/PortfolioWorkspace';import {portfolioFixture} from '/src/services/portfolio.fixture';import {claimTime as at} from '/src/services/verifiedClaim.fixture';
const f=await portfolioFixture();for(const [name,store] of [['claim',f.claimStore],['thesis',f.thesisStore],['expression',f.storage]]){const key='synthetic-portfolio-upstream-'+name;const prior=localStorage.getItem(key);if(prior){for(const [k,v] of JSON.parse(prior))store.setItem(k,v);}else localStorage.setItem(key,JSON.stringify([...store.values]));}const read=async()=>f.projection;const clock=()=>new Date(at(12));
window.portfolioTest={bump(){f.tick(14);f.thesisRepo.saveDraft(f.thesisRepo.load().data,{...f.thesisRepo.load().data.revisions[0],revisionId:'synthetic-successor',supersedes:f.revision.revisionId,createdAt:at(13),asOf:at(13)});},unavailable(){f.owners.expressions=()=>{throw Error('OWNER_UNAVAILABLE');};}};
createRoot(document.getElementById('root')).render(<PortfolioWorkspacePanel owners={f.owners} read={read} clock={clock} evidence={()=>({title:'Synthetic original Evidence',scope:'synthetic-only',quality:[],rows:[],records:[],linkage:null})}/>);
`);
const report={scope:'ISOLATED_REAL_EMPTY_AND_SYNTHETIC_CAPABILITY',checks:[],errors:[],screenshots:[],sourceSha256:{},realCreated:{projection:0,position:0,researchLink:0,target:0,rebalance:0}};
for(const file of ['shared/portfolio.mjs','src/services/portfolio.ts','src/services/portfolioRepository.ts','src/services/portfolioPlanning.ts','src/services/portfolioWorkspace.ts','src/components/portfolio/PortfolioWorkspace.tsx','src/components/portfolio/portfolio.css'])report.sourceSha256[file]=createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex');
const check=(ok,name)=>{report.checks.push({ok,name});if(!ok)throw Error(name);};
const browser=await chromium.launch({channel:'msedge',headless:true}),key='investment-research-dashboard.portfolio-planning.v1';
try {
  for(const width of [320,390,1536]) {
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(real+'/#/portfolio');await page.getByRole('heading',{name:'持仓与研究暴露',exact:true}).waitFor();
    await page.getByText('本机组合读取尚未连接或被阻断；持仓数量和总额未知。').waitFor();
    check(await page.evaluate(k=>localStorage.getItem(k),key)===null,`real no invented planning ${width}`);
    check(await page.getByText('尚未连接组合数据',{exact:true}).count()===1,`real disconnected ${width}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`real viewport ${width}`);
    await page.screenshot({path:path.join(output,`real-${width}.png`),fullPage:true});report.screenshots.push(`real-${width}.png`);
    await page.goto(dev+'/data-cache/stage-4-4/browser-harness/index.html');await page.getByText(/2 个已记录仓位/).waitFor();
    check(await page.getByText('合成能力测试',{exact:true}).count()===1,`synthetic explicit scope ${width}`);
    await page.getByLabel('币种与快照范围').selectOption({index:1});
    check(await page.getByLabel('a 目标比例').inputValue()==='',`no default target ${width}`);
    await page.getByLabel('a 目标比例').fill('50');await page.getByLabel('b 目标比例').fill('50');await page.getByLabel('配置理由').fill('Synthetic browser target');
    await page.getByRole('button',{name:'预览目标配置',exact:true}).click();
    check(await page.evaluate(k=>localStorage.getItem(k),key)===null,`preview read only ${width}`);
    await page.getByRole('button',{name:'本人确认保存',exact:true}).click();await page.getByText('配置版本历史（1）',{exact:true}).waitFor();
    check(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)).targets.length===1,`confirmed target ${width}`);
    await page.getByRole('combobox',{name:/^仓位/}).selectOption({index:1});await page.getByRole('combobox',{name:/^正式研究表达/}).selectOption({index:1});await page.getByLabel('关联理由',{exact:true}).fill('Synthetic linked reason');
    await page.getByRole('button',{name:'预览研究关联',exact:true}).click();await page.getByRole('button',{name:'本人确认保存',exact:true}).click();await page.getByText('Synthetic linked reason',{exact:true}).first().waitFor();
    check(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)).links.length===1,`exact research link ${width}`);
    await page.getByText('版本、证据与计算来源',{exact:true}).first().click();await page.getByRole('button',{name:/查看原始 Evidence/}).first().click();
    check(await page.getByRole('dialog').count()===1,`original evidence drawer ${width}`);await page.keyboard.press('Escape');
    await page.getByLabel('复核说明',{exact:true}).fill('Synthetic task reviewed');await page.getByRole('button',{name:'预览复核记录',exact:true}).first().click();await page.getByRole('button',{name:'本人确认保存',exact:true}).click();
    await page.getByText(/已复核（执行仍阻断）/).waitFor();check(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)).reviews.length===1,`review without execution ${width}`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`synthetic viewport ${width}`);
    const raw=await page.evaluate(k=>localStorage.getItem(k),key);await page.reload();await page.getByText(/2 个已记录仓位/).waitFor();
    check(await page.evaluate(k=>localStorage.getItem(k),key)===raw,`reload preserves exact history ${width}`);
    await page.getByText(/已复核（执行仍阻断）/).waitFor();check(await page.getByText(/研究状态：关系已知/).count()===1,`original authority still resolves on reload ${width}`);
    await page.screenshot({path:path.join(output,`synthetic-${width}.png`),fullPage:true});report.screenshots.push(`synthetic-${width}.png`);
    await page.evaluate(k=>localStorage.setItem(k,'{"schemaVersion":"portfolio-planning.v99"}'),key);await page.reload();await page.getByText(/写入已锁定/).waitFor();
    check(await page.getByRole('button',{name:'预览研究关联',exact:true}).isDisabled(),`future version locked ${width}`);
    check(await page.evaluate(k=>localStorage.getItem(k),key)==='{"schemaVersion":"portfolio-planning.v99"}',`future bytes retained ${width}`);
    await context.close();
  }
  const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(dev+'/data-cache/stage-4-4/browser-harness/index.html');await page.getByText(/2 个已记录仓位/).waitFor();
  await page.getByRole('combobox',{name:/^仓位/}).selectOption({index:1});await page.getByRole('combobox',{name:/^正式研究表达/}).selectOption({index:1});await page.getByLabel('关联理由',{exact:true}).fill('Synthetic stale preview');await page.getByRole('button',{name:'预览研究关联',exact:true}).click();await page.evaluate(()=>window.portfolioTest.bump());await page.getByRole('button',{name:'本人确认保存',exact:true}).click();
  await page.getByText('操作未完成，请检查输入与原始依据。').waitFor();check(await page.evaluate(k=>localStorage.getItem(k),key)===null,'upstream drift blocks confirmation');await context.close();
  check(report.errors.length===0,'zero page runtime errors');report.status='PASS';
}catch(e){report.status='FAIL';report.failure=String(e);process.exitCode=1;}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,failure:report.failure}));
