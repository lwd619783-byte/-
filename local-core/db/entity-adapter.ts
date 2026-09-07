import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ContractRegistry, EntityRepository } from '../ports/index.js';
import type { NewEntity, RegistryEntry } from '../domain/types.js';
import { fail, LocalCoreError } from '../domain/errors.js';
import { normalizeEntityText } from '../domain/normalize.js';

export type Atomic = <T>(work: () => T) => T;
interface Row {
  entity_id: string; entity_type: RegistryEntry['entityType']; canonical_name: string;
  status: RegistryEntry['status']; market: string | null; exchange: string | null; ticker: string | null;
  parent_entity_id: string | null; merged_into_entity_id: string | null; user_confirmed: number; revision: number;
}
export class SqliteEntityRepository implements EntityRepository {
  readonly #db: Database.Database;
  readonly #contracts: ContractRegistry;
  readonly #atomic: Atomic;
  constructor(db: Database.Database, contracts: ContractRegistry, atomic: Atomic) {
    this.#db = db; this.#contracts = contracts; this.#atomic = atomic;
  }
  create(input: NewEntity): RegistryEntry {
    return this.#atomic(() => {
      // Reserved identity/version fields cannot be smuggled through JavaScript callers.
      if (['schemaVersion', 'entityId', 'revision', 'mergedIntoEntityId'].some((key) => Object.hasOwn(input, key))) fail('CONTRACT_INVALID', 'Identity and revision are generated locally.');
      const entry: RegistryEntry = { ...input, schemaVersion: 'entity-registry-entry.v1', entityId: randomUUID(), revision: 1 };
      this.#contracts.validate('entity-registry-entry.v1', entry);
      if (entry.status === 'merged' || !normalizeEntityText(entry.canonicalName)) fail('CONTRACT_INVALID', 'New identities require a nonempty name and cannot start merged.');
      const normalizedAliases = entry.aliases.map(normalizeEntityText);
      if (normalizedAliases.some((alias) => !alias) || new Set(normalizedAliases).size !== normalizedAliases.length) fail('CONTRACT_INVALID', 'Aliases must remain distinct after normalization.');
      const now = new Date().toISOString();
      this.#db.prepare(`INSERT INTO entity_registry(entity_id, entity_type, canonical_name, status, market, exchange, ticker, parent_entity_id, merged_into_entity_id, user_confirmed, revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`).run(entry.entityId, entry.entityType, entry.canonicalName, entry.status, entry.market ?? null, entry.exchange ?? null, entry.ticker ?? null, entry.parentEntityId ?? null, Number(entry.userConfirmed ?? false), now, now);
      for (const [index, alias] of entry.aliases.entries()) {
        this.#db.prepare('INSERT INTO entity_aliases(entity_id, alias, normalized_alias, created_at) VALUES (?, ?, ?, ?)').run(entry.entityId, alias, normalizedAliases[index]!, now);
      }
      for (const [providerId, identifier] of Object.entries(entry.providerIdentifiers ?? {})) {
        if (!providerId.trim() || !identifier.trim()) fail('CONTRACT_INVALID', 'Provider identities must be nonempty.');
        if (this.#db.prepare('SELECT 1 FROM entity_provider_identifiers WHERE provider_id=? AND provider_identifier=?').get(providerId, identifier)) fail('ENTITY_DUPLICATE_IDENTIFIER', 'Provider identity already belongs to an entity.');
        try {
          this.#db.prepare('INSERT INTO entity_provider_identifiers(entity_id, provider_id, provider_identifier, created_at) VALUES (?, ?, ?, ?)').run(entry.entityId, providerId, identifier, now);
        } catch (error) {
          if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') fail('ENTITY_DUPLICATE_IDENTIFIER', 'Provider identity collision.');
          throw error;
        }
      }
      return this.get(entry.entityId);
    });
  }
  private decode(row: Row): RegistryEntry {
    const aliases = this.#db.prepare('SELECT alias FROM entity_aliases WHERE entity_id=? ORDER BY normalized_alias').all(row.entity_id) as { alias: string }[];
    const providers = this.#db.prepare('SELECT provider_id, provider_identifier FROM entity_provider_identifiers WHERE entity_id=? ORDER BY provider_id').all(row.entity_id) as { provider_id: string; provider_identifier: string }[];
    const entry: RegistryEntry = {
      schemaVersion: 'entity-registry-entry.v1', entityId: row.entity_id, entityType: row.entity_type,
      canonicalName: row.canonical_name, status: row.status, aliases: aliases.map((item) => item.alias),
      userConfirmed: row.user_confirmed === 1, revision: row.revision,
      ...(row.market !== null ? { market: row.market } : {}),
      ...(row.exchange !== null ? { exchange: row.exchange } : {}),
      ...(row.ticker !== null ? { ticker: row.ticker } : {}),
      ...(row.parent_entity_id !== null ? { parentEntityId: row.parent_entity_id } : {}),
      ...(row.merged_into_entity_id !== null ? { mergedIntoEntityId: row.merged_into_entity_id } : {}),
      ...(providers.length ? { providerIdentifiers: Object.fromEntries(providers.map((item) => [item.provider_id, item.provider_identifier])) } : {}),
    };
    this.#contracts.validate('entity-registry-entry.v1', entry);
    return entry;
  }
  private read<T>(work: () => T): T {
    try { return work(); } catch (error) {
      if (error instanceof LocalCoreError) throw error;
      return fail('DATABASE_INTEGRITY_FAILED', 'Entity read failed.');
    }
  }
  get(entityId: string): RegistryEntry {
    return this.read(() => {
      const row = this.#db.prepare('SELECT * FROM entity_registry WHERE entity_id=?').get(entityId) as Row | undefined;
      if (!row) return fail('ENTITY_NOT_FOUND', 'Entity does not exist.');
      return this.decode(row);
    });
  }
  list(): RegistryEntry[] {
    return this.read(() => (this.#db.prepare('SELECT * FROM entity_registry ORDER BY entity_id').all() as Row[]).map((row) => this.decode(row)));
  }
  rename(entityId: string, canonicalName: string, expectedRevision: number): RegistryEntry {
    return this.#atomic(() => {
      const previous = this.get(entityId);
      this.#contracts.validate('entity-registry-entry.v1', { ...previous, canonicalName });
      if (!normalizeEntityText(canonicalName)) fail('CONTRACT_INVALID', 'Canonical name must not normalize to empty.');
      if (previous.status === 'merged' || previous.revision !== expectedRevision) fail('ENTITY_CONFLICTED', 'Entity revision or status prevents rename.');
      this.#db.prepare('UPDATE entity_registry SET canonical_name=?, revision=revision+1, updated_at=? WHERE entity_id=? AND revision=?')
        .run(canonicalName, new Date().toISOString(), entityId, expectedRevision);
      return this.get(entityId);
    });
  }
  merge(entityId: string, targetId: string, expectedRevision: number, userConfirmed: true): RegistryEntry {
    return this.#atomic(() => {
      if (userConfirmed !== true) fail('ENTITY_NEEDS_CONFIRMATION', 'Merge requires explicit user confirmation.');
      const source = this.get(entityId);
      const target = this.get(targetId);
      if (entityId === targetId || source.status === 'merged' || target.status !== 'active' || source.entityType !== target.entityType || source.revision !== expectedRevision) fail('ENTITY_CONFLICTED', 'Merge identity, status or revision conflict.');
      this.#db.prepare("UPDATE entity_registry SET status='merged', merged_into_entity_id=?, user_confirmed=1, revision=revision+1, updated_at=? WHERE entity_id=? AND revision=?")
        .run(targetId, new Date().toISOString(), entityId, expectedRevision);
      // Preserve historical aliases/provider ownership on the source; never retarget silently.
      return this.get(entityId);
    });
  }
  lookupProviderIdentifier(providerId: string, providerIdentifier: string): RegistryEntry {
    return this.read(() => {
      if (!providerId.trim() || !providerIdentifier.trim()) fail('CONTRACT_INVALID', 'Exact provider identity requires both inputs.');
      const matches = this.#db.prepare('SELECT entity_id FROM entity_provider_identifiers WHERE provider_id=? AND provider_identifier=?').all(providerId, providerIdentifier) as { entity_id: string }[];
      if (matches.length > 1) fail('ENTITY_DUPLICATE_IDENTIFIER', 'Ambiguous provider identity.');
      if (!matches.length) return fail('ENTITY_NOT_FOUND', 'Exact provider identity was not found.');
      return this.get(matches[0]!.entity_id);
    });
  }
}
