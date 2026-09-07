import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { EntityService } from '../../.local-core-build/domain/entity-service.js';
import { canonicalJson } from '../../.local-core-build/domain/canonical-json.js';
import { contracts, memoryStore, entityFixture, auditFixture, tempDirectory, expectCode } from './fixtures.mjs';

test('valid audit append and success=false round-trip without update/delete ports', (t) => {
  const store = memoryStore(t);
  for (const success of [true, false]) {
    const event = auditFixture({ success });
    const saved = store.audit.append(event);
    assert.deepEqual(store.audit.get(saved.eventId), saved);
    assert.deepEqual(saved.event, event);
  }
  assert.equal(store.audit.listByRequest('fixture-request').length, 2);
  for (const repository of [store.audit, store.entities]) {
    for (const method of ['update', 'delete', 'remove', 'exec', 'prepare', 'db', 'atomic']) assert.equal(repository[method], undefined);
  }
});
test('invalid audit contract rejects before write, including recognizable sensitive metadata', (t) => {
  const store = memoryStore(t);
  for (const event of [auditFixture({ success: 'true' }), auditFixture({ timestamp: 'invalid' }), auditFixture({ token: 'fixture-placeholder' }), auditFixture({ actor: 'Bearer fixture-placeholder' }), auditFixture({ operation: 'CREATE TABLE fixture_dump' })]) expectCode('CONTRACT_INVALID', () => store.audit.append(event));
  assert.deepEqual(store.audit.listByRequest('fixture-request'), []);
});
test('canonical JSON ordering, nested keys, array order and SHA-256 are deterministic', (t) => {
  const store = memoryStore(t);
  assert.equal(canonicalJson({ z: [2, 1], a: { b: 2, a: 1 } }), '{"a":{"a":1,"b":2},"z":[2,1]}');
  const first = auditFixture({ entity: { entityType: 'company', entityId: 'fixture', displayName: 'Example Robotics Holdings' } });
  const reordered = Object.fromEntries(Object.entries(first).reverse());
  reordered.entity = Object.fromEntries(Object.entries(first.entity).reverse());
  const a = store.audit.append(first); const b = store.audit.append(reordered);
  assert.equal(a.payloadSha256, b.payloadSha256);
  assert.equal(a.payloadSha256, createHash('sha256').update(canonicalJson(first)).digest('hex'));
  assert.notEqual(a.eventId, b.eventId);
  assert.notEqual(a.payloadSha256, store.audit.append(auditFixture({ success: false })).payloadSha256);
  for (const value of [undefined, NaN, Infinity, new Date(), [undefined], Array(2), { a: undefined }]) expectCode('CONTRACT_INVALID', () => canonicalJson(value));
  const cyclic = {}; cyclic.self = cyclic;
  expectCode('CONTRACT_INVALID', () => canonicalJson(cyclic));
  const extended = Array(1); extended.fixture = 'value';
  expectCode('CONTRACT_INVALID', () => canonicalJson(extended));
});
test('DB rejects audit UPDATE, DELETE and INSERT OR REPLACE; entity history cannot be deleted', (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  const store = openLocalDatabase({ filename, mode: 'initialize', purpose: 'test' }, contracts);
  try {
    const entity = store.entities.create(entityFixture());
    const audit = store.audit.append(auditFixture());
    const raw = new Database(filename);
    try {
      assert.throws(() => raw.prepare('UPDATE audit_events SET success=0 WHERE event_id=?').run(audit.eventId), /audit_append_only/);
      assert.throws(() => raw.prepare('DELETE FROM audit_events WHERE event_id=?').run(audit.eventId), /audit_append_only/);
      assert.throws(() => raw.prepare('INSERT OR REPLACE INTO audit_events SELECT * FROM audit_events WHERE event_id=?').run(audit.eventId), /audit_append_only/);
      assert.throws(() => raw.prepare('DELETE FROM entity_registry WHERE entity_id=?').run(entity.entityId), /entity_history_immutable/);
      assert.throws(() => raw.prepare('INSERT OR REPLACE INTO entity_registry SELECT * FROM entity_registry WHERE entity_id=?').run(entity.entityId), /entity_history_immutable/);
      assert.throws(() => raw.prepare("UPDATE entity_registry SET entity_type='unknown', revision=revision+1 WHERE entity_id=?").run(entity.entityId));
      assert.throws(() => raw.prepare("UPDATE entity_registry SET status='unknown', revision=revision+1 WHERE entity_id=?").run(entity.entityId));
      assert.throws(() => raw.prepare("UPDATE entity_registry SET entity_id='changed-fixture', revision=revision+1 WHERE entity_id=?").run(entity.entityId));
      assert.throws(() => raw.prepare('INSERT INTO entity_provider_identifiers VALUES (?, ?, ?, ?)').run(entity.entityId, 'fixture-provider', 'example-robotics-1', '2026-01-01T00:00:00Z'), /UNIQUE/);
    } finally { raw.close(); }
    assert.deepEqual(store.audit.get(audit.eventId), audit);
  } finally { store.database.close(); }
});
test('service couples entity mutation and audit, retaining exact identity/version and user confirmation', (t) => {
  const store = memoryStore(t);
  const service = new EntityService(store.database, contracts);
  expectCode('ENTITY_NEEDS_CONFIRMATION', () => service.create(entityFixture(), auditFixture({ actorType: 'ai' })));
  expectCode('ENTITY_NEEDS_CONFIRMATION', () => service.create(entityFixture(), auditFixture({ confirmationState: 'prepared' })));
  const first = service.create(entityFixture(), auditFixture());
  const event = store.audit.listByRequest('fixture-request')[0].event;
  assert.equal(event.entity.entityId, first.entityId);
  assert.equal(event.beforeVersion, 0); assert.equal(event.afterVersion, 1);
  const renamed = service.rename(first.entityId, 'Example Renamed Holdings', 1, auditFixture({ requestId: 'rename-fixture', operation: 'entity.rename' }));
  assert.equal(renamed.entityId, first.entityId);
  assert.equal(store.audit.listByRequest('rename-fixture')[0].event.afterVersion, 2);
});
test('audited service rejects an unrepresentable macro_metric reference without omitting identity', (t) => {
  const store = memoryStore(t);
  const service = new EntityService(store.database, contracts);
  assert.throws(() => service.create(entityFixture({ entityType: 'macro_metric' }), auditFixture()), (error) => error.code === 'TRANSACTION_ROLLED_BACK' && error.reasonCode === 'CONTRACT_INVALID');
  assert.deepEqual(store.entities.list(), []);
  assert.deepEqual(store.audit.listByRequest('fixture-request'), []);
  // Full frozen RegistryEntry enum is still supported by the internal repository.
  assert.equal(store.entities.create(entityFixture({ entityType: 'macro_metric' })).entityType, 'macro_metric');
});
for (const swallow of [false, true]) test(`audit append failure rolls back mutation even if caller catches it (${swallow})`, (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  const store = openLocalDatabase({ filename, mode: 'initialize', purpose: 'test' }, contracts);
  const raw = new Database(filename);
  try {
    raw.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;");
    expectCode('AUDIT_APPEND_FAILED', () => store.audit.append(auditFixture()));
    assert.throws(() => store.database.transaction(({ entities, audit }) => {
      entities.create(entityFixture());
      if (swallow) { try { audit.append(auditFixture()); } catch {} }
      else audit.append(auditFixture());
    }), (error) => error.code === 'TRANSACTION_ROLLED_BACK' && error.reasonCode === 'AUDIT_APPEND_FAILED');
    assert.deepEqual(store.entities.list(), []);
    assert.deepEqual(store.audit.listByRequest('fixture-request'), []);
    const service = new EntityService(store.database, contracts);
    expectCode('TRANSACTION_ROLLED_BACK', () => service.create(entityFixture(), auditFixture()));
    assert.deepEqual(store.entities.list(), []);
    raw.exec('DROP TRIGGER fixture_audit_failure');
    assert.equal(store.database.verify().schemaVersion, 1);
  } finally { raw.close(); store.database.close(); }
});
test('audit reads reject tampered canonical payload, digest or indexed metadata', (t) => {
  const filename = path.join(tempDirectory(t), 'fixture.sqlite');
  const store = openLocalDatabase({ filename, mode: 'initialize', purpose: 'test' }, contracts);
  try {
    const saved = store.audit.append(auditFixture());
    const raw = new Database(filename);
    try {
      raw.exec('DROP TRIGGER audit_no_update');
      raw.prepare("UPDATE audit_events SET payload_sha256=? WHERE event_id=?").run('0'.repeat(64), saved.eventId);
    } finally { raw.close(); }
    expectCode('DATABASE_INTEGRITY_FAILED', () => store.audit.get(saved.eventId));
    expectCode('DATABASE_INTEGRITY_FAILED', () => store.database.verify());
  } finally { store.database.close(); }
});
