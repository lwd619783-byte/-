import { z } from 'zod';
import { canonicalJson } from './canonical-json.mjs';

export const methodology = 'portfolio-exposure.v1';
const id = z.string().trim().min(1).max(512);
const instant = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const amount = z.number().finite().nonnegative();
const receipt = z.object({ recordedAt: instant, operationKey: id, auditEventId: id, payloadDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const accountStatus = z.enum(['active', 'inactive', 'archived']);
const account = z.object({ accountId: id, name: id, status: accountStatus, receipt }).strict();
const asset = z.object({ assetId: id, name: id, assetType: z.enum(['stock','etf','fund','cash','deposit','physical_gold','insurance','crypto','commodity_proxy','other']), primaryCategory: id, strategyBucket: id.nullable(), instrumentId: id.nullable(), receipt }).strict();
const snapshot = z.object({ snapshotId: id, snapshotDate: date, accountId: id, assetId: id, quantity: amount, marketValue: amount, currency: z.string().regex(/^[A-Z]{3}$/), receipt, warnings: z.array(id) }).strict();
export const portfolioInputSchema = z.object({ schemaVersion: z.literal('portfolio-input.v1'), scope: z.enum(['real', 'synthetic']), accounts: z.array(account), assets: z.array(asset), snapshots: z.array(snapshot) }).strict();
export const dimensions = ['accountId', 'assetId', 'assetType', 'primaryCategory', 'strategyBucket', 'currency'];
const dimension = z.enum(['accountId', 'assetId', 'assetType', 'primaryCategory', 'strategyBucket', 'currency']);
export const portfolioProjectionSchema = z.object({
  integrity: z.object({ version: z.literal('portfolio-integrity.v1'), canonicalPayload: z.string().min(1) }).strict(),
  schemaVersion: z.literal('portfolio-projection.v1'), methodology: z.literal(methodology), scope: z.enum(['real','synthetic']), asOf: instant,
  status: z.enum(['partial','unresolved','conflicted']), denominator: z.literal('recorded_positions_only'), blockers: z.array(id),
  positions: z.array(z.object({ positionId:id, accountId:id, accountName:id, accountStatus, assetId:id, assetName:id, assetType:asset.shape.assetType, primaryCategory:id, strategyBucket:id.nullable(), instrumentId:id.nullable(), snapshotId:id, snapshotDate:date, quantity:amount, marketValue:amount, currency:z.string().regex(/^[A-Z]{3}$/), blockers:z.array(id), lineage:z.object({snapshot:receipt,account:receipt,asset:receipt}).strict() }).strict()),
  cohorts:z.array(z.object({currency:z.string().regex(/^[A-Z]{3}$/),snapshotDate:date,total:amount,blockers:z.array(id),exposures:z.array(z.object({dimension,value:id.nullable(),marketValue:amount,share:z.number().finite().min(0).max(1).nullable(),positionIds:z.array(id)}).strict())}).strict()),
}).strict();
export function validateProjection(raw) {
  const p = portfolioProjectionSchema.parse(raw);
  const { integrity, ...payload } = p;
  // Check the received bytes semantically before accepting schema normalization.
  // This is a content binding from the projector, not authentication or ledger authority.
  const { integrity: _binding, ...received } = raw;
  if (canonicalJson(received) !== integrity.canonicalPayload || canonicalJson(payload) !== integrity.canonicalPayload) throw Error('PORTFOLIO_INTEGRITY_MISMATCH');
  unique(p.positions.map(p=>p.positionId));
  if (p.status === 'conflicted') { if (p.positions.length || p.cohorts.length || !p.blockers.length) throw Error('PORTFOLIO_CONFLICT_INVALID'); return p; }
  const accounts = new Map(), assets = new Map();
  for (const row of p.positions) {
    if (row.positionId !== positionIdentity(row.accountId,row.assetId)) throw Error('PORTFOLIO_POSITION_ID_INVALID');
    const a={accountId:row.accountId,name:row.accountName,status:row.accountStatus,receipt:row.lineage.account};
    const s={assetId:row.assetId,name:row.assetName,assetType:row.assetType,primaryCategory:row.primaryCategory,strategyBucket:row.strategyBucket,instrumentId:row.instrumentId,receipt:row.lineage.asset};
    for (const [map,key,val] of [[accounts,row.accountId,a],[assets,row.assetId,s]]) { if (map.has(key) && canonicalJson(map.get(key)) !== canonicalJson(val)) throw Error('PORTFOLIO_INPUT_CONFLICT'); map.set(key,val); }
  }
  const rebuilt=projectPortfolio({schemaVersion:'portfolio-input.v1',scope:p.scope,accounts:[...accounts.values()],assets:[...assets.values()],snapshots:p.positions.map(row=>({snapshotId:row.snapshotId,snapshotDate:row.snapshotDate,accountId:row.accountId,assetId:row.assetId,quantity:row.quantity,marketValue:row.marketValue,currency:row.currency,receipt:row.lineage.snapshot,warnings:row.blockers}))},p.asOf);
  if (rebuilt.status !== p.status || canonicalJson(rebuilt.positions) !== canonicalJson(p.positions) || canonicalJson(rebuilt.cohorts)!==canonicalJson(p.cohorts) || rebuilt.blockers.some(b=>!p.blockers.includes(b))) throw Error('PORTFOLIO_PROJECTION_DRIFT');
  return p;
}
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

// Only the official projector creates a binding; validators must never repair/reseal input.
// Canonical JSON reuses the existing exact-pin primitive and keeps this path synchronous.
function bindProjection(payload) {
  return { ...payload, integrity: { version: 'portfolio-integrity.v1', canonicalPayload: canonicalJson(payload) } };
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
  for (const [positionId, values] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const dates = values.map(s => s.snapshotDate);
    if (new Set(dates).size !== dates.length) { blockers.push(`SNAPSHOT_CONFLICT:${positionId}`); continue; }
    const s = [...values].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)).at(-1);
    const a = assets.find(a => a.assetId === s.assetId), acc = accounts.find(a => a.accountId === s.accountId);
    const problems = [...s.warnings];
    if (s.snapshotDate !== new Date(asOf).toISOString().slice(0, 10)) problems.push('STALE_SNAPSHOT');
    if (acc.status !== 'active') problems.push(`ACCOUNT_${acc.status.toUpperCase()}`);
    if (!a.strategyBucket) problems.push('STRATEGY_UNRESOLVED');
    positions.push({ positionId, accountId: acc.accountId, accountName: acc.name, accountStatus: acc.status, assetId: a.assetId, assetName: a.name, assetType: a.assetType, primaryCategory: a.primaryCategory, strategyBucket: a.strategyBucket, instrumentId: a.instrumentId, snapshotId: s.snapshotId, snapshotDate: s.snapshotDate, quantity: s.quantity, marketValue: s.marketValue, currency: s.currency, blockers: [...new Set(problems)].sort(), lineage: { snapshot: s.receipt, account: acc.receipt, asset: a.receipt } });
  }
  // A conflicted denominator cannot retain healthy-looking shares from the rest.
  if (blockers.length) return bindProjection({ schemaVersion: 'portfolio-projection.v1', methodology, scope: input.scope, asOf, status: 'conflicted', positions: [], cohorts: [], blockers, denominator: 'recorded_positions_only' });
  for (const a of accounts) if (a.status !== 'active') blockers.push(`ACCOUNT_${a.status.toUpperCase()}:${a.accountId}`);
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
    return { currency, snapshotDate, total, exposures, blockers: [...new Set([...selected.filter(p => p.accountStatus !== 'active').map(p => `ACCOUNT_${p.accountStatus.toUpperCase()}:${p.accountId}`), ...(total === 0 ? ['ZERO_DENOMINATOR'] : [])])].sort() };
  });
  return bindProjection({ schemaVersion: 'portfolio-projection.v1', methodology, scope: input.scope, asOf, status: positions.length ? 'partial' : 'unresolved', positions, cohorts, blockers: [...new Set(blockers)].sort(), denominator: 'recorded_positions_only' });
}
