// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { KnowledgeDocument } from './KnowledgeDocument';

afterEach(cleanup);
describe('KnowledgeDocument', () => {
  it('renders Chinese headings, paragraphs, emphasis, lists, quotes and GFM tables', () => {
    const { container } = render(<KnowledgeDocument text={'# 光通信研究\n\n## 核心判断\n\n中文**重点**与*假设*。\n\n- 材料\n- 器件\n\n3. 核对来源\n4. 保留未知\n\n> 这是引用，不是已验证事实。\n\n| 环节 | 证据 |\n| --- | --- |\n| 光纤 | 公开原文 |'} />);
    expect(screen.getByRole('heading', { level: 1, name: '光通信研究' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '核心判断' })).toBeVisible();
    expect(container.querySelector('strong')).toHaveTextContent('重点');
    expect(container.querySelector('em')).toHaveTextContent('假设');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
    expect(container.querySelector('blockquote')).toHaveTextContent('这是引用');
    expect(within(screen.getByRole('table')).getByRole('cell', { name: '光纤' })).toBeVisible();
  });

  it('renders links and literal inline/fenced code without evaluating code', () => {
    const { container } = render(<KnowledgeDocument text={'[公开来源](https://example.com/report) 和 `a < b`\n\n```js\nwindow.__wikiExecuted = true;\n```'} />);
    expect(screen.getByRole('link', { name: '公开来源' })).toHaveAttribute('href', 'https://example.com/report');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('pre code')).toHaveTextContent('window.__wikiExecuted = true;');
    expect(container.querySelectorAll('code')).toHaveLength(2);
    expect('__wikiExecuted' in window).toBe(false);
  });

  it('does not render raw HTML, scripts, event handlers, JSX or remote embeds', () => {
    const { container } = render(<KnowledgeDocument text={'<script>window.__wikiExecuted = true</script>\n\n<img src="https://example.com/tracker" onerror="alert(1)">\n\n<iframe src="https://example.com"></iframe>\n\n<CustomComponent onClick={dangerous()} />\n\n![图片说明](https://example.com/image.png)\n\n安全中文正文'} />);
    expect(container.querySelector('script, img, iframe, customcomponent, [onerror]')).toBeNull();
    expect(screen.getByText('图片说明')).toBeVisible();
    expect(screen.getByText('安全中文正文')).toBeVisible();
    expect('__wikiExecuted' in window).toBe(false);
  });

  it.each(['javascript:alert%281%29', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox%281%29'])('rejects unsafe link protocol %s', url => {
    render(<KnowledgeDocument text={`[不可信链接](${url})`} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('不可信链接')).toBeVisible();
  });

  it('places long tables inside an independently scrollable keyboard-accessible container', () => {
    render(<KnowledgeDocument text={`| ${Array.from({ length: 12 }, (_, i) => `指标${i}`).join(' | ')} |\n| ${Array(12).fill('---').join(' | ')} |\n| ${Array(12).fill('很长的中文证据').join(' | ')} |`} />);
    const region = screen.getByRole('region', { name: '正文表格（可横向滚动）' });
    expect(region).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getAllByRole('columnheader')).toHaveLength(12);
  });

  it('preserves plain text line breaks and existing Markdown content without changing input', () => {
    const text = '普通中文第一行\n第二行\n\n## 历史文章\n\n旧内容 < 3，与未知时间保持不变。';
    const { container } = render(<KnowledgeDocument text={text} />);
    expect(container.querySelector('p')?.textContent).toBe('普通中文第一行\n第二行');
    expect(screen.getByRole('heading', { name: '历史文章' })).toBeVisible();
    expect(screen.getByText('旧内容 < 3，与未知时间保持不变。')).toBeVisible();
    expect(text).toContain('## 历史文章');
  });
});
