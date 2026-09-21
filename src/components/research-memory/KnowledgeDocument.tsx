import { memo, useId, useMemo, useRef } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './knowledge-document.css';

type ReadingNode = {
  type: string; tagName?: string; value?: string; children?: ReadingNode[];
  properties?: Record<string, string | number | boolean>;
};
const nodeText = (node: ReadingNode): string => node.value ?? node.children?.map(nodeText).join('') ?? '';
const element = (tagName: string, children: ReadingNode[], properties: ReadingNode['properties'] = {}): ReadingNode => ({ type: 'element', tagName, properties, children });

/** Derive navigation and heading IDs from rendered Markdown, including setext headings. */
function readingOutline(prefix: string) {
  return () => (tree: ReadingNode) => {
    const headings: Array<{ id: string; title: string; depth: number }> = [];
    function visit(node: ReadingNode) {
      if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const id = `${prefix}-section-${headings.length + 1}`;
        node.properties = { ...node.properties, id, tabIndex: -1 };
        headings.push({ id, title: nodeText(node), depth: Number(node.tagName.slice(1)) });
      }
      node.children?.forEach(visit);
    }
    visit(tree);
    tree.children = [element('article', tree.children ?? [], { className: 'knowledge-document__body', ariaLabel: '文章正文' })];
    if (headings.length < 2) return;
    const items = headings.map(heading => element('li', [element('a', [{ type: 'text', value: heading.title || '未命名章节' }], { href: `#${heading.id}` })], { className: heading.depth > 2 ? 'knowledge-document__toc-child' : '' }));
    tree.children.unshift(element('details', [
      element('summary', [{ type: 'text', value: `文章目录 · ${headings.length} 节` }]),
      element('nav', [element('ol', items)], { ariaLabel: '文章目录' }),
    ], { className: 'knowledge-document__toc' }));
  };
}

/** Presentation only: no raw HTML, MDX evaluation, embeds or changes to stored Markdown. */
export const KnowledgeDocument = memo(function KnowledgeDocument({ text }: { text: string }) {
  const prefix = useId().replace(/:/g, '');
  const root = useRef<HTMLDivElement>(null);
  const outline = useMemo(() => readingOutline(`reading-${prefix}`), [prefix]);
  const components = useMemo<Components>(() => ({
    a: ({ href, children }) => {
      if (href?.startsWith('#')) return <a href={href} onClick={event => {
        event.preventDefault();
        const target = document.getElementById(href.slice(1));
        if (target && root.current?.contains(target)) {
          target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
          target.focus({ preventScroll: true });
        }
      }}>{children}</a>;
      return href && /^(https?:\/\/|mailto:)/i.test(href)
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>;
    },
    // Reading a document must not automatically contact image/embedding hosts.
    img: ({ alt }) => <span className="text-textMuted">{alt || '图片'}</span>,
    table: ({ children }) => <div role="region" aria-label="正文表格（可横向滚动）" tabIndex={0} className="max-w-full overflow-x-auto knowledge-document__table"><table>{children}</table></div>,
  }), []);
  return <div ref={root} className="knowledge-document">
    {/\bE\d+\b/.test(text) && <p className="knowledge-document__citation-note">正文的 E 编号按原稿保留，未按列表顺序绑定来源。请结合已登记来源核对引用。</p>}
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[outline]} skipHtml components={components}>{text}</Markdown>
  </div>;
});
