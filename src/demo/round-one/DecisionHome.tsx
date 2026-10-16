import { useState } from 'react';

export const decisionSamples = [
  { id: 'SYN-01', name: '合成公司 01', suggestion: '继续观察', condition: '下一份合成披露验证需求改善后，再复核论点。', dataDate: '2026-10-15', validUntil: '2026-10-16', knowledge: 'SYN-KB-01 · 需求验证笔记' },
  { id: 'SYN-02', name: '合成公司 02', suggestion: '等待补证', condition: '数据已过期；刷新合成现金流证据前不形成动作建议。', dataDate: '2026-09-01', validUntil: '2026-09-30', knowledge: 'SYN-KB-02 · 现金流核对' },
  { id: 'SYN-03', name: '合成公司 03', suggestion: '暂不行动', condition: '缺少合成行情和披露日期，无法评价当前机会。', dataDate: null, validUntil: null, knowledge: 'SYN-KB-03 · 待补资料清单' },
] as const;
export function decisionFreshness(dataDate: string | null, validUntil: string | null, asOf: string) {
  if (!dataDate || !validUntil || dataDate > asOf) return '未知 · 缺失或未来日期';
  return validUntil < asOf ? '未知 · 数据已过期' : '合成数据有效 · 非实时行情';
}

export function DecisionHome({ onKnowledge, onEvidence }: { onKnowledge: () => void; onEvidence: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  return <section className="round-one" aria-label="决策首页">
    <div className="os-heading"><div><p className="os-eyebrow">DECISION FIRST / 合成样例</p><h2>今天先决定什么</h2></div><span>演示观察日 2026-10-16</span></div>
    <p>建议是待复核的研究意见。用户确认只记录已阅读建议与条件，不代表买卖、成交或持仓变化。</p>
    <div className="os-summary"><div><strong>3</strong><span>待复核样例</span></div><div><strong>2</strong><span>当前数据未知</span></div><div><strong>{confirmed.length}</strong><span>用户已确认阅读</span></div></div>
    <div className="os-cards">{decisionSamples.map(card => <article key={card.id} className="os-card" aria-label={card.name}>
      <p className="os-eyebrow">{card.id} · SYNTHETIC</p><h3>{card.name}</h3>
      <p className="os-conclusion">建议 · {card.suggestion}</p>
      <dl><dt>生效条件 / 下一步</dt><dd>{card.condition}</dd><dt>数据日期</dt><dd>{card.dataDate ?? '未知 · 尚无数据'}<br /><span className="os-status">{decisionFreshness(card.dataDate, card.validUntil, '2026-10-16')}</span></dd><dt>知识库索引</dt><dd><button className="os-link" onClick={onKnowledge}>{card.knowledge}</button></dd><dt>用户确认</dt><dd>{confirmed.includes(card.id) ? '已确认阅读 · 未成交' : '待用户确认 · 未成交'}</dd></dl>
      <button className="inbox-action" disabled={confirmed.includes(card.id)} onClick={() => setPreview(card.id)}>预览确认 · {card.id}</button>
      {preview === card.id && <section className="os-preview" aria-label="阅读确认预览"><p>仅在演示内存中追加“已阅读”记录；不确认投资动作、不写入正式系统。</p><div className="os-actions"><button className="inbox-action" onClick={() => { setConfirmed(ids => ids.includes(card.id) ? ids : [...ids, card.id]); setPreview(null); }}>确认已阅读</button><button className="inbox-action" onClick={() => setPreview(null)}>取消确认</button></div></section>}
    </article>)}</div>
    <details className="os-secondary"><summary>二级入口 · 原始证据链与历史</summary><p>保留既有 Thesis / Expression 演练、exact 来源引用、revision 与导入导出。首页不替代底层证据。</p><button className="inbox-action" onClick={onEvidence}>打开原始证据链</button><h3>本次阅读确认历史</h3><ol>{confirmed.map(id => <li key={id}>{id} · 用户确认已阅读 · 未成交 · 合成内存记录</li>)}</ol>{!confirmed.length && <p>尚无确认记录。</p>}</details>
  </section>;
}
export function KnowledgeIndex() {
  return <section className="round-one" aria-label="合成知识库索引"><h2>知识库索引</h2><p>仅演示索引与决策卡的关系。未接入私人知识库；没有外部链接，也不复制真实研究。</p>{decisionSamples.map(card => <article className="os-card" key={card.id}><h3>{card.knowledge}</h3><p>关联决策卡：{card.id} / {card.name}</p><p>{card.condition}</p><p>来源：本仓库手工构造的合成样例 · 非正式结论</p></article>)}</section>;
}
