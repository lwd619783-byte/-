// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { stocks } from '../../data/stocks';
import type { Stock } from '../../types';
import type { IndustryMetricDataset } from '../../types/industryMetric';
import { syntheticFreight } from '../../services/industryObservation.fixture';
import { OilShippingObservationContent } from './OilShippingObservation';
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, CartesianGrid: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null }));
afterEach(cleanup);
function fixture(): Stock[] {
  return stocks.filter(s => s.industryId === 'oil-shipping').map((stock, index) => {
    const points = Array.from({ length: 24 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, close: 10 + i + index, amount: null, pctChange: null }));
    return { ...stock, priceHistory: points, priceHistorySource: { id: stock.id, points, quality: { source: 'synthetic', status: 'real', updatedAt: '2026-09-25T10:00:00+08:00' } } };
  });
}
function setup(pool = fixture(), freightOwner: IndustryMetricDataset | null = null) {
  const onOpenStock = vi.fn(), onOpenMetrics = vi.fn();
  render(<OilShippingObservationContent stocks={pool} asOf="2026-09-27" freightOwner={freightOwner} onOpenStock={onOpenStock} onOpenMetrics={onOpenMetrics} />);
  return { onOpenStock, onOpenMetrics };
}
describe('oil observation UI', () => {
  it('presents real limitations without a fake score, benchmark or current freight', () => {
    setup();
    expect(screen.getByRole('heading', { name: '油运 · 动态观察' })).toBeTruthy();
    expect(screen.getByText('运价不可用')).toBeTruthy();
    expect(screen.getByText('数据不足')).toBeTruthy();
    expect(screen.getByText('3 家公司 · 3 个证券')).toBeTruthy();
    expect(screen.getByText('比较基准：未接入')).toBeTruthy();
    expect(screen.getByText(/价格为原来源 close 留存值，复权口径未确认/)).toBeTruthy();
    expect(screen.queryByText(/85 分|景气总分|全行业/)).toBeNull();
  });
  it('selects companies, sorts returns, changes window and uses existing callbacks', () => {
    const { onOpenStock, onOpenMetrics } = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: '对照中远海能' }));
    expect(screen.getByText('2 家公司 · 2 个证券')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: '动态观察时间窗口' }), { target: { value: '30' } });
    expect(screen.getByText('近 30 自然日 · 同一起止日比较')).toBeTruthy();
    const table = within(screen.getByRole('region', { name: '公司表可横向滚动' })).getByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: /5期/ }));
    expect(table.querySelector('[aria-sort="descending"]')?.textContent).toContain('5期');
    fireEvent.click(within(table).getByRole('button', { name: '招商南油' })); expect(onOpenStock.mock.calls[0][0].id).toBe('cm-nanjing');
    fireEvent.click(screen.getByRole('button', { name: '查看指标、事件与证据' })); expect(onOpenMetrics).toHaveBeenCalledOnce();
  });
  it('opens original Evidence Drawer and audit, and keeps missing stocks visible', () => {
    const pool = fixture(); pool[1].priceHistorySource = undefined;
    setup(pool);
    expect(screen.getByText('所选股票缺少可用历史。')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '来源与证据' })[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText(/当前图表没有可验证的正式证据关联/)).toBeTruthy();
  });
  it('handles empty and insufficient history and keeps stale/conflicts visible', () => {
    setup([]); expect(screen.getByText('当前研究池暂无证券')).toBeTruthy(); expect(screen.getByText('股票历史不足')).toBeTruthy();
    cleanup(); const pool = fixture(); pool[0].priceHistorySource!.quality.status = 'stale'; pool[1].priceHistorySource!.quality.status = 'conflicted'; setup(pool);
    expect(screen.getByText(/股票留存数据超过 7 个自然日/)).toBeTruthy(); expect(screen.getByText(/股票存在同日冲突/)).toBeTruthy();
  });
  it('renders an isolated synthetic freight series with its own unit, frequency and publication', () => {
    const owner = syntheticFreight();
    owner.definition.canonicalName = 'synthetic 运价测试'; owner.definition.freshness = 'FRESH'; owner.definition.staleAfter = '2026-10-01';
    // Fixture only: no real owner is altered or wired as freight.
    setup(fixture(), owner);
    expect(screen.getByRole('region', { name: '运价趋势' })).toBeTruthy();
    expect(screen.getAllByText(/synthetic 运价测试/).length).toBeGreaterThan(0);
    expect(screen.getByText('数据不足')).toBeTruthy();
  });
});
