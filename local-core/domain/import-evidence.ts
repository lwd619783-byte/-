import type { ImportTrust } from '../ports/import-trust.js';
import type { ContractRegistry } from '../ports/index.js';
import type { AccountValueReconciliation, AssetCandidate, AssetImportBundle, CandidatePayloads, CandidateType, EvidenceSnapshot, HistoricalAssetImport, ImportPlanItem, PositionSnapshot } from './asset-types.js';
import type { AssetState } from './asset-invariants.js';
import { amountSum, checked, digest, executionDates, ledgerBaselineDate } from './asset-invariants.js';
import { candidateVersions } from './asset-types.js';
import { canonicalJson } from './canonical-json.js';
import { fail, LocalCoreError } from './errors.js';

export function resolveImportEvidence(bundle: AssetImportBundle, historical: HistoricalAssetImport | undefined, trust: ImportTrust): EvidenceSnapshot[] {
  const refs = [...new Set([...(historical?.sourceRefs.map(r => r.refId) ?? []), ...(bundle.sourceEvidenceRefs ?? []),
    ...bundle.candidates.flatMap(c => [...(c.sourceEvidenceRefs ?? []), ...('sourceEvidenceRef' in c.payload && c.payload.sourceEvidenceRef ? [(c.payload.sourceEvidenceRef as { refId: string }).refId] : [])]),
    ...(bundle.accountValueObservations ?? []).flatMap(o => o.sourceEvidenceRefs)])].sort();
  const snapshots: EvidenceSnapshot[] = [];
  for (const refId of refs) {
    const resolved = trust.resolveEvidence(refId);
    if (!resolved) continue;
    // Clone before use: a resolver cannot later mutate a prepared snapshot.
    const value = JSON.parse(canonicalJson(resolved)) as typeof resolved;
    const { content, ...rest } = value;
    // This core admits structured source archives only. The source must itself
    // contain the exact assertions; a sidecar verified label/digest cannot
    // turn arbitrary text, OCR or an unrelated screenshot into evidence.
    let contentSupportsAssertions = false;
    try { contentSupportsAssertions = canonicalJson(JSON.parse(content)) === canonicalJson(value.assertions); }
    catch { /* Unsupported/unparseable evidence remains unusable. */ }
    const usable = value.refId === refId && typeof content === 'string' && Boolean(content.trim()) &&
      Boolean(value.verification?.version?.trim()) && value.verification.status === 'verified' &&
      value.verification.contentDigest === digest(content) && value.verification.assertionsDigest === digest(value.assertions) &&
      Array.isArray(value.assertions?.candidates) && Array.isArray(value.assertions?.accountSnapshots) && contentSupportsAssertions;
    snapshots.push({ ...rest, refId, contentDigest: digest(content ?? null), usable });
  }
  return snapshots;
}

export function historicalCandidate(candidate: AssetCandidate, value: CandidatePayloads[CandidateType], bundle: AssetImportBundle,
  metadata: HistoricalAssetImport, evidence: EvidenceSnapshot[], state: AssetState): void {
  if (bundle.sourceType !== 'file_import' || ('source' in value && value.source !== 'legacy_import')) fail('LEDGER_INVALID', 'Historical facts require file import and legacy_import provenance.');
  const refs = metadata.sourceRefs;
  if (!refs.length || refs.some(r => !evidence.some(e => e.refId === r.refId && e.refType === r.refType))) fail('LEDGER_INVALID', 'Historical source evidence cannot be resolved.');
  if (refs.some(r => r.quality !== 'verified') || evidence.some(e => refs.some(r => r.refId === e.refId) && e.verification?.status === 'pending')) fail('RECONCILIATION_REQUIRED', 'Historical evidence verification is not complete.');
  if (refs.some(r => !evidence.some(e => e.refId === r.refId && e.usable))) fail('LEDGER_INVALID', 'Historical evidence content or verification digest is not trustworthy.');
  const links = [...(candidate.sourceEvidenceRefs ?? []), ...(bundle.sourceEvidenceRefs ?? []), ...('sourceEvidenceRef' in value && value.sourceEvidenceRef ? [value.sourceEvidenceRef.refId] : [])];
  if (!evidence.some(e => e.usable && refs.some(r => r.refId === e.refId) && links.includes(e.refId) && e.assertions.candidates.some(f =>
    f.candidateId === candidate.candidateId && f.candidateType === candidate.candidateType && canonicalJson(f.payload) === canonicalJson(value)))) fail('LEDGER_INVALID', 'Verified source content does not support this candidate and its mapping.');
  const dates = value.schemaVersion === 'dca-execution.v1' ? executionDates(value, state) :
    'tradeDate' in value ? [value.tradeDate] : 'date' in value ? [value.date] : 'snapshotDate' in value ? [value.snapshotDate] : [];
  if (dates.some(d => d >= ledgerBaselineDate)) fail('LEDGER_INVALID', 'Every historical fact must be strictly before 2026-08-14.');
  if (dates.some(d => d > bundle.asOf.slice(0, 10))) fail('LEDGER_INVALID', 'History cannot be later than its observation.');
  if (!dates.length) {
    const facts = bundle.candidates.filter(c => !['account', 'asset'].includes(c.candidateType));
    const used = facts.some(c => value.schemaVersion === 'account.v1' ? c.payload.accountId === value.accountId : value.schemaVersion === 'asset.v1' &&
      (c.payload.assetId === value.assetId || (c.candidateType === 'dca_execution' && state.revisions.some(r => r.plan.planId === c.payload.planId && r.plan.assetId === value.assetId))));
    if (!used) fail('LEDGER_INVALID', 'Account and Asset candidates must be dependencies of dated historical facts.');
  }
}

