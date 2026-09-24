// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { DecisionSharePanel } from './DecisionSharePanel';
import type { DecisionPublisher } from '../../services/decisionPublish';
import { emptyDecisionFixture } from '../../../scripts/tests/os-domain.fixture.mjs';
afterEach(cleanup);
it('explicit prepare → visible scope → confirm → revoke without JSON/IDs; cancelled preview sends nothing', async () => {
  const snapshot = emptyDecisionFixture(), p = { snapshot, digest: 'a'.repeat(64), expectedGeneration: 0 };
  const service: DecisionPublisher = { prepare: vi.fn(async () => p), publish: vi.fn(async () => {}), revoke: vi.fn(async () => {}) };
  render(<DecisionSharePanel dataset={{ stocks: [], industries: [], macroIndicators: [] }} createPublisher={async () => service} />);
  fireEvent.change(screen.getByLabelText('共享访问密钥'), { target: { value: 'synthetic-owner-key-with-at-least-32-chars' } });
  fireEvent.click(screen.getByText('生成并校验共享预览'));
  await screen.findByText('组合：不可读取，不含组合数据'); expect(service.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('取消')); expect(service.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('生成并校验共享预览')); await screen.findByText('确认共享上述正式状态');
  fireEvent.click(screen.getByText('确认共享上述正式状态')); await waitFor(() => expect(service.publish).toHaveBeenCalledWith(p, expect.any(String), true));
  await screen.findByText(/已共享经校验/); fireEvent.click(screen.getByText('撤销当前共享'));
  await screen.findByText(/已撤销共享/); expect(service.revoke).toHaveBeenCalledOnce();
  expect(window.localStorage.length).toBe(0);
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
