// Run from repository root. Verify original and new evidence bytes on disk or in Git.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root='docs/tailwind4-security-20261017';
const mode=process.argv[2]||'disk';assert(['disk','index','HEAD'].includes(mode));
const read=f=>mode==='disk'?readFileSync(f):execFileSync('git',['show',`${mode==='index'?'':'HEAD'}:${f}`],{maxBuffer:32*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifests=['docs/research-os-round1-20261016/evidence/evidence-manifest.json','docs/research-os-round1-20261016/remediation-r1/evidence/evidence-manifest.json','docs/research-os-desktop-20261017/evidence-manifest.json',root+'/evidence-manifest.json'];
const verified=manifests.map(f=>{const m=JSON.parse(read(f));for(const e of m.files){const bytes=read(path.join(path.dirname(f),e.file));assert.equal(bytes.length,e.bytes,e.file);assert.equal(hash(bytes),e.sha256,e.file);}return{manifest:f,files:m.files.length,status:'passed'};});
const v=JSON.parse(read(root+'/verification.json'));
for(const ref of v.allCommandReceipts){const r=JSON.parse(read(root+'/'+ref));assert.equal(hash(read(root+'/evidence/commands/'+r.log)),r.logSha256,r.label);}
for(const r of v.finalCommands){assert.equal(r.sha,v.testedCodeSha);assert.deepEqual(r.worktree,[]);assert.equal(r.exitCode,r.label==='security-final-braces-absent'?1:0,r.label);}
const d=v.screenshots.smallScreenDeduplication;assert.equal(hash(read(root+'/'+d.storedAt)),d.sha256);
for(const f of ['audit-after.json','audit-after-production.json']){const a=JSON.parse(read(root+'/evidence/'+f));assert.equal(a.metadata.vulnerabilities.total,0);}
const diff=(base,files)=>execFileSync('git',['diff',base,'--',...files],{encoding:'utf8',maxBuffer:8*1024*1024});
assert.equal(diff(v.testedCodeSha,['.',':!docs']),'','runtime must remain identical to tested implementation');
assert.equal(diff(v.baseSha,['docs/research-os-round1-20261016','docs/research-os-desktop-20261017']),'','historical evidence must stay unchanged');
console.log(JSON.stringify({status:'passed',mode,verified,commandReceipts:v.allCommandReceipts.length,finalCleanCommands:v.finalCommands.length,runtimeUnchangedFromTestedCode:v.testedCodeSha},null,2));
