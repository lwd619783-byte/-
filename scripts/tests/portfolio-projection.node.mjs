import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPortfolio, sumAmounts, validateProjection } from '../../shared/portfolio.mjs';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { portfolioRequestAllowed } from '../portfolio-seam.mjs';

const receipt = { recordedAt: '2026-08-15T00:00:00.000Z', operationKey: 'synthetic', auditEventId: 'synthetic', payloadDigest: 'a'.repeat(64) };
export const syntheticInput = () => ({ schemaVersion: 'portfolio-input.v1', scope: 'synthetic', accounts: [{ accountId: 'a', name: 'Synthetic account', status: 'active', receipt }], assets: ['x','y'].map(assetId => ({ assetId, name: `Synthetic ${assetId}`, assetType: 'fund', primaryCategory: 'test', strategyBucket: null, instrumentId: null, receipt })), snapshots: ['x','y'].map((assetId, i) => ({ snapshotId: assetId, snapshotDate: '2026-08-15', accountId: 'a', assetId, quantity: 10, marketValue: (i + 1) * 100, currency: 'CNY', receipt, warnings: [] })) });
const cutoff = '2026-08-16T00:00:00.000Z';
test('same currency decimal exposure and exact lineage are reproducible', () => { const p = projectPortfolio(syntheticInput(), cutoff); assert.equal(p.cohorts[0].total, 300); assert.equal(p.cohorts[0].exposures.find(e => e.dimension === 'assetId' && e.value === 'x').share, 1/3); assert.equal(p.positions[0].lineage.snapshot.auditEventId, 'synthetic'); assert.equal(sumAmounts([0.1,0.2]), 0.3); });
test('no FX means separate cohorts and unresolved cross currency', () => { const i = syntheticInput(); i.snapshots[1].currency = 'USD'; const p = projectPortfolio(i, cutoff); assert.equal(p.cohorts.length, 2); assert.ok(p.blockers.includes('FX_UNRESOLVED')); assert.equal(p.total, undefined); });
test('future snapshot and later recorded backfill never change historical output', () => { const i = syntheticInput(), before = projectPortfolio(i, cutoff); i.snapshots.push({ ...i.snapshots[0], snapshotId: 'future', snapshotDate: '2027-01-01' }); i.snapshots.push({ ...i.snapshots[0], snapshotId: 'backfill', snapshotDate: '2026-08-14', receipt: { ...receipt, recordedAt: '2027-01-01T00:00:00Z' } }); assert.deepEqual(projectPortfolio(i, cutoff), before); });
test('same day duplicate and conflict both fail closed', () => { for (const value of [100,900]) { const i = syntheticInput(); i.snapshots.push({ ...i.snapshots[0], snapshotId: 'duplicate', marketValue: value }); const p = projectPortfolio(i, cutoff); assert.equal(p.status, 'conflicted'); assert.deepEqual(p.positions, []); assert.deepEqual(p.cohorts, []); } });
test('missing snapshots never manufacture positions or zero total', () => { const i = syntheticInput(); i.snapshots = []; const p = projectPortfolio(i, cutoff); assert.deepEqual(p.positions, []); assert.deepEqual(p.cohorts, []); assert.ok(p.blockers.includes('POSITION_SNAPSHOT_MISSING')); });
test('corrupt, future schema, identity and invalid amount rejected', () => { const i = syntheticInput(); for (const bad of [{...i, schemaVersion:'v99'}, {...i, snapshots:[{...i.snapshots[0], marketValue:NaN}]}, {...i, accounts:[...i.accounts,...i.accounts]}, {...i, assets:[]}]) assert.throws(() => projectPortfolio(bad, cutoff)); });
test('input order and latest snapshot selection deterministic', () => { const i = syntheticInput(); i.snapshots.push({ ...i.snapshots[0], snapshotId: 'older', snapshotDate: '2026-08-14' }); const p = projectPortfolio(i, cutoff); i.snapshots.reverse(); i.assets.reverse(); assert.deepEqual(projectPortfolio(i, cutoff), p); });
test('snapshot date and unknown strategy preserve blockers', () => { const i = syntheticInput(); i.snapshots[0].snapshotDate = '2026-08-14'; const p = projectPortfolio(i, cutoff); assert.ok(p.blockers.includes('SNAPSHOT_DATES_NOT_COMPARABLE')); assert.ok(p.positions[0].blockers.includes('STRATEGY_UNRESOLVED')); });
test('zero denominator remains null and precision loss is rejected', () => { const i = syntheticInput(); i.snapshots.forEach(s => s.marketValue = 0); assert.equal(projectPortfolio(i, cutoff).cohorts[0].exposures[0].share, null); assert.throws(() => sumAmounts([1e20, 0.1])); });
test('loopback seam rejects cross origin, host rebinding, write and missing header', () => { const r = { method:'GET', headers:{ host:'localhost:5173','x-portfolio-read':'1' }, socket:{remoteAddress:'127.0.0.1'} }; assert.equal(portfolioRequestAllowed(r), true); for (const bad of [{...r,method:'POST'}, {...r,headers:{...r.headers, origin:'https://evil.test'}}, {...r,headers:{...r.headers,host:'evil.test:5173'}}, {...r,headers:{host:'localhost:5173'}}, {...r,socket:{remoteAddress:'192.168.0.1'}}]) assert.equal(portfolioRequestAllowed(bad), false); });

