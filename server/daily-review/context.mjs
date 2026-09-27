import retained from '../../src/data/real/priceHistory.generated.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { instant, reviewRequire as need } from '../../shared/daily-review.mjs';
import { freightRuntime } from '../../shared/oil-shipping-scope.mjs';

/** Bounded metadata projection of the existing owner. No new provider or calculated prices. */
export function reviewContext(asOf, now = Date.now()) {
  instant.parse(asOf); need(Date.parse(asOf) <= now, 'REVIEW_FUTURE_CONTEXT');
  const refs = [{ id: 'freight', kind: 'os', title: '油运运价接入状态', locator: 'os:industry:oil-shipping:freight', revision: freightRuntime.revision, sourceDate: null,
    asOf, availableAt: null, availability: freightRuntime.availability, relationToOS: 'os_state' }];
  const stocks = ['cosco-energy','cm-energy','cm-nanjing'].map(id => {
    const owner = retained.items[id], availableAt = owner?.quality?.updatedAt ?? null;
    const readable = availableAt && Date.parse(availableAt) <= Date.parse(asOf) && owner?.id === id;
    const points = readable ? owner.points.filter(p => p.date < new Date(Date.parse(asOf)+8*3600000).toISOString().slice(0,10)) : [];
    const sourceDate = points.at(-1)?.date ?? null;
    const availability = !readable || !sourceDate ? 'missing' : owner.quality.status === 'conflicted' ? 'conflicted' : owner.quality.status === 'stale' ? 'stale' : owner.quality.status !== 'real' ? 'blocked' : Date.parse(asOf) - Date.parse(sourceDate) > 7*86400000 ? 'stale' : 'available';
    const ref = { id, kind: 'os', title: `${id} 股票留存元数据`, locator: `os:stock:${id}:price-history`, revision: createHash('sha256').update(canonicalJson(owner ?? null)).digest('hex'),
      sourceDate, asOf, availableAt: readable ? availableAt : null, availability, relationToOS: 'os_state' };
    refs.push(ref);
    return { id, availability, sourceDate, availableAt: ref.availableAt, retainedPoints: points.length, adjustment: 'unknown', source: owner?.quality?.source ?? null, sourceUrl: owner?.quality?.sourceUrl ?? null };
  });
  return { subjectType: 'industry', subjectId: 'oil-shipping', asOf, freight: freightRuntime.availability, relationship: freightRuntime.relationship, stocks, sourceReferences: refs,
    formalDecision: 'unchanged; use separately authorized os:read for exact formal snapshot references',
    limitation: 'Metadata only, no stock-price calculation. Freight is NOT_ADMITTED. Future retained snapshots cannot establish historical availability. External evidence never replaces these OS states.' };
}
export function validateOSReferences(review, now = Date.now()) {
  const context = reviewContext(review.asOf, now);
  // Mandatory blocked-freight reference prevents publishing a review that silently omits the OS gap.
  need(review.sources.some(s => s.locator === context.sourceReferences[0].locator), 'REVIEW_FREIGHT_GAP_REQUIRED');
  for (const source of review.sources.filter(s => s.kind === 'os')) {
    const ref = context.sourceReferences.find(s => s.locator === source.locator);
    need(ref && ['revision','sourceDate','asOf','availableAt','availability','relationToOS'].every(k => source[k] === ref[k]), 'REVIEW_OS_REFERENCE_MISMATCH');
  }
}
