// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DecisionHome, decisionFreshness, decisionSamples } from './DecisionHome';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it.each([
  [null, null, '2026-10-16'], ['2026-09-01', '2026-09-30', '2026-10-16'],
  ['2026-10-17', '2026-10-18', '2026-10-16'], ['bad', '2026-10-16', '2026-10-16'],
  ['2026-02-30', '2026-10-16', '2026-10-16'], ['2026-10-15', '2026-10-14', '2026-10-16'],
  ['2026-10-15', '2026-10-16', 'bad'], ['2026-10-15', '2026-13-01', '2026-10-16'],
  ['2026-1-01', '2026-10-16', '2026-10-16'], ['2025-02-29', '2026-10-16', '2026-10-16'],
])('fails closed for invalid/stale/future/contradictory dates %#', (date, until, asOf) => {
  expect(decisionFreshness(date, until, asOf!)).toContain('未知');
});
it('allows valid leap date and inclusive expiry boundary', () => {
  expect(decisionFreshness('2024-02-29', '2024-03-01', '2024-03-01')).not.toContain('未知');
});
it('derives counts from supplied samples', () => {
  render(<DecisionHome onKnowledge={vi.fn()} onEvidence={vi.fn()} initialSamples={[decisionSamples[0]]} />);
  expect(screen.getByText('合成样例数').previousElementSibling?.textContent).toBe('1');
  expect(screen.getByText('当前数据未知').previousElementSibling?.textContent).toBe('0');
});
it('reading, cancellation and decision confirmation are separate; confirmation is version-bound and duplicate-safe', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T18:00:00Z'));
  render(<DecisionHome onKnowledge={vi.fn()} onEvidence={vi.fn()} />);
  const card = within(screen.getByRole('article', { name: '合成公司 01' }));
  fireEvent.click(card.getByText('预览阅读 · SYN-01')); fireEvent.click(card.getByText('取消确认'));
  expect(card.getByText('尚未阅读此版本')).toBeTruthy();
  fireEvent.click(card.getByText('预览阅读 · SYN-01')); fireEvent.click(card.getByText('确认已阅读'));
  expect(card.getByText('待用户决策确认 · 未成交')).toBeTruthy();
  fireEvent.click(card.getByText('预览决策确认 · SYN-01')); fireEvent.click(card.getByText('取消确认'));
  expect(screen.getByText('尚无决策确认记录。')).toBeTruthy();
  fireEvent.click(card.getByText('预览决策确认 · SYN-01')); fireEvent.click(card.getByText('本人确认此版本合成建议及条件'));
  expect(card.getByText('v1 已由用户确认（合成）· 未成交')).toBeTruthy();
  expect(card.getByText('2026-10-16T18:00:00.000Z')).toBeTruthy();
  expect((card.getByText('预览决策确认 · SYN-01') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('list', { name: '决策确认历史', hidden: true }).children).toHaveLength(1);
  fireEvent.click(card.getByText('演练建议更新 · SYN-01'));
  expect(card.getByText('旧版本确认已过时 · 当前版本待确认 · 未成交')).toBeTruthy();
  expect(screen.getByText('当前版本决策确认').previousElementSibling?.textContent).toBe('0');
  expect(screen.getByText(/SYN-01 \/ 建议v1 \/ 继续观察 · 旧版本/)).toBeTruthy();
  fireEvent.click(card.getByText('预览决策确认 · SYN-01')); fireEvent.click(card.getByText('本人确认此版本合成建议及条件'));
  const history = screen.getByRole('list', { name: '决策确认历史', hidden: true });
  expect(history.children).toHaveLength(2); expect(history.textContent).toContain(decisionSamples[0].condition); expect(history.textContent).toContain(decisionSamples[0].invalidation);
});
it('invalidates a pending preview on suggestion update', () => {
  render(<DecisionHome onKnowledge={vi.fn()} onEvidence={vi.fn()} />);
  fireEvent.click(screen.getByText('预览决策确认 · SYN-01')); fireEvent.click(screen.getByText('演练建议更新 · SYN-01'));
  expect(screen.queryByRole('region', { name: '决策确认预览' })).toBeNull(); expect(screen.getByText('尚无决策确认记录。')).toBeTruthy();
});
it('keeps confirmation history and revision state across independent overview, stock and history views', () => {
  const props = { onKnowledge: vi.fn(), onEvidence: vi.fn(), onDecision: vi.fn(), onHistory: vi.fn(), selectedId: 'SYN-01' };
  const { rerender } = render(<DecisionHome {...props} view="overview" />);
  expect(screen.queryByText('预览决策确认 · SYN-01')).toBeNull();
  fireEvent.click(screen.getByText('查看决策 · SYN-01'));
  expect(props.onDecision).toHaveBeenCalledWith('SYN-01');
  rerender(<DecisionHome {...props} view="cards" />);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByText('预览决策确认 · SYN-01'));
  fireEvent.click(screen.getByText('本人确认此版本合成建议及条件'));
  rerender(<DecisionHome {...props} view="overview" />);
  expect(screen.getByText('当前版本决策确认').previousElementSibling?.textContent).toBe('1');
  rerender(<DecisionHome {...props} view="cards" selectedId="SYN-02" />);
  expect(screen.queryByRole('article', { name: '合成公司 01' })).toBeNull();
  expect(screen.getByText('未知 · 数据已过期')).toBeTruthy();
  rerender(<DecisionHome {...props} view="cards" />);
  fireEvent.click(screen.getByText('演练建议更新 · SYN-01'));
  rerender(<DecisionHome {...props} view="history" />);
  expect(screen.getByRole('list', { name: '决策确认历史' }).textContent).toContain('旧版本，需重新确认');
  expect(screen.queryByRole('article')).toBeNull();
  rerender(<DecisionHome {...props} view="overview" />);
  expect(screen.getByText('当前版本决策确认').previousElementSibling?.textContent).toBe('0');
  expect(screen.getByText('等待新增证据')).toBeTruthy();
});
