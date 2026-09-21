import type { BrowserSource, BrowserSourceRepository, ContributionDisposition, IngestionSnapshot, ResearchBatch, SourceSegment } from '../types/knowledgeIngestion';
import { cloneWiki, wikiRequire } from './wiki';
import { isPreciseInstant } from '../utils/dateTime';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { proposalKey, validateContribution } from './knowledgeContribution';

export const SOURCE_DATABASE = 'investment-research-dashboard.knowledge-ingestion.v1';
export const emptyIngestion = (): IngestionSnapshot => ({ schemaVersion: 'knowledge-ingestion.v1', generation: 0, batches: [], sources: [], contributions: [], dispositions: [] });
export const digestBytes = async (bytes: Uint8Array): Promise<string> => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
const request = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const complete = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('本地存储事务失败，未保存本次修改')); tx.onerror = () => { /* onabort owns rejection */ }; });
const exact = (value: object, keys: string) => wikiRequire(value && Object.keys(value).sort().join(',') === keys.split(',').sort().join(','), '本地资料结构损坏');
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const unique = (values: string[]) => wikiRequire(new Set(values).size === values.length && values.every(text), '本地资料身份重复或无效');

export function validateIngestion(state: IngestionSnapshot): void {
  exact(state, 'schemaVersion,generation,batches,sources,contributions,dispositions');
  wikiRequire(state.schemaVersion === 'knowledge-ingestion.v1' && Number.isSafeInteger(state.generation) && state.generation >= 0
    && [state.batches, state.sources, state.contributions, state.dispositions].every(Array.isArray), '本地资料版本不支持或结构损坏');
  unique(state.batches.map(b => b.batchId)); unique(state.sources.map(s => s.sourceId)); unique(state.sources.map(s => s.sha256));
  unique(state.contributions.map(c => c.bundle.bundleId)); unique(state.dispositions.map(d => d.key));
  unique(state.contributions.flatMap(c => c.bundle.extractions.map(e => e.ref.extractionId)));
  for (const b of state.batches) {
    exact(b, 'schemaVersion,batchId,title,capturedAt,sourceIds');
    wikiRequire(b.schemaVersion === 'research-batch.v1' && text(b.title) && isPreciseInstant(b.capturedAt) && Array.isArray(b.sourceIds) && b.sourceIds.length > 0, '批次结构损坏');
    unique(b.sourceIds);
    wikiRequire(b.sourceIds.every(id => state.sources.some(s => s.sourceId === id && s.batchId === b.batchId && s.capturedAt === b.capturedAt)), '批次资料缺失');
  }
  for (const s of state.sources) {
    exact(s, 'sourceId,batchId,filename,mime,size,sha256,capturedAt,rawRef,kind,parse'); exact(s.parse, 'status,segments,error,parsedAt');
    wikiRequire(text(s.filename) && text(s.mime) && Number.isSafeInteger(s.size) && s.size > 0 && /^[a-f0-9]{64}$/.test(s.sha256)
      && s.rawRef === s.sourceId && isPreciseInstant(s.capturedAt) && ['pdf', 'markdown', 'text'].includes(s.kind)
      && state.batches.some(b => b.batchId === s.batchId && b.sourceIds.includes(s.sourceId)), '资料元数据损坏');
    wikiRequire(['pending', 'parsed', 'failed'].includes(s.parse.status) && Array.isArray(s.parse.segments), '解析状态损坏');
    unique(s.parse.segments.map(segment => segment.locator));
    for (const segment of s.parse.segments) { exact(segment, 'locator,label,text'); wikiRequire(text(segment.label) && typeof segment.text === 'string' && (s.kind === 'pdf' ? /^page:[1-9]\d*$/ : /^line:[1-9]\d*$/).test(segment.locator), '原文定位损坏'); }
    if (s.parse.status === 'pending') wikiRequire(s.parse.parsedAt === null && s.parse.error === null && !s.parse.segments.length, '等待解析状态损坏');
    else {
      wikiRequire(isPreciseInstant(s.parse.parsedAt ?? '') && Date.parse(s.parse.parsedAt!) >= Date.parse(s.capturedAt), '解析时间损坏');
      wikiRequire(s.parse.status === 'parsed' ? s.parse.error === null && s.parse.segments.some(row => text(row.text)) : text(s.parse.error) && !s.parse.segments.length, '解析结果损坏');
    }
  }
  for (const c of state.contributions) { exact(c, 'bundle,importedAt'); wikiRequire(isPreciseInstant(c.importedAt), '导入时间损坏'); validateContribution(c.bundle, state, c.importedAt); }
  for (const d of state.dispositions) {
    exact(d, 'key,bundleId,proposalId,decision,note,recordedAt');
    const c = state.contributions.find(c => c.bundle.bundleId === d.bundleId), p = c?.bundle.proposals.find(p => p.proposalId === d.proposalId);
    wikiRequire(p && d.key === proposalKey(d.bundleId, d.proposalId) && ['rejected', 'no_action'].includes(d.decision) && text(d.note)
      && isPreciseInstant(d.recordedAt) && Date.parse(d.recordedAt) >= Date.parse(c!.importedAt)
      && (d.decision !== 'no_action' || p.action === 'NO_ACTION'), '建议处置记录损坏');
  }
}

