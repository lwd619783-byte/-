import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan underline underline-offset-2">{children}</a>
    : <span>{children}</span>,
  // Reading a document must not automatically contact image/embedding hosts.
  img: ({ alt }) => <span className="text-textMuted">{alt || '图片'}</span>,
  table: ({ children }) => <div role="region" aria-label="正文表格（可横向滚动）" tabIndex={0} className="max-w-full overflow-x-auto rounded border border-borderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan">
    <table className="min-w-full border-collapse text-left">{children}</table>
  </div>,
};

/** Presentation only: no raw HTML, MDX evaluation, embeds or changes to stored Markdown. */
export function KnowledgeDocument({ text }: { text: string }) {
  return <div className="min-w-0 max-w-full space-y-3 break-words text-sm leading-7 [overflow-wrap:anywhere] [&_h1]:pt-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_p]:whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-borderSoft [&_blockquote]:pl-4 [&_blockquote]:text-textMuted [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-bg2 [&_pre]:p-3 [&_pre]:leading-6 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-bg2 [&_code]:px-1 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_th]:min-w-32 [&_th]:border-b [&_th]:border-borderSoft [&_th]:bg-bg2 [&_th]:px-3 [&_th]:py-2 [&_td]:min-w-32 [&_td]:border-b [&_td]:border-borderSoft [&_td]:px-3 [&_td]:py-2">
    <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>{text}</Markdown>
  </div>;
}
