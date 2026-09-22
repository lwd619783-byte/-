// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(within(screen.getByRole('article', { name: '文章正文' })).getAllByRole('listitem')).toHaveLength(4);
    expect(container.querySelector('article ol')).toHaveAttribute('start', '3');
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

  it('derives a keyboard-operable outline from actual headings without changing route hash', () => {
    render(<KnowledgeDocument text={'旧版文章\n===\n\n## **同名**章节\n\n```md\n## 不是标题\n```\n\n## 同名章节'} />);
    fireEvent.click(screen.getByText('文章目录 · 3 节'));
    const outline = screen.getByRole('navigation', { name: '文章目录' });
    const links = within(outline).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[1]).toHaveTextContent('同名章节');
    expect(links[1].getAttribute('href')).not.toBe(links[2].getAttribute('href'));
    const hash = window.location.hash;
    fireEvent.click(links[2]);
    expect(screen.getAllByRole('heading', { level: 2 })[1]).toHaveFocus();
    expect(window.location.hash).toBe(hash);
  });

  it('keeps heading targets unique when current and proposed articles render together', () => {
    const { container } = render(<><KnowledgeDocument text={'## 当前\n\n## 风险'} /><KnowledgeDocument text={'## 当前\n\n## 风险'} /></>);
    const ids = [...container.querySelectorAll('h2')].map(heading => heading.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('preserves all six legacy sections and source metadata without inventing E-number links', () => {
    const sections = ['核心判断', '产业与主题结构', '近期变化', '关键公司与环节', '风险与待验证问题', '来源'];
    const text = sections.map(title => `## ${title}\n\n原始内容 [E7]。`).join('\n\n') + '\n\n来源日期：未知。parsedTextSha: abc123';
    const { container } = render(<KnowledgeDocument text={text} />);
    expect(screen.getByText(/未按列表顺序绑定来源/)).toBeVisible();
    const article = screen.getByRole('article', { name: '文章正文' });
    for (const title of sections) expect(within(article).getByRole('heading', { name: title })).toBeVisible();
    expect(article).toHaveTextContent('来源日期：未知。parsedTextSha: abc123');
    expect(container.querySelectorAll('article a')).toHaveLength(0);
  });

  it.each(['//example.com/tracker', '/other-route', 'file:///secret.txt'])('does not promote unvalidated URL %s to a link', url => {
    render(<KnowledgeDocument text={`[原文](${url})`} />);
    expect(screen.getByText('原文')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
