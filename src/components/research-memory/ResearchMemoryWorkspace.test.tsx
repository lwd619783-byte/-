// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchMemoryWorkspace } from './ResearchMemoryWorkspace';
import { BrowserWikiRepository, WIKI_STORAGE_KEY } from '../../services/wikiRepository';
import { wikiFixture, wikiFixtureOwners } from '../../services/wiki.fixture';
import { creatorViewpointFixture } from '../../services/creatorViewpoint.fixture';
import { createWikiOwners } from '../../services/wikiOwners';
import type { CreatorViewpointRepository } from '../../services/creatorViewpointRepository';

const sourceOwner = { load: () => ({ data: creatorViewpointFixture(), error: null, corruptedRaw: null }) } as CreatorViewpointRepository;
function setup(seed = true) {
  const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const owners = createWikiOwners(sourceOwner), repository = new BrowserWikiRepository(storage, owners);
  if (seed) repository.import(repository.load().data, repository.export(wikiFixture()), true);
  return { values, storage, repository, owners };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Research Memory Workspace', () => {
  it('opens empty Workspace with no seed or business writes', () => {
    const { repository, owners, values } = setup(false); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    expect(screen.getByRole('heading', { name: '从可反查的材料建立研究记忆' })).toBeInTheDocument(); expect(values.size).toBe(0);
  });
  it('shows reviewed Wiki, preserved AI origin, exact source/extraction drilldown and historical read-only', () => {
    const { repository, owners, values } = setup(); const before = [...values]; render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    expect(screen.getByText(/Current Reviewed Revision/)).toBeInTheDocument(); expect(screen.getByText(/ai_draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Extraction · observation-1' }));
    const drawer = screen.getByRole('dialog', { name: '观点来源核对' }); expect(within(drawer).getByText('合成测试摘录，不是任何真实博主观点。')).toBeInTheDocument(); fireEvent.click(within(drawer).getByRole('button', { name: '关闭' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Knowledge asOf/ }), { target: { value: '2026-01-04T10:00:00.000Z' } }); fireEvent.click(screen.getByRole('button', { name: '应用时间视图' }));
    expect(screen.queryByText(/Current Reviewed Revision ·/)).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: '新建 Wiki' })).toBeDisabled(); expect([...values]).toEqual(before);
  });
  it('creates draft, requires explicit quality review, then retains both after reload', () => {
    const { repository, owners, values } = setup(false); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    fireEvent.click(screen.getByRole('button', { name: '新建 Wiki' }));
    fireEvent.change(screen.getByLabelText('Wiki 标题'), { target: { value: 'UI synthetic Wiki' } }); fireEvent.change(screen.getByLabelText('正文 Markdown'), { target: { value: 'Synthetic Markdown' } });
    fireEvent.change(screen.getByLabelText('作者来源'), { target: { value: 'ai' } }); fireEvent.click(screen.getByRole('checkbox', { name: 'observation-1 · reviewed' })); fireEvent.click(screen.getByRole('button', { name: '保存 Wiki Draft' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(repository.load().data.reviews).toHaveLength(0);
    fireEvent.click(screen.getByText(/UI synthetic Wiki · draft/)); fireEvent.click(screen.getByRole('button', { name: '审核此修订' })); expect(screen.getByRole('button', { name: '确认追加审核记录' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('审核说明'), { target: { value: 'Synthetic quality check' } }); fireEvent.click(screen.getByRole('button', { name: '确认追加审核记录' }));
    expect(screen.getByText(/Current Reviewed Revision/)).toBeInTheDocument(); expect(screen.getByText(/ai_draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新历史' })); expect(repository.load().data.reviews).toHaveLength(1); expect(values.has(WIKI_STORAGE_KEY)).toBe(true);
  });
  it('corruption/future schema lock writes and keep raw export; future recovery stays disabled', () => {
    const { repository, owners, storage } = setup(false); storage.setItem(WIKI_STORAGE_KEY, '{"schemaVersion":"wiki.v9"}'); render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    expect(screen.getByRole('button', { name: '新建 Wiki' })).toBeDisabled(); expect(screen.getByRole('button', { name: '导入 Wiki JSON' })).toBeDisabled(); expect(screen.getByRole('button', { name: '导出锁定原字节' })).toBeEnabled();
  });
  it('missing owner blocks current and export, while JSON history remains exportable', () => {
    const { repository } = setup(); const owners = { ...wikiFixtureOwners(), research: () => { throw new Error('OWNER_UNAVAILABLE'); } }; render(<ResearchMemoryWorkspace repository={repository} owners={owners} creatorRepository={sourceOwner} />);
    expect(screen.getByRole('alert')).toHaveTextContent('OWNER_UNAVAILABLE'); expect(screen.getByRole('button', { name: '导出 Markdown Vault' })).toBeDisabled(); expect(screen.getByRole('button', { name: '完整 Wiki JSON 备份' })).toBeEnabled();
  });
});
