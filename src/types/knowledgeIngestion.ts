import type { ResearchExtraction, ResearchSourceRef } from './researchExtraction';
import type { WikiType } from './wiki';

export const BROWSER_SOURCE_DOMAIN = 'browser-source';
export interface ResearchBatch { schemaVersion: 'research-batch.v1'; batchId: string; title: string; capturedAt: string; sourceIds: string[] }
export interface SourceSegment { locator: string; label: string; text: string }
export interface BrowserSource {
  sourceId: string; batchId: string; filename: string; mime: string; size: number; sha256: string;
  capturedAt: string; rawRef: string; kind: 'pdf' | 'markdown' | 'text';
  parse: { status: 'pending' | 'parsed' | 'failed'; segments: SourceSegment[]; error: string | null; parsedAt: string | null };
}
export interface SourceCitation { sourceRef: ResearchSourceRef; locator: string; quote: string }
export const DOCUMENT_SECTIONS = ['核心判断', '产业与主题结构', '近期变化', '关键公司与环节', '风险与待验证问题', '来源'] as const;
export interface WikiDocumentDraft { title: string; summary: string; bodyMarkdown: string }
export interface SectionChange { section: string; kind: 'ADD' | 'MODIFY' | 'REMOVE' | 'LOWER_CONFIDENCE'; summary: string; citations: SourceCitation[] }
export interface KnowledgeProposal {
  proposalId: string; action: 'CREATE' | 'UPDATE' | 'LINK' | 'CONFLICT' | 'NO_ACTION';
  wikiId: string | null; baseRevisionId: string | null; wikiType: WikiType;
  document: WikiDocumentDraft | null; changes: SectionChange[]; citations: SourceCitation[];
  extractionIds: string[]; linkedWikiIds: string[]; uncertainty: string[]; rationale: string;
}
/** A transport contract, never a second extraction or Wiki authority. */
export interface KnowledgeContributionBundle {
  schemaVersion: 'knowledge-contribution.v1'; bundleId: string; batchId: string; createdAt: string;
  sourceRefs: Array<{ sourceRef: ResearchSourceRef; sha256: string }>;
  extractions: ResearchExtraction[];
  knowledgeAtoms: Array<{ atomId: string; extractionId: string; findingIndex: number; citations: SourceCitation[] }>;
  conflicts: Array<{ description: string; citations: SourceCitation[] }>;
  uncertainty: string[]; proposals: KnowledgeProposal[];
}
export interface ImportedContribution { bundle: KnowledgeContributionBundle; importedAt: string }
/** Transport triage only. Acceptance is derived exclusively from the existing WikiReview. */
export interface ContributionDisposition { key: string; bundleId: string; proposalId: string; decision: 'rejected' | 'no_action'; note: string; recordedAt: string }
export interface IngestionSnapshot {
  schemaVersion: 'knowledge-ingestion.v1'; generation: number; batches: ResearchBatch[]; sources: BrowserSource[];
  contributions: ImportedContribution[]; dispositions: ContributionDisposition[];
}
export interface BrowserSourceRepository {
  load(): Promise<IngestionSnapshot>;
  saveBatch(files: readonly File[], title: string): Promise<ResearchBatch>;
  parseBatch(batchId: string): Promise<void>;
  readRaw(sourceId: string): Promise<Uint8Array>;
  importBundle(raw: string): Promise<ImportedContribution>;
  dispose(bundleId: string, proposalId: string, decision: ContributionDisposition['decision'], note: string): Promise<void>;
}
export interface KnowledgeAnalysisProvider {
  readonly id: string;
  analyze(request: ResearchTaskExport, signal: AbortSignal): Promise<KnowledgeContributionBundle>;
}
/** Future remote adapters require explicit authenticated transport; IndexedDB is not remotely readable. */
export interface ResearchBridgeReadPort { readAuthorizedBatch(batchId: string): Promise<ResearchTaskExport>; readAuthorizedOriginal(sourceId: string): Promise<Uint8Array> }
export interface ContributionSubmitPort { submitBundle(raw: string): Promise<ImportedContribution> }
export interface ResearchTaskExport {
  schemaVersion: 'knowledge-research-task.v1'; batch: ResearchBatch; sources: BrowserSource[];
  currentArticles: Array<{ wikiId: string; revisionId: string; title: string; summary: string; bodyMarkdown: string }>;
  instructions: string; contributionSchema: object;
}
