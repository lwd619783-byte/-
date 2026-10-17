// Exercise actual formal-build CSS with synthetic markup only, never formal JS/data.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.SECURITY_STYLE_ROOT || 'dist/assets';
const output = process.env.SECURITY_STYLE_OUTPUT || 'data-cache/security-style';
await mkdir(output,{recursive:true});
const cssFiles=(await readdir(root)).filter(f=>/^index-.*\.css$/.test(f)).sort(); assert(cssFiles.length);
const css=await Promise.all(cssFiles.map(async file=>({file,content:await readFile(path.join(root,file),'utf8')})));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'formal built CSS with synthetic fixture; not full formal App runtime',browser:browser.version(),assets:css.map(c=>({file:c.file,sha256:createHash('sha256').update(c.content).digest('hex')})),states:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 await page.route('**/*',route=>{report.errors.push('unexpected request');return route.abort();});
 await page.setContent(`<!doctype html><html data-theme="light"><body><main style="padding:24px;max-width:900px"><h1>SYNTHETIC CSS PROBE</h1>
 <button id="tab" class="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-10 border-accent bg-selected text-accent">Synthetic tab</button>
 <input id="filter" class="mt-1 h-11 w-full rounded-md border border-control bg-panel2 px-3 text-sm text-text outline-none transition placeholder:text-textWeak focus:border-accent focus:ring-2 focus:ring-accent sm:h-10" placeholder="Synthetic filter">
 <section id="card" class="rounded-lg border border-borderSoft bg-surface/70 p-3 shadow-soft"><p class="text-textMuted text-xs">Synthetic panel</p></section>
 <div id="hidden" hidden class="flex">Must stay hidden</div><div id="spacing" class="space-y-3"><p>First</p><p hidden>Hidden</p><p>Third</p></div>
 <div id="radius" class="rounded border p-3">Default radius/border</div><div id="small" class="rounded-sm shadow-sm">Small radius/shadow</div>
 </main></body></html>`);
 for(const item of css)await page.addStyleTag({content:item.content});
 const capture=async name=>{await page.waitForTimeout(200); await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});report.states.push({name,elements:await page.locator('main').evaluate(root=>[...root.querySelectorAll('*')].map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{id:el.id,tag:el.tagName,class:el.className,rect:[r.x,r.y,r.width,r.height],style:Object.fromEntries(['display','opacity','color','backgroundColor','borderTopColor','borderTopWidth','borderRadius','fontSize','fontWeight','lineHeight','boxShadow','outlineStyle','outlineWidth','outlineColor','outlineOffset','marginTop','marginBottom','paddingLeft'].map(p=>[p,s[p]]))};}))});};
 await capture('rest'); await page.locator('#filter').focus();await capture('filter-focus'); await page.locator('#tab').focus();await capture('tab-focus');
 assert.equal(await page.locator('#hidden').evaluate(el=>getComputedStyle(el).display),'none');
 assert.equal(await page.locator('#card').evaluate(el=>getComputedStyle(el).borderRadius),'10px');
 assert.equal(await page.locator('#filter').evaluate(el=>getComputedStyle(el).borderRadius),'6px');
 assert.equal(report.errors.length,0);report.status='passed';await page.close();
}catch(e){report.status='failed';report.failure=String(e);process.exitCode=1;}finally{await browser.close();await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,states:report.states.length,output,failure:report.failure}));
