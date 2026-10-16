// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DecisionHome, decisionFreshness } from './DecisionHome';
afterEach(cleanup);
it('propagates missing, stale and future data as unknown', () => {
  expect(decisionFreshness(null, null, '2026-10-16')).toContain('未知');
  expect(decisionFreshness('2026-09-01', '2026-09-30', '2026-10-16')).toContain('过期');
  expect(decisionFreshness('2026-10-17', '2026-10-18', '2026-10-16')).toContain('未知');
});
it('previews, cancels and confirms reading once, without equating confirmation to fills', () => {
  const knowledge = vi.fn();
  render(<DecisionHome onKnowledge={knowledge} onEvidence={vi.fn()} />);
  const card = within(screen.getByRole('article', { name: '合成公司 01' }));
  fireEvent.click(card.getByText('预览确认 · SYN-01'));
  fireEvent.click(card.getByText('取消确认'));
  expect(card.getByText('待用户确认 · 未成交')).toBeTruthy();
  fireEvent.click(card.getByText('预览确认 · SYN-01'));
  fireEvent.click(card.getByText('确认已阅读'));
  expect(card.getByText('已确认阅读 · 未成交')).toBeTruthy();
  expect((card.getByText('预览确认 · SYN-01') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(card.getByText('SYN-KB-01 · 需求验证笔记'));
  expect(knowledge).toHaveBeenCalledOnce();
});
