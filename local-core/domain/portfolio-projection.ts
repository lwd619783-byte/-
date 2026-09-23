import type { AssetReads } from '../ports/asset-ports.js';
import type { AuditRepository, ContractRegistry } from '../ports/index.js';
import type { PortfolioInput, Receipt } from '../../shared/portfolio.mjs';
import { projectPortfolio } from '../../shared/portfolio.mjs';
import { digest } from './asset-invariants.js';

/** Accept read capabilities only. Callers open the existing DB in readonly mode. */
export function readPortfolio(reads: AssetReads, audit: Pick<AuditRepository, 'get'>, contracts: ContractRegistry, asOf: string, scope: 'real' | 'synthetic' = 'real') {
  function receipt(type: string, id: string, value: { schemaVersion: string }): Receipt & { warnings: string[] } {
    contracts.validate(value.schemaVersion, value);
    const fingerprint = reads.fingerprint(`id:${type}:${id}`);
    const op = fingerprint && reads.operation(fingerprint.operationKey);
    const event = op && audit.get(op.auditEventId);
    const payloadDigest = digest(value);
    if (!fingerprint || !op || !event || !op.confirmation.userApprovalRef.trim() || !op.appends.some(a => a.id === id && a.version === value.schemaVersion && a.payloadDigest === payloadDigest)
      || event.event.confirmationState !== 'approved' || !event.event.success || event.event.idempotencyKey !== fingerprint.operationKey) throw Error('PORTFOLIO_CONFIRMATION_UNAVAILABLE');
    return { recordedAt: event.event.timestamp, operationKey: fingerprint.operationKey, auditEventId: op.auditEventId, payloadDigest, warnings: op.result.warnings };
  }
  const strip = ({ warnings: _warnings, ...rest }: Receipt & { warnings: string[] }): Receipt => rest;
  const input: PortfolioInput = {
    schemaVersion: 'portfolio-input.v1', scope,
    accounts: reads.accounts().map(a => ({ accountId: a.accountId, name: a.name, receipt: strip(receipt('account', a.accountId, a)) })),
    assets: reads.assets().map(a => ({ assetId: a.assetId, name: a.name, assetType: a.assetType, primaryCategory: a.primaryCategory, strategyBucket: a.strategyBucket ?? null, instrumentId: a.instrumentId ?? null, receipt: strip(receipt('asset', a.assetId, a)) })),
    snapshots: reads.positions().map(s => { const r = receipt('position_snapshot', s.snapshotId, s); return { snapshotId: s.snapshotId, snapshotDate: s.snapshotDate, accountId: s.accountId, assetId: s.assetId, quantity: s.quantity, marketValue: s.marketValue.amount, currency: s.marketValue.currency, receipt: strip(r), warnings: r.warnings }; }),
  };
  return projectPortfolio(input, asOf);
}
