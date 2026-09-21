import { describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { IndexedDbBrowserSourceRepository, digestBytes, parseSourceBytes } from './browserSourceRepository';
import { createBrowserSourceAdapter } from './browserSourceAdapter';
import { contributionAdditions, sourceRef, validateContribution } from './knowledgeContribution';
import { articleFixture, contributionFixture } from './knowledgeIngestion.fixture';
import { BrowserWikiRepository } from './wikiRepository';
import { buildWikiReadModel, cloneWiki } from './wiki';
import type { WikiOwners } from '../types/wiki';
import schema from '../../contracts/knowledge-ingestion/v1/contribution.schema.json';
import common from '../../contracts/research-extraction/v1/research-extraction.schema.json';
import entity from '../../contracts/v1/entity-resolution.v1.schema.json';

async function setup() {
  const factory = new IDBFactory(), repository = new IndexedDbBrowserSourceRepository(factory, 'synthetic');
  const files = [new File(['合成原文\r\n第二行'], '研究.md', { type: 'text/markdown' }), new File(['独立合成文本'], '原文.txt', { type: 'text/plain' })];
  const batch = await repository.saveBatch(files, '合成批次'); await repository.parseBatch(batch.batchId);
  return { factory, repository, files, batch, state: await repository.load() };
}
describe('browser source and contribution authority', () => {
  it('retains a mixed 9 parsed / 1 failed batch after reload and imports a subset with original identities', async () => {
    const factory = new IDBFactory(), repo = new IndexedDbBrowserSourceRepository(factory, 'mixed', async (source, bytes) => { if (source.kind === 'pdf') throw new Error('invalid PDF'); return parseSourceBytes(source, bytes); });
    const files = [...Array.from({ length: 9 }, (_, i) => new File([`研究资料 ${i}`], `${i}.txt`)), new File(['broken PDF'], 'failed.pdf')];
    const batch = await repo.saveBatch(files, '混合批次'); await repo.parseBatch(batch.batchId);
    const reloaded = new IndexedDbBrowserSourceRepository(factory, 'mixed'), state = await reloaded.load();
    expect(state.sources.filter(s => s.parse.status === 'parsed')).toHaveLength(9);
    expect(state.sources[9].parse.status).toBe('failed');
    expect(await reloaded.readRaw(state.sources[9].sourceId)).toEqual(new TextEncoder().encode('broken PDF'));
    await expect(reloaded.saveBatch(files.slice(0, 9), '不要重复上传')).rejects.toThrow(/重复/);
    const bundle = contributionFixture(state); await reloaded.importBundle(JSON.stringify(bundle));
    expect(bundle.batchId).toBe(batch.batchId); expect(bundle.sourceRefs[0].sha256).toBe(state.sources[0].sha256);
    expect((await reloaded.load()).sources).toEqual(state.sources);
    const failedRef = structuredClone(bundle); failedRef.sourceRefs.push({ sourceRef: sourceRef(state.sources[9].sourceId), sha256: state.sources[9].sha256 });
    expect(() => validateContribution(failedRef, state, new Date().toISOString())).toThrow();
    const undeclared = structuredClone(bundle); undeclared.proposals[0].citations[0].sourceRef = sourceRef(state.sources[1].sourceId);
    expect(() => validateContribution(undeclared, state, new Date().toISOString())).toThrow();
  });
  it('atomically retains multiple exact UTF-8 byte originals across reload and verifies digests', async () => {
    const { factory, state, files } = await setup(), reloaded = new IndexedDbBrowserSourceRepository(factory, 'synthetic');
    expect((await reloaded.load()).batches).toHaveLength(1);
    for (let i = 0; i < files.length; i++) { const bytes = new Uint8Array(await files[i].arrayBuffer()); expect(await reloaded.readRaw(state.sources[i].sourceId)).toEqual(bytes); expect(state.sources[i].sha256).toBe(await digestBytes(bytes)); }
    expect(state.sources[0].parse.segments[1]).toEqual({ locator: 'line:2', label: '第 2 行', text: '第二行' });
  });
  it('rejects duplicates, unsupported files and intra-batch duplicates without saving partial batches', async () => {
    const { repository, state, files } = await setup();
    await expect(repository.saveBatch([new File(['new'], 'new.txt'), files[0]], 'bad')).rejects.toThrow(/重复/);
    await expect(repository.saveBatch([new File(['x'], 'x.exe')], 'bad')).rejects.toThrow();
    await expect(repository.saveBatch([new File(['same'], 'a.txt'), new File(['same'], 'b.txt')], 'bad')).rejects.toThrow();
    expect(await repository.load()).toEqual(state);
  });
  it('retains original when strict text parsing fails', async () => {
    const repo = new IndexedDbBrowserSourceRepository(new IDBFactory()); const b = await repo.saveBatch([new File([new Uint8Array([255, 254, 0])], 'bad.txt')], '编码错误');
    await repo.parseBatch(b.batchId); const state = await repo.load(); expect(state.sources[0].parse.status).toBe('failed'); expect(await repo.readRaw(state.sources[0].sourceId)).toEqual(new Uint8Array([255, 254, 0]));
  });
  it('preserves original PDF when parser throws and never fabricates text', async () => {
    const repo = new IndexedDbBrowserSourceRepository(new IDBFactory(), 'pdf', async () => { throw new Error('encrypted'); }); const b = await repo.saveBatch([new File(['%PDF invalid'], 'bad.pdf')], '坏PDF');
    await repo.parseBatch(b.batchId); const state = await repo.load(); expect(state.sources[0].parse).toMatchObject({ status: 'failed', segments: [] }); expect(new TextDecoder().decode(await repo.readRaw(state.sources[0].sourceId))).toBe('%PDF invalid');
  });
  it('locks on retained-byte corruption without overwriting corrupt bytes', async () => {
    const { factory, repository, state } = await setup(); const db = await new Promise<IDBDatabase>(resolve => { const r = factory.open('synthetic'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('originals', 'readwrite'); tx.objectStore('originals').put(new Uint8Array([1]), state.sources[0].sourceId); tx.oncomplete = () => resolve(); }); db.close();
    await expect(repository.load()).rejects.toThrow(/摘要/); await expect(repository.saveBatch([new File(['other'], 'x.txt')], 'x')).rejects.toThrow();
  });
  it('two simultaneous stale writers cannot overwrite each other', async () => {
    const factory = new IDBFactory(), a = new IndexedDbBrowserSourceRepository(factory, 'race'), b = new IndexedDbBrowserSourceRepository(factory, 'race');
    const results = await Promise.allSettled([a.saveBatch([new File(['a'], 'a.txt')], 'a'), b.saveBatch([new File(['b'], 'b.txt')], 'b')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect((await a.load()).sources).toHaveLength(1);
  });
  it('quota/write failure rolls back metadata and every original in the batch', async () => {
    const { repository, state } = await setup(); const original = IDBObjectStore.prototype.add;
    let calls = 0; const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'originals' && ++calls === 2) throw new DOMException('full', 'QuotaExceededError');
      return original.apply(this, args);
    });
    try { await expect(repository.saveBatch([new File(['fresh 1'], '1.txt'), new File(['fresh 2'], '2.txt')], 'quota')).rejects.toThrow(); } finally { spy.mockRestore(); }
    expect(await repository.load()).toEqual(state);
  });
  it('reject/NO_ACTION disposition is append-only transport triage and cannot change Wiki', async () => {
    const { repository, state } = await setup(); const bundle = contributionFixture(state); bundle.proposals[0] = { ...bundle.proposals[0], action: 'NO_ACTION', document: null };
    await repository.importBundle(JSON.stringify(bundle)); await repository.dispose(bundle.bundleId, 'proposal-1', 'no_action', '无需修改');
    expect((await repository.load()).dispositions[0].decision).toBe('no_action'); await expect(repository.dispose(bundle.bundleId, 'proposal-1', 'rejected', '改主意')).rejects.toThrow(/已处理/);
  });
  it('round trips common Extraction contract and bundle into pending only; blocks duplicate import', async () => {
    const { repository, state } = await setup(), bundle = contributionFixture(state); const ajv = new Ajv2020({ strict: true, strictRequired: false }); addFormats(ajv); ajv.addSchema(entity); ajv.addSchema(common);
    expect(ajv.compile(schema)(bundle)).toBe(true); const imported = await repository.importBundle(JSON.stringify(bundle)); expect(imported.bundle).toEqual(bundle);
    await expect(repository.importBundle(JSON.stringify(bundle))).rejects.toThrow(/已导入/);
    expect((await repository.load()).dispositions).toEqual([]);
  });
  it.each(['digest', 'quote', 'locator', 'review', 'atom', 'partial', 'domain', 'time', 'unknown-field'] as const)('rejects forged %s', async kind => {
    const { state } = await setup(), b = contributionFixture(state);
    if (kind === 'digest') b.sourceRefs[0].sha256 = '0'.repeat(64);
    if (kind === 'quote') b.proposals[0].citations[0].quote = '不存在的原文';
    if (kind === 'locator') b.proposals[0].citations[0].locator = 'page:900';
    if (kind === 'review') b.extractions[0].review.status = 'reviewed';
    if (kind === 'atom') b.knowledgeAtoms[0].findingIndex = 999;
    if (kind === 'partial') b.proposals[0].document!.bodyMarkdown = '只包含补丁';
    if (kind === 'domain') b.sourceRefs[0].sourceRef.sourceDomain = 'foreign';
    if (kind === 'time') b.extractions[0].effectiveAt = b.createdAt;
    if (kind === 'unknown-field') Object.assign(b, { fakeApproved: true });
    expect(() => validateContribution(b, state, new Date().toISOString())).toThrow();
  });
  it('creates once, updates same Wiki, preserves complete approved history and rejects stale UPDATE', async () => {
    const { repository, state } = await setup(); let snapshot = state;
    const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    const owners: WikiOwners = { research: asOf => createBrowserSourceAdapter(snapshot, asOf), evidence: () => { throw new Error('no'); }, related: () => {} };
    const wiki = new BrowserWikiRepository(storage, owners), first = contributionFixture(state);
    await repository.importBundle(JSON.stringify(first)); snapshot = await repository.load();
    expect(buildWikiReadModel(wiki.load().data, owners, new Date().toISOString()).pages).toEqual([]);
    let base = wiki.load().data; base = wiki.append(base, contributionAdditions(snapshot, base, owners, first.bundleId, 'proposal-1', '已核对', new Date().toISOString()));
    expect(base.entries).toHaveLength(1); const previous = base.revisions[0];
    const update = contributionFixture(state, 'bundle-update'); update.proposals[0] = { ...update.proposals[0], action: 'UPDATE', wikiId: previous.wikiId, baseRevisionId: previous.revisionId, document: articleFixture('更新') };
    await repository.importBundle(JSON.stringify(update)); snapshot = await repository.load();
    base = wiki.load().data; const updated = wiki.append(base, contributionAdditions(snapshot, base, owners, update.bundleId, 'proposal-1', '复核变化', new Date().toISOString()));
    expect(updated.entries).toHaveLength(1); expect(updated.revisions).toHaveLength(2); expect(updated.revisions[0].bodyMarkdown).toBe(first.proposals[0].document!.bodyMarkdown);
    expect(buildWikiReadModel(updated, owners, new Date().toISOString()).pages[0].revision.bodyMarkdown).toBe(update.proposals[0].document!.bodyMarkdown);
    expect(() => contributionAdditions(snapshot, updated, owners, update.bundleId, 'proposal-1', 'again', new Date().toISOString())).toThrow(/已处理/);
    const stale = contributionFixture(state, 'bundle-stale'); stale.proposals[0] = { ...stale.proposals[0], action: 'UPDATE', wikiId: previous.wikiId, baseRevisionId: previous.revisionId };
    await repository.importBundle(JSON.stringify(stale)); snapshot = await repository.load(); expect(() => contributionAdditions(snapshot, updated, owners, stale.bundleId, 'proposal-1', 'stale', new Date().toISOString())).toThrow(/已变化/);
  });
  it('adapter respects import availability, original unknown times and exact owner equality', async () => {
    const { repository, state } = await setup(); await repository.importBundle(JSON.stringify(contributionFixture(state))); const next = await repository.load(), adapter = createBrowserSourceAdapter(next, new Date().toISOString());
    const s = adapter.resolveSource(sourceRef(state.sources[0].sourceId)); expect(s.publishedAt).toBeNull(); expect(s.digest?.value).toBe(state.sources[0].sha256);
    const bad = cloneWiki(s); bad.digest!.value = 'f'.repeat(64); expect(() => adapter.validateSource(bad)).toThrow();
    expect(createBrowserSourceAdapter(next, '2020-01-01T00:00:00Z').listExtractions()).toEqual([]);
  });
  it('does not reinterpret text bytes when parsing Markdown', async () => {
    const { state } = await setup(); const segments = await parseSourceBytes(state.sources[0], new TextEncoder().encode('# 标题\n正文')); expect(segments.map(s => s.text)).toEqual(['# 标题', '正文']);
  });
});
