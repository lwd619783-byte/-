import test from 'node:test';
import assert from 'node:assert/strict';
import { context, position, approval } from './asset-fixtures.mjs';
import { contracts } from './fixtures.mjs';
import { readPortfolio } from '../../.local-core-build/domain/portfolio-projection.js';

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
