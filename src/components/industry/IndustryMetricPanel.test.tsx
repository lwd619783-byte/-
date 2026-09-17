// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IndustryMetricPanel, MetricContent } from './IndustryMetricPanel';
import { roboticsMetric } from '../../services/industryMetricProvider';
// Recharts layout requires a browser; real browser acceptance separately exercises the plot.
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, LineChart: () => <div>plot</div>, Line: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('real pilot shows explicit admission, distinct basis, same audit/Evidence Drawer without storage writes', () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  render(<IndustryMetricPanel industryId="robotics" />);
  expect(screen.getByRole('region', { name: '正式行业指标' }).textContent).toContain('96,174');
  expect(screen.getByText(/官方留存样本/).textContent).toContain('NOT_ADMITTED');
  fireEvent.change(screen.getByLabelText('指标口径'), { target: { value: 'year_to_date' } });
  expect(screen.getByText('729,352 套')).toBeTruthy(); expect(screen.getByText('不比较累计口径')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  const drawer = screen.getByRole('dialog');
  expect(within(drawer).getByLabelText('图表审计元数据').textContent).toContain('candidate');
  expect(drawer.textContent).toContain('releaseAvailableAt'); expect(drawer.textContent).toContain('未提供 / unknown');
  expect(drawer.textContent).toContain('当前图表没有可验证的 Evidence linkage');
  expect(writes).not.toHaveBeenCalled();
});
it('switching industry unmounts selected basis and the evidence drawer; others never show fake metrics', () => {
  const { rerender } = render(<IndustryMetricPanel industryId="robotics" />);
  fireEvent.click(screen.getByRole('button', { name: '查看指标证据' }));
  for (const id of ['ai-computing', 'innovative-drug', 'oil-shipping']) {
    rerender(<IndustryMetricPanel industryId={id} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText(/not_implemented/)).toBeTruthy(); expect(screen.queryByLabelText('指标口径')).toBeNull();
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
