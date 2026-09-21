import { BROWSER_SOURCE_DOMAIN, type BrowserSource, type SourceCitation } from '../../types/knowledgeIngestion';

/** Exact source identity only. Citation order never supplies an E-number mapping. */
export function CitationList({ citations, sources, onOpenSource, context }: {
  citations: readonly SourceCitation[];
  sources: readonly BrowserSource[];
  onOpenSource?: (source: BrowserSource) => void;
  /** Exact proposal change wording, never an inferred support/limitation claim. */
  context?: string;
}) {
  if (!citations.length) return <p className="text-sm text-textMuted">此提议未登记可定位引文。</p>;
  return <div className="space-y-3">
    {citations.map((citation, index) => {
      const source = citation.sourceRef.sourceDomain === BROWSER_SOURCE_DOMAIN
        ? sources.find(row => row.sourceId === citation.sourceRef.sourceId) : undefined;
      const segment = source?.parse.segments.find(row => row.locator === citation.locator);
      return <details key={`${citation.sourceRef.sourceDomain}:${citation.sourceRef.sourceId}:${citation.locator}:${index}`} className="min-w-0 rounded border border-borderSoft p-3">
        <summary className="min-h-11 cursor-pointer break-words text-sm font-medium">{source?.filename ?? '来源不可用'} · {segment?.label ?? '原文位置未解析'}</summary>
        <div className="mt-2 space-y-3">
          <p className="text-xs text-textMuted">发布日期未登记。保存时间不代表来源发布时间。</p>
          {!source && <p className="text-sm text-warning">当前资料中没有与此引用身份匹配的来源，无法打开原文。</p>}
          {source && !segment && <p className="text-sm text-warning">已找到来源，尚未找到此引用对应的原文片段。</p>}
          <blockquote className="whitespace-pre-wrap break-words border-l-2 border-borderSoft pl-3 text-base leading-8">{citation.quote}</blockquote>
          {context && <p className="break-words text-sm">提议登记的关联变化（尚未核验）：{context}</p>}
          <p className="text-xs text-textMuted">此引用未单独登记支持或限制关系，请结合正文与原文核对；展示引文不代表事实已证实。</p>
          {source && onOpenSource && <button className="inbox-action" onClick={() => onOpenSource(source)}>打开已保存原文</button>}
          <details>
            <summary className="min-h-11 cursor-pointer text-xs text-textMuted">技术信息</summary>
            <dl className="space-y-1 break-all text-xs text-textMuted">
              <div><dt className="inline">来源域：</dt><dd className="inline">{citation.sourceRef.sourceDomain}</dd></div>
              <div><dt className="inline">资料标识：</dt><dd className="inline">{citation.sourceRef.sourceId}</dd></div>
              <div><dt className="inline">原文定位：</dt><dd className="inline">{citation.locator}</dd></div>
              {source && <>
                <div><dt className="inline">原件 SHA-256：</dt><dd className="inline">{source.sha256}</dd></div>
                <div><dt className="inline">保存时间：</dt><dd className="inline">{source.capturedAt}</dd></div>
                <div><dt className="inline">解析状态：</dt><dd className="inline">{{ pending: '等待解析', parsed: '已解析', failed: '解析失败' }[source.parse.status]}</dd></div>
              </>}
            </dl>
          </details>
        </div>
      </details>;
    })}
  </div>;
}
