import fs from 'node:fs';
import assert from 'node:assert/strict';
const receipt=JSON.parse(fs.readFileSync('dist/local-core-boundary.json','utf8'));
assert.equal(receipt.forbiddenModules,0);assert.equal(receipt.status,'passed');
const js=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(`dist/assets/${f}`,'utf8')).join('\n');
for(const marker of ['Synthetic user-selected research relationship','synthetic-link-r1','portfolioFixtureProjection','process.env.PORTFOLIO_LOCAL_DB','better-sqlite3','portfolio-cli.js'])assert.ok(!js.includes(marker),`Forbidden production marker: ${marker}`);
for(const f of ['src/services/portfolio.ts','src/services/portfolioPlanning.ts','src/services/portfolioRepository.ts','src/services/portfolioWorkspace.ts','src/components/portfolio/PortfolioWorkspace.tsx']) {
  const source=fs.readFileSync(f,'utf8');assert.ok(!/from\s+['"][^'"]*(?:fixture|local-core)/.test(source),`Runtime fixture/Node import: ${f}`);
  assert.ok(!/\.createTransaction\(|\.appendTransaction\(|\.appendPosition\(/.test(source),`Ledger mutation: ${f}`);
}
console.log('Portfolio browser boundary / fixture isolation / ledger write absence: PASS');
