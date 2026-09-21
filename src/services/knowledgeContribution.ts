import { canonicalJson } from '../../shared/canonical-json.mjs';
import type { ResearchSourceRef } from '../types/researchExtraction';
import { DOCUMENT_SECTIONS, BROWSER_SOURCE_DOMAIN, type IngestionSnapshot, type KnowledgeContributionBundle, type KnowledgeProposal, type SourceCitation, type WikiDocumentDraft } from '../types/knowledgeIngestion';
import type { WikiData, WikiOwners } from '../types/wiki';
import { buildWikiReadModel, cloneWiki, emptyWikiRelatedRefs, validateWikiData, wikiRequire } from './wiki';
import type { WikiAdditions } from './wikiRepository';
import validateSchema from './contributionValidator.generated.mjs';
import { isPreciseInstant } from '../utils/dateTime';

export const sourceRef = (sourceId: string): ResearchSourceRef => ({ schemaVersion: 'research-source-ref.v1', sourceDomain: BROWSER_SOURCE_DOMAIN, sourceId });
export const proposalKey = (bundleId: string, proposalId: string) => `${bundleId}:${proposalId}`;
export const proposalReviewId = (bundleId: string, proposalId: string) => `c-${bundleId.length}-${bundleId}-${proposalId.length}-${proposalId}-review`;
const unique = (values: string[], message: string) => wikiRequire(new Set(values).size === values.length, message);

