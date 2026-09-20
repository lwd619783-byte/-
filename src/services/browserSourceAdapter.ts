import type { ResearchSource, ResearchSourceAdapter, ResearchSourceRef, ResearchExtractionRef } from '../types/researchExtraction';
import { BROWSER_SOURCE_DOMAIN, type IngestionSnapshot } from '../types/knowledgeIngestion';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { cloneWiki, emptyWikiRelatedRefs, wikiRequire } from './wiki';
import { sourceRef } from './knowledgeContribution';
import { validateIngestion } from './browserSourceRepository';
import { isPreciseInstant } from '../utils/dateTime';

/** Snapshot obtained only after the repository has verified retained binary bytes. */
export function createBrowserSourceAdapter(snapshot: IngestionSnapshot, asOf: string): ResearchSourceAdapter {
  validateIngestion(snapshot); wikiRequire(isPreciseInstant(asOf), '资料查询时间无效');
  const state = cloneWiki(snapshot), visible = (at: string) => Date.parse(at) <= Date.parse(asOf);
  const sources: ResearchSource[] = state.sources.filter(s => visible(s.capturedAt)).map(s => ({
    schemaVersion: 'research-source.v1', ref: sourceRef(s.sourceId), sourceType: s.kind, semanticClass: 'source_material', relatedRefs: emptyWikiRelatedRefs(),
    provenance: { owner: 'BrowserSource', authorRef: null, url: null }, publishedAt: null, capturedAt: s.capturedAt, recordedAt: s.capturedAt, asOf,
    completeness: 'UNVERIFIED', uncertainty: ['unknown_publication', 'author_unverified', 'unverified_source'],
    contentRef: { sourceRef: sourceRef(s.sourceId), field: 'rawBytes' }, digest: { algorithm: 'sha256', value: s.sha256 }, revision: { supersedes: null, successor: null },
  }));
  const extractions = state.contributions.filter(c => visible(c.importedAt)).flatMap(c => c.bundle.extractions);
  const adapter: ResearchSourceAdapter = {
    adapterVersion: 'browser-source.v1', sourceDomain: BROWSER_SOURCE_DOMAIN, asOf,
    listSources: () => cloneWiki(sources), listExtractions: () => cloneWiki(extractions),
    resolveSource(ref) { const row = sources.find(s => canonicalJson(s.ref) === canonicalJson(ref)); wikiRequire(row, '原始资料不存在或在该时点尚不可见'); return cloneWiki(row!); },
    resolveExtraction(ref) { const row = extractions.find(e => canonicalJson(e.ref) === canonicalJson(ref)); wikiRequire(row, '提取记录不存在或在该时点尚未导入'); return cloneWiki(row!); },
    validateSource(value) { wikiRequire(value && typeof value === 'object' && 'ref' in value && canonicalJson(value) === canonicalJson(adapter.resolveSource(value.ref as ResearchSourceRef)), '资料投影与原始记录不符'); },
    validateExtraction(value) { wikiRequire(value && typeof value === 'object' && 'ref' in value && canonicalJson(value) === canonicalJson(adapter.resolveExtraction(value.ref as ResearchExtractionRef)), '提取投影与原始记录不符'); },
  }; return adapter;
}
export function composeResearchAdapters(adapters: ResearchSourceAdapter[], asOf: string): ResearchSourceAdapter {
  wikiRequire(new Set(adapters.map(a => a.sourceDomain)).size === adapters.length && adapters.every(a => a.asOf === asOf), '资料适配器注册冲突');
  const owner = (ref: { sourceDomain: string }) => { const adapter = adapters.find(a => a.sourceDomain === ref.sourceDomain); wikiRequire(adapter, '未知资料来源'); return adapter!; };
  return { adapterVersion: 'research-composite.v1', sourceDomain: 'composite', asOf,
    listSources: () => adapters.flatMap(a => a.listSources()), listExtractions: () => adapters.flatMap(a => a.listExtractions()),
    resolveSource: ref => owner(ref).resolveSource(ref), resolveExtraction: ref => owner(ref).resolveExtraction(ref),
    validateSource(value) { wikiRequire(value && typeof value === 'object' && 'ref' in value, '资料引用无效'); owner((value as ResearchSource).ref).validateSource(value); },
    validateExtraction(value) { wikiRequire(value && typeof value === 'object' && 'ref' in value, '提取引用无效'); owner((value as { ref: ResearchExtractionRef }).ref).validateExtraction(value); },
  };
}
