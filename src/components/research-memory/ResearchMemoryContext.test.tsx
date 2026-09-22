// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchMemoryWorkspace } from './ResearchMemoryWorkspace';
import { BrowserWikiRepository, WIKI_STORAGE_KEY } from '../../services/wikiRepository';
import { emptyIngestion } from '../../services/browserSourceRepository';
import { wikiFixtureOwners } from '../../services/wiki.fixture';
import { creatorViewpointFixture } from '../../services/creatorViewpoint.fixture';
import type { CreatorViewpointRepository } from '../../services/creatorViewpointRepository';
import type { BrowserSourceRepository, IngestionSnapshot } from '../../types/knowledgeIngestion';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function fixture(load: () => Promise<IngestionSnapshot> = async () => emptyIngestion(), wikiRaw: string | null = null) {
  const owners = wikiFixtureOwners();
  const storage = { getItem: (key: string) => key === WIKI_STORAGE_KEY ? wikiRaw : null, setItem: vi.fn(), removeItem: vi.fn() };
  const repository = new BrowserWikiRepository(storage, owners);
  const creatorRepository = { load: () => ({ data: creatorViewpointFixture(), error: null, corruptedRaw: null }) } as CreatorViewpointRepository;
  const sourceRepository: BrowserSourceRepository = { load: vi.fn(load), saveBatch: vi.fn(), parseBatch: vi.fn(), readRaw: vi.fn(), importBundle: vi.fn(), dispose: vi.fn() };
  return { owners, repository, creatorRepository, sourceRepository, storage };
}
describe('route-specific knowledge and material presentation', () => {
  it('shows only the article library on knowledge routes with no fixed empty list or maintenance panels', async () => {
    const props = fixture(); render(<ResearchMemoryWorkspace {...props} requestedView="我的知识库" />);
    await screen.findByRole('heading', { name: '还没有文章' });
    expect(screen.queryByRole('navigation', { name: '资料分类' })).toBeNull();
    expect(screen.queryByLabelText('文章列表')).toBeNull();
    expect(screen.queryByRole('article', { name: '文章详情' })).toBeNull();
    expect(screen.queryByRole('region', { name: '文章维护' })).toBeNull();
    expect(props.storage.setItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByRole('button', { name: '备份全部文章历史' })).toBeVisible();
    expect(screen.getByText(/文章备份不包含原件/)).toBeVisible();
    expect(screen.getByRole('button', { name: '导出到 Obsidian' })).toBeVisible();
  });

  it('distinguishes source loading from ready-empty and only reports a zero queue once owners are ready', async () => {
    let resolve!: (state: IngestionSnapshot) => void;
    const pending = new Promise<IngestionSnapshot>(done => { resolve = done; });
    const onReviewStateChange = vi.fn();
    render(<ResearchMemoryWorkspace {...fixture(() => pending)} onReviewStateChange={onReviewStateChange} requestedView="原始资料" />);
    expect(screen.getByText('正在核验本地原件…')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '还没有资料' })).toBeNull();
    expect(onReviewStateChange).toHaveBeenLastCalledWith({ status: 'loading' });
    await act(async () => resolve(emptyIngestion()));
    await screen.findByRole('heading', { name: '还没有资料' });
    expect(onReviewStateChange).toHaveBeenLastCalledWith({ status: 'ready', count: 0 });
    expect(within(screen.getByRole('navigation', { name: '资料分类' })).getAllByRole('button').map(button => button.textContent)).toEqual(['原始资料', 'AI 整理', '研究桥']);
    expect(screen.queryByLabelText('本批资料名称（可选）')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '添加资料' }));
    expect(screen.getByRole('dialog', { name: '添加资料' })).toBeVisible();
    expect(screen.getByLabelText('选择多份文件')).toBeInTheDocument();
    expect(screen.getByText(/单份最多 25 MiB/)).toBeVisible();
  });

  it.each(['source-error', 'wiki-locked'] as const)('keeps %s explicit instead of reporting an empty review queue', async state => {
    const props = state === 'source-error' ? fixture(async () => { throw new Error('ORIGINAL_UNREADABLE'); }) : fixture(undefined, '{"schemaVersion":"wiki.v99"}');
    const callback = vi.fn(); render(<ResearchMemoryWorkspace {...props} requestedView="待审核" onReviewStateChange={callback} />);
    await waitFor(() => expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ status: state === 'source-error' ? 'error' : 'locked' })));
    expect(callback.mock.calls.at(-1)![0]).not.toHaveProperty('count');
    expect(screen.queryByText(/暂无待审核建议/)).toBeNull();
    expect(screen.getAllByRole('alert').some(node => node.textContent?.includes(state === 'source-error' ? 'ORIGINAL_UNREADABLE' : 'WIKI_FUTURE_SCHEMA_LOCKED'))).toBe(true);
  });

  it('keeps existing files primary and opens adding as a separate modal without changing source owners', async () => {
    const state = emptyIngestion(), at = '2026-01-01T00:00:00.000Z';
    state.batches.push({ schemaVersion: 'research-batch.v1', batchId: 'batch-1', title: '合成原件', capturedAt: at, sourceIds: ['source-1'] });
    state.sources.push({ sourceId: 'source-1', batchId: 'batch-1', filename: '解析失败.pdf', mime: 'application/pdf', size: 12, sha256: 'a'.repeat(64), capturedAt: at, rawRef: 'source-1', kind: 'pdf', parse: { status: 'failed', segments: [], error: '合成解析错误', parsedAt: at } });
    const props = fixture(async () => state); render(<ResearchMemoryWorkspace {...props} requestedView="原始资料" />);
    await screen.findByRole('button', { name: '解析失败.pdf' });
    expect(screen.getByText(/解析失败，原件已保存/)).toBeVisible();
    expect(screen.queryByLabelText('本批资料名称（可选）')).toBeNull();
    expect(screen.getByRole('button', { name: '下载原件' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '添加资料' }));
    expect(screen.getByRole('dialog', { name: '添加资料' })).toBeVisible();
    expect(props.sourceRepository.saveBatch).not.toHaveBeenCalled();
    expect(props.sourceRepository.dispose).not.toHaveBeenCalled();
  });

  it('opens an explicitly requested add-material deep link without persisting or uploading anything', async () => {
    const props = fixture(); render(<ResearchMemoryWorkspace {...props} requestedView="原始资料" requestedAddMaterial routeKey="sources:add" />);
    const dialog = await screen.findByRole('dialog', { name: '添加资料' });
    await waitFor(() => expect(within(dialog).getByLabelText('选择多份文件')).not.toBeDisabled());
    expect(props.sourceRepository.saveBatch).not.toHaveBeenCalled();
    expect(props.sourceRepository.importBundle).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
