// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CitationList } from './CitationList';
import type { BrowserSource, SourceCitation } from '../../types/knowledgeIngestion';

afterEach(cleanup);
const source: BrowserSource = {
  sourceId: 'source-exact', batchId: 'batch-fixture', filename: '公开材料.txt', mime: 'text/plain',
  size: 30, sha256: 'retained-byte-digest', capturedAt: '2026-09-20T00:00:00Z', rawRef: 'fixture-only', kind: 'text',
  parse: { status: 'parsed', segments: [{ locator: 'line:3', label: '第 3 行', text: '行业前景仍待验证。' }], error: null, parsedAt: null },
};
const citation: SourceCitation = { sourceRef: { schemaVersion: 'research-source-ref.v1', sourceDomain: 'browser-source', sourceId: source.sourceId }, locator: 'line:3', quote: '行业前景仍待验证。' };

describe('CitationList', () => {
  it('shows exact source and locator with quote, unknown publication time and folded technical identity', () => {
    const open = vi.fn();
    const { container } = render(<CitationList citations={[citation]} sources={[source]} onOpenSource={open} />);
    fireEvent.click(screen.getByText('公开材料.txt · 第 3 行'));
    expect(screen.getByText(citation.quote)).toBeVisible();
    expect(screen.getByText(/发布日期未登记/)).toBeVisible();
    expect(screen.getByText(/未单独登记支持或限制关系/)).toBeVisible();
    expect(container.querySelector('details details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: '打开已保存原文' }));
    expect(open).toHaveBeenCalledWith(source);
    expect(screen.queryByText('E1')).toBeNull();
  });

  it('does not resolve the same sourceId from a different owner or guess a missing locator', () => {
    render(<CitationList citations={[{ ...citation, sourceRef: { ...citation.sourceRef, sourceDomain: 'foreign-owner' } }, { ...citation, locator: 'line:99' }]} sources={[source]} />);
    expect(screen.getByText(/没有与此引用身份匹配的来源/)).toBeInTheDocument();
    expect(screen.getByText(/尚未找到此引用对应的原文片段/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an explicitly supplied proposal change without upgrading it to verified support', () => {
    render(<CitationList citations={[citation]} sources={[source]} context="风险与待验证问题：降低确信度，仍缺独立来源" />);
    fireEvent.click(screen.getByText('公开材料.txt · 第 3 行'));
    expect(screen.getByText('提议登记的关联变化（尚未核验）：风险与待验证问题：降低确信度，仍缺独立来源')).toBeVisible();
    expect(screen.getByText(/未单独登记支持或限制关系/)).toBeVisible();
  });

  it('renders hostile names and quotes as text and handles no citations explicitly', () => {
    const { container, rerender } = render(<CitationList citations={[{ ...citation, quote: '<img src=x onerror=alert(1)>' }]} sources={[{ ...source, filename: '<script>alert(1)</script>' }]} />);
    expect(container.querySelector('script, img, [onerror]')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    rerender(<CitationList citations={[]} sources={[]} />);
    expect(screen.getByText('此提议未登记可定位引文。')).toBeVisible();
  });
});
