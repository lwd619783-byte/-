// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClaimVerificationModal } from './ClaimVerificationModal';
import { claimFixture, claimStorage } from '../../services/verifiedClaim.fixture';
import { BrowserClaimRepository, CLAIM_STORAGE_KEY } from '../../services/verifiedClaimRepository';
afterEach(cleanup);
it('supported synthetic candidate requires saved revision, preview, then user click; reload exposes immutable history', async () => {
  const f = await claimFixture(), storage = claimStorage(), repository = new BrowserClaimRepository(storage, f.owners);
  const props = { binding: f.binding, owners: f.owners, repository, onEvidence() {}, onClose() {} };
  const view = render(<ClaimVerificationModal {...props} />);
  expect(storage.getItem(CLAIM_STORAGE_KEY)).toBeNull();
  expect(screen.queryByRole('button', { name: '本人确认已验证' })).toBeNull();
  fireEvent.change(screen.getByLabelText('修订或审核说明'), { target: { value: 'Synthetic review' } });
  fireEvent.change(screen.getByLabelText('背景标题'), { target: { value: 'Synthetic context' } });
  fireEvent.change(screen.getByLabelText('背景链接'), { target: { value: 'https://example.com/synthetic' } });
  fireEvent.click(screen.getByRole('button', { name: '保存候选草稿' }));
  expect(repository.load().data.reviews).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '生成验证预览' }));
  expect((screen.getByRole('button', { name: '本人确认已验证' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '本人确认已验证' }));
  expect(repository.load().data.reviews[0].decision).toBe('VERIFIED');
  expect(repository.load().data.revisions[0].origin).toBe('ai_draft');
  view.unmount(); render(<ClaimVerificationModal {...props} />);
  expect(screen.getByText(/当前主张：已验证/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Synthetic context' }).getAttribute('href')).toBe('https://example.com/synthetic');
});
it('blocked synthetic candidate can be rejected, never verified; contexts do not change gate', async () => {
  const f = await claimFixture(g => { g.nodes[0].releaseAvailableAt = null; }), repository = new BrowserClaimRepository(claimStorage(), f.owners);
  render(<ClaimVerificationModal binding={f.binding} owners={f.owners} repository={repository} onEvidence={() => {}} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('修订或审核说明'), { target: { value: 'Rejected with blocker' } });
  fireEvent.click(screen.getByRole('button', { name: '保存候选草稿' }));
  fireEvent.click(screen.getByRole('button', { name: '生成验证预览' }));
  expect((screen.getByRole('button', { name: '本人确认已验证' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '本人确认拒绝' }));
  expect(repository.load().data.reviews[0].decision).toBe('REJECTED');
});
it('future schema disables writes and recovery without touching stored bytes', async () => {
  const f = await claimFixture(), storage = claimStorage(); storage.setItem(CLAIM_STORAGE_KEY, '{"schemaVersion":"verified-claim.v2"}');
  const repository = new BrowserClaimRepository(storage, f.owners);
  render(<ClaimVerificationModal binding={f.binding} owners={f.owners} repository={repository} onEvidence={() => {}} onClose={() => {}} />);
  expect(screen.queryByRole('button', { name: '保存候选草稿' })).toBeNull();
  expect((screen.getByRole('button', { name: '导入或恢复主张备份' }) as HTMLButtonElement).disabled).toBe(true);
  expect(storage.getItem(CLAIM_STORAGE_KEY)).toBe('{"schemaVersion":"verified-claim.v2"}');
});
