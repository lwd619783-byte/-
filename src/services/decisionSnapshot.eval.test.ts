import { it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { evaluateRequest, type EvalResult } from '../../scripts/research-eval/harness.mjs';
import { DecisionStaging, snapshotDigest } from '../../server/os-domain/staging.mjs';
import { createDomainMcp } from '../../server/os-domain/mcp.mjs';
import { DecisionTestStore } from '../../scripts/tests/os-domain.fixture.mjs';
import { buildDecisionSnapshot } from './decisionSnapshot';
import { decisionFixture } from './decisionSnapshot.fixture';
import { claimTime as at } from './verifiedClaim.fixture';
import type { DecisionRow } from '../../shared/decision-snapshot.mjs';

// F3 additive tool-use denominator through the existing harness and official SDK.
// Deterministic synthetic service coverage, never a Stage 4.6 Agent or real account claim.
const common: EvalResult = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
const refs = ['source', 'artifact', 'evidence', 'fact', 'derived_metric', 'claim'];
const vectors = [
  { variant: 'claim', expected: { ...common, outcome: 'supported', selectedRefs: ['synthetic-revision-1'], citationRefs: refs } },
  { variant: 'thesis', expected: { ...common, outcome: 'supported', selectedRefs: ['synthetic-thesis-r1', 'synthetic-revision-1'], citationRefs: refs } },
  { variant: 'expression', expected: { ...common, outcome: 'supported', selectedRefs: ['synthetic-expression-ETF-r1', 'synthetic-thesis-r1'], citationRefs: refs } },
  { variant: 'portfolio-unavailable', expected: { ...common, outcome: 'blocked', conditions: ['missing_evidence'] } },
  ...['blocked-claim', 'future', 'corrupt', 'mutation', 'digest', 'generation', 'expired', 'revoked', 'write', 'wrong-asof', 'wiki'].map(variant => ({ variant, expected: { ...common, conditions: ['missing_evidence'] } })),
];
it.each(vectors)('F3 Domain MCP tool-use: $variant', async ({ variant, expected }) => {
  const f = await decisionFixture(); if (variant === 'blocked-claim') f.claim.graph.nodes[0].nodeId = 'changed';
  const snapshot = await buildDecisionSnapshot(f.runtime, null, new Date(at(12)));
  const target = { targetId: 'os-domain-mcp-readonly-v1', targetVersion: '1', targetKind: 'deterministic_service' as const, supportedOperations: ['retrieve'],
    async execute({ input }: { input: unknown }): Promise<EvalResult> {
      let now = Date.parse(at(12)); const store = new DecisionTestStore(), staging = new DecisionStaging(store, 'synthetic', () => now, 'synthetic');
      const server = createDomainMcp(staging), client = new Client({ name: 'f3-synthetic', version: '1' }), [a, b] = InMemoryTransport.createLinkedPair();
      try {
        const raw = structuredClone(input) as Record<string, unknown>;
        if (variant === 'future') raw.schemaVersion = 'decision-snapshot.v99';
        if (variant === 'corrupt') raw.claims = null;
        if (variant === 'wiki') raw.bodyMarkdown = 'must not stage';
        const published = await staging.publish({ snapshot: raw, digest: snapshotDigest(raw), expectedGeneration: 0, consent: 'publish-current-decision-state' });
        if (variant === 'mutation') store.values.set(`${staging.prefix}snapshots/${snapshot.snapshotId}.json`, { ...snapshot, generatedAt: at(13) });
        if (variant === 'expired') now += 86400001;
        if (variant === 'revoked') await staging.revoke(1);
        await server.connect(a); await client.connect(b);
        const binding = { ...published.binding, ...(variant === 'digest' ? { digest: 'a'.repeat(64) } : {}), ...(variant === 'generation' ? { generation: 9 } : {}), ...(variant === 'wrong-asof' ? { asOf: at(11) } : {}) };
        const name = variant === 'write' ? 'create_claim' : variant === 'portfolio-unavailable' ? 'portfolio_exposure' : variant === 'thesis' ? 'get_thesis' : variant === 'expression' ? 'get_expression' : 'list_verified_claims';
        const exact = variant === 'thesis' ? { id: 'synthetic-thesis', revisionId: 'synthetic-thesis-r1' } : variant === 'expression' ? { id: 'synthetic-expression-ETF', revisionId: 'synthetic-expression-ETF-r1' } : {};
        const result = await client.callTool({ name, arguments: { ...binding, ...exact } });
        if (result.isError) throw Error('TOOL_REJECTED');
        const structured = result.structuredContent;
        if (!structured || typeof structured !== 'object' || !('result' in structured)) throw Error('INVALID_TOOL_RESULT');
        const data = structured.result as { row?: DecisionRow; rows?: DecisionRow[]; status: string };
        const row = data.row ?? data.rows?.[0];
        if (!row || data.status === 'unavailable' || row.status === 'blocked') throw Error('NO_SUPPORTED_RESULT');
        return { ...common, outcome: 'supported', selectedRefs: [row.revisionId, ...row.lineage.map(r => r.revisionId)], citationRefs: row.citationRefs };
      } catch { return { ...common, conditions: ['missing_evidence'] }; }
      finally { await client.close(); await server.close(); }
    },
  };
  const result = await evaluateRequest(target, { operation: 'retrieve', request: {}, input: snapshot }, expected);
  expect(result.semanticDiff).toEqual([]); expect(result.status).toBe('PASS');
});
