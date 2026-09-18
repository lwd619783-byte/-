// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IndustryChangePanel } from './IndustryChangePanel';
import { ResearchInbox } from '../home/ResearchInbox';
import retained from '../../data/real/industry-robotics.generated.json';
import growth from '../../data/real/industry-robotics-yoy.generated.json';
import registry from '../../../config/industry/industry-metric-registry.v1.json';
import { loadIndustryMetrics } from '../../services/industryMetricProvider';
import { buildIndustryChanges } from '../../services/industrySignals';
import type { IndustryMetricProvider } from '../../services/industryMetricRegistry.mjs';
import type { IndustryMetricDataset } from '../../types/industryMetric';

const provider = (): IndustryMetricProvider => ({
  list: id => id === 'robotics' ? registry.entries.filter(entry => entry.industryId === 'robotics').map((entry, i) => ({ entry: { ...entry, presentation: { ...entry.presentation, delta: i ? 'none' : 'absolute_difference', basisLabels: { monthly: entry.presentation.basisLabels.monthly!, year_to_date: entry.presentation.basisLabels.year_to_date! } } }, owner: [retained, growth][i] as IndustryMetricDataset, binding: null })) : [],
  get: () => null,
});
vi.mock('../../services/industryMetricProvider', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/industryMetricProvider')>(), loadIndustryMetrics: vi.fn(),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows one release/four readings and reuses EvidenceDrawer with Escape/focus restoration and no writes', async () => {
  vi.mocked(loadIndustryMetrics).mockResolvedValue({ status: 'available', provider: provider() });
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  render(<IndustryChangePanel industryId="robotics" />);
  expect(await screen.findByText('国家统计局更新工业机器人 8 月产量数据')).toBeTruthy();
  expect(screen.getByText('96,174 套')).toBeTruthy(); expect(screen.getByText('729,352 套')).toBeTruthy();
  expect(screen.getByText('34.6 %')).toBeTruthy(); expect(screen.getByText('29 %')).toBeTruthy();
  const trigger = screen.getByRole('button', { name: '查看行业变化证据' }); trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole('dialog').textContent).toContain('CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY');
  expect(screen.getByRole('dialog').textContent).toContain('releaseAvailableAt');
  expect(screen.getByRole('dialog').textContent).toContain('candidate');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
  expect(writes).not.toHaveBeenCalled();
});
it('foreign industry and blocked Registry have no fabricated event, and switching closes the old drawer', async () => {
  vi.mocked(loadIndustryMetrics).mockResolvedValue({ status: 'available', provider: provider() });
  const { rerender, unmount } = render(<IndustryChangePanel industryId="robotics" />);
  fireEvent.click(await screen.findByRole('button', { name: '查看行业变化证据' }));
  rerender(<IndustryChangePanel industryId="ai-computing" />);
  expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText(/行业变化 unavailable/)).toBeTruthy();
  unmount();
  vi.mocked(loadIndustryMetrics).mockResolvedValue({ status: 'blocked', reason: 'PIN_DIGEST' });
  render(<IndustryChangePanel industryId="robotics" />);
  expect(await screen.findByText(/blocked：PIN_DIGEST/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '查看行业变化证据' })).toBeNull();
});
it('Inbox receives one explicit formal event, opens the same evidence, and links to exact industry identity', () => {
  const events = buildIndustryChanges(provider(), 'robotics').events;
  render(<ResearchInbox events={[]} tasks={[]} watchItems={[]} stocks={[]} industryEvents={[...events, ...events]} now={new Date('2026-09-18T00:00:00Z')} timeZone="Asia/Shanghai" onOpenStock={vi.fn()} />);
  expect(screen.getAllByText('国家统计局更新工业机器人 8 月产量数据')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '打开对应行业 / Metric' }).getAttribute('href')).toBe('#/industry?industry=robotics');
  fireEvent.click(screen.getByRole('button', { name: '查看行业变化证据' }));
  expect(screen.getByRole('dialog').textContent).toContain('NOT_ADMITTED');
  expect(screen.getByRole('dialog').textContent).toContain('industry-retained-readings.v1');
});
it('Inbox updates after async industry props arrive, and unknown publication does not acquire false recency', () => {
  const events = buildIndustryChanges(provider(), 'robotics').events;
  const props = { events: [], tasks: [], watchItems: [], stocks: [], now: new Date('2026-09-18T00:00:00Z'), timeZone: 'Asia/Shanghai', onOpenStock: vi.fn() };
  const { rerender } = render(<ResearchInbox {...props} industryEvents={[]} />);
  expect(screen.queryByRole('button', { name: '查看行业变化证据' })).toBeNull();
  rerender(<ResearchInbox {...props} industryEvents={events} />);
  expect(screen.getByRole('button', { name: '查看行业变化证据' })).toBeTruthy();
  rerender(<ResearchInbox {...props} industryEvents={[{ ...events[0], publicationDateTime: null }]} />);
  expect(screen.queryByRole('button', { name: '查看行业变化证据' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: '日期范围' }), { target: { value: 'all' } });
  expect(screen.getByRole('button', { name: '查看行业变化证据' })).toBeTruthy();
  expect(screen.getByText(/页面标注发布：unknown/)).toBeTruthy();
});
