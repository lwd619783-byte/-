// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { EvidenceDrawer } from './EvidenceDrawer';
import { industryChartAudit } from '../../services/industryMetricProvider';
import eia from '../../data/real/industry-eia-commercial-crude-stocks.generated.json';
import type { IndustryMetricDataset } from '../../types/industryMetric';
import { createReviewFixtures } from '../../ui-review/fixtures';
import type { ChartAuditView } from '../../services/chartAudit';

afterEach(cleanup);
it('shows Chinese EIA facts and safe links while retaining exact pins and original rows behind a closed disclosure', () => {
  const owner = eia as IndustryMetricDataset;
  const before = JSON.stringify(owner);
  render(<EvidenceDrawer audit={industryChartAudit(owner, 'week_ending')} onClose={() => {}} />);
  const drawer = screen.getByRole('dialog');
  expect(within(drawer).getAllByText('美国能源信息署（EIA）', { exact: true })[0]).toBeVisible();
  const details = drawer.querySelector<HTMLDetailsElement>('[data-advanced-audit]')!;
  expect(details.open).toBe(false);
  expect(within(details).getAllByText(owner.definition.id, { exact: true })[0]).not.toBeVisible();
  expect(within(details).getAllByText(owner.observations[0].provenance.rawSha256, { exact: true })[0]).not.toBeVisible();
  expect(within(drawer).getAllByRole('link').every(link => link.getAttribute('href')?.startsWith('https://www.eia.gov/'))).toBe(true);
  fireEvent.click(within(details).getByText('高级审计信息 / 技术详情'));
  expect(details.open).toBe(true);
  expect(within(details).getAllByText(owner.observations[0].provenance.rawSha256, { exact: true })[0]).toBeVisible();
  expect(JSON.stringify(owner)).toBe(before);
});
it('keeps zero, missing values, conflicts and distinct publication clocks without exposing technical JSON', () => {
  const audit: ChartAuditView = { title: '原始数值', scope: 'internal-owner', quality: ['conflicted', 'not_admitted', 'unknown'], linkage: null,
    rows: [{ label: '值', value: '0' }, { label: '公开可得 releaseAvailableAt', value: '未提供 / unknown' }, { label: '页面标注 publicationDateTime', value: '2026-09-11' }, { label: 'Artifact pin', value: '{"sha256":"original-hash"}' }], records: [] };
  render(<EvidenceDrawer audit={audit} onClose={() => {}} />);
  expect(screen.getAllByText('0')[0]).toBeVisible();
  expect(screen.getByText('冲突 / 尚未准入 / 未确认')).toBeVisible();
  expect(screen.getAllByText('2026-09-11')[0]).toBeVisible();
  expect(screen.getByText('{"sha256":"original-hash"}')).not.toBeVisible();
  expect(screen.getByText('公开可得时间')).toBeVisible();
  expect(screen.getByText('未提供 / 未确认')).toBeVisible();
});
it('keeps event identity and provenance hidden while showing ordinary evidence and preserving the event', () => {
  const fixture = createReviewFixtures('full'), event = fixture.snapshot.events[0];
  const before = JSON.stringify(event);
  render(<EvidenceDrawer events={[event]} stocks={fixture.companies} onClose={() => {}} onOpenStock={() => {}} />);
  expect(screen.getByText(event.id, { exact: true })).not.toBeVisible();
  const details = screen.getByText(event.id, { exact: true }).closest('details')!;
  fireEvent.click(within(details).getByText('高级审计信息 / 技术详情'));
  expect(screen.getByText(event.id, { exact: true })).toBeVisible();
  expect(JSON.stringify(event)).toBe(before);
});
