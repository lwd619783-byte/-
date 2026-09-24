import { z } from 'zod';
import { bindingSchema } from './staging.mjs';
const instant = z.string().datetime({ offset: true });
const list = bindingSchema.extend({ offset: z.number().int().min(0).max(200).default(0), limit: z.number().int().min(1).max(20).default(20) });
const detail = bindingSchema.extend({ id: z.string().min(1).max(512), revisionId: z.string().min(1).max(512) });
export const domainToolSchemas = {
  decision_summary: z.object({ asOf: instant.optional() }).strict(),
  list_verified_claims: list, get_claim: detail, list_theses: list, get_thesis: detail,
  list_expressions: list, get_expression: detail, portfolio_exposure: bindingSchema,
};
export async function callDomainTool(staging, name, input) {
  if (!Object.hasOwn(domainToolSchemas, name)) throw Error('TOOL_NOT_ALLOWED');
  const args = domainToolSchemas[name].parse(input);
  const binding = name === 'decision_summary' ? undefined : bindingSchema.parse(Object.fromEntries(['snapshotId', 'digest', 'generation', 'asOf'].map(k => [k, args[k]])));
  const { snapshot: s, binding: current, expiresAt } = await staging.read(binding);
  if (args.asOf && args.asOf !== s.asOf) throw Error('ASOF_NOT_PROVABLE');
  const common = { ...current, generatedAt: s.generatedAt, expiresAt, scope: s.scope, authority: s.authority, semantics: s.semantics, freshness: 'published-snapshot-not-live', status: 'published' };
  if (name === 'decision_summary') return { ...common, domains: Object.fromEntries(['claims', 'theses', 'expressions'].map(k => [k, { status: s[k].status, blockers: s[k].blockers, count: s[k].rows.length }])), portfolio: { status: s.portfolio.status, blockers: s.portfolio.blockers, authority: s.portfolio.authority } };
  if (name === 'portfolio_exposure') return { ...common, ...s.portfolio };
  const key = name.includes('claim') ? 'claims' : name.includes('these') || name === 'get_thesis' ? 'theses' : 'expressions', domain = s[key];
  if (name.startsWith('list_')) {
    const rows = key === 'claims' ? domain.rows.filter(r => r.status === 'verified' && r.gate.verifiable) : domain.rows;
    return { ...common, status: domain.status, blockers: domain.blockers, rows: rows.slice(args.offset, args.offset + args.limit), nextOffset: args.offset + args.limit < rows.length ? args.offset + args.limit : null };
  }
  const row = domain.rows.find(r => r.id === args.id && r.revisionId === args.revisionId);
  if (!row) throw Error('EXACT_REVISION_UNAVAILABLE');
  return { ...common, status: domain.status, blockers: domain.blockers, row };
}