export function validateDocument(document: WikiDocumentDraft | null): asserts document is WikiDocumentDraft {
  wikiRequire(document && document.title.trim() && document.summary.trim(), '建议必须包含文章标题、摘要和完整正文');
  for (const heading of DOCUMENT_SECTIONS) {
    const match = document!.bodyMarkdown.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
    wikiRequire(match && match[1].trim().length > 0, `完整文章缺少章节或内容：${heading}`);
  }
}
export function validateCitation(citation: SourceCitation, state: IngestionSnapshot, allowed: Set<string>): void {
  const source = state.sources.find(row => canonicalJson(sourceRef(row.sourceId)) === canonicalJson(citation.sourceRef));
  wikiRequire(source && allowed.has(source.sourceId) && source.parse.status === 'parsed', '引用资料不存在、未解析或不属于本批贡献');
  const segment = source!.parse.segments.find(row => row.locator === citation.locator);
  wikiRequire(segment && citation.quote.trim() && segment.text.includes(citation.quote), '原文定位或引文核验失败');
}
/** Schema alone never grants imported references authority. */
export function validateContribution(value: unknown, state: IngestionSnapshot, importedAt: string): asserts value is KnowledgeContributionBundle {
  wikiRequire(validateSchema(value), '研究贡献包格式错误或版本不支持');
  const bundle = value as KnowledgeContributionBundle;
  wikiRequire(isPreciseInstant(bundle.createdAt) && Date.parse(bundle.createdAt) <= Date.parse(importedAt), '贡献时间无效或晚于导入时间');
  const batch = state.batches.find(row => row.batchId === bundle.batchId);
  wikiRequire(batch && Date.parse(batch.capturedAt) <= Date.parse(bundle.createdAt), '批次不存在或贡献早于资料保存');
  unique(bundle.sourceRefs.map(row => row.sourceRef.sourceId), '贡献包存在重复资料引用');
  // A contribution may cover an explicitly selected subset of its original batch.
  // Citations still must belong to this declared subset; remote staging is not local authority.
  const allowed = new Set(bundle.sourceRefs.map(row => row.sourceRef.sourceId));
  bundle.sourceRefs.forEach(row => {
    const source = state.sources.find(s => canonicalJson(sourceRef(s.sourceId)) === canonicalJson(row.sourceRef));
    wikiRequire(source && batch!.sourceIds.includes(source.sourceId) && source.sha256 === row.sha256 && source.parse.status === 'parsed'
      && Date.parse(source.parse.parsedAt!) <= Date.parse(importedAt), '原始资料摘要不符、跨批次引用或尚未解析');
  });
  unique(bundle.extractions.map(row => row.ref.extractionId), '重复的提取记录');
  bundle.extractions.forEach(row => {
    wikiRequire(row.ref.sourceDomain === BROWSER_SOURCE_DOMAIN && row.semanticClass === 'ai_draft' && row.author.type === 'ai' && row.author.ref === null
      && row.extractor.type === 'ai' && row.adapterVersion === 'browser-source.v1'
      && row.review.status === 'draft' && row.review.approvalRef === null && row.review.reviewedAt === null
      && row.effectiveAt === null && row.revision.supersedes === null && row.revision.successor === null && row.revision.reason === null
      && canonicalJson(row.relatedRefs) === canonicalJson(emptyWikiRelatedRefs())
      && isPreciseInstant(row.createdAt) && isPreciseInstant(row.asOf) && Date.parse(row.asOf) <= Date.parse(row.createdAt)
      && Date.parse(row.createdAt) <= Date.parse(bundle.createdAt) && Date.parse(row.asOf) >= Date.parse(batch!.capturedAt)
      && row.completeness !== 'FULL' && row.uncertainty.includes('unknown_publication'), '提取记录越过来源、时间、审核或身份边界');
    wikiRequire(row.findings.every(finding => finding.kind !== 'relationship'), '本资料适配器尚不支持外部事件关系引用');
    row.sourceRefs.forEach(ref => wikiRequire(ref.sourceDomain === BROWSER_SOURCE_DOMAIN && allowed.has(ref.sourceId), '提取记录引用不属于当前贡献'));
  });
  unique(bundle.knowledgeAtoms.map(row => row.atomId), '重复的知识要点');
  bundle.knowledgeAtoms.forEach(atom => {
    const extraction = bundle.extractions.find(row => row.ref.extractionId === atom.extractionId);
    wikiRequire(extraction && atom.findingIndex < extraction.findings.length, '知识要点必须引用已有提取内容');
    atom.citations.forEach(c => { validateCitation(c, state, allowed); wikiRequire(extraction!.sourceRefs.some(ref => ref.sourceId === c.sourceRef.sourceId), '要点与提取来源不符'); });
  });
  bundle.conflicts.forEach(row => row.citations.forEach(c => validateCitation(c, state, allowed)));
  unique(bundle.proposals.map(row => row.proposalId), '重复的建议');
  bundle.proposals.forEach(proposal => {
    unique(proposal.extractionIds, '建议重复引用提取记录'); unique(proposal.linkedWikiIds, '建议重复关联');
    proposal.extractionIds.forEach(id => wikiRequire(bundle.extractions.some(row => row.ref.extractionId === id), '建议引用未知提取记录'));
    proposal.citations.forEach(c => validateCitation(c, state, allowed));
    proposal.changes.forEach(change => change.citations.forEach(c => validateCitation(c, state, allowed)));
    if (proposal.action === 'NO_ACTION') wikiRequire(proposal.document === null && proposal.wikiId === null && proposal.baseRevisionId === null && !proposal.linkedWikiIds.length, '无需处理建议不得携带写入');
    else {
      validateDocument(proposal.document); wikiRequire(proposal.changes.length > 0, '建议必须提供逐节变化摘要');
      wikiRequire(proposal.action === 'CREATE' ? proposal.wikiId === null && proposal.baseRevisionId === null
        : proposal.wikiId !== null && proposal.baseRevisionId !== null, '新增或更新目标不明确');
      if (proposal.action === 'LINK') wikiRequire(proposal.linkedWikiIds.length > 0, '建立关联必须指定已有文章');
      if (proposal.action === 'CONFLICT') wikiRequire(bundle.conflicts.length > 0 && proposal.uncertainty.length > 0, '冲突建议必须保留冲突与不确定性');
    }
  });
}

export function contributionStatus(state: IngestionSnapshot, wiki: WikiData, bundleId: string, proposalId: string): 'pending' | 'accepted' | 'rejected' | 'no_action' {
  const accepted = wiki.reviews.find(row => row.reviewId === proposalReviewId(bundleId, proposalId));
  if (accepted) { wikiRequire(accepted.decision === 'reviewed', '建议审核记录冲突'); return 'accepted'; }
  return state.dispositions.find(row => row.key === proposalKey(bundleId, proposalId))?.decision ?? 'pending';
}