const projectionMutations = [
  ['quantity', p => { p.positions[0].quantity++; }],
  ['snapshotId', p => { p.positions[0].snapshotId = 'forged'; }],
  ['accountName', p => { p.positions[0].accountName = 'forged'; }],
  ['assetName', p => { p.positions[0].assetName = 'forged'; }],
  ['instrumentId', p => { p.positions[0].instrumentId = 'forged'; }],
  ['accountStatus', p => { p.positions[0].accountStatus = 'archived'; }],
  ['deleted position blocker', p => { p.positions[0].blockers = []; }],
  ['forged position blocker', p => { p.positions[0].blockers.push('FORGED'); }],
  ['projection status', p => { p.status = 'unresolved'; }],
  ['deleted global blocker', p => { p.blockers = []; }],
  ['forged global blocker', p => { p.blockers.push('FORGED'); }],
  ['deleted integrity', p => { delete p.integrity; }],
  ['corrupt integrity', p => { p.integrity.canonicalPayload += ' '; }],
  ['future integrity', p => { p.integrity.version = 'portfolio-integrity.v99'; }],
  ['future projection', p => { p.schemaVersion = 'portfolio-projection.v99'; }],
  ['normalization drift', p => { p.positions[0].accountName += ' '; }],
  ...['snapshot','account','asset'].flatMap(owner => [
    ['recordedAt','2026-08-14T00:00:00.000Z'],['operationKey','forged'],['auditEventId','forged'],['payloadDigest','b'.repeat(64)]
  ].map(([field,value]) => [`${owner} receipt ${field}`, p => { p.positions[0].lineage[owner][field] = value; }]))
];
for (const [name, mutate] of projectionMutations) test(`complete projection binding rejects ${name} without cohort change`, () => {
  const original = projectPortfolio(syntheticInput(), cutoff), changed = structuredClone(original);
  assert.deepEqual(validateProjection(JSON.parse(JSON.stringify(original))), original);
  mutate(changed); assert.deepEqual(changed.cohorts, original.cohorts);
  assert.throws(() => validateProjection(changed));
});
for (const status of ['active','inactive','archived']) test(`account lifecycle ${status} retained in recorded-position denominator`, () => {
  const input = syntheticInput(); input.accounts[0].status = status;
  const p = projectPortfolio(input, cutoff); assert.deepEqual(validateProjection(p), p);
  assert.equal(p.status, 'partial'); assert.equal(p.cohorts[0].total, 300);
  assert.ok(p.positions.every(row => row.accountStatus === status));
  for (const row of p.positions) assert.equal(row.blockers.includes(`ACCOUNT_${status.toUpperCase()}`), status !== 'active');
  assert.equal(p.blockers.includes(`ACCOUNT_${status.toUpperCase()}:a`), status !== 'active');
  assert.equal(p.cohorts[0].blockers.includes(`ACCOUNT_${status.toUpperCase()}:a`), status !== 'active');
});
test('conflicted and empty results are bound too, without validation resealing', () => {
  for (const conflict of [false,true]) {
    const input = syntheticInput();
    if (conflict) input.snapshots.push({...input.snapshots[0],snapshotId:'duplicate'}); else input.snapshots=[];
    const p = projectPortfolio(input, cutoff); assert.deepEqual(validateProjection(p), p);
    const before = JSON.stringify(p); p.blockers.push('FORGED'); const corrupted = JSON.stringify(p);
    assert.throws(() => validateProjection(p), /INTEGRITY/); assert.equal(JSON.stringify(p), corrupted); assert.notEqual(corrupted,before);
  }
});
test('missing or future account lifecycle never defaults to active', () => {
  for (const status of [undefined,'future']) { const input=syntheticInput(); input.accounts[0].status=status; assert.throws(()=>projectPortfolio(input,cutoff)); }
});

test('reconstruction still rejects inconsistent status even with a self-consistent forged binding', () => {
  const p=projectPortfolio(syntheticInput(),cutoff); p.status='unresolved';
  const {integrity,...payload}=p;
  // Adversarial wire construction, never a production resealing API.
  integrity.canonicalPayload=canonicalJson(payload);
  assert.throws(()=>validateProjection(p),/PROJECTION_DRIFT/);
});
