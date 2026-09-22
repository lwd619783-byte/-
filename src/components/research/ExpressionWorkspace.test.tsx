// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { canonicalJson } from '../../../shared/canonical-json.mjs';
import { ExpressionWorkspacePanel } from './ExpressionWorkspace';
import { expressionFixture } from '../../services/expression.fixture';
import { BrowserExpressionRepository, EXPRESSION_STORAGE_KEY } from '../../services/expressionRepository';
import { claimTime as at } from '../../services/verifiedClaim.fixture';
import type { ExpressionWorkspaceRuntime } from '../../services/expressionWorkspace';

afterEach(cleanup);
async function fixture() {
  const f = await expressionFixture();
  const repository = new BrowserExpressionRepository(f.storage, f.expressionOwners);
  const runtime: ExpressionWorkspaceRuntime = { owners: f.expressionOwners, repository, instruments: f.instruments.map(ref => ({ ref, label: ref.id })), thesisRuntime: {
    owners: f.owners, repository: f.thesisRepo, claimRepository: f.claimRepo, claimOwners: f.claim.owners, bindings: [f.claim.binding], identities: f.identities.map(ref => ({ ref, label: ref.id })),
    evidence: () => ({ title: 'Synthetic original Evidence', scope: 'synthetic-only', quality: [], rows: [], records: [], linkage: null }),
  } };
  return { ...f, repository, runtime };
}
it.each(['ETF', 'Index', 'Equity'])('UI saves and explicitly confirms %s; exact trace and history are read-only', async type => {
  const f = await fixture(); render(<ExpressionWorkspacePanel runtime={f.runtime} />);
  fireEvent.click(screen.getByRole('button', { name: '新建 Expression 草稿' }));
  fireEvent.change(screen.getByLabelText('正式 Thesis 精确版本'), { target: { value: f.revision.revisionId } });
  fireEvent.change(screen.getByLabelText('投资标的'), { target: { value: canonicalJson(f.instruments.find(i => i.type === type)) } });
  fireEvent.change(screen.getByLabelText('Expression 修订说明'), { target: { value: 'Synthetic UI draft' } });
  fireEvent.click(screen.getByRole('button', { name: '保存 Expression 草稿' }));
  expect(f.repository.load().data.confirmations).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '生成 Expression 确认预览' }));
  expect((screen.getByRole('button', { name: '本人确认正式 Expression' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Expression 本人确认说明'), { target: { value: 'Synthetic explicit user confirmation' } });
  fireEvent.click(screen.getByRole('button', { name: '本人确认正式 Expression' }));
  expect(screen.getByTestId('expression-counts').textContent).toBe('1 formal Expression');
  const raw = f.storage.getItem(EXPRESSION_STORAGE_KEY);
  fireEvent.click(screen.getByText('Expression 版本历史与 diff（1）'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Expression → Thesis → Claim → Evidence' })[0]);
  const modal = screen.getByRole('dialog', { name: 'Expression 精确引用链' });
  expect(modal.textContent).toContain(f.revision.revisionId); expect(modal.textContent).toContain(f.ref.revisionId);
  fireEvent.click(within(modal).getByRole('button', { name: '查看 Expression 原始 Evidence' }));
  expect(screen.getByRole('dialog', { name: '证据核对' }).textContent).toContain('Synthetic original Evidence');
  expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
});
it('UI preserves a blocked draft with no formal Thesis and visible unknown context', async () => {
  const f = await fixture(); f.repository.saveDraft(f.repository.load().data, { ...f.expression, thesis: null, instrument: null });
  render(<ExpressionWorkspacePanel runtime={f.runtime} />);
  expect(within(screen.getByRole('region', { name: '当前 Expression 草稿' })).getByText('缺少正式 Thesis 的精确版本；研究背景不能解除阻断。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '生成 Expression 确认预览' }));
  fireEvent.change(screen.getByLabelText('Expression 本人确认说明'), { target: { value: 'Cannot bypass' } });
  expect((screen.getByRole('button', { name: '本人确认正式 Expression' }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.repository.load().data.confirmations).toHaveLength(0);
});
it('UI shows later Thesis review notice without changing historical pins or formal state', async () => {
  const f = await fixture(), draft = f.repository.saveDraft(f.repository.load().data, f.expression);
  f.repository.confirm(f.repository.prepareConfirmation(draft, f.expression.revisionId), 'Synthetic', true);
  f.tick(13); f.thesisRepo.saveDraft(f.thesisRepo.load().data, { ...f.revision, revisionId: 'later', supersedes: f.revision.revisionId, createdAt: at(12), asOf: at(12) });
  const raw = f.storage.getItem(EXPRESSION_STORAGE_KEY); render(<ExpressionWorkspacePanel runtime={f.runtime} />);
  expect(screen.getByText('基础 Thesis 已有新版本 / 需复核；历史精确引用保持不变。')).toBeTruthy();
  expect(screen.getByTestId('expression-counts').textContent).toBe('1 formal Expression'); expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe(raw);
});
it('UI locks future schema recovery and reports stale saved bytes', async () => {
  const f = await fixture(); f.storage.setItem(EXPRESSION_STORAGE_KEY, '{"schemaVersion":"v99"}');
  const view = render(<ExpressionWorkspacePanel runtime={f.runtime} />);
  expect((screen.getByRole('button', { name: '导入或恢复 Expression 备份' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('暂无正式 Expression。')).toBeNull();
  expect(screen.getByRole('alert')).toBeTruthy(); view.unmount(); f.storage.removeItem(EXPRESSION_STORAGE_KEY);
  render(<ExpressionWorkspacePanel runtime={f.runtime} />);
  fireEvent.click(screen.getByRole('button', { name: '新建 Expression 草稿' }));
  fireEvent.change(screen.getByLabelText('Expression 修订说明'), { target: { value: 'Synthetic' } });
  f.storage.setItem(EXPRESSION_STORAGE_KEY, '{}');
  fireEvent.click(screen.getByRole('button', { name: '保存 Expression 草稿' }));
  expect(screen.getByRole('alert').textContent).toContain('已变化'); expect(f.storage.getItem(EXPRESSION_STORAGE_KEY)).toBe('{}');
});
