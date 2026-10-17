import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const base='fd0009db95148e72f6e8804b37618634274c588c';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:4*1024*1024});
const branch=git('branch','--show-current').trim();assert.equal(branch,'fix/tailwind4-security-no-deploy');git('merge-base','--is-ancestor',base,'HEAD');
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const before=f=>JSON.parse(git('show',`${base}:${f}`));
const pkg=await json('package.json'),expected=before('package.json');
expected.devDependencies.tailwindcss='4.3.3';expected.devDependencies['@tailwindcss/postcss']='4.3.3';expected.devDependencies.vite='6.4.3';delete expected.devDependencies.autoprefixer;
expected.scripts['security:audit']='npm audit --audit-level=high';expected.scripts['security:audit:production']='npm audit --omit=dev --audit-level=high';
assert.deepEqual(pkg,expected,'only authorized toolchain dependencies and audit scripts may change');
const lock=await json('package-lock.json'),old=before('package-lock.json');
for(const [name,record] of Object.entries(lock.packages))if(old.packages[name]&&old.packages[name].version!==record.version)assert(['node_modules/tailwindcss','node_modules/jiti'].includes(name),`unexpected version change ${name}`);
assert.equal(lock.packages['node_modules/vite'].version,'6.4.3');
for(const name of ['braces','chokidar','micromatch','fast-glob'])assert(!Object.keys(lock.packages).some(key=>key.endsWith('/'+name)),`old vulnerable chain ${name}`);
const deploy=await json('vercel.json'),prior=before('vercel.json');prior.git.deploymentEnabled[branch]=false;assert.deepEqual(deploy,prior);
const steps='      - name: Audit all dependencies including build tooling (blocks high and critical)\n        run: npm run security:audit\n\n      - name: Audit production dependency closure (blocks high and critical)\n        run: npm run security:audit:production\n\n';
const ci=await readFile('.github/workflows/ci.yml','utf8');assert(ci.includes(steps));assert.equal(ci.replace(steps,''),git('show',`${base}:.github/workflows/ci.yml`),'existing CI checks/triggers must remain intact');
assert.equal(git('diff',base,'--','src/data','research-data','contracts','local-core','server','api','src/App.tsx','src/main.tsx','src/demo','src/components','vite.config.ts','vite.demo.config.mjs','scripts/demo-boundary.mjs','scripts/check-demo-bundle.mjs','scripts/round-one-browser-check.mjs','scripts/demo-browser-check.mjs'),'','business/runtime/isolation/browser gates unchanged');
const inventory=await json('dist-demo/demo-asset-inventory.json');assert.equal(inventory.scope,'synthetic-only');assert.equal(inventory.forbiddenContentMatches,0);assert.equal(inventory.secretPatternMatches,0);
async function walk(root){return(await Promise.all((await readdir(root,{withFileTypes:true})).map(f=>f.isDirectory()?walk(path.join(root,f.name)):path.join(root,f.name)))).flat();}
let checked=0;for(const f of await walk('dist'))if(/\.(js|html|css)$/.test(f)){checked++;assert(!/synthetic-oversold-backup-v1|OVERSOLD LAB|demo-sidebar-toggle/.test(await readFile(f,'utf8')),'demo leaked into formal assets');}
assert(checked>0);
console.log(JSON.stringify({status:'passed',scope:'authorized Tailwind4 security profile for desktop integrity',base,branch,automaticDeployment:false,oldVulnerableChainAbsent:true,vite:'6.4.3',originalCIGatesPreserved:true,formalFilesChecked:checked,demoGraphModules:inventory.checkedGraphModules,restrictedLiterals:inventory.restrictedLiteralsChecked},null,2));