export function reconcileAccountValues(bundle: AssetImportBundle, items: ImportPlanItem[], evidence: EvidenceSnapshot[], contracts: ContractRegistry): AccountValueReconciliation[] {
  return (bundle.accountValueObservations ?? []).map(observation => {
    const warnings: string[] = [];
    const result: AccountValueReconciliation = { accountId: observation.accountId, snapshotDate: observation.snapshotDate, observedTotal: observation.totalMarketValue, status: 'warn', warnings };
    const observations = bundle.accountValueObservations!.filter(o => o.accountId === observation.accountId && o.snapshotDate === observation.snapshotDate);
    if (observations.length > 1) warnings.push(new Set(observations.map(o => canonicalJson(o.totalMarketValue))).size > 1 ? 'CONFLICTING_ACCOUNT_OBSERVATIONS' : 'DUPLICATE_ACCOUNT_OBSERVATIONS');
    const candidates = bundle.candidates.filter(c => c.candidateType === 'position_snapshot' && c.payload.accountId === observation.accountId && c.payload.snapshotDate === observation.snapshotDate);
    const positions: PositionSnapshot[] = [];
    if (!candidates.length) warnings.push('NO_SAME_BUNDLE_POSITIONS');
    for (const c of candidates) {
      try {
        const p = checked<PositionSnapshot>(contracts, candidateVersions.position_snapshot, c.payload);
        const item = items.find(i => i.candidateId === c.candidateId);
        if (!item || !['pass', 'skip_duplicate'].includes(item.decision) || item.warnings?.length) warnings.push('POSITION_CANDIDATE_NOT_VALIDATED');
        positions.push(p);
      } catch (e) { if (!(e instanceof LocalCoreError)) throw e; warnings.push('POSITION_CONTRACT_INVALID'); }
    }
    const byAsset = new Map<string, PositionSnapshot[]>();
    positions.forEach(p => byAsset.set(p.assetId, [...(byAsset.get(p.assetId) ?? []), p]));
    for (const group of byAsset.values()) if (group.length > 1) {
      const facts = group.map(({ snapshotId: _id, ...p }) => canonicalJson(p));
      warnings.push(new Set(facts).size > 1 ? 'CONFLICTING_POSITION_CANDIDATES' : 'DUPLICATE_ASSET_POSITION_CANDIDATES');
    }
    if (positions.some(p => p.marketValue.currency !== observation.totalMarketValue.currency)) warnings.push('ACCOUNT_VALUE_CURRENCY_CONFLICT');
    const sources = observation.sourceEvidenceRefs.map(id => evidence.find(e => e.refId === id));
    if (sources.some(e => !e?.usable)) warnings.push('ACCOUNT_VALUE_EVIDENCE_UNVERIFIED');
    const manifests = sources.flatMap(e => e?.usable ? e.assertions.accountSnapshots.filter(s => s.observation.accountId === observation.accountId && s.observation.snapshotDate === observation.snapshotDate) : []);
    // Exact source manifest membership proves completeness, including cash.
    // A mere verified label or coincidentally equal sum cannot prove it.
    const actual = positions.map(p => canonicalJson(p)).sort();
    if (!manifests.length || manifests.some(s => !s.complete || canonicalJson(s.observation) !== canonicalJson(observation) ||
      canonicalJson(s.positions.map(p => canonicalJson(p)).sort()) !== canonicalJson(actual))) warnings.push('FULL_ACCOUNT_COMPLETENESS_UNVERIFIABLE');
    if (warnings.length) return result;
    try {
      const amounts = positions.map(p => p.marketValue.amount);
      result.candidatePositionTotal = { amount: amountSum(amounts), currency: observation.totalMarketValue.currency };
      result.reconciliationDelta = { amount: amountSum([...amounts, -observation.totalMarketValue.amount]), currency: observation.totalMarketValue.currency };
      if (result.reconciliationDelta.amount !== 0) warnings.push('ACCOUNT_VALUE_MISMATCH');
      else result.status = 'pass';
    } catch (e) {
      if (!(e instanceof LocalCoreError)) throw e;
      delete result.candidatePositionTotal; delete result.reconciliationDelta; warnings.push('EXACT_ACCOUNT_TOTAL_UNREPRESENTABLE');
    }
    return result;
  });
}
