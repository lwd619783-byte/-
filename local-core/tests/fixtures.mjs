import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { V1ContractRegistry } from '../../.local-core-build/contracts/registry.js';
import { openLocalDatabase } from '../../.local-core-build/db/connection.js';

export const contracts = new V1ContractRegistry();
export const fixedId = '10000000-0000-4000-8000-000000000001';
export const entityFixture = (overrides = {}) => ({ entityType: 'company', canonicalName: 'Example Robotics Holdings', aliases: ['Example Robotics'], status: 'active', exchange: 'TEST', ticker: 'TEST.X1', providerIdentifiers: { 'fixture-provider': 'example-robotics-1' }, ...overrides });
export const requestFixture = (overrides = {}) => ({ schemaVersion: 'entity-resolution-request.v1', requestId: 'fixture-request', rawName: 'Example Robotics Holdings', expectedEntityTypes: ['company'], ...overrides });
export const auditFixture = (overrides = {}) => ({ schemaVersion: 'bridge-audit-event.v1', requestId: 'fixture-request', timestamp: '2026-01-02T03:04:05Z', actor: 'fixture-user', actorType: 'user', client: 'fixture-cli', operation: 'entity.create', confirmationState: 'approved', success: true, ...overrides });
export function expectCode(code, fn) { assert.throws(fn, (error) => error?.name === 'LocalCoreError' && error.code === code); }
export function tempDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'investment-local-core-test-'));
  t.after(() => {
    const relative = path.relative(tmpdir(), directory);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
export function memoryStore(t) {
  const store = openLocalDatabase({ filename: ':memory:', purpose: 'test', mode: 'initialize' }, contracts);
  t.after(() => store.database.close());
  return store;
}