export async function parseSourceBytes(source: BrowserSource, bytes: Uint8Array): Promise<SourceSegment[]> {
  if (source.kind === 'pdf') {
    const { extractPdfPages } = await import('./knowledgePdf');
    return extractPdfPages(bytes);
  }
  const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  wikiRequire(value.trim() && !value.includes('\0'), '文本为空或不是有效 UTF-8 文本');
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((text, i) => ({ locator: `line:${i + 1}`, label: `第 ${i + 1} 行`, text }));
}

/** Binary and metadata commit in one transaction; no localStorage base64 mirror. */
export class IndexedDbBrowserSourceRepository implements BrowserSourceRepository {
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB, private readonly database = SOURCE_DATABASE,
    private readonly parser = parseSourceBytes, private readonly now = () => new Date().toISOString()) {}
  private async open(): Promise<IDBDatabase> {
    wikiRequire(this.factory, '浏览器本地文件存储不可用');
    const req = this.factory!.open(this.database, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('originals'); };
    const db = await request(req); db.onversionchange = () => db.close(); return db;
  }
  async load(): Promise<IngestionSnapshot> {
    const db = await this.open();
    try {
      const tx = db.transaction(['state', 'originals'], 'readonly'), done = complete(tx);
      const [stored, keys, raw] = await Promise.all([request(tx.objectStore('state').get('current')), request(tx.objectStore('originals').getAllKeys()), request(tx.objectStore('originals').getAll())]);
      await done;
      const state: IngestionSnapshot = stored ?? emptyIngestion(); validateIngestion(state);
      wikiRequire(keys.length === state.sources.length, '原件与资料目录不一致');
      const bytes = new Map(keys.map((key, index) => [key, raw[index] as Uint8Array]));
      for (const s of state.sources) { const value = bytes.get(s.rawRef); wikiRequire(value instanceof Uint8Array && value.byteLength === s.size && await digestBytes(value) === s.sha256, '原件缺失或摘要核验失败'); }
      return cloneWiki(state);
    } finally { db.close(); }
  }
  private async commit(base: IngestionSnapshot, next: IngestionSnapshot, originals: Array<{ key: string; bytes: Uint8Array }> = []): Promise<void> {
    next.generation = base.generation + 1; validateIngestion(next);
    const db = await this.open();
    try {
      const tx = db.transaction(['state', 'originals'], 'readwrite'), done = complete(tx);
      const get = tx.objectStore('state').get('current'); let conflict = false;
      get.onsuccess = () => {
        try {
          if (canonicalJson(get.result ?? emptyIngestion()) !== canonicalJson(base)) { conflict = true; tx.abort(); return; }
          originals.forEach(row => tx.objectStore('originals').add(row.bytes, row.key));
          tx.objectStore('state').put(next, 'current');
        } catch { tx.abort(); }
      };
      try { await done; } catch (error) { if (conflict) throw new Error('资料已在其他页面变化，请刷新后重试'); throw error; }
    } finally { db.close(); }
  }
  async saveBatch(files: readonly File[], title: string): Promise<ResearchBatch> {
    wikiRequire(files.length > 0 && files.length <= 30 && files.reduce((n, f) => n + f.size, 0) <= 100 * 1024 * 1024, '一次请选择 1–30 份文件，总大小不超过 100 MiB');
    const base = await this.load(), next = cloneWiki(base), batchId = `batch-${crypto.randomUUID()}`, capturedAt = this.now();
    const originals: Array<{ key: string; bytes: Uint8Array }> = [];
    for (const file of files) {
      const extension = file.name.toLowerCase().split('.').pop();
      wikiRequire(['pdf', 'md', 'markdown', 'txt'].includes(extension ?? '') && file.size > 0 && file.size <= 25 * 1024 * 1024, '仅支持非空 PDF / Markdown / TXT，单份最多 25 MiB');
      const bytes = new Uint8Array(await file.arrayBuffer()), sha256 = await digestBytes(bytes);
      wikiRequire(!next.sources.some(s => s.sha256 === sha256), `重复资料：${file.name}。本批未保存，请移除重复文件后重试`);
      const sourceId = `source-${crypto.randomUUID()}`, kind = extension === 'pdf' ? 'pdf' : extension === 'txt' ? 'text' : 'markdown';
      next.sources.push({ sourceId, batchId, filename: file.name, mime: file.type || (kind === 'pdf' ? 'application/pdf' : kind === 'markdown' ? 'text/markdown' : 'text/plain'), size: bytes.byteLength,
        sha256, capturedAt, rawRef: sourceId, kind, parse: { status: 'pending', segments: [], error: null, parsedAt: null } });
      originals.push({ key: sourceId, bytes });
    }
    const batch: ResearchBatch = { schemaVersion: 'research-batch.v1', batchId, title: title.trim() || `资料批次 · ${files[0].name}`, capturedAt, sourceIds: originals.map(row => row.key) };
    next.batches.push(batch); await this.commit(base, next, originals); return cloneWiki(batch);
  }
  async readRaw(sourceId: string): Promise<Uint8Array> {
    const state = await this.load(), source = state.sources.find(s => s.sourceId === sourceId); wikiRequire(source, '原件不存在');
    const db = await this.open();
    try { const tx = db.transaction('originals', 'readonly'), done = complete(tx); const bytes = await request(tx.objectStore('originals').get(source!.rawRef)) as Uint8Array; await done;
      wikiRequire(bytes instanceof Uint8Array && bytes.byteLength === source!.size && await digestBytes(bytes) === source!.sha256, '原件摘要核验失败'); return bytes; }
    finally { db.close(); }
  }
  async parseBatch(batchId: string): Promise<void> {
    const state = await this.load(), batch = state.batches.find(b => b.batchId === batchId); wikiRequire(batch, '批次不存在');
    for (const source of state.sources.filter(s => s.batchId === batchId && s.parse.status === 'pending')) {
      let parse: BrowserSource['parse'];
      try { const segments = await this.parser(source, await this.readRaw(source.sourceId)); wikiRequire(segments.some(s => s.text.trim()), '未提取到文本；扫描件需 OCR，本版本不支持'); parse = { status: 'parsed', segments, error: null, parsedAt: this.now() }; }
      catch (error) { parse = { status: 'failed', segments: [], error: String(error), parsedAt: this.now() }; }
      const base = await this.load(), next = cloneWiki(base), target = next.sources.find(s => s.sourceId === source.sourceId)!;
      wikiRequire(target.parse.status === 'pending', '解析结果已变化，请刷新'); target.parse = parse; await this.commit(base, next);
    }
  }
  async importBundle(raw: string) {
    wikiRequire(new TextEncoder().encode(raw).byteLength <= 10 * 1024 * 1024, '贡献包超过 10 MiB');
    const value: unknown = JSON.parse(raw), base = await this.load(), importedAt = this.now(); validateContribution(value, base, importedAt);
    wikiRequire(!base.contributions.some(c => c.bundle.bundleId === value.bundleId), '贡献包已导入或身份冲突');
    const next = cloneWiki(base), row = { bundle: cloneWiki(value), importedAt }; next.contributions.push(row); await this.commit(base, next); return row;
  }
  async dispose(bundleId: string, proposalId: string, decision: ContributionDisposition['decision'], note: string) {
    const base = await this.load(), next = cloneWiki(base), key = proposalKey(bundleId, proposalId);
    wikiRequire(!base.dispositions.some(d => d.key === key), '此建议已处理');
    next.dispositions.push({ key, bundleId, proposalId, decision, note: note.trim(), recordedAt: this.now() }); await this.commit(base, next);
  }
}
