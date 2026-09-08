import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { defineMigration, loadMigrations, migrateDatabase, verifyDatabase } from '../../.local-core-build/db/migrations.js';
import { assertSafeDatabasePath, projectRoot, localDataLayout } from '../../.local-core-build/paths.js';
import { contracts, memoryStore, entityFixture, auditFixture, tempDirectory, expectCode } from './fixtures.mjs';

const open = (filename, mode = 'initialize') => openLocalDatabase({ filename, mode, purpose: 'test' }, contracts);
test('empty memory database initializes only the five Phase 1A tables and verifies', () => {
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys = ON');
    assert.equal(migrateDatabase(db, loadMigrations().slice(0, 1)).schemaVersion, 1);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map((row) => row.name), ['audit_events', 'entity_aliases', 'entity_provider_identifiers', 'entity_registry', 'schema_migrations']);
    assert.equal(verifyDatabase(db, loadMigrations().slice(0, 1)).integrity, 'ok');
    assert.equal(verifyDatabase(db, loadMigrations().slice(0, 1)).foreignKeys, 'ok');
  } finally { db.close(); }
});
test('file initialization is idempotent; read-only verify leaves DB bytes unchanged', (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  let store = open(filename);
  const entity = store.entities.create(entityFixture());
  store.database.close();
  const first = readFileSync(filename);
  store = open(filename);
  assert.equal(store.entities.get(entity.entityId).canonicalName, entity.canonicalName);
  const metadata = store.database.verify();
  assert.equal(metadata.migrations.length, 2);
  store.database.close();
  assert.deepEqual(readFileSync(filename), first);
  store = open(filename, 'readonly');
  assert.deepEqual(store.database.verify(), metadata);
  expectCode('TRANSACTION_ROLLED_BACK', () => store.entities.create(entityFixture()));
  store.database.close();
  assert.deepEqual(readFileSync(filename), first);
  const raw = new Database(filename, { readonly: true });
  try { assert.equal(raw.pragma('journal_mode', { simple: true }), 'wal'); }
  finally { raw.close(); }
});
test('migration checksums are invariant to CRLF only', () => {
  const first = loadMigrations()[0];
  assert.equal(first.checksum, defineMigration(1, first.name, first.sql.replaceAll('\n', '\r\n')).checksum);
  assert.notEqual(first.checksum, defineMigration(1, first.name, `${first.sql}\n-- change`).checksum);
});
for (const [name, sql, code] of [
  ['checksum mismatch', "UPDATE schema_migrations SET checksum='tampered'", 'MIGRATION_CHECKSUM_MISMATCH'],
  ['renamed applied migration', "UPDATE schema_migrations SET name='renamed'", 'MIGRATION_CHECKSUM_MISMATCH'],
  ['future version', "INSERT INTO schema_migrations VALUES (999,'future','future','2026-01-01T00:00:00Z')", 'SCHEMA_VERSION_UNSUPPORTED'],
  ['missing history', 'DELETE FROM schema_migrations', 'SCHEMA_VERSION_UNSUPPORTED'],
  ['missing defensive trigger', 'DROP TRIGGER audit_no_delete', 'DATABASE_INTEGRITY_FAILED'],
]) test(`${name} is rejected by initialize and readonly verify without repair`, (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  open(filename).database.close();
  const raw = new Database(filename);
  raw.exec(sql); raw.close();
  const before = readFileSync(filename);
  for (const mode of ['initialize', 'readonly', 'readwrite']) expectCode(code, () => open(filename, mode));
  assert.deepEqual(readFileSync(filename), before);
});
test('initial migration failure rolls back all DDL and schema metadata', () => {
  const db = new Database(':memory:');
  try {
    const bad = defineMigration(3, '003-failing-fixture', 'CREATE TABLE fixture_partial(id INTEGER); INVALID FIXTURE SQL;');
    expectCode('TRANSACTION_ROLLED_BACK', () => migrateDatabase(db, [...loadMigrations(), bad]));
    assert.deepEqual(db.prepare('SELECT name FROM sqlite_schema').all(), []);
    assert.equal(migrateDatabase(db).schemaVersion, 2);
  } finally { db.close(); }
});
test('new migration failure preserves earlier migration and rows', () => {
  const db = new Database(':memory:');
  try {
    migrateDatabase(db);
    const before = db.prepare('SELECT * FROM schema_migrations').all();
    expectCode('TRANSACTION_ROLLED_BACK', () => migrateDatabase(db, [...loadMigrations(), defineMigration(3, '003-failing-fixture', 'CREATE TABLE fixture_partial(id INTEGER); INVALID FIXTURE SQL;')]));
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), before);
    assert.equal(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='fixture_partial'").get(), undefined);
    assert.equal(verifyDatabase(db).schemaVersion, 2);
  } finally { db.close(); }
});
test('multi-table mutation and audit both roll back on later failure', (t) => {
  const store = memoryStore(t);
  expectCode('TRANSACTION_ROLLED_BACK', () => store.database.transaction(({ entities, audit }) => {
    entities.create(entityFixture());
    audit.append(auditFixture());
    throw new Error('fixture failure');
  }));
  assert.deepEqual(store.entities.list(), []);
  assert.deepEqual(store.audit.listByRequest('fixture-request'), []);
});
test('process termination before commit leaves no partial entity or false-success audit', (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  open(filename).database.close();
  const worker = spawnSync(process.execPath, ['local-core/tests/crash-worker.mjs', filename], { cwd: projectRoot, encoding: 'utf8', windowsHide: true });
  assert.equal(worker.status, 23, worker.stderr);
  const store = open(filename, 'readwrite');
  try {
    assert.deepEqual(store.entities.list(), []);
    assert.deepEqual(store.audit.listByRequest('fixture-request'), []);
    assert.equal(store.database.verify().integrity, 'ok');
  } finally { store.database.close(); }
});
test('foreign keys are enforced on actual adapter connection', (t) => {
  const store = memoryStore(t);
  expectCode('TRANSACTION_ROLLED_BACK', () => store.entities.create(entityFixture({ parentEntityId: 'missing-fixture-parent' })));
  assert.deepEqual(store.entities.list(), []);
  const parent = store.entities.create(entityFixture());
  const child = store.entities.create(entityFixture({ canonicalName: 'Example Fixture Child', parentEntityId: parent.entityId, providerIdentifiers: {} }));
  assert.equal(child.parentEntityId, parent.entityId);
});
test('foreign_key_check detects externally corrupted references without fixing them', (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  open(filename).database.close();
  const raw = new Database(filename);
  raw.pragma('foreign_keys=OFF');
  raw.prepare('INSERT INTO entity_aliases VALUES (?, ?, ?, ?)').run('missing-fixture', 'Fixture', 'fixture', '2026-01-01T00:00:00Z');
  raw.close();
  expectCode('DATABASE_INTEGRITY_FAILED', () => open(filename, 'readonly'));
});
test('damaged and unrelated SQLite files fail closed and are retained', (t) => {
  const directory = tempDirectory(t);
  const damaged = path.join(directory, 'damaged.sqlite');
  const original = Buffer.from('fictional invalid database bytes');
  writeFileSync(damaged, original);
  expectCode('DATABASE_INTEGRITY_FAILED', () => open(damaged));
  assert.deepEqual(readFileSync(damaged), original);
  const unrelated = path.join(directory, 'unrelated.sqlite');
  const raw = new Database(unrelated); raw.exec('CREATE TABLE unrelated_fixture(id INTEGER)'); raw.close();
  const before = readFileSync(unrelated);
  expectCode('SCHEMA_VERSION_UNSUPPORTED', () => open(unrelated));
  assert.deepEqual(readFileSync(unrelated), before);
});
test('missing readonly DB, invalid path and closed reads return typed failures', (t) => {
  const filename = path.join(tempDirectory(t), 'missing.sqlite');
  expectCode('DATABASE_OPEN_FAILED', () => open(filename, 'readonly'));
  assert(!existsSync(filename));
  expectCode('DATABASE_OPEN_FAILED', () => open('relative.sqlite'));
  const store = open(':memory:'); store.database.close();
  expectCode('DATABASE_INTEGRITY_FAILED', () => store.entities.list());
  expectCode('DATABASE_INTEGRITY_FAILED', () => store.database.verify());
});
test('test paths reject the real default root before opening any file; repo source DBs are forbidden', () => {
  const defaultDb = path.join(homedir(), '.investment-research-dashboard', 'data', 'investment-dashboard.sqlite');
  expectCode('DATABASE_OPEN_FAILED', () => assertSafeDatabasePath(defaultDb, 'test'));
  expectCode('DATABASE_OPEN_FAILED', () => assertSafeDatabasePath(path.join(projectRoot, 'public', 'fixture.sqlite'), 'local'));
  assertSafeDatabasePath(path.join(projectRoot, '.local-data', 'fixture.sqlite'), 'local');
  assertSafeDatabasePath(':memory:', 'test');
  assert.equal(localDataLayout(path.join(homedir(), 'fixture-data-root')).directories.length, 4);
});
test('async/thenable callbacks rollback, and scoped repositories expire', async (t) => {
  const store = memoryStore(t);
  let called = false;
  expectCode('TRANSACTION_ROLLED_BACK', () => store.database.transaction(async () => { called = true; }));
  assert.equal(called, false);
  let saved;
  expectCode('TRANSACTION_ROLLED_BACK', () => store.database.transaction((repositories) => {
    saved = repositories;
    repositories.entities.create(entityFixture());
    return Promise.resolve('fixture');
  }));
  expectCode('TRANSACTION_ROLLED_BACK', () => saved.entities.create(entityFixture()));
  assert.deepEqual(store.entities.list(), []);
});
