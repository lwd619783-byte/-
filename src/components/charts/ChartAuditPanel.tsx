import type { ChartAuditView } from "../../services/chartAudit";
import { safeEvidenceUrl } from "../../utils/evidenceUrl";

function AuditRows({ rows }: { rows: ChartAuditView["rows"] }) {
  return <dl className="grid min-w-0 gap-x-5 gap-y-3 sm:grid-cols-2">{rows.map((row, index) => <div key={`${row.label}-${index}`} className="min-w-0"><dt className="text-textMuted">{row.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-textStrong">{safeEvidenceUrl(row.href) ? <a href={row.href} target="_blank" rel="noreferrer" className="text-accent underline">{row.value}</a> : row.value}</dd></div>)}</dl>;
}
export function ChartAuditPanel({ audit }: { audit: ChartAuditView }) {
  return <details className="chart-audit mt-3 min-w-0 rounded-md border border-control bg-panel text-xs" aria-label="图表审计元数据">
    <summary className="min-h-11 cursor-pointer px-3 py-3 text-accent">核对图表来源与证明 · {audit.quality.join(" / ")}</summary>
    <div className="space-y-4 border-t border-borderSoft p-3">
      <p className="break-words font-semibold">{audit.title}</p><p className="break-words">研究对象：{audit.scope}</p>
      <AuditRows rows={audit.rows} />
      {audit.records.map((record, index) => <details key={`${record.title}-${index}`} className="rounded border border-borderSoft p-3"><summary className="min-h-11 cursor-pointer break-words text-accent">{record.title}</summary><AuditRows rows={record.rows}/></details>)}
      <p className="text-warning">当前图表没有可验证的 Evidence linkage</p>
      <p className="text-textMuted">当前 owner 未提供可证明的 metric / entity / revision 精确证据引用。相关事件或留存来源不等于正式图表证据；来源链接不证明 PIT 或 Evidence Graph。</p>
    </div>
  </details>;
}
