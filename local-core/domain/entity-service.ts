import type { AuditRepository, ContractRegistry, EntityRepository, LocalDatabase } from '../ports/index.js';
import type { BridgeAuditEvent, NewEntity, RegistryEntry } from './types.js';
import { fail } from './errors.js';

// Node operator service, not a remote permission/authentication implementation.
// Future REST/MCP adapters must enforce their own frozen permissions before use.
export class EntityService {
  constructor(private readonly database: LocalDatabase, private readonly contracts: ContractRegistry) {}
  private mutate(event: BridgeAuditEvent, operation: string, mutation: (entities: EntityRepository) => RegistryEntry): RegistryEntry {
    this.contracts.validate('bridge-audit-event.v1', event);
    if (event.actorType !== 'user' || event.confirmationState !== 'approved') fail('ENTITY_NEEDS_CONFIRMATION', 'Entity mutation requires an approved user audit context.');
    if (!event.success || event.operation !== operation || event.entity || event.beforeVersion !== undefined || event.afterVersion !== undefined) fail('CONTRACT_INVALID', 'Audit outcome and identity are supplied by the entity service.');
    return this.database.transaction(({ entities, audit }: { entities: EntityRepository; audit: AuditRepository }) => {
      const entry = mutation(entities);
      // Do not omit identity or invent macro_metric -> macro semantics. The
      // internal registry supports every enum; this audited operator service
      // rejects types not representable by V1 Audit EntityRef and rolls back.
      if (entry.entityType === 'macro_metric') fail('CONTRACT_INVALID', 'V1 Audit EntityRef cannot express a macro_metric registry mutation.');
      audit.append({ ...event, entity: { entityType: entry.entityType, entityId: entry.entityId }, beforeVersion: entry.revision! - 1, afterVersion: entry.revision! });
      return entry;
    });
  }
  create(input: NewEntity, event: BridgeAuditEvent): RegistryEntry {
    return this.mutate(event, 'entity.create', (entities) => entities.create(input));
  }
  rename(entityId: string, canonicalName: string, expectedRevision: number, event: BridgeAuditEvent): RegistryEntry {
    return this.mutate(event, 'entity.rename', (entities) => entities.rename(entityId, canonicalName, expectedRevision));
  }
  merge(entityId: string, targetId: string, expectedRevision: number, event: BridgeAuditEvent): RegistryEntry {
    return this.mutate(event, 'entity.merge', (entities) => entities.merge(entityId, targetId, expectedRevision, true));
  }
}
