import test from 'node:test';
import assert from 'node:assert/strict';
import { context, position, approval, account, asset } from './asset-fixtures.mjs';
import { contracts } from './fixtures.mjs';
import { validateProjection } from '../../shared/portfolio.mjs';
import { readPortfolio } from '../../.local-core-build/domain/portfolio-projection.js';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { tempDirectory } from './fixtures.mjs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

test('projection reads official receipts and does not change ledger or Audit', t => {
  const c = context(t); c.service.createPosition(position(), approval('portfolio-snapshot'));
  const before = JSON.stringify([c.ledger.accounts(),c.ledger.assets(),c.ledger.positions(),c.ledger.transactions(),c.audit.listByRequest('portfolio-snapshot')]);
  const p = readPortfolio(c.ledger, c.audit, contracts, new Date(Date.now()+1000).toISOString(), 'synthetic');
  assert.equal(p.positions.length, 1); assert.equal(p.positions[0].marketValue, 100);
  assert.equal(JSON.stringify([c.ledger.accounts(),c.ledger.assets(),c.ledger.positions(),c.ledger.transactions(),c.audit.listByRequest('portfolio-snapshot')]), before);
});
test('original confirmation absence and authority drift fail closed', t => {
  const c = context(t); c.service.createPosition(position(), approval('portfolio-snapshot'));
  assert.throws(() => readPortfolio({...c.ledger, fingerprint:()=>undefined}, c.audit, contracts, new Date().toISOString()), /CONFIRMATION/);
  assert.throws(() => readPortfolio({...c.ledger, positions:()=>[{...position(),quantity:999}]}, c.audit, contracts, new Date().toISOString()), /CONFIRMATION/);
});
test('historical read does not expose later confirmed backfill', t => {
  const c = context(t); c.service.createPosition(position(), approval('portfolio-snapshot'));
  assert.equal(readPortfolio(c.ledger, c.audit, contracts, '2026-08-15T00:00:00.000Z').positions.length, 0);
});
test('consistent readonly SQLite snapshot cannot write and preserves DB bytes', t => {
  const filename=join(tempDirectory(t),'portfolio.sqlite');
  const initial=openLocalDatabase({filename,purpose:'test',mode:'initialize'},contracts);initial.database.close();
  const bytes=readFileSync(filename),store=openLocalDatabase({filename,purpose:'test',mode:'readonly'},contracts);
  try {
    const p=store.readAssetSnapshot((reads,audit)=>{assert.equal(reads.createAccount,undefined);assert.equal(audit.append,undefined);return readPortfolio(reads,audit,contracts,new Date().toISOString(),'synthetic');});
    assert.equal(p.positions.length,0);assert.throws(()=>store.database.transaction(()=>undefined));
    assert.throws(()=>store.readAssetSnapshot(async()=>undefined));
  } finally {store.database.close();}
  assert.deepEqual(readFileSync(filename),bytes);
});

for (const status of ['active','inactive','archived']) test(`official Account ${status} propagates with confirmed receipt and no ledger changes`, t => {
  const c=context(t,false);
  c.service.createAccount(account({status}),approval('lifecycle-account'));
  c.service.createAsset(asset(),approval('lifecycle-asset'));
  c.service.createPosition(position(),approval('lifecycle-position'));
  const before=JSON.stringify([c.ledger.accounts(),c.ledger.positions()]);
  const p=readPortfolio(c.ledger,c.audit,contracts,new Date(Date.now()+1000).toISOString(),'synthetic');
  assert.deepEqual(validateProjection(p),p); assert.equal(p.positions[0].accountStatus,status);
  assert.equal(p.cohorts[0].total,100); assert.equal(p.status,'partial');
  assert.equal(p.positions[0].blockers.includes(`ACCOUNT_${status.toUpperCase()}`),status!=='active');
  assert.equal(p.positions[0].lineage.account.auditEventId,c.ledger.operation(c.ledger.fingerprint('id:account:fixture-account').operationKey).auditEventId);
  assert.throws(()=>readPortfolio({...c.ledger,accounts:()=>[account({status:status==='active'?'archived':'active'})]},c.audit,contracts,p.asOf),/CONFIRMATION/);
  assert.equal(JSON.stringify([c.ledger.accounts(),c.ledger.positions()]),before);
});
