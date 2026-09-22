// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThesisWorkspacePanel } from './ThesisWorkspace';
import { thesisFixture } from '../../services/thesis.fixture';
import { claimStorage, claimTime as at } from '../../services/verifiedClaim.fixture';
import { BrowserThesisRepository, THESIS_STORAGE_KEY } from '../../services/thesisRepository';
import { CLAIM_STORAGE_KEY } from '../../services/verifiedClaimRepository';
import type { ThesisWorkspaceRuntime } from '../../services/thesisWorkspace';

afterEach(cleanup);
async function fixture() {
  const f = await thesisFixture(), storage = claimStorage(), repository = new BrowserThesisRepository(storage, f.owners);
  const runtime: ThesisWorkspaceRuntime = { owners: f.owners, repository, claimRepository: f.claimRepo, claimOwners: f.claim.owners, bindings: [f.claim.binding], identities: f.identities.map(ref => ({ ref, label: ref.id })), evidence: () => ({ title: 'Synthetic original evidence', scope: 'synthetic', quality: [], rows: [], records: [], linkage: null }) };
  return { ...f, storage, repository, runtime };
}
function fillDraft() {
  fireEvent.click(screen.getByRole('button', { name: '新建 Thesis 草稿' }));
  for (const label of ['论点陈述', '乐观情景 bull', '基准情景 base', '悲观情景 bear', 'Thesis 修订说明']) fireEvent.change(screen.getByLabelText(label), { target: { value: `Synthetic ${label}` } });
}
it('synthetic formal path requires exact saved draft, preview and explicit confirmation; history and original Claim drill-down remain read-only', async () => {
  const f = await fixture();
  f.repository.saveDraft(f.repository.load().data, { ...f.revision, contexts: [{ kind: 'web', title: 'Synthetic background', url: 'https://example.com/thesis-background' }] });
  f.tickClaim(10);
  f.claimRepo.saveDraft(f.claimRepo.load().data, { ...f.claim.revision, revisionId: 'synthetic-newer-claim-draft', supersedes: f.claim.revision.revisionId,
    createdAt: '2026-09-09T00:00:00.000Z', asOf: '2026-09-09T00:00:00.000Z', reason: 'New head must not replace pinned revision' });
  const beforeClaim = f.claimStore.getItem(CLAIM_STORAGE_KEY);
  const view = render(<ThesisWorkspacePanel runtime={f.runtime} />);
  expect(screen.queryByRole('button', { name: '本人确认正式 Thesis' })).toBeNull();
  expect(f.repository.load().data.confirmations).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '生成 Thesis 确认预览' }));
  expect((screen.getByRole('button', { name: '本人确认正式 Thesis' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('本人确认说明'), { target: { value: 'Synthetic explicit confirmation' } });
  fireEvent.click(screen.getByRole('button', { name: '本人确认正式 Thesis' }));
  const data = f.repository.load().data;
  expect(data.confirmations).toHaveLength(1); expect(data.revisions[0].origin).toBe('ai_draft');
  const thesisBytes = f.storage.getItem(THESIS_STORAGE_KEY);
  fireEvent.click(screen.getByText('Thesis 版本历史与 diff（1）'));
  expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(thesisBytes);
  fireEvent.click(screen.getAllByRole('button', { name: /Claim → Evidence/ })[0]);
  const exact = within(screen.getByRole('dialog', { name: 'Thesis 支持主张精确版本' }));
  expect(exact.getByText(/主张版本：synthetic-revision-1/)).toBeTruthy();
  expect(exact.queryByText(/synthetic-newer-claim-draft/)).toBeNull();
  expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBe(beforeClaim);
  fireEvent.click(screen.getByRole('button', { name: '查看原始证据' }));
  expect(screen.getByRole('dialog', { name: '证据核对' })).toBeTruthy();
  expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBe(beforeClaim);
  view.unmount(); render(<ThesisWorkspacePanel runtime={f.runtime} />);
  expect(screen.getByText('当前正式 Thesis')).toBeTruthy();
  expect(screen.getByText(/支持主张已有后续版本\/需复核/)).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Synthetic background' })[0].getAttribute('href')).toBe('https://example.com/thesis-background');
  expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(thesisBytes);
  fireEvent.click(screen.getByRole('button', { name: '修订为新草稿' }));
  fireEvent.change(screen.getByLabelText('论点陈述'), { target: { value: 'Synthetic revised statement' } });
  fireEvent.change(screen.getByLabelText('Thesis 修订说明'), { target: { value: 'Synthetic second draft' } });
  fireEvent.click(screen.getByRole('button', { name: '保存 Thesis 草稿' }));
  expect(f.repository.load().data.revisions).toHaveLength(2);
  expect(f.repository.load().data.revisions[0]).toEqual(data.revisions[0]);
  expect(f.repository.load().data.confirmations).toHaveLength(1);
  expect(screen.getByText('当前正式 Thesis')).toBeTruthy();
  expect(screen.getByRole('region', { name: '当前 Thesis 草稿' })).toBeTruthy();
});
it('empty original Claim store allows blocked draft and explicit unknown macro relationship without creating authority', async () => {
  const f = await fixture(); f.claimStore.removeItem(CLAIM_STORAGE_KEY);
  render(<ThesisWorkspacePanel runtime={f.runtime} />); fillDraft();
  fireEvent.change(screen.getByLabelText('宏观驱动'), { target: { value: 'synthetic-macro' } });
  fireEvent.change(screen.getByLabelText('关联行业'), { target: { value: 'synthetic-industry' } });
  fireEvent.change(screen.getByLabelText('关系理由'), { target: { value: 'Synthetic unknown relationship' } });
  fireEvent.click(screen.getByRole('button', { name: '添加结构化关系' }));
  fireEvent.click(screen.getByRole('button', { name: '保存 Thesis 草稿' }));
  expect(f.repository.load().data.revisions).toHaveLength(1);
  expect(screen.getAllByText('关系状态：未知')[0]).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '生成 Thesis 确认预览' }));
  fireEvent.change(screen.getByLabelText('本人确认说明'), { target: { value: 'Cannot bypass' } });
  expect((screen.getByRole('button', { name: '本人确认正式 Thesis' }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.repository.load().data.confirmations).toHaveLength(0);
  expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBeNull();
});
it('corrupt Claim authority remains unknown, does not substitute cached pins or context', async () => {
  const f = await fixture(); f.repository.saveDraft(f.repository.load().data, f.revision);
  f.claimStore.setItem(CLAIM_STORAGE_KEY, '{bad');
  render(<ThesisWorkspacePanel runtime={f.runtime} />);
  expect(screen.getByTestId('thesis-counts').textContent).toContain('读取失败 verified');
  fireEvent.click(screen.getByRole('button', { name: '生成 Thesis 确认预览' }));
  fireEvent.change(screen.getByLabelText('本人确认说明'), { target: { value: 'Cannot confirm broken owner' } });
  expect((screen.getByRole('button', { name: '本人确认正式 Thesis' }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBe('{bad');
});
it('future Thesis schema locks writing and recovery while preserving exact bytes', async () => {
  const f = await fixture(), raw = '{ "schemaVersion": "thesis.v2" }'; f.storage.setItem(THESIS_STORAGE_KEY, raw);
  render(<ThesisWorkspacePanel runtime={f.runtime} />);
  expect((screen.getByRole('button', { name: '新建 Thesis 草稿' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '导入或恢复 Thesis 备份' }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(raw);
});
it('concurrent storage change rejects stale editor without altering another writer bytes', async () => {
  const f = await fixture(); render(<ThesisWorkspacePanel runtime={f.runtime} />); fillDraft();
  const other = new BrowserThesisRepository(f.storage, f.owners); other.saveDraft(other.load().data, f.revision);
  const raw = f.storage.getItem(THESIS_STORAGE_KEY);
  fireEvent.click(screen.getByRole('button', { name: '保存 Thesis 草稿' }));
  expect(within(screen.getByRole('alert')).getByText(/操作或读取已阻断/)).toBeTruthy();
  expect(f.storage.getItem(THESIS_STORAGE_KEY)).toBe(raw);
});

it.each(['DRAFT', 'VERIFIED', 'REJECTED'] as const)('filters superseded Claim choices by editor asOf when successor is %s', async decision => {
  const f = await fixture(); f.tickClaim(11);
  const next = { ...f.claim.revision, revisionId: 'successor-claim', supersedes: f.claim.revision.revisionId, createdAt: at(10), asOf: at(10) };
  let claims = f.claimRepo.saveDraft(f.claimRepo.load().data, next);
  if (decision !== 'DRAFT') claims = f.claimRepo.confirmReview(f.claimRepo.prepareReview(claims, next.revisionId), decision, 'Synthetic decision', true);
  const claimRaw = f.claimStore.getItem(CLAIM_STORAGE_KEY);
  render(<ThesisWorkspacePanel runtime={f.runtime} />); fillDraft();
  const group = within(screen.getByRole('group', { name: '选择支持主张的精确版本' }));
  expect(group.queryByRole('checkbox', { name: /synthetic-revision-1/ })).toBeNull();
  expect(!!group.queryByRole('checkbox', { name: /successor-claim/ })).toBe(decision === 'VERIFIED');
  fireEvent.change(screen.getByLabelText('论点 asOf（ISO 时间）'), { target: { value: at(9) } });
  expect(group.getByRole('checkbox', { name: /synthetic-revision-1/ })).toBeTruthy();
  expect(group.queryByRole('checkbox', { name: /successor-claim/ })).toBeNull();
  fireEvent.click(group.getByRole('checkbox', { name: /synthetic-revision-1/ }));
  fireEvent.change(screen.getByLabelText('论点 asOf（ISO 时间）'), { target: { value: at(12) } });
  expect(group.queryByRole('checkbox', { name: /synthetic-revision-1/ })).toBeNull();
  expect(group.getByText(/已保存引用在此 asOf 不可作为当前支持/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '保存 Thesis 草稿' }));
  fireEvent.click(screen.getByRole('button', { name: '生成 Thesis 确认预览' }));
  fireEvent.change(screen.getByLabelText('本人确认说明'), { target: { value: 'Must not confirm obsolete support' } });
  expect((screen.getByRole('button', { name: '本人确认正式 Thesis' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByText(/支持主张在论点 asOf 时已被后续版本替代/).length).toBeGreaterThan(0);
  expect(f.claimStore.getItem(CLAIM_STORAGE_KEY)).toBe(claimRaw);
  expect(f.repository.load().data.confirmations).toHaveLength(0);
});
