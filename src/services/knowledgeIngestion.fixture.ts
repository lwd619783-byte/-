import type { IngestionSnapshot, KnowledgeContributionBundle, WikiDocumentDraft } from '../types/knowledgeIngestion';
import { DOCUMENT_SECTIONS } from '../types/knowledgeIngestion';
import { sourceRef } from './knowledgeContribution';
import { emptyWikiRelatedRefs } from './wiki';

/** Synthetic only; never imported by application runtime. */
export const articleFixture = (version = '初始'): WikiDocumentDraft => ({ title: '光通信产业链', summary: `合成测试文章：${version}`, bodyMarkdown: DOCUMENT_SECTIONS.map(title => `## ${title}\n\n${version}合成研究内容，需进一步核验，不代表真实投资结论。`).join('\n\n') });
export function contributionFixture(state: IngestionSnapshot, bundleId = 'bundle-synthetic'): KnowledgeContributionBundle {
  const s = state.sources[0], at = new Date().toISOString(), ref = sourceRef(s.sourceId), citation = { sourceRef: ref, locator: s.parse.segments[0].locator, quote: s.parse.segments[0].text };
  return { schemaVersion: 'knowledge-contribution.v1', bundleId, batchId: s.batchId, createdAt: at,
    sourceRefs: [{ sourceRef: ref, sha256: s.sha256 }],
    extractions: [{ schemaVersion: 'research-extraction.v1', ref: { schemaVersion: 'research-extraction-ref.v1', sourceDomain: 'browser-source', extractionId: `${bundleId}-extraction` }, sourceRefs: [ref], semanticClass: 'ai_draft', relatedRefs: emptyWikiRelatedRefs(), author: { type: 'ai', ref: null }, extractor: { type: 'ai', method: 'synthetic-test', version: '1' }, adapterVersion: 'browser-source.v1', createdAt: at, asOf: at, effectiveAt: null,
      findings: [{ kind: 'fact_candidate', statement: '合成资料候选，尚未证实' }], completeness: 'UNVERIFIED', uncertainty: ['unknown_publication'], review: { status: 'draft', approvalRef: null, reviewedAt: null }, revision: { supersedes: null, successor: null, reason: null } }],
    knowledgeAtoms: [{ atomId: 'atom-1', extractionId: `${bundleId}-extraction`, findingIndex: 0, citations: [citation] }], conflicts: [], uncertainty: ['合成案例未核验'],
    proposals: [{ proposalId: 'proposal-1', action: 'CREATE', wikiId: null, baseRevisionId: null, wikiType: 'INDUSTRY_KNOWLEDGE', document: articleFixture(), changes: [{ section: '核心判断', kind: 'ADD', summary: '首次建立完整文章', citations: [citation] }], citations: [citation], extractionIds: [`${bundleId}-extraction`], linkedWikiIds: [], uncertainty: ['候选结论待验证'], rationale: '根据合成资料整理' }],
  };
}
