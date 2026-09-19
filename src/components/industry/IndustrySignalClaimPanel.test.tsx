// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IndustrySignalClaimPanel } from './IndustrySignalClaimPanel';
import { loadIndustrySignalClaims } from '../../services/industrySignalClaimProvider';
import type { IndustrySignalClaims } from '../../services/industrySignalClaim.mjs';
import type { IndustryMetricProvider, RegisteredIndustryMetric } from '../../services/industryMetricRegistry.mjs';
import derived from '../../../research-data/industry/signal-claim-v1/derived.json';
import graphBundle from '../../../research-data/industry/signal-claim-v1/graphs.json';
import registry from '../../../config/industry/industry-metric-registry.v1.json';
const owners = import.meta.glob('/src/data/real/industry-*.generated.json', { eager: true, import: 'default' });
const metrics: RegisteredIndustryMetric[] = registry.entries.map(entry => ({
  entry: { ...entry, presentation: { ...entry.presentation, delta: entry.presentation.delta === 'none' ? 'none' : 'absolute_difference',
    basisLabels: Object.fromEntries(Object.entries(entry.presentation.basisLabels).filter((pair): pair is [string, string] => typeof pair[1] === 'string')) } },
  owner: Object.values(owners).find(o => (o as RegisteredIndustryMetric['owner']).definition.id === entry.metricId) as RegisteredIndustryMetric['owner'], binding: null,
}));
const provider: IndustryMetricProvider = { get: (id, metricId) => metrics.find(m => m.entry.industryId === id && m.entry.metricId === metricId) ?? null, list: id => metrics.filter(m => m.entry.industryId === id) };
const result = { derived, ...graphBundle, resolvePin: () => { throw new Error('UI fixture does not resolve pins'); } } as unknown as IndustrySignalClaims;
vi.mock('../../services/industrySignalClaimProvider', async original => {
  const actual = await original<typeof import('../../services/industrySignalClaimProvider')>();
  return { ...actual, loadIndustrySignalClaims: vi.fn(async () => ({ status: 'available', result, provider })) };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('renders Chinese retained changes/candidates and abstention; exact two operands in existing Drawer', async () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  render(<IndustrySignalClaimPanel industryId="oil-shipping" />);
  await screen.findByText('景气判断资格：暂不具备条件');
  expect(screen.getAllByRole('article')).toHaveLength(4);
  expect(screen.getByText(/当前留存快照中，美国原油出口/).textContent).toContain('1414 千桶/日');
  expect(screen.getByText('缺失维度：价格')).toBeTruthy();
  const row = screen.getByText(/当前留存快照中，美国原油出口/).closest('article')!;
  fireEvent.click(within(row).getByRole('button', { name: '查看完整证据链' }));
  const drawer = await screen.findByRole('dialog');
  expect(drawer.textContent).toContain('候选结论 → 派生信号');
  expect(drawer.textContent).toContain('2026-09-04'); expect(drawer.textContent).toContain('2026-09-11');
  expect(drawer.textContent).toContain('原始字节 SHA-256'); expect(drawer.textContent).toContain('table.FloatTitle');
  expect(within(drawer).getAllByRole('link').filter(link => !link.closest('[data-advanced-audit]'))).toHaveLength(2);
  expect(within(drawer).getAllByRole('link')[0].getAttribute('href')).toContain('WCREXUS2');
  expect((drawer.querySelector('[data-advanced-audit]') as HTMLDetailsElement).open).toBe(false);
  expect(drawer.textContent).toContain('evidence-graph.v1'); expect(drawer.textContent).toContain('input_to');
  expect(writes).not.toHaveBeenCalled();
});
it('industry change clears Drawer and never borrows an oil formula', async () => {
  const { rerender } = render(<IndustrySignalClaimPanel industryId="oil-shipping" />);
  fireEvent.click((await screen.findAllByRole('button', { name: '查看完整证据链' }))[0]);
  await screen.findByRole('dialog'); rerender(<IndustrySignalClaimPanel industryId="robotics" />);
  await screen.findByText(/官方同比与累计值未登记派生公式/);
  expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByText('1,414')).toBeNull(); expect(screen.getByText('-2,503')).toBeTruthy();
  rerender(<IndustrySignalClaimPanel industryId="foreign" />);
  await screen.findByText('当前行业尚无已审查的派生公式。'); expect(screen.queryByRole('article')).toBeNull();
});
it('fail-closed service failure has no candidate or misleading eligibility', async () => {
  vi.mocked(loadIndustrySignalClaims).mockResolvedValueOnce({ status: 'blocked', reason: 'SIGNAL_POLICY_REVIEW_DRIFT' });
  render(<IndustrySignalClaimPanel industryId="oil-shipping" />);
  await screen.findByText('公式或证据核验未通过，暂不生成候选结论。');
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.getByText('SIGNAL_POLICY_REVIEW_DRIFT').closest('details')?.open).toBe(false);
});
