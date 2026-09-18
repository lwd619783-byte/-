// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { industries } from '../../data/industries';
import { stocks } from '../../data/stocks';
import { IndustryChainDiagram } from './IndustryChainDiagram';
import type { Stock } from '../../types';
afterEach(cleanup);
const industry = industries.find(i => i.id === 'robotics')!;
const pool = stocks.filter(s => s.industryId === 'robotics');
it('keeps exact company/segment navigation and discloses context versus facts', () => {
  const onOpenStock = vi.fn(), onSelectSegment = vi.fn();
  const { container } = render(<IndustryChainDiagram industry={industry} stocks={pool} onOpenStock={onOpenStock} onSelectSegment={onSelectSegment} />);
  fireEvent.click(container.querySelector('[data-stock-id="inovance"]')!);
  expect(onOpenStock).toHaveBeenCalledWith(pool.find(s => s.id === 'inovance'));
  fireEvent.click(container.querySelector('[data-chain-segment="motor-drive-control"]')!);
  expect(onSelectSegment).toHaveBeenCalledWith('motor-drive-control');
  expect(container.textContent).toContain('来源数据');
  expect(container.textContent).toContain('位置待映射');
  for (const stage of container.querySelectorAll('[data-chain-stage]')) {
    expect(stage.getAttribute('aria-labelledby')!.split(' ').every(id => !!document.getElementById(id))).toBe(true);
  }
  expect(container.querySelectorAll('[data-chain-stage]')).toHaveLength(3);
  expect(container.querySelector('[data-chain-stage="下游"] [data-chain-group="robot-oem"] [data-chain-company="unitree"]')).toBeTruthy();
  expect(container.querySelector('[data-chain-company="unitree"]')?.closest('.chain-more')).toBeNull();
  expect(container.querySelector('[data-chain-company="unitree"]')?.textContent).toContain('688836.SH');
  expect(container.querySelector('[data-chain-company="unitree"]')?.textContent).toContain('A股 / 科创板');
  fireEvent.click(container.querySelector('[data-stock-id="unitree"]')!);
  expect(onOpenStock).toHaveBeenLastCalledWith(pool.find(s => s.id === 'unitree'));
});
it('shows unavailable when no structural context exists', () => {
  render(<IndustryChainDiagram industry={{ ...industry, chain: [] }} stocks={pool} onOpenStock={vi.fn()} onSelectSegment={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toContain('暂不可用');
  expect(screen.queryByRole('img')).toBeNull();
});
it('uses exact segment primary nodes and keeps all company facts in secondary disclosures', () => {
  const { container } = render(<IndustryChainDiagram industry={industry} stocks={pool} onOpenStock={vi.fn()} onSelectSegment={vi.fn()} />);
  const nodes = container.querySelectorAll('[data-chain-node="segment"]');
  expect(nodes).toHaveLength(7);
  expect(new Set([...nodes].map(n => n.getAttribute('data-chain-group'))).size).toBe(7);
  for (const node of nodes) {
    expect(industry.segments.some(s => s.id === node.getAttribute('data-chain-group'))).toBe(true);
    expect(node.closest('[data-chain-stage], .chain-cross-context')).toBeTruthy();
    expect(node.querySelector('.chain-segment-detail > summary')?.textContent).toContain(industry.segments.find(s => s.id === node.getAttribute('data-chain-group'))!.name);
    expect(node.querySelector('.chain-provider-summary')?.closest('details')?.hasAttribute('open')).toBe(false);
  }
  for (const company of container.querySelectorAll('[data-chain-company]')) {
    expect(company.closest('.chain-segment-detail')?.hasAttribute('open')).toBe(false);
    expect(company.closest('[data-chain-node="segment"]')).toBeTruthy();
  }
  const unitreeChip = container.querySelector('[data-chain-stage="下游"] [data-chain-group="robot-oem"] [data-chain-company="unitree"]')!;
  expect(unitreeChip.textContent).toContain('688836.SH · A股 / 科创板');
  expect(unitreeChip.textContent).not.toMatch(/未上市|待上市|IPO 尚未完成/);
  expect(container.querySelectorAll('.chain-unresolved-grid article')).toHaveLength(12);
  expect(container.querySelector('.chain-unpositioned')?.textContent).toContain('未自动分配阶段');
});
it('keeps missing and stale owners in the full segment coverage denominator', () => {
  const stock = pool.find(s => s.id === 'unitree')!;
  const missing = { ...stock, quote: undefined, realFinancial: undefined, aShareFinancialSummary: undefined, announcements: undefined, aShareAnnouncementSummary: undefined };
  const { container, rerender } = render(<IndustryChainDiagram industry={industry} stocks={[missing]} onOpenStock={vi.fn()} onSelectSegment={vi.fn()} />);
  const segment = container.querySelector('[data-chain-group="robot-oem"]') as HTMLElement;
  expect(within(segment).getByText('行情 0/1')).toBeTruthy();
  expect(within(segment).getByText('财务 0/1')).toBeTruthy();
  expect(within(segment).getByText('公告 0/1')).toBeTruthy();
  expect(segment.textContent).toContain('缺失 1');
  const stale = { ...missing, quote: { id: stock.id, updatedAt: '2026-09-01', marketCap: 0, quality: { status: 'stale', source: 'test' } } } as Stock;
  rerender(<IndustryChainDiagram industry={industry} stocks={[stale]} onOpenStock={vi.fn()} onSelectSegment={vi.fn()} />);
  expect(within(segment).getByText('行情 1/1')).toBeTruthy();
  expect(segment.textContent).toContain('过期 1');
  expect(segment.textContent).toContain('财务 0/1');
});
