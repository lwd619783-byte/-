import { z } from 'zod';
import { canonicalJson } from './canonical-json.mjs';
import { portfolioProjectionSchema, validateProjection } from './portfolio.mjs';

export const MAX_SNAPSHOT_BYTES = 1024 * 1024;
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
export const PUBLISH_MAX_AGE_MS = 15 * 60 * 1000;
const id = z.string().min(1).max(512), text = z.string().max(16000), instant = z.string().datetime({ offset: true });
const refs = z.array(id).max(200), digest = z.string().regex(/^[a-f0-9]{64}$/);
const status = z.enum(['verified', 'confirmed', 'blocked', 'stale', 'conflicted', 'partial']);
const lineage = z.object({ owner: z.enum(['Claim', 'Thesis', 'Expression']), id, revisionId: id, approvalId: id, revisionDigest: digest }).strict();
const base = { id, revisionId: id, approvalId: id, revisionDigest: digest, asOf: instant, createdAt: instant,
  status, blockers: refs, citationRefs: refs, lineage: z.array(lineage).max(200), origin: z.enum(['ai_draft', 'user_judgement']) };
const claim = z.object({ ...base, authority: z.literal('BrowserClaimRepository'), statement: text, scope: text,
  gate: z.object({ outcome: id, verifiable: z.boolean(), conditions: refs }).strict(),
  evidence: z.object({ adapter: id, graphId: id, graphRevision: z.number().int().positive(), graphSha256: digest, targetNodeId: id,
    candidateRef: z.object({ owner: id, objectId: id, version: id, sha256: digest, locator: id }).strict() }).strict() }).strict();
const identity = z.object({ owner: z.enum(['MacroIndicator', 'Industry', 'Stock']), id }).strict();
const thesis = z.object({ ...base, authority: z.literal('BrowserThesisRepository'), statement: text, bull: text, base: text, bear: text,
  keyDrivers: z.array(text).max(200), catalysts: z.array(text).max(200), risks: z.array(text).max(200), invalidation: z.array(text).max(200),
  confidence: z.enum(['low', 'medium', 'high', 'unknown']), relatedEntities: z.array(identity).max(200),
  gate: z.object({ publishable: z.boolean() }).strict(), supportUpdates: refs }).strict();
const context = z.object({ status: z.enum(['unknown', 'research_judgement']), rationale: text }).strict();
const expression = z.object({ ...base, authority: z.literal('BrowserExpressionRepository'),
  instrument: z.object({ owner: z.enum(['Stock', 'Entity', 'Asset']), id, type: z.enum(['Index', 'ETF', 'Fund', 'Equity', 'CommodityProxy']), market: z.enum(['A', 'H', 'US', 'global', 'unknown']) }).strict().nullable(),
  role: z.enum(['direct', 'leader', 'high_beta', 'defensive', 'unknown']), directness: context, correlation: context, liquidity: context,
  valuation: context, sensitivity: context, idiosyncraticRisk: context,
  gate: z.object({ publishable: z.boolean(), unknowns: refs }).strict(), thesisUpdated: z.boolean() }).strict();
const domain = row => z.object({ status: z.enum(['available', 'missing', 'partial', 'blocked', 'stale', 'conflicted']), blockers: refs, rows: z.array(row).max(200) }).strict();
export const decisionSnapshotSchema = z.object({ schemaVersion: z.literal('decision-snapshot.v1'), snapshotId: z.string().uuid(), generatedAt: instant, asOf: instant,
  scope: z.enum(['real', 'synthetic']), authority: z.literal('local-formal-owners'), semantics: z.literal('current-published-state-only'),
  claims: domain(claim), theses: domain(thesis), expressions: domain(expression),
  portfolio: z.object({ status: z.enum(['unavailable', 'partial', 'conflicted']), authority: z.literal('localhost-portfolio-projection'), blockers: refs, projection: portfolioProjectionSchema.nullable() }).strict(),
}).strict();
export function validateDecisionSnapshot(raw) {
  if (new TextEncoder().encode(canonicalJson(raw)).length > MAX_SNAPSHOT_BYTES) throw Error('SNAPSHOT_TOO_LARGE');
  const s = decisionSnapshotSchema.parse(raw);
  if (s.asOf !== s.generatedAt) throw Error('SNAPSHOT_CURRENT_ONLY');
  for (const key of ['claims', 'theses', 'expressions']) {
    const d = s[key], seen = new Set();
    const expectedStatus = !d.rows.length ? 'missing' : d.rows.some(r => !['verified', 'confirmed'].includes(r.status)) ? 'partial' : 'available';
    const expectedBlockers = [...new Set(d.rows.flatMap(r => r.blockers))].sort();
    if (d.status !== expectedStatus || canonicalJson(d.blockers) !== canonicalJson(expectedBlockers)) throw Error('SNAPSHOT_DOMAIN_STATUS');
    for (const r of d.rows) {
      if (seen.has(r.id) || Date.parse(r.asOf) > Date.parse(r.createdAt) || Date.parse(r.createdAt) > Date.parse(s.asOf)) throw Error('SNAPSHOT_ID_OR_TIME');
      seen.add(r.id);
      const passed = key === 'claims' ? r.gate.verifiable : r.gate.publishable;
      if (!passed && (!['blocked', 'conflicted'].includes(r.status) || !r.blockers.length)) throw Error('SNAPSHOT_GATE');
      if (key === 'claims' && passed && r.status !== 'verified') throw Error('SNAPSHOT_GATE');
      if (['verified', 'confirmed'].includes(r.status) && (!passed || r.blockers.length)) throw Error('SNAPSHOT_GATE');
      if ((key === 'claims' && r.status === 'confirmed') || (key !== 'claims' && r.status === 'verified')) throw Error('SNAPSHOT_STATUS');
      if (key === 'claims' && r.status === 'verified' && (r.gate.outcome !== 'supported' || r.gate.conditions.length)) throw Error('SNAPSHOT_GATE');
      if (key === 'theses' && (!r.lineage.length || r.lineage.some(l => l.owner !== 'Claim'))) throw Error('SNAPSHOT_LINEAGE');
      if (key === 'expressions' && r.gate.publishable && (r.lineage.length !== 1 || r.lineage[0].owner !== 'Thesis' || !r.instrument)) throw Error('SNAPSHOT_LINEAGE');
      for (const ref of r.lineage) {
        const upstream = (ref.owner === 'Claim' ? s.claims.rows : ref.owner === 'Thesis' ? s.theses.rows : s.expressions.rows).find(v => v.id === ref.id && v.revisionId === ref.revisionId);
        if (upstream && (upstream.approvalId !== ref.approvalId || upstream.revisionDigest !== ref.revisionDigest)) throw Error('SNAPSHOT_LINEAGE_DRIFT');
      }
    }
  }
  const p = s.portfolio;
  if (p.status === 'unavailable') { if (p.projection !== null || !p.blockers.length) throw Error('SNAPSHOT_PORTFOLIO'); }
  else { const projection = validateProjection(p.projection); if (projection.scope !== s.scope || projection.asOf !== s.asOf || p.status !== (projection.status === 'conflicted' ? 'conflicted' : 'partial') || canonicalJson(p.blockers) !== canonicalJson(projection.blockers)) throw Error('SNAPSHOT_PORTFOLIO'); }
  return s;
}
