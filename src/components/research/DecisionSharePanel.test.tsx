// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { DecisionSharePanel } from './DecisionSharePanel';
import type { DecisionPublisher } from '../../services/decisionPublish';
import { emptyDecisionFixture } from '../../../scripts/tests/os-domain.fixture.mjs';
import { decisionFixture } from '../../services/decisionSnapshot.fixture';
import { buildDecisionSnapshot } from '../../services/decisionSnapshot';
import { portfolioFixtureProjection } from '../../services/portfolio.fixture';
import { claimTime as at } from '../../services/verifiedClaim.fixture';
afterEach(cleanup);
it('explicit prepare → visible scope → confirm → revoke without JSON/IDs; cancelled preview sends nothing', async () => {
  const snapshot = emptyDecisionFixture(), p = { snapshot, digest: 'a'.repeat(64), expectedGeneration: 0 };
  const service: DecisionPublisher = { prepare: vi.fn(async () => p), publish: vi.fn(async () => {}), revoke: vi.fn(async () => {}) };
  render(<DecisionSharePanel dataset={{ stocks: [], industries: [], macroIndicators: [] }} createPublisher={async () => service} />);
  fireEvent.change(screen.getByLabelText('共享访问密钥'), { target: { value: 'synthetic-owner-key-with-at-least-32-chars' } });
  fireEvent.click(screen.getByText('生成并校验共享预览'));
  await screen.findByText('组合：不可读取，不含组合数据'); expect(service.publish).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('本次共享的组合数据')).toBeNull(); expect(screen.queryByText(/0 个已记录仓位/)).toBeNull();
  fireEvent.click(screen.getByText('取消')); expect(service.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('生成并校验共享预览')); await screen.findByText('确认共享上述正式状态');
  fireEvent.click(screen.getByText('确认共享上述正式状态')); await waitFor(() => expect(service.publish).toHaveBeenCalledWith(p, expect.any(String), true));
  await screen.findByText(/已共享经校验/); fireEvent.click(screen.getByText('撤销当前共享'));
  await screen.findByText(/已撤销共享/); expect(service.revoke).toHaveBeenCalledOnce();
  expect(window.localStorage.length).toBe(0);
});
it('previews non-empty synthetic Portfolio and actual research fields before a single explicit publication', async () => {
  const f = await decisionFixture(), projection = portfolioFixtureProjection(at(12), 'archived');
  const snapshot = await buildDecisionSnapshot(f.runtime, projection, new Date(at(12))), p = { snapshot, digest: 'a'.repeat(64), expectedGeneration: 0 };
  const original = JSON.stringify(snapshot);
  const service: DecisionPublisher = { prepare: vi.fn(async () => p), publish: vi.fn(async () => {}), revoke: vi.fn(async () => {}) };
  render(<DecisionSharePanel dataset={{ stocks: [], industries: [], macroIndicators: [] }} createPublisher={async () => service} />);
  fireEvent.change(screen.getByLabelText('共享访问密钥'), { target: { value: 'synthetic-owner-key-with-at-least-32-chars' } });
  fireEvent.click(screen.getByText('生成并校验共享预览')); await screen.findByText(/下列内容就是本次将发送到私人暂存区/);
  const portfolio = screen.getByLabelText('本次共享的组合数据'), positions = within(portfolio).getAllByRole('article');
  expect(positions).toHaveLength(2);
  for (const [i, position] of projection.positions.entries()) {
    const text = positions[i].textContent!;
    expect(text).toContain(`账户：${position.accountName}`); expect(text).toContain('账户状态：已归档');
    expect(text).toContain(`资产：${position.assetName}`); expect(text).toContain(`数量：${position.quantity}`);
    expect(text).toContain(`市值：${position.marketValue} ${position.currency}`); expect(text).toContain(`快照日期：${position.snapshotDate}`);
    expect(text).toContain(`主要类别：${position.primaryCategory}`); expect(text).toContain(`策略分类：${position.strategyBucket}`);
    expect(position.blockers.length).toBeGreaterThan(0); for (const blocker of position.blockers) expect(text).toContain(blocker);
  }
  expect(screen.getByText(snapshot.claims.rows[0].statement)).toBeTruthy(); expect(screen.getByText('证据门禁：通过（supported）')).toBeTruthy();
  fireEvent.click(screen.getByText('Thesis 记录与风险、失效条件（1）'));
  const thesis = screen.getByText(snapshot.theses.rows[0].statement).closest('article')!;
  for (const text of [...snapshot.theses.rows[0].risks, ...snapshot.theses.rows[0].invalidation]) expect(within(thesis).getByText(text)).toBeTruthy();
  fireEvent.click(screen.getByText('投资表达与未知项（1）'));
  const expression = screen.getByText(/标的：synthetic-ETF/).closest('article')!;
  expect(expression.textContent).toContain('角色：直接表达'); expect(expression.textContent).toContain('部分信息缺失或需复核');
  expect(within(expression).getByText('未知项')).toBeTruthy(); expect(within(expression).getByText('估值')).toBeTruthy();
  expect(screen.getByText(/上述记录还保留来源、时间、精确版本、证据及审计引用/)).toBeTruthy();
  expect(screen.getByText(/访问最长有效24小时.*不代表.*物理删除/)).toBeTruthy();
  expect(screen.queryByText(snapshot.snapshotId, { exact: false })).toBeNull(); expect(screen.queryByText(p.digest, { exact: false })).toBeNull();
  expect(service.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('确认共享上述正式状态')); await screen.findByText(/已共享经校验/);
  expect(service.publish).toHaveBeenCalledOnce(); expect(service.publish).toHaveBeenCalledWith(p, expect.any(String), true);
  expect(JSON.stringify(snapshot)).toBe(original);
});
it('shows blocked Claim gate and Thesis/Expression blockers without presenting them as verified', async () => {
  const f = await decisionFixture(); f.claim.graph.nodes[0].nodeId = 'synthetic-drift';
  const snapshot = await buildDecisionSnapshot(f.runtime, null, new Date(at(12)));
  const service: DecisionPublisher = { prepare: vi.fn(async () => ({ snapshot, digest: 'a'.repeat(64), expectedGeneration: 0 })), publish: vi.fn(async () => {}), revoke: vi.fn(async () => {}) };
  render(<DecisionSharePanel dataset={{ stocks: [], industries: [], macroIndicators: [] }} createPublisher={async () => service} />);
  fireEvent.change(screen.getByLabelText('共享访问密钥'), { target: { value: 'synthetic-owner-key-with-at-least-32-chars' } });
  fireEvent.click(screen.getByText('生成并校验共享预览')); await screen.findByText('证据门禁：未通过（blocked）');
  fireEvent.click(screen.getByText('Thesis 记录与风险、失效条件（1）')); fireEvent.click(screen.getByText('投资表达与未知项（1）'));
  for (const rows of [snapshot.claims.rows, snapshot.theses.rows, snapshot.expressions.rows]) {
    const row = rows[0], text = 'statement' in row ? row.statement : `标的：${row.instrument!.id} · ${row.instrument!.type} / ${row.instrument!.market}`;
    const article = screen.getByText(text).closest('article')!;
    expect(article.textContent).toContain('已阻断'); for (const blocker of row.blockers) expect(article.textContent).toContain(blocker);
  }
  expect(screen.getByText('组合：不可读取，不含组合数据')).toBeTruthy(); expect(service.publish).not.toHaveBeenCalled();
});
it('unavailable local owners still allow independent server revoke; errors do not leak raw diagnostics', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/status') ? { generation: 7 } : { status: 'revoked' }), { status: 200 }));
  try {
    render(<DecisionSharePanel dataset={{ stocks: [], industries: [], macroIndicators: [] }} />);
    fireEvent.change(screen.getByLabelText('共享访问密钥'), { target: { value: 'synthetic-owner-key-with-at-least-32-chars' } });
    fireEvent.click(screen.getByText('撤销当前共享')); await screen.findByText(/已撤销共享/);
    expect(spy.mock.calls.map(c => c[0])).toEqual(['/api/os-domain/status', '/api/os-domain/revoke']);
  } finally { spy.mockRestore(); }
});
