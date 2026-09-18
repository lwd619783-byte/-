// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IndustrySnapshotPanel } from './IndustrySnapshotPanel';
import { loadIndustrySnapshot, SNAPSHOT_NOTICE } from '../../services/industrySnapshot';
import mapping from '../../../config/industry/industry-dimension-mapping.v1.json';
import registry from '../../../config/industry/industry-metric-registry.v1.json';
import production from '../../data/real/industry-eia-production.generated.json';
import exportsOwner from '../../data/real/industry-eia-exports.generated.json';
import refinery from '../../data/real/industry-eia-refinery-input.generated.json';
import inventory from '../../data/real/industry-eia-commercial-crude-stocks.generated.json';
import type { IndustryDimensions, IndustryDimensionEntry } from '../../services/industryDimensions.mjs';
import type { IndustryMetricDataset } from '../../types/industryMetric';
// UI fixture only, exact committed values; real digest/identity/replay run in Node/service/browser gates.
const dimensions: IndustryDimensions = { schemaVersion: 'industry-dimension-mapping.v1', revision: '1', list: (id: string) =>
  (mapping.entries as IndustryDimensionEntry[]).filter(e => e.industryId === id && id === 'oil-shipping').map(e => {
    const entry = registry.entries.find(r => r.metricId === e.metricId)!;
    return { mapping: e, metric: {
      entry: { ...entry, presentation: { ...entry.presentation, delta: 'none', basisLabels: { week_ending: entry.presentation.basisLabels.week_ending! } } },
      owner: [production, exportsOwner, refinery, inventory].find(o => o.definition.id === e.metricId)! as IndustryMetricDataset, binding: null,
    } };
  }) };
vi.mock('../../services/industrySnapshot', async original => {
  const actual = await original<typeof import('../../services/industrySnapshot')>();
  return { ...actual, loadIndustrySnapshot: vi.fn(async (id: string) => ({ status: 'available', snapshot: actual.industrySnapshot(id, dimensions) })) };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('Chinese groups, four real owners, retained units/periods and candidate Evidence without writes', async () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  render(<IndustrySnapshotPanel industryId="oil-shipping" />);
  await screen.findByRole('region', { name: '供给维度' });
  const panel = screen.getByRole('region', { name: '多因子基本面快照' });
  expect(within(panel).getByText(SNAPSHOT_NOTICE)).toBeTruthy();
  expect(panel.querySelectorAll('article')).toHaveLength(4);
  expect(panel.textContent).toContain('13,944'); expect(panel.textContent).toContain('千桶/日');
  expect(panel.textContent).toContain('未接入维度（缺失）'); expect(panel.textContent).toContain('发布时间：未证明');
  const advanced = panel.querySelector('[data-advanced-audit]') as HTMLDetailsElement;
  expect(advanced.open).toBe(false);
  fireEvent.click(within(panel).getAllByRole('button')[0]);
  const drawer = screen.getByRole('dialog');
  expect(drawer.textContent).toContain('US_EIA_CRUDE_PRODUCTION');
  expect(drawer.textContent).toContain('原始字节 SHA-256'); expect(drawer.textContent).toContain('candidate');
  expect(drawer.textContent).toContain('industry-dimension-mapping.v1');
  expect(within(drawer).getAllByRole('link')[0].getAttribute('href')).toContain('www.eia.gov');
  expect(writes).not.toHaveBeenCalled();
});
it('industry switch removes oil data and open drawer; missing never borrows metrics', async () => {
  const { rerender } = render(<IndustrySnapshotPanel industryId="oil-shipping" />);
  await screen.findByRole('region', { name: '供给维度' });
  fireEvent.click(screen.getAllByRole('button')[0]); expect(screen.getByRole('dialog')).toBeTruthy();
  rerender(<IndustrySnapshotPanel industryId="innovative-drug" />);
  await screen.findByText('当前行业尚无已映射的正式基本面指标。');
  expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByText('13,944')).toBeNull();
});
it('mapping failure shows blocked with reason only in advanced audit, no numbers', async () => {
  vi.mocked(loadIndustrySnapshot).mockResolvedValueOnce({ status: 'blocked', reason: 'DIMENSION_REVIEW_DRIFT' });
  render(<IndustrySnapshotPanel industryId="oil-shipping" />);
  await screen.findByText('维度映射校验未通过，快照暂不可用。');
  expect(screen.getByText('DIMENSION_REVIEW_DRIFT').closest('details')?.open).toBe(false);
  expect(screen.queryByRole('article')).toBeNull();
});
