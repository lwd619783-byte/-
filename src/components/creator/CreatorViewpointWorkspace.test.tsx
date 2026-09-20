// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatorViewpointWorkspace } from './CreatorViewpointWorkspace';
import { creatorViewpointFixture, fixtureTime } from '../../services/creatorViewpoint.fixture';
import { BrowserCreatorViewpointRepository, CREATOR_VIEWPOINT_STORAGE_KEY, CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX } from '../../services/creatorViewpointRepository';
import { CreatorEntryForm } from './CreatorEntryForm';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

afterEach(() => {
  cleanup();
  // Finish download URL cleanup before removing the browser URL mock.
  if (vi.isFakeTimers()) { vi.runOnlyPendingTimers(); vi.useRealTimers(); }
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function setup(corrupt = false) {
  const data = creatorViewpointFixture();
  const values = new Map<string, string>([[CREATOR_VIEWPOINT_STORAGE_KEY, corrupt ? '{bad' : JSON.stringify(data)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn() };
  const repository = new BrowserCreatorViewpointRepository(storage);
  return { data, values, storage, repository };
}
describe('Creator Viewpoint Workspace', () => {
  it('propagates unresolved current-state health to Overview and Comparison with knowledge As-of', () => {
    const { data, values, repository } = setup();
    const later = '2026-09-18T08:00:00.000Z';
    data.sources.push({ ...data.sources[0], id: 'uncertain-source', publishedAt: null, capturedAt: later, recordedAt: later });
    data.observations.push({ ...data.observations[0], id: 'uncertain', sourceId: 'uncertain-source', recordedAt: later });
    data.approvals.push({ id: 'uncertain-approval', observationId: 'uncertain', decision: 'reviewed', recordedAt: later, note: '来源时间未证实' });
    values.set(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    render(<CreatorViewpointWorkspace repository={repository} />);
    expect(screen.getByText(/最近可确定状态 · 存在 1 条未解析观点/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '博主比较' }));
    expect(screen.getAllByText(/当前状态不完整 \/ 无法确认/)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('As-of 本地时间（按记录 / 审核可得时点）'), { target: { value: '2026-09-17T08:00' } });
    expect(screen.queryByText(/当前状态不完整 \/ 无法确认/)).toBeNull();
  });
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
    data.sources.push({ ...data.sources[0], id: 'source-condition-change', publishedAt: fixtureTime(4), capturedAt: fixtureTime(4), recordedAt: fixtureTime(4) });
    data.observations.push({ ...data.observations[0], id: 'condition-change', sourceId: 'source-condition-change', recordedAt: fixtureTime(4), trigger: '新的成立条件', summary: '合成条件变化' });
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
  it('exports corrupt bytes, validates without writes, confirms scoped recovery and unlocks the UI', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { data, storage, values, repository } = setup(true);
    values.set('unrelated-record', 'preserve');
    const backup = repository.export(data);
    const downloads: Blob[] = [];
    vi.stubGlobal('URL', class extends URL { static createObjectURL(blob: Blob) { downloads.push(blob); return 'blob:fixture'; } static revokeObjectURL() {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<CreatorViewpointWorkspace repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: '导出原文并打开灾难恢复' }));
    expect(downloads).toHaveLength(1);
    const dialog = screen.getByRole('dialog', { name: '灾难恢复观点备份' });
    fireEvent.change(within(dialog).getByLabelText('JSON 内容'), { target: { value: '{bad backup' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '校验并预览' }));
    expect(within(dialog).getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认备份损坏原文并替换观点存储' })).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('JSON 内容'), { target: { value: backup } });
    fireEvent.click(within(dialog).getByRole('button', { name: '校验并预览' }));
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe('{bad');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认备份损坏原文并替换观点存储' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('button', { name: '新增博主' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: '导出原文并打开灾难恢复' })).toBeNull();
    expect(values.get('unrelated-record')).toBe('preserve');
    const rawBackup = [...values].find(([key]) => key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX));
    expect(rawBackup?.[1]).toBe('{bad');
    expect(JSON.parse(values.get(CREATOR_VIEWPOINT_STORAGE_KEY)!)).toEqual(data);
  });
  it('keeps future-schema recovery locked and read-only corrupt export disabled', () => {
    const { data, storage } = setup();
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify({ ...data, schemaVersion: 99 }));
    const { unmount } = render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    expect(screen.queryByRole('button', { name: '导出原文并打开灾难恢复' })).toBeNull();
    expect(screen.getByText(/禁止降级恢复/)).toBeTruthy();
    unmount();
    const corrupt = setup(true);
    render(<CreatorViewpointWorkspace repository={corrupt.repository} readOnly />);
    for (const name of ['导出损坏原文', '导出原文并打开灾难恢复']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(corrupt.storage.setItem).not.toHaveBeenCalled();
  });
  it('keeps unknown creator time unresolved and review dates uncomputed after approval', () => {
    const { data, storage } = setup();
    data.sources[0].publishedAt = null; data.sources[0].publishedAtLabel = '昨日（时区未知）';
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    expect(screen.queryByRole('button', { name: '合成观点 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    expect(screen.getByText('unresolved · 来源时间未知，不参与有序状态转换，可能影响 Current View 完整性')).toBeTruthy();
    expect(screen.getAllByText(/unresolved · 到期日不可计算/)).toHaveLength(3);
    const card = screen.getByRole('button', { name: '合成观点 1' }).closest('article')!;
    fireEvent.click(within(card).getAllByRole('button', { name: '填写复盘' })[0]);
    expect(screen.getByText(/来源发布时间锚点 unknown · 到期 unresolved/)).toBeTruthy();
    expect((screen.getByLabelText('复盘状态') as HTMLSelectElement).value).toBe('pending');
  });
  it('orders backfilled observations by creator time while showing separate local audit times', () => {
    const { data, storage } = setup();
    data.sources[0].publishedAt = fixtureTime(5); data.sources[0].capturedAt = fixtureTime(5); data.sources[0].recordedAt = fixtureTime(5);
    data.observations[0].recordedAt = fixtureTime(6); data.approvals[0].recordedAt = fixtureTime(7);
    data.sources.push({ ...data.sources[0], id: 'backfill-source', publishedAt: fixtureTime(1), recordedAt: fixtureTime(10), capturedAt: fixtureTime(10) });
    data.observations.push({ ...data.observations[0], id: 'backfill', sourceId: 'backfill-source', summary: '补录旧观点', recordedAt: fixtureTime(10), stance: 'negative' });
    data.approvals.push({ id: 'backfill-approval', observationId: 'backfill', recordedAt: fixtureTime(11), note: '合成补录审核', decision: 'reviewed' });
    data.approvals.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
    render(<CreatorViewpointWorkspace repository={new BrowserCreatorViewpointRepository(storage)} />);
    expect(screen.getByRole('button', { name: '合成观点 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '补录旧观点' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '观点时间轴' }));
    fireEvent.change(screen.getByLabelText('筛选博主'), { target: { value: 'creator-1' } });
    const cards = screen.getAllByRole('article');
    expect(cards[0].textContent).toContain('补录旧观点');
    expect(cards[0].textContent).toContain(`Creator time ${fixtureTime(1)}`);
    expect(cards[0].textContent).toContain(`本地审核 ${fixtureTime(11)}`);
    expect(cards[1].textContent).toContain('合成观点 1');
  });
  it('allows verified external-event transcription with explicit non-admission language', () => {
    const { data } = setup(); const onAppend = vi.fn();
    render(<CreatorEntryForm request={{ kind: 'event' }} data={data} onAppend={onAppend} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('事件名称'), { target: { value: '合成已核验事件' } });
    fireEvent.change(screen.getByLabelText('事件摘要'), { target: { value: '合成摘要' } });
    fireEvent.change(screen.getByLabelText('事件来源 URL'), { target: { value: 'https://example.com/verified' } });
    fireEvent.change(screen.getByLabelText('核验状态'), { target: { value: 'verified' } });
    expect(screen.getByText(/不代表 Provider Fact 准入、Verified Claim 或正式 Thesis/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '追加保存' }));
    expect(onAppend.mock.calls[0][0].events[0].verificationStatus).toBe('verified');
  });
});
