import type { ChartAuditView } from '../../services/chartAudit';
import { safeEvidenceUrl } from '../../utils/evidenceUrl';
import { auditDisplayText } from '../../utils/displayLabels';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';

type Rows = ChartAuditView['rows'];
// Explicit display allowlist. New engineering fields remain available in the raw audit.
const publicLabels: Record<string, string> = {
  '候选结论': '事实性候选结论', '证据链状态': '证据链状态',
  '单位 / 币种': '单位 / 币种', '单位 / 原生频率 / 口径': '单位 / 频率 / 口径', '期间口径 / 原生频率': '期间口径 / 频率',
  '观测日期范围': '观测日期范围', '观测期间（非发布时间）': '观测期间（非发布时间）', '窗口完整性': '窗口完整性',
  '历史覆盖': '历史覆盖', freshness: '数据新鲜度', '数据准入': '数据准入', '生产准入': '生产准入',
  '严格 PIT / 官方修订连续性': '历史时点可得性（PIT） / 官方修订连续性', '严格 PIT': '历史时点可得性（PIT）',
  '公开可得时间 releaseAvailableAt': '公开可得时间', '公开可得 releaseAvailableAt': '公开可得时间',
  '页面标注 publicationDateTime': '页面标注发布时间', '发布时间 announcementDate': '标注发布时间', '发布时间': '标注发布时间',
  '数据更新时间（非发布）': '数据更新时间（非发布）', '来源身份': '来源机构', 'source owner': '来源机构',
  '来源 HTTP(S)': '来源链接', '官方来源': '官方来源', '数值完整性': '数值完整性', '图表数值完整性': '数值完整性',
  '计算': '计算口径与限制', '转换 / 公式': '转换 / 公式', '不匹配记录数': '不匹配记录数',
  '期间口径': '期间口径', '报表范围': '报表范围', '原生频率': '频率', '参考期': '参考期',
  '值': '值', '原始记录值（冲突时不绘制）': '原始记录值（冲突时不绘制）', '质量': '质量', '解析状态': '解析状态',
  '报告期（非发布时间）': '报告期（非发布时间）', '报告类型': '报告类型', '报告质量': '报告质量',
  '期间 / asOf（观测期间，非公开可得时间）': '观测期间（非公开可得时间）', '使用边界': '使用限制',
  'PIT / data / production': '历史时点可得性（PIT） / 数据准入 / 生产准入',
  'Evidence Graph / revision continuity': '证据关联 / 修订连续性',
};
function AuditRows({ rows, raw = false }: { rows: Rows; raw?: boolean }) {
  return <dl className="grid min-w-0 gap-x-5 gap-y-3 sm:grid-cols-2">{rows.map((row, index) => <div key={`${row.label}-${index}`} className="min-w-0"><dt className="text-textMuted">{row.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-textStrong">{safeEvidenceUrl(row.href) ? <a href={row.href} target="_blank" rel="noreferrer" className="text-accent underline">{raw ? row.value : '打开来源页面'}</a> : row.value}</dd></div>)}</dl>;
}
function publicRows(rows: Rows): Rows {
  return rows.flatMap(row => {
    if (publicLabels[row.label]) return [{ ...row, label: publicLabels[row.label], value: row.href ? row.value : auditDisplayText(row.value) }];
    if (/^(operatingRevenue|netProfitAttributableToParent|netOperatingCashFlow)（/.test(row.label)) return [{ ...row, label: auditDisplayText(row.label) }];
    // Industry event audit already contains these exact retained payloads. Extract only
    // display fields, never resolve an owner, select revisions or infer admission.
    if (row.value.startsWith('{')) {
      try {
        const item = JSON.parse(row.value);
        if (row.label === '原始 observation（冲突值仅核对）') {
          const fields = [
            ['观测日期', item.valueDate], ['单位', item.unit], ['来源机构', item.provenance?.sourceOwner],
            ['页面标注发布时间', item.publicationDateTime], ['公开可得时间', item.releaseAvailableAt],
            ['历史时点可得性（PIT）', item.pit], ['数据准入', item.dataAdmission], ['生产准入', item.productionAdmission],
          ];
          return fields.map(([label, value]) => ({ label, value: auditDisplayText(value == null ? '未确认' : String(value)) }));
        }
        if (Object.prototype.hasOwnProperty.call(item, 'value') && Object.prototype.hasOwnProperty.call(item, 'deltaSemantics')) {
          const value = typeof item.value === 'number' && Number.isFinite(item.value) ? String(item.value) : '暂缺';
          return [{ label: row.label, value: `${value} ${auditDisplayText(item.unit ?? '')}；${auditDisplayText((item.conditions ?? []).join(' / '))}` }];
        }
      } catch { /* Raw content remains available below, without a guessed summary. */ }
    }
    return [];
  });
}
export function ChartAuditPanel({ audit, expanded = false }: { audit: ChartAuditView; expanded?: boolean }) {
  const content = <div className="space-y-4 p-3">
    <p className="break-words font-semibold">{auditDisplayText(audit.title.split(' · ')[0])}</p>
    <p className="text-warning">{audit.quality.map(auditDisplayText).join(' / ')}</p>
    <AuditRows rows={publicRows(audit.rows)} />
    {audit.rows.some(row => /错误/.test(row.label) && !row.value.startsWith('未提供')) ? <p className="text-warning">数据存在错误，使用受限；完整诊断见高级审计信息。</p> : null}
    {audit.records.map((record, index) => {
      const rows = publicRows(record.rows);
      return rows.length ? <section key={index} className="min-w-0 rounded border border-borderSoft p-3"><h4 className="mb-3 font-medium">{auditDisplayText(record.title.split(' · ')[0])}</h4><AuditRows rows={rows} /></section> : null;
    })}
    <p className="text-warning">{audit.candidateGraph ? '候选证据引用链已建立，正式支持资格未通过' : '当前图表没有可验证的正式证据关联'}</p>
    <p className="text-textMuted">{audit.candidateGraph ? '可沿候选结论、派生公式及输入引用核对原始观测。留存来源引用不证明历史时点可得性、官方修订连续性或生产准入。' : '当前数据未提供指标、研究对象和修订版本的精确证据引用。相关事件或留存来源不等于正式图表证据；来源链接不证明历史时点可得性（PIT）或证据关联闭合。'}</p>
    <AdvancedAuditDetails>
      <p>{audit.title}</p><p>研究对象：{audit.scope}</p><p>原始状态：{audit.quality.join(' / ')}</p>
      <AuditRows rows={audit.rows} raw />
      {audit.records.map((record, index) => <section key={index} className="min-w-0 space-y-3 border-t border-borderSoft pt-3"><h4>{record.title}</h4><AuditRows rows={record.rows} raw /></section>)}
    </AdvancedAuditDetails>
  </div>;
  return expanded ? <section className="chart-audit min-w-0 text-xs" aria-label="图表来源与证明">{content}</section> : <details className="chart-audit mt-3 min-w-0 rounded-md border border-control bg-panel text-xs" aria-label="图表审计元数据"><summary className="min-h-11 cursor-pointer px-3 py-3 text-accent">核对图表来源与证明 · {audit.quality.map(auditDisplayText).join(' / ')}</summary>{content}</details>;
}
