import test from 'node:test';
import assert from 'node:assert/strict';
import { V1EntityResolver } from '../../.local-core-build/domain/resolver.js';
import { normalizeEntityText } from '../../.local-core-build/domain/normalize.js';
import { contracts, memoryStore, entityFixture, requestFixture, expectCode } from './fixtures.mjs';

test('canonical, alias, exchange+ticker resolve exactly in priority order', (t) => {
  const store = memoryStore(t);
  const first = store.entities.create(entityFixture());
  const resolver = new V1EntityResolver(store.entities, contracts);
  for (const input of [requestFixture(), requestFixture({ rawName: 'example robotics' }), requestFixture({ rawName: 'unrelated fixture label', exchangeHint: 'test', tickerHint: 'TEST.X1' })]) {
    assert.equal(resolver.requireResolved(input), first.entityId);
    contracts.validate('entity-resolution-result.v1', resolver.resolve(input));
  }
  const other = store.entities.create(entityFixture({ canonicalName: 'Another Fixture', aliases: ['Example Robotics Holdings'], providerIdentifiers: {}, ticker: 'TEST.X2' }));
  assert.equal(resolver.requireResolved(requestFixture()), first.entityId);
  assert.equal(resolver.requireResolved(requestFixture({ tickerHint: 'TEST.X2', exchangeHint: 'TEST' })), other.entityId);
});
test('provider identity internal exact lookup preserves raw spelling and rejects duplicates atomically', (t) => {
  const store = memoryStore(t);
  const entry = store.entities.create(entityFixture());
  assert.equal(store.entities.lookupProviderIdentifier('fixture-provider', 'example-robotics-1').entityId, entry.entityId);
  expectCode('ENTITY_NOT_FOUND', () => store.entities.lookupProviderIdentifier('FIXTURE-PROVIDER', 'example-robotics-1'));
  expectCode('ENTITY_DUPLICATE_IDENTIFIER', () => store.entities.create(entityFixture({ canonicalName: 'Another Fixture' })));
  assert.equal(store.entities.list().length, 1);
  expectCode('CONTRACT_INVALID', () => new V1EntityResolver(store.entities, contracts).resolve(requestFixture({ providerId: 'fixture-provider' })));
});
for (const matchKind of ['alias', 'canonical', 'ticker']) test(`${matchKind} collision returns conflicted, never first`, (t) => {
  const store = memoryStore(t);
  store.entities.create(entityFixture());
  store.entities.create(entityFixture({ canonicalName: matchKind === 'canonical' ? 'Example Robotics Holdings' : 'Another Fixture', providerIdentifiers: {} }));
  const request = matchKind === 'ticker' ? requestFixture({ tickerHint: 'TEST.X1', exchangeHint: 'TEST' }) : requestFixture({ rawName: matchKind === 'alias' ? 'Example Robotics' : 'Example Robotics Holdings' });
  const resolver = new V1EntityResolver(store.entities, contracts);
  const result = resolver.resolve(request);
  assert.equal(result.status, 'conflicted');
  assert.equal(result.candidates.length, 2);
  assert.equal(result.resolvedEntityId, undefined);
  assert.equal(result.allowAutoCreate, false);
  expectCode('ENTITY_CONFLICTED', () => resolver.requireResolved(request));
});
test('weak exact ticker, candidate/archived/merged matches and hint disagreement need confirmation', (t) => {
  const store = memoryStore(t);
  const entry = store.entities.create(entityFixture());
  const resolver = new V1EntityResolver(store.entities, contracts);
  for (const input of [requestFixture({ rawName: 'Unknown Fixture', tickerHint: 'TEST.X1' }), requestFixture({ marketHint: 'OTHER_FIXTURE_MARKET' }), requestFixture({ tickerHint: 'TEST.X9' }), requestFixture({ exchangeHint: 'OTHER_FIXTURE_EXCHANGE' })]) {
    assert.equal(resolver.resolve(input).status, 'needs_user_confirmation');
    expectCode('ENTITY_NEEDS_CONFIRMATION', () => resolver.requireResolved(input));
  }
  for (const status of ['candidate', 'archived']) {
    store.entities.create(entityFixture({ canonicalName: `Example ${status}`, aliases: [], status, providerIdentifiers: {} }));
    assert.equal(resolver.resolve(requestFixture({ rawName: `Example ${status}` })).status, 'needs_user_confirmation');
  }
  const target = store.entities.create(entityFixture({ canonicalName: 'Example Merge Target', aliases: [], providerIdentifiers: {}, ticker: 'TEST.X2' }));
  store.entities.merge(entry.entityId, target.entityId, 1, true);
  assert.equal(resolver.resolve(requestFixture()).status, 'needs_user_confirmation');
});
test('expected type separates identities; no candidate means not_found with no creation', (t) => {
  const store = memoryStore(t);
  store.entities.create(entityFixture());
  const resolver = new V1EntityResolver(store.entities, contracts);
  for (const input of [requestFixture({ expectedEntityTypes: ['industry'] }), requestFixture({ rawName: 'Unknown Fixture' }), requestFixture({ rawName: 'Example Robotic' }), requestFixture({ rawName: '   ' })]) {
    const result = resolver.resolve(input);
    assert.equal(result.status, 'not_found');
    assert.equal(result.allowAutoCreate, false);
    assert.deepEqual(result.candidates, []);
    expectCode('ENTITY_NOT_FOUND', () => resolver.requireResolved(input));
  }
  assert.equal(store.entities.list().length, 1);
});
test('multiple weak ticker candidates need confirmation rather than claim exact conflict', (t) => {
  const store = memoryStore(t);
  store.entities.create(entityFixture());
  store.entities.create(entityFixture({ canonicalName: 'Another Fixture', exchange: 'OTHER_TEST', providerIdentifiers: {} }));
  const result = new V1EntityResolver(store.entities, contracts).resolve(requestFixture({ rawName: 'Unknown Fixture', tickerHint: 'TEST.X1' }));
  assert.equal(result.status, 'needs_user_confirmation');
  assert.equal(result.candidates.length, 2);
});
test('normalization is deterministic, leaves non-ASCII case alone and preserves raw input', (t) => {
  const store = memoryStore(t);
  store.entities.create(entityFixture());
  const request = requestFixture({ rawName: '  ＥＸＡＭＰＬＥ\tRobotics   Holdings  ', contextText: 'raw fixture context' });
  const before = structuredClone(request);
  assert.equal(new V1EntityResolver(store.entities, contracts).resolve(request).status, 'resolved');
  assert.deepEqual(request, before);
  assert.equal(normalizeEntityText('  ＡＢＣ\n  Ä  '), 'abc Ä');
  assert.equal(normalizeEntityText(normalizeEntityText(request.rawName)), normalizeEntityText(request.rawName));
});
test('rename preserves opaque UUID; merge preserves historical rows, aliases and identifiers', (t) => {
  const store = memoryStore(t);
  const entry = store.entities.create(entityFixture());
  assert.match(entry.entityId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const renamed = store.entities.rename(entry.entityId, 'Example Renamed Holdings', 1);
  assert.equal(renamed.entityId, entry.entityId);
  assert.equal(renamed.revision, 2);
  expectCode('ENTITY_CONFLICTED', () => store.entities.rename(entry.entityId, 'Stale Fixture', 1));
  const target = store.entities.create(entityFixture({ canonicalName: 'Example Merge Target', providerIdentifiers: {} }));
  expectCode('ENTITY_NEEDS_CONFIRMATION', () => store.entities.merge(entry.entityId, target.entityId, 2, false));
  const merged = store.entities.merge(entry.entityId, target.entityId, 2, true);
  assert.equal(merged.status, 'merged');
  assert.equal(merged.mergedIntoEntityId, target.entityId);
  assert.deepEqual(merged.aliases, entry.aliases);
  assert.equal(store.entities.lookupProviderIdentifier('fixture-provider', 'example-robotics-1').entityId, entry.entityId);
  assert.equal(store.entities.list().length, 2);
  expectCode('ENTITY_CONFLICTED', () => store.entities.merge(target.entityId, entry.entityId, 1, true));
  assert.equal(store.entities.delete, undefined);
});
test('reserved IDs, invalid enums and aliases cannot be smuggled into creation', (t) => {
  const store = memoryStore(t);
  for (const input of [entityFixture({ entityId: 'fixture' }), entityFixture({ status: 'unknown' }), entityFixture({ entityType: 'unknown' }), entityFixture({ canonicalName: '   ' }), entityFixture({ aliases: ['Fixture', 'ＦＩＸＴＵＲＥ'] })]) expectCode('CONTRACT_INVALID', () => store.entities.create(input));
  assert.deepEqual(store.entities.list(), []);
});
