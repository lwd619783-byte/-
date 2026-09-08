import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { loadMigrations, defineMigration, migrateDatabase, verifyDatabase } from '../../.local-core-build/db/migrations.js';
import { AssetService } from '../../.local-core-build/domain/asset-service.js';
import { AssetImportService } from '../../.local-core-build/domain/asset-import-service.js';
import { contracts, tempDirectory } from './fixtures.mjs';
import { account, asset, transaction, position, dcaPlan, execution, cashFlow, approval, bundle, candidate, commitRequest, operator, reason, now } from './asset-fixtures.mjs';
import { historicalContext, accountContext } from './import-alignment-fixtures.mjs';
import { confirmedMutation, authorizeRecord } from '../../.local-core-build/domain/asset-service.js';

test('001 checksum matches immutable Phase 1A baseline; 002 upgrades an actual Phase 1A database without data loss', () => {
  const migrations = loadMigrations();
  assert.equal(migrations[0]?.version, 1);
  assert.equal(migrations[0]?.name, '001-local-core');
  assert.equal(migrations[0]?.checksum, '339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef');
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys=ON'); migrateDatabase(db, migrations.slice(0, 1));
    const before = db.prepare('SELECT * FROM schema_migrations').all();
    assert.equal(migrateDatabase(db).schemaVersion, 2);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version=1').all(), before);
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(v => v.name);
    for (const name of ['accounts', 'assets', 'asset_tags', 'transactions', 'cash_flows', 'position_snapshots', 'dca_plans', 'dca_plan_revisions', 'dca_constraints', 'dca_executions', 'dca_execution_transactions', 'confirmed_operations', 'import_plans', 'import_fingerprints']) assert(tables.includes(name));
    assert.equal(verifyDatabase(db).foreignKeys, 'ok');
  } finally { db.close(); }
});
test('failed 002 upgrade rolls back DDL and preserves 001 metadata; subsequent real 002 succeeds', () => {
  const db = new Database(':memory:');
  try {
    const migrations = loadMigrations(); migrateDatabase(db, migrations.slice(0, 1));
    const before = db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all();
    const failed = defineMigration(2, '002-fixture-failure', `${migrations[1].sql}\nINVALID FIXTURE SQL;`);
    reason('TRANSACTION_ROLLED_BACK', () => migrateDatabase(db, [migrations[0], failed]));
    assert.deepEqual(db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all(), before);
    assert.equal(migrateDatabase(db).schemaVersion, 2);
  } finally { db.close(); }
});
test('file reopen preserves formal payloads, DCA revisions/links and idempotent import receipt', t => {
  const filename = path.join(tempDirectory(t), 'synthetic.sqlite');
  const open = () => openLocalDatabase({ filename, purpose: 'test', mode: 'initialize' }, contracts);
  let store = open();
  const service = new AssetService(store.database, contracts, now);
  service.createAccount(account(), approval('account')); service.createAsset(asset(), approval('asset'));
  service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  service.createTransaction(transaction(), approval('transaction'));
  service.commitDcaExecution(execution(), approval('execution'));
  service.createPosition(position(), approval('position'));
  const imports = new AssetImportService(store.database, contracts, now);
  const plan = imports.prepare(bundle([candidate(cashFlow(), 'cash_flow')]));
  const result = imports.commit(commitRequest(plan), operator);
  store.database.close(); store = open();
  try {
    assert.deepEqual(new AssetImportService(store.database, contracts, now).commit(commitRequest(plan), operator), result);
    assert.equal(store.ledger.accounts().length, 1); assert.deepEqual(store.ledger.assets()[0], asset());
    assert.equal(store.ledger.dcaRevisions().length, 1); assert.equal(store.ledger.dcaExecutions()[0].planRevision, 1);
    assert.equal(store.ledger.positions().length, 1); assert.equal(store.ledger.cashFlows().length, 1);
    assert.equal(store.database.verify().integrity, 'ok');
  } finally { store.database.close(); }
  const raw = new Database(filename);
  try {
    for (const table of ['accounts', 'assets', 'asset_tags', 'transactions', 'cash_flows', 'position_snapshots', 'dca_plans', 'dca_plan_revisions', 'dca_constraints', 'dca_executions', 'dca_execution_transactions', 'confirmed_operations', 'import_plans', 'import_fingerprints']) {
      assert.throws(() => raw.exec(`DELETE FROM ${table}`), /immutable|append_only/);
      const columns = raw.pragma(`table_info(${table})`).map(v => v.name).join(',');
      assert.throws(() => raw.exec(`INSERT OR REPLACE INTO ${table}(${columns}) SELECT ${columns} FROM ${table}`), /immutable|append_only/);
    }
    assert.throws(() => raw.exec("UPDATE transactions SET payload_json=payload_json"), /append_only/);
    raw.pragma('foreign_keys=ON');
    const flow = cashFlow({ cashFlowId: 'missing-pair', type: 'internal_transfer' });
    assert.throws(() => raw.prepare('INSERT INTO cash_flows(id,payload_json,payload_sha256,operation_key) VALUES(?,?,?,?)').run(flow.cashFlowId, JSON.stringify(flow), '0'.repeat(64), 'fixture-import-commit'), /CHECK/);
    const missingAccount = transaction({ transactionId: 'missing-account', accountId: 'unknown' });
    assert.throws(() => raw.prepare('INSERT INTO transactions(id,payload_json,payload_sha256,operation_key) VALUES(?,?,?,?)').run(missingAccount.transactionId, JSON.stringify(missingAccount), '0'.repeat(64), 'transaction'), /FOREIGN KEY/);
  } finally { raw.close(); }
});
test('two connections cannot commit a stale plan or double-write an idempotency key', t => {
  const filename = path.join(tempDirectory(t), 'concurrent-fixture.sqlite');
  const a = openLocalDatabase({ filename, purpose: 'test', mode: 'initialize' }, contracts);
  const b = openLocalDatabase({ filename, purpose: 'test', mode: 'readwrite' }, contracts);
  try {
    const service = new AssetService(a.database, contracts, now);
    service.createAccount(account(), approval('account')); service.createAsset(asset(), approval('asset'));
    const first = new AssetImportService(a.database, contracts, now), second = new AssetImportService(b.database, contracts, now);
    const plan = first.prepare(bundle());
    const result = second.commit(commitRequest(plan), operator);
    assert.deepEqual(first.commit(commitRequest(plan), operator), result);
    assert.equal(a.ledger.transactions().length, 1); assert.equal(b.ledger.transactions().length, 1);
    const stale = first.prepare(bundle([candidate(cashFlow(), 'cash_flow')], { importId: 'second' }));
    new AssetService(b.database, contracts, now).createAccount(account({ accountId: 'other' }), approval('other'));
    reason('IMPORT_PLAN_STALE', () => first.commit(commitRequest(stale, { idempotencyKey: 'second' }), operator));
    assert.deepEqual(a.ledger.cashFlows(), []);
  } finally { a.database.close(); b.database.close(); }
});

