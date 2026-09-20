/** Safe readable Markdown subset. Raw HTML/remote embeds are never interpreted. */
export function KnowledgeDocument({ text }: { text: string }) {
  return <div className="space-y-3 break-words text-sm leading-7 [overflow-wrap:anywhere]">{text.split(/\n\s*\n/).map((block, index) => {
    if (/^#{1,3} /.test(block) && !block.includes('\n')) return <h4 key={index} className="pt-2 text-base font-semibold text-textStrong">{block.replace(/^#+ /, '')}</h4>;
    return <p key={index} className="whitespace-pre-wrap">{block}</p>;
  })}</div>;
}
