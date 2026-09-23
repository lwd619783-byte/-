import { z } from 'zod';
import { canonicalJson } from './canonical-json.mjs';

export const methodology = 'portfolio-exposure.v1';
const id = z.string().trim().min(1).max(512);
const instant = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const amount = z.number().finite().nonnegative();
const receipt = z.object({ recordedAt: instant, operationKey: id, auditEventId: id, payloadDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const account = z.object({ accountId: id, name: id, receipt }).strict();
const asset = z.object({ assetId: id, name: id, assetType: z.enum(['stock','etf','fund','cash','deposit','physical_gold','insurance','crypto','commodity_proxy','other']), primaryCategory: id, strategyBucket: id.nullable(), instrumentId: id.nullable(), receipt }).strict();
const snapshot = z.object({ snapshotId: id, snapshotDate: date, accountId: id, assetId: id, quantity: amount, marketValue: amount, currency: z.string().regex(/^[A-Z]{3}$/), receipt, warnings: z.array(id) }).strict();
export const portfolioInputSchema = z.object({ schemaVersion: z.literal('portfolio-input.v1'), scope: z.enum(['real', 'synthetic']), accounts: z.array(account), assets: z.array(asset), snapshots: z.array(snapshot) }).strict();
export const dimensions = ['accountId', 'assetId', 'assetType', 'primaryCategory', 'strategyBucket', 'currency'];
export function positionIdentity(accountId, assetId) { return canonicalJson([accountId, assetId]); }
const prior = (a, b) => Date.parse(a) <= Date.parse(b);
const unique = (values) => { if (new Set(values).size !== values.length) throw Error('PORTFOLIO_DUPLICATE_ID'); };
// Decimal sum preserves supplied decimal values; reject non-representable totals.
export function sumAmounts(values) {
  const decimals = values.map(v => { if (!Number.isFinite(v)) throw Error('PORTFOLIO_AMOUNT_INVALID'); const [base, exponent = '0'] = String(v).split('e'); return { n: BigInt(base.replace('.', '')), scale: (base.split('.')[1]?.length ?? 0) - Number(exponent) }; });
  const scale = Math.max(0, ...decimals.map(d => d.scale));
  const n = decimals.reduce((s, d) => s + d.n * 10n ** BigInt(scale - d.scale), 0n);
  const str = (n < 0n ? -n : n).toString().padStart(scale + 1, '0');
  const value = Number(`${n < 0n ? '-' : ''}${scale ? `${str.slice(0, -scale)}.${str.slice(-scale)}` : str}`);
  if (!Number.isFinite(value)) throw Error('PORTFOLIO_AMOUNT_OVERFLOW');
  const [b, e = '0'] = String(value).split('e'), s = (b.split('.')[1]?.length ?? 0) - Number(e), common = Math.max(scale, s);
  if (BigInt(b.replace('.', '')) * 10n ** BigInt(common - s) !== n * 10n ** BigInt(common - scale)) throw Error('PORTFOLIO_AMOUNT_PRECISION');
  return value;
}

/** Rebuildable read model, no mutable storage and no ledger capability. */
export function projectPortfolio(raw, asOf) {
  instant.parse(asOf); const input = portfolioInputSchema.parse(raw);
  unique(input.accounts.map(a => a.accountId)); unique(input.assets.map(a => a.assetId)); unique(input.snapshots.map(s => s.snapshotId));
  const accounts = input.accounts.filter(a => prior(a.receipt.recordedAt, asOf));
  const assets = input.assets.filter(a => prior(a.receipt.recordedAt, asOf));
  const snapshots = input.snapshots.filter(s => prior(`${s.snapshotDate}T23:59:59.999Z`, asOf) && prior(s.receipt.recordedAt, asOf));
  const groups = new Map(), positions = [], blockers = [];
  for (const s of snapshots) {
    if (!accounts.some(a => a.accountId === s.accountId) || !assets.some(a => a.assetId === s.assetId)) throw Error('PORTFOLIO_AUTHORITY_UNAVAILABLE');
    const key = positionIdentity(s.accountId, s.assetId), values = groups.get(key) ?? [];
    values.push(s); groups.set(key, values);
  }
  for (const [positionId, values] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const dates = values.map(s => s.snapshotDate);
    if (new Set(dates).size !== dates.length) { blockers.push(`SNAPSHOT_CONFLICT:${positionId}`); continue; }
    const s = [...values].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)).at(-1);
    const a = assets.find(a => a.assetId === s.assetId), acc = accounts.find(a => a.accountId === s.accountId);
    const problems = [...s.warnings];
    if (s.snapshotDate !== asOf.slice(0, 10)) problems.push('STALE_SNAPSHOT');
    if (!a.strategyBucket) problems.push('STRATEGY_UNRESOLVED');
    positions.push({ positionId, accountId: acc.accountId, accountName: acc.name, assetId: a.assetId, assetName: a.name, assetType: a.assetType, primaryCategory: a.primaryCategory, strategyBucket: a.strategyBucket, instrumentId: a.instrumentId, snapshotId: s.snapshotId, snapshotDate: s.snapshotDate, quantity: s.quantity, marketValue: s.marketValue, currency: s.currency, blockers: problems, lineage: { snapshot: s.receipt, account: acc.receipt, asset: a.receipt } });
  }
  // A conflicted denominator cannot retain healthy-looking shares from the rest.
  if (blockers.length) return { schemaVersion: 'portfolio-projection.v1', methodology, scope: input.scope, asOf, status: 'conflicted', positions: [], cohorts: [], blockers, denominator: 'recorded_positions_only' };
  if (!positions.length) blockers.push('POSITION_SNAPSHOT_MISSING');
  for (const a of accounts) if (!positions.some(p => p.accountId === a.accountId)) blockers.push(`ACCOUNT_SNAPSHOT_MISSING:${a.accountId}`);
  if (new Set(positions.map(p => p.currency)).size > 1) blockers.push('FX_UNRESOLVED');
  if (new Set(positions.map(p => p.snapshotDate)).size > 1) blockers.push('SNAPSHOT_DATES_NOT_COMPARABLE');
  blockers.push('FULL_ACCOUNT_COVERAGE_UNPROVEN');
  const cohorts = [...new Set(positions.map(p => canonicalJson([p.currency, p.snapshotDate])))].sort().map(key => {
    const [currency, snapshotDate] = JSON.parse(key), selected = positions.filter(p => p.currency === currency && p.snapshotDate === snapshotDate);
    const total = sumAmounts(selected.map(p => p.marketValue));
    const exposures = dimensions.flatMap(dimension => [...new Set(selected.map(p => p[dimension]))].sort().map(value => {
      const members = selected.filter(p => p[dimension] === value), marketValue = sumAmounts(members.map(p => p.marketValue));
      return { dimension, value, marketValue, share: total > 0 ? marketValue / total : null, positionIds: members.map(p => p.positionId) };
    }));
    return { currency, snapshotDate, total, exposures, blockers: total === 0 ? ['ZERO_DENOMINATOR'] : [] };
  });
  return { schemaVersion: 'portfolio-projection.v1', methodology, scope: input.scope, asOf, status: positions.length ? 'partial' : 'unresolved', positions, cohorts, blockers: [...new Set(blockers)].sort(), denominator: 'recorded_positions_only' };
}
