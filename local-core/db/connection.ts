import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { AuditRepository, ContractRegistry, EntityRepository, LocalDatabase } from '../ports/index.js';
import { LocalCoreError, fail } from '../domain/errors.js';
import { assertSafeDatabasePath } from '../paths.js';
import { migrateDatabase, preflightDatabase, verifyDatabase } from './migrations.js';
import { SqliteEntityRepository } from './entity-adapter.js';
import { SqliteAuditRepository } from './audit-adapter.js';

export interface OpenDatabaseOptions {
  filename: string;
  purpose: 'local' | 'test';
  mode: 'initialize' | 'readwrite' | 'readonly';
}
export interface LocalStore {
  database: LocalDatabase;
  entities: EntityRepository;
  audit: AuditRepository;
}

export function openLocalDatabase(options: OpenDatabaseOptions, contracts: ContractRegistry): LocalStore {
  assertSafeDatabasePath(options.filename, options.purpose);
  let db: Database.Database;
  try {
    if (options.mode === 'initialize' && options.filename !== ':memory:') mkdirSync(path.dirname(options.filename), { recursive: true });
    db = new Database(options.filename, { readonly: options.mode === 'readonly', fileMustExist: options.mode !== 'initialize', timeout: 5000 });
  } catch { return fail('DATABASE_OPEN_FAILED', 'Unable to open Local DB. Check explicit path, permissions and native dependency.'); }
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('recursive_triggers = ON');
    if (options.mode === 'readonly') {
      db.pragma('query_only = ON');
      verifyDatabase(db);
    } else {
      // Validate existing DB before any journal-mode write. Initialization of
      // an unknown/corrupt DB never attempts repair or destructive recreation.
      if (options.mode === 'initialize') preflightDatabase(db);
      else verifyDatabase(db);
      const journal = db.pragma('journal_mode = WAL', { simple: true });
      if (journal !== (options.filename === ':memory:' ? 'memory' : 'wal')) fail('DATABASE_OPEN_FAILED', 'Required SQLite journal mode is unavailable.');
      db.pragma('synchronous = FULL');
      if (options.mode === 'initialize') migrateDatabase(db);
    }
    if (db.pragma('foreign_keys', { simple: true }) !== 1) fail('DATABASE_OPEN_FAILED', 'SQLite foreign keys could not be enabled.');
  } catch (error) {
    db.close();
    if (error instanceof LocalCoreError) throw error;
    return fail('DATABASE_INTEGRITY_FAILED', 'Local DB initialization failed; original data was retained.');
  }

  const frames: { failure?: LocalCoreError }[] = [];
  function atomic<T>(work: () => T): T {
    const frame: { failure?: LocalCoreError } = {};
    try {
      if (!db.open || options.mode === 'readonly') fail('TRANSACTION_ROLLED_BACK', 'Database is closed or read-only.');
      if (work.constructor.name === 'AsyncFunction') fail('TRANSACTION_ROLLED_BACK', 'SQLite transaction callbacks must be synchronous.');
      return db.transaction(() => {
        frames.push(frame);
        try {
          const result = work();
          if (result && (typeof result === 'object' || typeof result === 'function') && 'then' in result) fail('TRANSACTION_ROLLED_BACK', 'SQLite transactions cannot return a Promise or thenable.');
          if (frame.failure) throw new LocalCoreError('TRANSACTION_ROLLED_BACK', 'A failed operation marked the transaction for rollback.', frame.failure.code);
          return result;
        } finally { frames.pop(); }
      }).immediate();
    } catch (error) {
      const typed = error instanceof LocalCoreError ? error : new LocalCoreError('TRANSACTION_ROLLED_BACK', 'Database transaction was rolled back.');
      // Even a caller that catches a nested audit failure cannot commit earlier mutations.
      for (const parent of frames) parent.failure ??= typed;
      throw typed;
    }
  }
  const entities: EntityRepository = new SqliteEntityRepository(db, contracts, atomic);
  const audit: AuditRepository = new SqliteAuditRepository(db, contracts, atomic);
  const database: LocalDatabase = {
    transaction<T>(work: (repositories: { entities: EntityRepository; audit: AuditRepository }) => T extends PromiseLike<unknown> ? never : T): T {
      let active = true;
      const scopedEntities: EntityRepository = {
        create: (input) => { checkActive(); return entities.create(input); },
        get: (id) => { checkActive(); return entities.get(id); },
        list: () => { checkActive(); return entities.list(); },
        rename: (...args) => { checkActive(); return entities.rename(...args); },
        merge: (...args) => { checkActive(); return entities.merge(...args); },
        lookupProviderIdentifier: (...args) => { checkActive(); return entities.lookupProviderIdentifier(...args); },
      };
      const scopedAudit: AuditRepository = {
        append: (event) => { checkActive(); return audit.append(event); },
        get: (id) => { checkActive(); return audit.get(id); },
        listByRequest: (id) => { checkActive(); return audit.listByRequest(id); },
      };
      function checkActive() { if (!active) fail('TRANSACTION_ROLLED_BACK', 'Transaction-scoped repository has expired.'); }
      try {
        if (work.constructor.name === 'AsyncFunction') fail('TRANSACTION_ROLLED_BACK', 'SQLite transaction callbacks must be synchronous.');
        return atomic(() => work({ entities: scopedEntities, audit: scopedAudit }));
      } catch (error) {
        throw new LocalCoreError('TRANSACTION_ROLLED_BACK', 'Explicit transaction did not commit.', error instanceof LocalCoreError ? error.reasonCode ?? error.code : undefined);
      } finally { active = false; }
    },
    verify: () => verifyDatabase(db),
    close: () => { if (frames.length) fail('TRANSACTION_ROLLED_BACK', 'Cannot close an active transaction.'); db.close(); },
  };
  return { database, entities, audit };
}
