// Deterministic local closeout evidence checks. PASS never grants independent audit or admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = '17a2e1929c1d7570e477a5e19aadbeee29aa04f5';
const root = path.resolve('data-cache/stage-4-3-r3');
const hash = data => createHash('sha256').update(data).digest('hex');
const read = p => fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const checks = [];
const check = (name, fn) => { fn(); checks.push({name,status:'PASS'}); };
check('frozen owners, raw data, permissions and F3 baselines unchanged', () => {
  const protectedPaths = ['contracts/v1','contracts/financial-research','contracts/verified-claim','contracts/thesis','contracts/stage-4-1','research-data','config/industry','config/market-regime','local-core','src/data',
    'src/services/verifiedClaim.ts','src/services/verifiedClaimRepository.ts','src/services/thesis.ts','src/services/thesisRepository.ts','scripts/research-eval','docs/data-audit-v1.md'];
  assert.equal(execFileSync('git',['diff','--name-only',base,'--',...protectedPaths],{encoding:'utf8'}).trim(),'');
});
check('closed Expression schema rejects allocation/trading/score fields', () => {
  const schema = JSON.parse(read('contracts/investment-expression/v1/expression.schema.json'));
  assert.equal(schema.additionalProperties,false); assert.equal(schema.$defs.Revision.additionalProperties,false);
  for (const k of ['quantity','position','transaction','expectedReturn','targetPrice','score','probability','targetAllocation','rebalance']) assert.ok(!(k in schema.$defs.Revision.properties));
  assert.deepEqual(schema.$defs.Instrument.properties.type.enum,['Index','ETF','Fund','Equity','CommodityProxy']);
});
check('production bundle excludes synthetic frozen fixture', () => {
  const assets = fs.readdirSync('dist/assets').filter(n => n.endsWith('.js')); assert.ok(assets.length>0);
  for(const file of assets) {
    const source=read(path.join('dist/assets',file));
    for(const marker of ['Synthetic initial expression','synthetic-expression-ETF','Synthetic explicit Thesis confirmation']) assert.ok(!source.includes(marker),`${file}: ${marker}`);
  }
});
const reports = [['real-browser',43],['synthetic-browser',103],['r1-browser',130],['r2-real-browser',49],['r2-synthetic-browser',76]];
for(const [folder,denominator] of reports) check(`${folder} full denominator and exact source pins`, () => {
  const report=JSON.parse(read(path.join(root,folder,'report.json')));
  assert.equal(report.checks.length,denominator); assert.ok(report.checks.every(c => c.ok === true || c.pass === true)); assert.equal(report.errors.length,0);
  if(report.status) assert.equal(report.status,'PASS');
  assert.ok(Object.keys(report.sourceSha256).length>0);
  for(const [file,sha] of Object.entries(report.sourceSha256)) {
    assert.equal(hash(read(file)),sha,`source drift ${file}`);
    if(process.argv.includes('--head')) assert.equal(hash(execFileSync('git',['show',`HEAD:${file}`])),sha,`HEAD source drift ${file}`);
  }
  if(folder==='real-browser') assert.deepEqual(report.real,{candidates:5,verifiable:0,verified:0,formalThesis:0,formalExpression:0});
  if(folder==='synthetic-browser') assert.equal(report.scope,'SYNTHETIC_FROZEN_F2_ONLY');
});
check('CURRENT stops at independent audit; legacy gaps and future stages remain explicit', () => {
  const doc=read('docs/stage-4-3-r3-investment-expression-closeout.md');
  for(const term of ['CLOSEOUT READY','PENDING INDEPENDENT AUDIT','PENDING / NOT_REVERIFIED','PLANNED / NOT_IMPLEMENTED','LocalStorage','R0','R1','R2','R3'])assert.ok(doc.includes(term),term);
  for(const file of ['docs/feature-registry.md','docs/development-execution-plan-2026-09-07.md','docs/current-development-direction-2026-09-13.md'])assert.ok(read(file).slice(0,1800).includes('CLOSEOUT READY'),file);
});
console.log(JSON.stringify({status:'PASS',scope:'LOCAL_CLOSEOUT_ONLY_PENDING_INDEPENDENT_AUDIT',base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks},null,2));
