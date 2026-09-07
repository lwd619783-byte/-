import type { BridgeAuditEvent, NewEntity, RegistryEntry, ResolutionRequest, ResolutionResult, StoredAudit } from '../domain/types.js';

export interface ContractRegistry {
  validate(version: string, value: unknown): void;
  readonly versions: readonly string[];
}
export interface DatabaseVerification {
  schemaVersion: number;
  migrations: { version: number; name: string; checksum: string }[];
  integrity: 'ok';
  foreignKeys: 'ok';
  schemaObjects: 'ok';
}
export interface LocalDatabase {
  // Synchronous only. Repositories supplied to the callback share one connection.
  transaction<T>(work: (repositories: { entities: EntityRepository; audit: AuditRepository }) => T extends PromiseLike<unknown> ? never : T): T;
  verify(): DatabaseVerification;
  close(): void;
}
export interface EntityRepository {
  create(input: NewEntity): RegistryEntry;
  get(entityId: string): RegistryEntry;
  list(): RegistryEntry[];
  rename(entityId: string, canonicalName: string, expectedRevision: number): RegistryEntry;
  merge(entityId: string, targetId: string, expectedRevision: number, userConfirmed: true): RegistryEntry;
  // Internal Node port; deliberately NOT a V1 ResolutionRequest extension.
  lookupProviderIdentifier(providerId: string, providerIdentifier: string): RegistryEntry;
}
export interface EntityResolver {
  resolve(request: ResolutionRequest): ResolutionResult;
  requireResolved(request: ResolutionRequest): string;
}
export interface AuditRepository {
  append(event: BridgeAuditEvent): StoredAudit;
  get(eventId: string): StoredAudit;
  listByRequest(requestId: string): StoredAudit[];
}