/** Complete revision + user Review are one existing repository append. No parallel Wiki store. */
export function contributionAdditions(state: IngestionSnapshot, wiki: WikiData, owners: WikiOwners, bundleId: string, proposalId: string, note: string, now: string, edited?: WikiDocumentDraft): WikiAdditions {
  validateWikiData(wiki);
  const imported = state.contributions.find(row => row.bundle.bundleId === bundleId);
  wikiRequire(imported, '贡献包不存在');
  validateContribution(imported!.bundle, state, imported!.importedAt);
  wikiRequire(contributionStatus(state, wiki, bundleId, proposalId) === 'pending', '此建议已处理');
  const proposal = imported!.bundle.proposals.find(row => row.proposalId === proposalId);
  wikiRequire(proposal && proposal.action !== 'NO_ACTION' && note.trim(), '请选择有效建议并填写审核说明');
  wikiRequire(isPreciseInstant(now) && Date.parse(now) >= Date.parse(imported!.importedAt), '审核时间早于导入');
  const p = proposal!, document = edited ?? p.document;
  validateDocument(document);
  const current = buildWikiReadModel(wiki, owners, now);
  const previous = p.wikiId ? current.pages.find(row => row.entry.wikiId === p.wikiId)?.revision : undefined;
  if (p.action !== 'CREATE') {
    wikiRequire(previous && previous.revisionId === p.baseRevisionId, '当前文章已变化，请重新研究并导入建议');
    wikiRequire(!wiki.revisions.some(row => row.supersedes === previous!.revisionId), '已有后续草稿，请先处理版本历史');
  }
  for (const id of p.linkedWikiIds) wikiRequire(id !== p.wikiId && current.pages.some(page => page.entry.wikiId === id), '关联文章不是当前已审核文章');
  const wikiId = p.wikiId ?? `c-${bundleId.length}-${bundleId}-${proposalId.length}-${proposalId}-wiki`;
  wikiRequire(p.action !== 'CREATE' || !wiki.entries.some(row => row.wikiId === wikiId), '新增文章身份已存在');
  const revisionId = `c-${bundleId.length}-${bundleId}-${proposalId.length}-${proposalId}-revision`, reviewId = proposalReviewId(bundleId, proposalId);
  const refs = [...(previous?.sourceRefs ?? []), ...p.citations.map(c => c.sourceRef), ...p.changes.flatMap(change => change.citations.map(c => c.sourceRef))];
  const sourceRefs = [...new Map(refs.map(ref => [canonicalJson(ref), ref])).values()];
  const extractionRefs = [...new Map([...(previous?.extractionRefs ?? []), ...imported!.bundle.extractions.filter(row => p.extractionIds.includes(row.ref.extractionId)).map(row => row.ref)].map(ref => [canonicalJson(ref), ref])).values()];
  return cloneWiki({
    ...(previous ? {} : { entries: [{ schemaVersion: 'wiki-entry.v1', wikiId, type: p.wikiType, createdAt: now }] }),
    revisions: [{ schemaVersion: 'wiki-revision.v1', wikiId, revisionId, ...document, sourceRefs, extractionRefs,
      evidenceRefs: previous?.evidenceRefs ?? [], relatedRefs: previous?.relatedRefs ?? emptyWikiRelatedRefs(),
      wikiRefs: [...new Set([...(previous?.wikiRefs.map(ref => ref.wikiId) ?? []), ...p.linkedWikiIds])].map(id => ({ wikiId: id })),
      tags: previous?.tags ?? [], aliases: previous?.aliases ?? [], authorType: 'ai', createdAt: now, asOf: now,
      supersedes: previous?.revisionId ?? null, revisionReason: `${p.rationale}\n${p.changes.map(row => `${row.section}：${row.summary}`).join('\n')}\n不确定性：${[...imported!.bundle.uncertainty, ...p.uncertainty].join('；') || '未另行说明'}${edited ? '\n用户修改后接受' : ''}` }],
    reviews: [{ schemaVersion: 'wiki-review.v1', reviewId, wikiId, revisionId, decision: 'reviewed', reviewerType: 'user',
      approvalRef: { owner: 'WikiReview', approvalId: reviewId }, createdAt: now, note: note.trim(), supersedes: null }],
  });
}
export const proposalLabels: Record<KnowledgeProposal['action'], string> = { CREATE: '新增知识', UPDATE: '更新知识', LINK: '建立关联', CONFLICT: '发现冲突', NO_ACTION: '无需修改' };
