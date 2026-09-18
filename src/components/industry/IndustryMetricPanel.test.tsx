// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IndustryMetricPanel, MetricContent } from './IndustryMetricPanel';
import retained from '../../data/real/industry-robotics.generated.json';
import type { IndustryMetricDataset } from '../../types/industryMetric';
import growth from '../../data/real/industry-robotics-yoy.generated.json';
import registry from '../../../config/industry/industry-metric-registry.v1.json';
import { loadIndustryMetrics } from '../../services/industryMetricProvider';
// UI-only fixture; real digest/replay runs in Node tests and the browser matrix.
vi.mock('../../services/industryMetricProvider', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/industryMetricProvider')>(),
  loadIndustryMetrics: vi.fn(async () => ({ status: 'available', provider: { list: (id: string) => id === 'robotics' ? registry.entries.filter(entry => entry.industryId === 'robotics').map((entry, i) => ({ entry, owner: [retained, growth][i] })) : [] } })),
}));
const roboticsMetric = retained as IndustryMetricDataset;
// Recharts layout requires a browser; real browser acceptance separately exercises the plot.
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, LineChart: () => <div>plot</div>, Line: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('real pilot shows explicit admission, distinct basis, same audit/Evidence Drawer without storage writes', async () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  render(<IndustryMetricPanel industryId="robotics" />);
  await screen.findByLabelText('正式指标');
  expect(screen.getByRole('region', { name: '正式行业指标' }).textContent).toContain('96,174');
  expect(screen.getByText(/官方留存样本/).textContent).toContain('尚未准入');
  fireEvent.change(screen.getByLabelText('指标口径'), { target: { value: 'year_to_date' } });
  expect(screen.getByText('729,352 套')).toBeTruthy(); expect(screen.getByText('不比较累计口径')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  const drawer = screen.getByRole('dialog');
  expect(within(drawer).getByLabelText('图表来源与证明').textContent).toContain('candidate');
  expect(drawer.textContent).toContain('releaseAvailableAt'); expect(drawer.textContent).toContain('未提供 / unknown');
  expect(drawer.textContent).toContain('当前图表没有可验证的正式证据关联');
  expect(writes).not.toHaveBeenCalled();
});
it('switching industry unmounts selected basis and the evidence drawer; others never show fake metrics', async () => {
  const { rerender } = render(<IndustryMetricPanel industryId="robotics" />);
  await screen.findByLabelText('正式指标');
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  for (const id of ['ai-computing', 'innovative-drug']) {
    rerender(<IndustryMetricPanel industryId={id} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText(/尚未接入正式指标/)).toBeTruthy(); expect(screen.queryByLabelText('指标口径')).toBeNull();
  }
});
it('empty and conflicted owner previews propagate instead of falling back to retained numbers', () => {
  const owner = structuredClone(roboticsMetric); owner.observations = [];
  const { rerender } = render(<MetricContent owner={owner} />);
  expect(screen.getByText('图表数据暂缺')).toBeTruthy(); expect(screen.getAllByText(/missing/).length).toBeGreaterThan(0);
  const conflict = structuredClone(roboticsMetric); conflict.observations.forEach(o => { o.conditions.push('conflicted'); });
  rerender(<MetricContent owner={conflict} />);
  expect(screen.getByText('图表数据暂缺')).toBeTruthy(); expect(screen.getAllByText(/conflicted/).length).toBeGreaterThan(0);
  expect(screen.queryByText('96,174 套')).toBeNull();
});

it('switches independent metric identity, percentage unit/basis/evidence without stale drawer or delta', async () => {
  render(<IndustryMetricPanel industryId="robotics" />);
  const selector = await screen.findByLabelText('正式指标');
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  fireEvent.change(selector, { target: { value: 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY' } });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('34.6 %')).toBeTruthy();
  expect(screen.queryByText('相邻月留存值差额')).toBeNull();
  expect(screen.getAllByText(/官方直接发布同比增长/).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('指标口径'), { target: { value: 'year_to_date' } });
  expect(screen.getByText('29 %')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  expect(screen.getByRole('dialog').textContent).toContain('CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY');
  expect(screen.getByRole('dialog').textContent).toContain('官方同比增长（%）');
  fireEvent.change(selector, { target: { value: 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT' } });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('96,174 套')).toBeTruthy();
});

it('registry failure is explicitly blocked and never falls back to an artifact', async () => {
  vi.mocked(loadIndustryMetrics).mockResolvedValueOnce({ status: 'blocked', reason: 'PIN_DIGEST' });
  render(<IndustryMetricPanel industryId="robotics" />);
  expect(await screen.findByText(/PIN_DIGEST/)).toBeTruthy();
  expect(screen.queryByLabelText('正式指标')).toBeNull();
  expect(screen.queryByText('96,174 套')).toBeNull();
});
