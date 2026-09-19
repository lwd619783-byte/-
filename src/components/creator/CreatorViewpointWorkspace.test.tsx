// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatorViewpointWorkspace } from './CreatorViewpointWorkspace';
import { creatorViewpointFixture, fixtureTime } from '../../services/creatorViewpoint.fixture';
import { BrowserCreatorViewpointRepository, CREATOR_VIEWPOINT_STORAGE_KEY } from '../../services/creatorViewpointRepository';
import { CreatorEntryForm } from './CreatorEntryForm';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup(corrupt = false) {
  const data = creatorViewpointFixture();
  const values = new Map<string, string>([[CREATOR_VIEWPOINT_STORAGE_KEY, corrupt ? '{bad' : JSON.stringify(data)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn() };
  const repository = new BrowserCreatorViewpointRepository(storage);
  return { data, values, storage, repository };
}
describe('Creator Viewpoint Workspace', () => {
  it('compares three independent creators with reasons, conditions and due reviews', () => {
    const { repository } = setup(); render(<CreatorViewpointWorkspace repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: '博主比较' }));
    for (let index = 1; index <= 3; index++) expect(screen.getByRole('heading', { name: `合成研究者 ${index}` })).toBeTruthy();
    expect(screen.getAllByText('合成理由')).toHaveLength(3);
    expect(screen.getAllByText(/待复盘 T\+5 \/ T\+20 \/ T\+60/)).toHaveLength(3);
    expect(screen.getByText(/不生成赢家排名/)).toBeTruthy();
  });
  it('renders the timeline, three distinct event relations and shared evidence drawer', () => {
    const { repository } = setup(); render(<CreatorViewpointWorkspace repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    expect(screen.getAllByText(/首次建立状态/)).toHaveLength(3);
    for (const relation of ['本人明确说明因果', '系统 / 研究者推断', '仅时间背景相关']) expect(screen.getByText(new RegExp(relation.split('/').join('\\/')))).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '打开证据' })[0]);
    const dialog = screen.getByRole('dialog', { name: '观点来源核对' });
    expect(within(dialog).getByText('原始来源 · 主帖')).toBeTruthy();
    expect(dialog.textContent).toContain('External Commentary');
    expect(within(dialog).getByRole('link', { name: '打开原始来源' }).getAttribute('href')).toContain('example.com/post/');
  });
  it('hides future approved observations at as-of and keeps Draft from Current View', () => {
    const { data, storage } = setup();
    data.observations.push({ ...data.observations[0], id: 'draft-future', summary: '未来积极草稿', stance: 'positive', recordedAt: fixtureTime(4) });
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    expect(screen.queryByText('未来积极草稿')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    expect(screen.getByRole('button', { name: '未来积极草稿' })).toBeTruthy();
    expect(screen.getByText('Draft · 不改变正式 Current View')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/As-of 本地时间/), { target: { value: '2026-01-01T00:00' } });
    expect(screen.queryByRole('button', { name: '未来积极草稿' })).toBeNull();
    expect(screen.queryByRole('button', { name: '合成观点 1' })).toBeNull();
    expect((screen.getByRole('button', { name: '记录观点' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('locks corruption writes without changing stored bytes', () => {
    const { repository, storage, values } = setup(true); render(<CreatorViewpointWorkspace repository={repository} />);
    expect((screen.getByRole('button', { name: '新增博主' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '恢复 JSON' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('原始数据未被覆盖');
    expect(storage.setItem).not.toHaveBeenCalled(); expect(values.get(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe('{bad');
  });
  it('adds a creator without overwriting the three prior creators', () => {
    const { repository, values } = setup(); render(<CreatorViewpointWorkspace repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: '新增博主' }));
    fireEvent.change(screen.getByLabelText('博主名称'), { target: { value: '合成研究者 4' } });
    fireEvent.click(screen.getByRole('button', { name: '追加保存' }));
    expect(JSON.parse(values.get(CREATOR_VIEWPOINT_STORAGE_KEY)!).creators).toHaveLength(4);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('separates source kinds, identity evidence and comment coverage', () => {
    const { data } = setup(); const onAppend = vi.fn();
    render(<CreatorEntryForm data={data} request={{ kind: 'source' }} onAppend={onAppend} onClose={vi.fn()} />);
    for (const label of ['主帖', '专栏 / 文章', '评论', '本人回复', '转发 / 补充']) expect(screen.getByRole('option', { name: label })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('来源类型'), { target: { value: 'self_reply' } });
    fireEvent.change(screen.getByLabelText(/父级来源/), { target: { value: 'source-1' } });
    fireEvent.click(screen.getByRole('button', { name: '追加保存' }));
    expect(onAppend.mock.calls[0][0].sources[0]).toMatchObject({ kind: 'self_reply', authorIdentity: 'unverified', completeness: 'UNVERIFIED', commentCoverage: 'UNVERIFIED', publishedAt: null });
  });
  it('keeps every write and export disabled for isolated visual review', () => {
    const { repository, storage } = setup(); render(<CreatorViewpointWorkspace repository={repository} readOnly />);
    for (const name of ['新增博主', '新增来源', '恢复 JSON', 'JSON 完整备份', 'Excel 分析副本']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('never opens unsafe external URLs in creator evidence', () => {
    const { data } = setup(); data.sources[0].url = 'javascript:alert(1)';
    render(<EvidenceDrawer creatorEvidence={{ data, source: data.sources[0] }} onClose={vi.fn()} />);
    expect(screen.queryByRole('link', { name: '打开原始来源' })).toBeNull();
  });
  it('shows changed conditions even when stance is unchanged and retains earlier pending reviews', () => {
    const { data, storage } = setup();
    data.observations.push({ ...data.observations[0], id: 'condition-change', recordedAt: fixtureTime(4), trigger: '新的成立条件', summary: '合成条件变化' });
    data.approvals.push({ id: 'condition-approval', observationId: 'condition-change', decision: 'reviewed', recordedAt: fixtureTime(5), note: '合成审核' });
    data.reviews.push({ id: 'review-inconclusive', observationId: 'observation-1', offsetDays: 5, recordedAt: fixtureTime(9), status: 'inconclusive', triggerOccurred: 'unknown', invalidationOccurred: 'unknown', actualOutcome: null, evidence: null, evidenceUrl: null, supersedesId: null });
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    expect(screen.getByText(/待复盘 T\+5（待继续核验）/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    expect(screen.getByText('Trigger：合成条件成立 → 新的成立条件')).toBeTruthy();
    expect(screen.getByText(/inconclusive · 待继续核验/)).toBeTruthy();
  });
  it('reports invalid import inside the modal without exposing a confirm action or writing', () => {
    const { repository, storage } = setup(); render(<CreatorViewpointWorkspace repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: '恢复 JSON' }));
    fireEvent.change(screen.getByLabelText('JSON 内容'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: '校验并预览' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '备份当前数据并确认恢复' })).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('persists a deliberate approval and keeps the original observation unchanged', () => {
    const { data, storage, values } = setup();
    data.approvals = data.approvals.filter(item => item.observationId !== 'observation-1');
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    const original = JSON.stringify(data.observations);
    render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    fireEvent.click(screen.getByRole('button', { name: '审核记录' }));
    fireEvent.change(screen.getByLabelText('审核依据 / 备注'), { target: { value: '已核对合成原文与条件' } });
    fireEvent.click(screen.getByRole('button', { name: '确认审核决定' }));
    const saved = JSON.parse(values.get(CREATOR_VIEWPOINT_STORAGE_KEY)!);
    expect(saved.approvals).toHaveLength(3);
    expect(JSON.stringify(saved.observations)).toBe(original);
    expect(screen.queryByRole('button', { name: '审核记录' })).toBeNull();
  });
});
