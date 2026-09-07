// V1 wire shapes, checked against the frozen schemas by contract tests.
export const entityTypes = ['industry', 'theme', 'instrument', 'company', 'macro_metric', 'account', 'asset'] as const;
export type EntityType = typeof entityTypes[number];
export const entityStatuses = ['active', 'candidate', 'merged', 'archived'] as const;
export type EntityStatus = typeof entityStatuses[number];
export interface RegistryEntry {
  schemaVersion: 'entity-registry-entry.v1';
  entityId: string;
  entityType: EntityType;
  canonicalName: string;
  aliases: string[];
  market?: string;
  exchange?: string;
  ticker?: string;
  providerIdentifiers?: Record<string, string>;
  parentEntityId?: string;
  status: EntityStatus;
  mergedIntoEntityId?: string;
  userConfirmed?: boolean;
  revision?: number;
}
export type NewEntity = Omit<RegistryEntry, 'schemaVersion' | 'entityId' | 'revision' | 'mergedIntoEntityId'>;
export interface ResolutionRequest {
  schemaVersion: 'entity-resolution-request.v1';
  requestId: string;
  rawName: string;
  expectedEntityTypes: EntityType[];
  marketHint?: string;
  exchangeHint?: string;
  tickerHint?: string;
  contextText?: string;
}
export interface ResolutionCandidate {
  entityId: string;
  canonicalName: string;
  entityType: string;
  confidence: number;
  matchReasons: string[];
}
export interface ResolutionResult {
  schemaVersion: 'entity-resolution-result.v1';
  requestId: string;
  status: 'resolved' | 'needs_user_confirmation' | 'not_found' | 'conflicted';
  resolvedEntityId?: string;
  confidence?: number;
  candidates: ResolutionCandidate[];
  allowAutoCreate: false;
  notes?: string[];
}
export interface BridgeAuditEvent {
  schemaVersion: 'bridge-audit-event.v1';
  requestId: string;
  timestamp: string;
  actor: string;
  actorType?: 'user' | 'ai' | 'system';
  client: string;
  operation: string;
  entity?: {
    entityType: 'macro' | 'industry' | 'theme' | 'instrument' | 'company' | 'account' | 'asset' | 'thesis' | 'workflow';
    entityId: string;
    displayName?: string;
  };
  scope?: string;
  confirmationState?: 'not_required' | 'prepared' | 'approved' | 'rejected';
  beforeVersion?: number;
  afterVersion?: number;
  idempotencyKey?: string;
  success: boolean;
  errorCode?: string;
}
export interface StoredAudit {
  eventId: string;
  event: BridgeAuditEvent;
  payloadSha256: string;
  createdAt: string;
}
