// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { industries } from '../../data/industries';
import { stocks } from '../../data/stocks';
import { IndustryChainDiagram } from './IndustryChainDiagram';
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
  expect(container.textContent).toContain('Provider Fact');
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
  expect(screen.getByRole('status').textContent).toContain('unavailable');
  expect(screen.queryByRole('img')).toBeNull();
});
