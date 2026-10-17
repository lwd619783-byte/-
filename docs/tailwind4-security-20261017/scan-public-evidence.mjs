// Compare restricted sources without printing or copying their values.
import assert from 'node:assert/strict';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const root='docs/tailwind4-security-20261017';
const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();
const needles=new Set();
const collect=value=>{if(typeof value==='string'&&value.trim().length>=32)needles.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};
const sources=['industries.ts','industryChainResearch.ts','stocks.ts','unitreeHistoricalResearch.ts','privateCompanies.ts','real/research.generated.json','real/signals.generated.json'];
for(const f of sources){const raw=await readFile('src/data/'+f,'utf8');if(f.endsWith('.json'))collect(JSON.parse(raw));else{const src=ts.createSourceFile(f,raw,ts.ScriptTarget.Latest,true);const visit=n=>{if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))collect(n.text);ts.forEachChild(n,visit);};visit(src);}}
const files=await walk(root),textFiles=files.filter(f=>!f.endsWith('.png'));let characters=0;
const hosts=new Set();
for(const file of textFiles){const raw=await readFile(file,'utf8');characters+=raw.length;assert(!/-----BEGIN [\w ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}/.test(raw),'secret pattern in '+file);for(const value of needles)assert(!raw.includes(value)&&!raw.includes(JSON.stringify(value).slice(1,-1)),'restricted content in '+file);for(const url of raw.matchAll(/https?:\/\/[^\s<>"\\)]+/g)){const host=new URL(url[0]).hostname;assert(['github.com','registry.npmjs.org','tailwindcss.com','rollupjs.org'].includes(host),'unreviewed URL host in '+file);hosts.add(host);}}
const result={status:'passed',files:files.length,textFiles:textFiles.length,characters,restrictedSourceFiles:sources.length,restrictedLiterals:needles.size,restrictedMatches:0,secretMatches:0,urlHosts:[...hosts].sort(),scope:'new public evidence only; PNGs are synthetic browser captures, separately hash-verified and visually sampled'};
await writeFile(root+'/evidence/public-content-scan.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
