// Use the actual formal build entry's existing synthetic UI-review route.
// The BusinessApp never mounts; no formal data endpoints are served.
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const { chromium }=createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE||'playwright');
const output=process.env.SECURITY_FORMAL_OUTPUT||'data-cache/security-formal';await mkdir(output,{recursive:true});
const allowed=new Map();for(const file of ['index.html',...(await readdir('dist/assets')).filter(f=>/\.(js|css)$/.test(f)).map(f=>'assets/'+f)]){const bytes=await readFile(process.env.SECURITY_FORMAL_BASELINE_CSS && /^assets\/index-.*\.css$/.test(file) ? process.env.SECURITY_FORMAL_BASELINE_CSS : 'dist/'+file);allowed.set('/'+file,{bytes,sha256:createHash('sha256').update(bytes).digest('hex')});}
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,f=p==='/'?'/index.html':p,a=allowed.get(f);if(!a)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');res.end(a.bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineCss:process.env.SECURITY_FORMAL_BASELINE_CSS||null,scope:'formal production entry with existing ui-review=1 synthetic fixtures; BusinessApp not mounted',snapshots:[],checks:[],errors:[],requests:[],blockedRequests:[],screenshots:[]};
const check=(ok,name)=>{report.checks.push({name,ok});assert(ok,name);};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});report.browser=browser.version();
try{for(const width of [1440,1920,390]){const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
 await context.addInitScript(()=>{localStorage.setItem('security-synthetic-sentinel','unchanged');const get=Storage.prototype.getItem;window.__storageEvents=[];for(const name of ['getItem','setItem','removeItem','clear']){const original=Storage.prototype[name];Storage.prototype[name]=function(...args){window.__storageEvents.push(name);return original.apply(this,args);};}window.__sentinel=()=>get.call(localStorage,'security-synthetic-sentinel');});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin||!(u.pathname==='/'||allowed.has(u.pathname))){report.blockedRequests.push(u.origin===origin?u.pathname:'external');return route.abort();}report.requests.push({path:u.pathname,sha256:allowed.get(u.pathname==='/'?'/index.html':u.pathname).sha256});return route.continue();});
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-10-17T03:00:00Z'));page.on('pageerror',e=>report.errors.push(e.message));
 for(const route of ['home','stocks','watchlist','expectations']){
  await page.goto(`${origin}/?ui-review=1&profile=full#/${route}`);await page.locator('[data-ui-review="full"]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await page.waitForTimeout(200);
  check(await page.getByRole('complementary',{name:'界面验收模式'}).isVisible(),`${width}/${route} synthetic mode visible`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${route} no horizontal overflow`);
  check(await page.evaluate(()=>window.__storageEvents.length===0&&window.__sentinel()==='unchanged'),`${width}/${route} no business storage reads/writes`);
  report.snapshots.push({width,route,elements:await page.locator('body').evaluate(root=>[...root.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,class:el.getAttribute('class'),rect:[r.x,r.y,r.width,r.height],style:Object.fromEntries(['display','color','backgroundColor','borderTopColor','borderBottomColor','marginTop','marginBottom','paddingTop','paddingBottom','fontSize','lineHeight'].map(p=>[p,s[p]]))};}))});
  if(width>=800){const file=`${width}-${route}.png`;await page.screenshot({path:path.join(output,file),fullPage:true});const bytes=await readFile(path.join(output,file));report.screenshots.push({file,width,height:960,capturedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex')});}
 }
 await context.close();}
 check(report.errors.length===0,'zero runtime errors');check(report.blockedRequests.length===0,'zero non-asset/data/service requests');report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure,output}));
