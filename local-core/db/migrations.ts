import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseVerification } from '../ports/index.js';
import { fail, LocalCoreError } from '../domain/errors.js';
import { projectRoot } from '../paths.js';

export interface Migration { readonly version: number; readonly name: string; readonly sql: string; readonly checksum: string }
export function defineMigration(version: number, name: string, source: string): Migration {
  // Git CRLF checkout conversion is not a schema change. All other bytes matter.
  const sql = source.replace(/\r\n/g, '\n');
  return Object.freeze({ version, name, sql, checksum: createHash('sha256').update(sql, 'utf8').digest('hex') });
}
export function loadMigrations(): readonly Migration[] {
  try {
    return Object.freeze(['001-local-core', '002-long-term-account'].map((name, index) =>
      defineMigration(index + 1, name, readFileSync(path.join(projectRoot, `local-core/db/migrations/${name}.sql`), 'utf8'))));
  } catch {
    return fail('DATABASE_OPEN_FAILED', 'Local Core migration source is unavailable.');
  }
}
interface AppliedMigration { version: number; name: string; checksum: string; applied_at: string }
function objects(db: Database.Database): { type: string; name: string; sql: string }[] {
  return db.prepare("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all() as { type: string; name: string; sql: string }[];
}
function history(db: Database.Database, migrations: readonly Migration[]): AppliedMigration[] {
  for (const [index, migration] of migrations.entries()) {
    if (migration.version !== index + 1 || defineMigration(migration.version, migration.name, migration.sql).checksum !== migration.checksum) fail('MIGRATION_CHECKSUM_MISMATCH', 'Migration source sequence or checksum is invalid.');
  }
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='schema_migrations'").get()) {
    if (objects(db).length) fail('SCHEMA_VERSION_UNSUPPORTED', 'Unrecognized database without schema metadata.');
    return [];
  }
  const rows = db.prepare('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version').all() as AppliedMigration[];
  if (!rows.length) fail('SCHEMA_VERSION_UNSUPPORTED', 'Schema metadata exists without an applied migration.');
  for (const [index, row] of rows.entries()) {
    const expected = migrations[index];
    if (!expected || row.version !== expected.version) fail('SCHEMA_VERSION_UNSUPPORTED', 'Database schema version is unsupported.');
    if (row.name !== expected.name || row.checksum !== expected.checksum) fail('MIGRATION_CHECKSUM_MISMATCH', 'Applied migration differs from immutable source.');
    if (!Number.isFinite(Date.parse(row.applied_at))) fail('DATABASE_INTEGRITY_FAILED', 'Migration timestamp is invalid.');
  }
  return rows;
}
function verifyContent(db: Database.Database): void {
  const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') fail('DATABASE_INTEGRITY_FAILED', 'SQLite integrity check failed.');
  if ((db.pragma('foreign_key_check') as unknown[]).length) fail('DATABASE_INTEGRITY_FAILED', 'SQLite foreign key check failed.');
}
function verifyObjects(db: Database.Database, migrations: readonly Migration[]): void {
  const reference = new Database(':memory:');
  try {
    for (const migration of migrations) reference.exec(migration.sql);
    if (JSON.stringify(objects(db)) !== JSON.stringify(objects(reference))) fail('DATABASE_INTEGRITY_FAILED', 'Schema tables, indexes or defensive triggers differ from migrations.');
  } finally { reference.close(); }
}
export function preflightDatabase(db: Database.Database, migrations = loadMigrations()): void {
  try {
    const rows = history(db, migrations);
    verifyContent(db);
    if (rows.length) verifyObjects(db, migrations.slice(0, rows.length));
  } catch (error) {
    if (error instanceof LocalCoreError) throw error;
    fail('DATABASE_INTEGRITY_FAILED', 'Database preflight failed; no migration or repair was attempted.');
  }
}
export function verifyDatabase(db: Database.Database, migrations = loadMigrations()): DatabaseVerification {
  try {
    const rows = history(db, migrations);
    if (rows.length !== migrations.length) fail('SCHEMA_VERSION_UNSUPPORTED', 'Database requires explicit initialization or migration.');
    verifyContent(db);
    verifyObjects(db, migrations);
    return { schemaVersion: rows.at(-1)!.version, migrations: rows.map(({ version, name, checksum }) => ({ version, name, checksum })), integrity: 'ok', foreignKeys: 'ok', schemaObjects: 'ok' };
  } catch (error) {
    if (error instanceof LocalCoreError) throw error;
    return fail('DATABASE_INTEGRITY_FAILED', 'Database verification failed; no repair was attempted.');
  }
}
export function migrateDatabase(db: Database.Database, migrations = loadMigrations()): DatabaseVerification {
  try {
    return db.transaction(() => {
      const previous = history(db, migrations);
      verifyContent(db);
      if (previous.length) verifyObjects(db, migrations.slice(0, previous.length));
      for (const migration of migrations.slice(previous.length)) {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
          .run(migration.version, migration.name, migration.checksum, new Date().toISOString());
      }
      return verifyDatabase(db, migrations);
    }).immediate();
  } catch (error) {
    if (error instanceof LocalCoreError) throw error;
    if (['SQLITE_CORRUPT', 'SQLITE_NOTADB'].includes((error as { code?: string }).code ?? '')) fail('DATABASE_INTEGRITY_FAILED', 'Damaged database was retained without repair.');
    return fail('TRANSACTION_ROLLED_BACK', 'Migration failed and was rolled back.');
  }
}
