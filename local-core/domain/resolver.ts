import type { ContractRegistry, EntityRepository, EntityResolver } from '../ports/index.js';
import type { RegistryEntry, ResolutionRequest, ResolutionResult } from './types.js';
import { normalizeEntityText as normalize } from './normalize.js';
import { fail } from './errors.js';

export class V1EntityResolver implements EntityResolver {
  constructor(private readonly entities: EntityRepository, private readonly contracts: ContractRegistry) {}
  resolve(request: ResolutionRequest): ResolutionResult {
    this.contracts.validate('entity-resolution-request.v1', request);
    // Never mutate rawName/contextText; callers retain the exact request for audit.
    const raw = normalize(request.rawName);
    const all = this.entities.list().filter((entry) => request.expectedEntityTypes.includes(entry.entityType));
    const equal = (value: string | undefined, hint: string | undefined) => Boolean(value && hint && normalize(value) === normalize(hint));
    const eligible = all.filter((entry) => !request.marketHint || equal(entry.market, request.marketHint));
    const strongTiers: [string, RegistryEntry[]][] = [
      ['exact_exchange_ticker', eligible.filter((entry) => equal(entry.exchange, request.exchangeHint) && equal(entry.ticker, request.tickerHint))],
      ['exact_canonical_name', eligible.filter((entry) => raw !== '' && normalize(entry.canonicalName) === raw)],
      ['exact_alias', eligible.filter((entry) => raw !== '' && entry.aliases.some((alias) => normalize(alias) === raw))],
    ];
    let result: ResolutionResult | undefined;
    for (const [reason, matches] of strongTiers) {
      if (!matches.length) continue;
      // A contradictory supplied ticker/exchange downgrades name/alias evidence.
      const consistent = matches.every((entry) => (!request.tickerHint || equal(entry.ticker, request.tickerHint)) && (!request.exchangeHint || equal(entry.exchange, request.exchangeHint)));
      result = this.result(request.requestId, matches, reason, consistent);
      break;
    }
    if (!result) {
      // Exact ticker without exchange, or exact name with mismatched market,
      // is explainable candidate evidence only. No substring/fuzzy similarity.
      const candidates = all.filter((entry) => (raw !== '' && (normalize(entry.canonicalName) === raw || entry.aliases.some((alias) => normalize(alias) === raw))) || equal(entry.ticker, request.tickerHint));
      result = this.result(request.requestId, candidates, 'insufficient_identity_context', false);
    }
    this.contracts.validate('entity-resolution-result.v1', result);
    return result;
  }
  private result(requestId: string, entries: RegistryEntry[], reason: string, strong: boolean): ResolutionResult {
    const active = entries.filter((entry) => entry.status === 'active');
    const uniqueStrong = strong && entries.length === 1 && active.length === 1;
    const status = !entries.length ? 'not_found' : strong && active.length > 1 ? 'conflicted' : uniqueStrong ? 'resolved' : 'needs_user_confirmation';
    return {
      schemaVersion: 'entity-resolution-result.v1', requestId, status, allowAutoCreate: false,
      ...(uniqueStrong ? { resolvedEntityId: entries[0]!.entityId, confidence: 1 } : {}),
      candidates: [...entries].sort((a, b) => a.entityId.localeCompare(b.entityId)).map((entry) => ({
        entityId: entry.entityId, canonicalName: entry.canonicalName, entityType: entry.entityType,
        // Binary evidence strength, never a probabilistic fuzzy-match score.
        confidence: strong && entry.status === 'active' ? 1 : 0,
        matchReasons: [reason, `registry_status:${entry.status}`],
      })),
    };
  }
  requireResolved(request: ResolutionRequest): string {
    const result = this.resolve(request);
    if (result.status === 'resolved') return result.resolvedEntityId!;
    return fail(result.status === 'not_found' ? 'ENTITY_NOT_FOUND' : result.status === 'conflicted' ? 'ENTITY_CONFLICTED' : 'ENTITY_NEEDS_CONFIRMATION', 'Entity resolution did not produce a unique active identity.');
  }
}