for (const historical of [true, false]) test(`file reopen preserves ${historical ? 'Historical metadata/evidence/receipt' : 'AccountValue Observation/Reconciliation'} canonical fields`, t => {
  const fixture = historical ? historicalContext(t) : accountContext(t);
  const filename = path.join(tempDirectory(t), 'alignment-synthetic.sqlite');
  const open = () => openLocalDatabase({ filename, purpose: 'test', mode: 'initialize' }, contracts);
  let store = open();
  const service = new AssetService(store.database, contracts, now);
  service.createAccount(account(), approval('account')); service.createAsset(asset(), approval('asset'));
  if (!historical) service.createTransaction(transaction(), approval('transaction'));
  let imports = new AssetImportService(store.database, contracts, now, fixture.trust);
  const plan = historical ? imports.prepareHistorical(fixture.metadata, fixture.b) : imports.prepare(fixture.b);
  assert.equal(plan.status, 'ready');
  const request = fixture.approve(plan, historical ? 'historical_asset_import.commit' : 'asset_import.commit');
  const before = store.ledger.importPlan(plan.planId);
  store.database.close(); store = open();
  try {
    imports = new AssetImportService(store.database, contracts, now, fixture.trust);
    assert.deepEqual(store.ledger.importPlan(plan.planId), before);
    const result = historical ? imports.commitHistorical(request, operator) : imports.commit(request, operator);
    const receipt = store.ledger.operation(request.idempotencyKey);
    store.database.close(); store = open();
    // Successful retries use the persisted approved receipt, even without a
    // source host after reopening; no new write or verification is attempted.
    imports = new AssetImportService(store.database, contracts, now);
    assert.deepEqual(historical ? imports.commitHistorical(request, operator) : imports.commit(request, operator), result);
    assert.deepEqual(store.ledger.operation(request.idempotencyKey), receipt);
    assert.equal(store.audit.listByRequest(request.idempotencyKey).length, 1);
    assert.equal(store.database.verify().integrity, 'ok');
  } finally { store.database.close(); }
});

test('old undated canonical DCA payload remains readable; new official commit requires dates', t => {
  const filename = path.join(tempDirectory(t), 'old-wire-synthetic.sqlite');
  let store = openLocalDatabase({ filename, purpose: 'test', mode: 'initialize' }, contracts);
  const service = new AssetService(store.database, contracts, now);
  service.createAccount(account(), approval('account')); service.createAsset(asset(), approval('asset')); service.saveDcaPlan(dcaPlan(), 0, approval('plan'));
  const old = execution({ transactionIds: [] });
  contracts.validate('dca-execution.v1', old);
  // Trusted persistence fixture representing a pre-clarification receipt;
  // deliberately does not exercise current service admission.
  store.database.transaction(r => confirmedMutation(r, 'dca_execution.commit', approval('old-writer'), old, () => ({
    result: { recordIds: [old.executionId], warnings: [] }, appends: [authorizeRecord({ type: 'dca_execution', value: old, revision: 1 })],
    write: () => r.ledger.appendDcaExecution({ execution: old, planRevision: 1 }, 'old-writer'),
  })));
  service.commitDcaExecution(execution({ executionId: 'dated', transactionIds: [], periodStart: '2026-08-14', periodEnd: '2026-08-20' }), approval('dated'));
  store.database.close(); store = openLocalDatabase({ filename, purpose: 'test', mode: 'readwrite' }, contracts);
  try {
    assert.deepEqual(store.ledger.dcaExecutions().find(v => v.execution.executionId === old.executionId).execution, old);
    assert.equal(store.ledger.dcaExecutions().find(v => v.execution.executionId === 'dated').execution.periodEnd, '2026-08-20');
    reason('RECONCILIATION_REQUIRED', () => new AssetService(store.database, contracts, now).commitDcaExecution({ ...old, executionId: 'new-undated' }, approval('new-undated')));
    assert.equal(store.ledger.dcaExecutions().length, 2);
  } finally { store.database.close(); }
});
