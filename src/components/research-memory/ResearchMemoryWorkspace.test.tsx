// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WikiLibrary as ResearchMemoryWorkspace } from './WikiLibrary';
import { BrowserWikiRepository, WIKI_STORAGE_KEY } from '../../services/wikiRepository';
import { wikiFixture, wikiFixtureOwners, wikiRevision, wikiReview } from '../../services/wiki.fixture';
import { creatorViewpointFixture } from '../../services/creatorViewpoint.fixture';
import { createWikiOwners } from '../../services/wikiOwners';
import type { CreatorViewpointRepository } from '../../services/creatorViewpointRepository';
import { IDBFactory } from 'fake-indexeddb';
import { BridgeStagingPanel } from './BridgeStagingPanel';
import { IndexedDbBrowserSourceRepository, parseSourceBytes, digestBytes } from '../../services/browserSourceRepository';

const sourceOwner = { load: () => ({ data: creatorViewpointFixture(), error: null, corruptedRaw: null }) } as CreatorViewpointRepository;
function setup(seed = true) {
  const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const owners = createWikiOwners(sourceOwner), repository = new BrowserWikiRepository(storage, owners);
  if (seed) repository.import(repository.load().data, repository.export(wikiFixture()), true);
  return { values, storage, repository, owners };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Research Memory Workspace', () => {
  it.each([
    [503, '研究桥私有暂存尚未配置，暂不能发送资料。'],
    [503, '研究桥服务端认证尚未配置完成，暂不能发送资料。'],
    [503, '研究桥尚未启用，暂不能发送资料。'],
    [401, '研究桥访问密钥不正确，请核对后重试。'],
    [502, null],
  ])('failed staging (%s, %s) stops before upload and preserves local originals', async (status, message) => {
    const { File: NodeFile, Buffer } = await vi.importActual<typeof import('node:buffer')>('node:buffer');
    const { webcrypto } = await vi.importActual<typeof import('node:crypto')>('node:crypto');
    vi.stubGlobal('File', NodeFile); vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor); localStorage.clear();
    const repo = new IndexedDbBrowserSourceRepository(new IDBFactory(), 'bridge-error');
    const batch = await repo.saveBatch([new File(['# Synthetic MLCC'], 'synthetic.md')], 'Synthetic'); await repo.parseBatch(batch.batchId);
    const snapshot = await repo.load(), { repository } = setup(false);
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => new Response(message ? JSON.stringify({ error: 'REQUEST_REJECTED', message }) : '<html>Unavailable</html>', { status, headers: { 'content-type': message ? 'application/json' : 'text/html' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<BridgeStagingPanel batch={batch} snapshot={snapshot} sourceRepository={repo} wiki={repository.load().data} model={null} />);
    fireEvent.change(screen.getByLabelText('研究桥访问密钥'), { target: { value: 'synthetic-ui-owner-secret-only-32-characters' } });
    fireEvent.click(screen.getByRole('button', { name: '选择全部已解析资料' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '我已核对清单，仅发送所选 1 份资料，保留 0 份不发送' }));
    fireEvent.click(screen.getByRole('button', { name: '发送给 ChatGPT' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message ?? '研究桥暂时不可用，请稍后重试。'));
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0]?.[0]).toBe('/api/bridge/begin');
    expect(screen.queryByText(/已可读取/)).not.toBeInTheDocument(); expect(localStorage.length).toBe(0);
    expect(await repo.readRaw(snapshot.sources[0].sourceId)).toEqual(new TextEncoder().encode('# Synthetic MLCC'));
  });
  it('explicitly sends a mixed batch subset after repository reload, with correct wire digest and batch-wide revoke', async () => {
    // Test-only Node primitives via Vitest, never imported into the browser module graph.
    const { File: NodeFile, Buffer } = await vi.importActual<typeof import('node:buffer')>('node:buffer');
    const { webcrypto } = await vi.importActual<typeof import('node:crypto')>('node:crypto');
    vi.stubGlobal('File', NodeFile); vi.stubGlobal('crypto', webcrypto);
    // fake-indexeddb uses Node structuredClone; keep binary instances in that same test realm.
    vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor); localStorage.clear();
    const factory = new IDBFactory(), repo = new IndexedDbBrowserSourceRepository(factory, 'mixed-ui', async (source, bytes) => { if (source.kind === 'pdf') throw new Error('invalid'); return parseSourceBytes(source, bytes); });
    const batch = await repo.saveBatch([...Array.from({ length: 9 }, (_, i) => new File([`中文😀 ${i}`], `${i}.txt`)), new File(['invalid PDF'], 'bad.pdf')], '混合'); await repo.parseBatch(batch.batchId);
    const reloaded = new IndexedDbBrowserSourceRepository(factory, 'mixed-ui'), snapshot = await reloaded.load(), { repository } = setup(false);
    const calls: Array<{ action: string; payload: Record<string, unknown> }> = [];
    const fetcher = vi.fn(async (input: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body)); calls.push({ action: input, payload });
      return new Response(JSON.stringify({ stageId: 'stage-synthetic', batchId: batch.batchId, createdAt: batch.capturedAt, expiresAt: batch.capturedAt, status: input.endsWith('/publish') ? 'readable' : 'uploading' }), { headers: { 'content-type': 'application/json' } });
    }); vi.stubGlobal('fetch', fetcher);
    const props = { batch, snapshot, sourceRepository: reloaded, wiki: repository.load().data, model: null };
    const first = render(<BridgeStagingPanel {...props} />); fireEvent.click(screen.getByRole('button', { name: '选择全部已解析资料' })); first.unmount();
    render(<BridgeStagingPanel {...props} />); expect(screen.getByRole('checkbox', { name: '0.txt（已解析）' })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('研究桥访问密钥'), { target: { value: 'synthetic-ui-owner-secret-only-32-characters' } });
    fireEvent.click(screen.getByRole('button', { name: '选择全部已解析资料' }));
    expect(screen.getByRole('checkbox', { name: 'bad.pdf（解析失败，原件保留）' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '8.txt（已解析）' }));
    expect(screen.getByText('未发送清单：8.txt、bad.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送给 ChatGPT' })).toBeDisabled(); expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: '我已核对清单，仅发送所选 8 份资料，保留 2 份不发送' }));
    fireEvent.click(screen.getByRole('button', { name: '发送给 ChatGPT' }));
    await screen.findByText(/所选 8 份资料已可供 ChatGPT/);
    const uploads = calls.filter(c => c.action.endsWith('/source')); expect(uploads).toHaveLength(8);
    for (const upload of uploads) {
      const source = upload.payload.source as { metadata: { sourceId: string; batchId: string; sha256: string; parsedTextSha256: string }; segments: Array<{ locator: string; label: string; text: string }> };
      expect(source.metadata.batchId).toBe(batch.batchId); expect(source.metadata.sha256).toBe(snapshot.sources.find(s => s.sourceId === source.metadata.sourceId)!.sha256);
      expect(Object.keys(source.segments[0])).toEqual(['locator', 'label', 'text']);
      expect(source.metadata.parsedTextSha256).toBe(await digestBytes(new TextEncoder().encode(JSON.stringify(source.segments))));
    }
    expect(JSON.stringify(calls)).not.toContain(snapshot.sources[8].sourceId); expect(JSON.stringify(calls)).not.toContain(snapshot.sources[9].sourceId);
    expect(await reloaded.readRaw(snapshot.sources[9].sourceId)).toEqual(new TextEncoder().encode('invalid PDF'));
    cleanup(); localStorage.clear(); render(<BridgeStagingPanel {...props} />);
    fireEvent.change(screen.getByLabelText('研究桥访问密钥'), { target: { value: 'synthetic-ui-owner-secret-only-32-characters' } });
    fireEvent.click(screen.getByRole('button', { name: '撤销 ChatGPT 访问' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ action: '/api/bridge/revoke-batch', payload: { batchId: batch.batchId } }));
    await screen.findByText(/已撤销本批此前全部暂存/);
  });
  it('opens empty Workspace with no seed or business writes', () => {
    const { repository, owners, values } = setup(false); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    expect(screen.getByRole('heading', { name: '还没有文章' })).toBeInTheDocument(); expect(values.size).toBe(0);
  });
  it('shows reviewed Wiki, preserved AI origin, exact source/extraction drilldown and historical read-only', () => {
    const { repository, owners, values } = setup(); const before = [...values]; render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    fireEvent.click(screen.getByRole('button', { name: /合成框架/ }));
    expect(screen.getByText(/当前已审核文章/)).toBeInTheDocument(); expect(screen.getByText(/ai_draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提取内容 · 已保存研究记录' }));
    const drawer = screen.getByRole('dialog', { name: '观点来源核对' }); expect(within(drawer).getByText('合成测试摘录，不是任何真实博主观点。')).toBeInTheDocument(); fireEvent.click(within(drawer).getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.change(screen.getByRole('textbox', { name: /历史查询时间/ }), { target: { value: '2026-01-04T10:00:00.000Z' } }); fireEvent.click(screen.getByRole('button', { name: '应用时间视图' }));
    expect(screen.queryByText(/当前已审核文章 ·/)).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: '手工新建文章' })).toBeDisabled(); expect([...values]).toEqual(before);
  });
  it('mounts history Markdown only while expanded and keeps current uncertainty outside audit details', async () => {
    const { repository, owners } = setup(); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    fireEvent.click(screen.getByRole('button', { name: /合成框架/ }));
    const body = 'Synthetic body. No investment claim.';
    expect(screen.getAllByText(body)).toHaveLength(1);
    const history = screen.getByText(/合成框架 · 已审核/).closest('details')!;
    history.open = true; fireEvent(history, new Event('toggle'));
    await waitFor(() => expect(screen.getAllByText(body)).toHaveLength(2));
    history.open = false; fireEvent(history, new Event('toggle'));
    await waitFor(() => expect(screen.getAllByText(body)).toHaveLength(1));
    const limitation = screen.queryByLabelText('文章重要限制');
    expect(limitation).not.toBeNull();
    expect(limitation!.closest('details')).toBeNull();
    expect(limitation).toBeVisible();
  });
  it('creates draft, requires explicit quality review, then retains both after reload', () => {
    const { repository, owners, values } = setup(false); const onSelectWiki = vi.fn(); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} onSelectWiki={onSelectWiki} />);
    fireEvent.click(screen.getByRole('button', { name: '手工新建文章' }));
    fireEvent.change(screen.getByLabelText('文章标题'), { target: { value: 'UI synthetic Wiki' } }); fireEvent.change(screen.getByLabelText('完整正文'), { target: { value: 'Synthetic Markdown' } });
    fireEvent.change(screen.getByLabelText('作者来源'), { target: { value: 'ai' } }); fireEvent.click(screen.getAllByRole('checkbox').find(input => input.getAttribute('value') === 'observation-1')!); fireEvent.click(screen.getByRole('button', { name: '保存文章草稿' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(repository.load().data.reviews).toHaveLength(0);
    expect(onSelectWiki).toHaveBeenCalledTimes(1); expect(onSelectWiki).toHaveBeenCalledWith(repository.load().data.revisions[0].wikiId);
    fireEvent.click(screen.getByText(/UI synthetic Wiki · 待审核/)); fireEvent.click(screen.getByRole('button', { name: '审核此修订' })); expect(screen.getByRole('button', { name: '确认追加审核记录' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('审核说明'), { target: { value: 'Synthetic quality check' } }); fireEvent.click(screen.getByRole('button', { name: '确认追加审核记录' }));
    expect(screen.getByText(/当前已审核文章/)).toBeInTheDocument(); expect(screen.getByText(/ai_draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: '刷新历史' })); expect(repository.load().data.reviews).toHaveLength(1); expect(values.has(WIKI_STORAGE_KEY)).toBe(true);
    expect(onSelectWiki).toHaveBeenCalledTimes(1);
  });
  it('clears route-selected Wiki state when selectedWikiId becomes undefined without changing stored articles', () => {
    const { repository, owners, values } = setup();
    const second = { ...wikiRevision('wiki-two', 'revision-two'), title: '另一篇合成文章' };
    repository.append(repository.load().data, { entries: [{ schemaVersion: 'wiki-entry.v1', wikiId: second.wikiId, type: 'FRAMEWORK', createdAt: second.createdAt }], revisions: [second], reviews: [wikiReview(second)] });
    const before = [...values]; const onSelectWiki = vi.fn();
    const view = (selectedWikiId?: string) => <ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} selectedWikiId={selectedWikiId} onSelectWiki={onSelectWiki} />;
    const { rerender } = render(view('wiki-two'));
    expect(within(screen.getByRole('article', { name: '文章详情' })).getByRole('heading', { name: '另一篇合成文章' })).toBeVisible();
    rerender(view(undefined));
    expect(screen.queryByRole('article', { name: '文章详情' })).toBeNull();
    expect(screen.getByRole('heading', { name: '文章库' })).toBeVisible();
    expect(screen.getByRole('button', { name: /合成框架/ })).toBeVisible();
    expect(onSelectWiki).not.toHaveBeenCalled(); expect([...values]).toEqual(before);
  });
  it('keeps list filters when opening and returning from an exact article, with maintenance off by default', () => {
    const { repository, owners, values } = setup(); const before = [...values]; const onSelectWiki = vi.fn(), onBackToLibrary = vi.fn();
    render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} onSelectWiki={onSelectWiki} onBackToLibrary={onBackToLibrary} />);
    expect(screen.queryByRole('article', { name: '文章详情' })).toBeNull();
    fireEvent.change(screen.getByLabelText('搜索知识库'), { target: { value: '不存在的词' } });
    expect(screen.getByRole('heading', { name: '没有匹配的文章' })).toBeVisible();
    expect(screen.queryByLabelText('文章列表')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    fireEvent.change(screen.getByLabelText('搜索知识库'), { target: { value: '合成' } });
    fireEvent.click(screen.getByRole('button', { name: /合成框架/ }));
    expect(onSelectWiki).toHaveBeenCalledWith('wiki-one');
    expect(screen.queryByLabelText('文章列表')).toBeNull();
    expect(screen.getByRole('article', { name: '文章详情' })).toHaveTextContent('Synthetic body. No investment claim.');
    fireEvent.click(screen.getByRole('button', { name: '返回文章列表' }));
    expect(onBackToLibrary).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('搜索知识库')).toHaveValue('合成');
    expect(screen.queryByRole('region', { name: '文章维护' })).toBeNull();
    expect([...values]).toEqual(before);
  });
  it('corruption/future schema lock writes and keep raw export; future recovery stays disabled', () => {
    const { repository, owners, storage } = setup(false); storage.setItem(WIKI_STORAGE_KEY, '{"schemaVersion":"wiki.v9"}'); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByRole('button', { name: '手工新建文章' })).toBeDisabled(); expect(screen.getByRole('button', { name: '导入文章备份' })).toBeDisabled(); expect(screen.getByRole('button', { name: '导出锁定原字节' })).toBeEnabled();
  });
  it('missing owner blocks current and export, while JSON history remains exportable', () => {
    const { repository } = setup(); const owners = { ...wikiFixtureOwners(), research: () => { throw new Error('OWNER_UNAVAILABLE'); } }; render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByRole('alert')).toHaveTextContent('OWNER_UNAVAILABLE'); expect(screen.getByRole('button', { name: '导出到 Obsidian' })).toBeDisabled(); expect(screen.getByRole('button', { name: '备份全部文章历史' })).toBeEnabled();
  });
});
