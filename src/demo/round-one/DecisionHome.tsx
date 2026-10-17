import { useState } from 'react';

export type DecisionSample = { id: string; version: number; name: string; suggestion: string; condition: string; invalidation: string; dataDate: string | null; validUntil: string | null; knowledge: string };
export const decisionSamples: readonly DecisionSample[] = [
  { id: 'SYN-01', version: 1, name: '合成公司 01', suggestion: '继续观察', condition: '下一份合成披露验证需求改善后，再复核论点。', invalidation: '合成需求证据反转、数据失效或建议版本更新时重新确认。', dataDate: '2026-10-15', validUntil: '2026-10-16', knowledge: 'SYN-KB-01 · 需求验证笔记' },
  { id: 'SYN-02', version: 1, name: '合成公司 02', suggestion: '等待补证', condition: '数据已过期；刷新合成现金流证据前不形成动作建议。', invalidation: '补证完成或现金流假设改变时重新确认。', dataDate: '2026-09-01', validUntil: '2026-09-30', knowledge: 'SYN-KB-02 · 现金流核对' },
  { id: 'SYN-03', version: 1, name: '合成公司 03', suggestion: '暂不行动', condition: '缺少合成行情和披露日期，无法评价当前机会。', invalidation: '补齐日期、行情或建议版本改变时重新确认。', dataDate: null, validUntil: null, knowledge: 'SYN-KB-03 · 待补资料清单' },
];
const OBSERVATION_DAY = '2026-10-16';
function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function decisionFreshness(dataDate: string | null, validUntil: string | null, asOf: string) {
  if (!validDate(dataDate) || !validDate(validUntil) || !validDate(asOf) || validUntil < dataDate || dataDate > asOf) return '未知 · 缺失、非法或矛盾日期';
  return validUntil < asOf ? '未知 · 数据已过期' : '合成数据有效 · 非实时行情';
}
type Confirmation = { decisionId: string; version: number; suggestion: string; confirmedAt: string; appliesWhen: string; invalidWhen: string; scope: 'synthetic-only'; actor: 'explicit-user-confirmation' };

export function DecisionHome({ onKnowledge, onEvidence, onDecision, onHistory, view = 'cards', selectedId, initialSamples = decisionSamples }: { onKnowledge: () => void; onEvidence: () => void; onDecision?: (id: string) => void; onHistory?: () => void; view?: 'overview' | 'cards' | 'history'; selectedId?: string; initialSamples?: readonly DecisionSample[] }) {
  const [cards, setCards] = useState(() => initialSamples.map(card => ({ ...card })));
  const [preview, setPreview] = useState<{ id: string; version: number; kind: 'read' | 'decision' } | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const unknownCount = cards.filter(card => decisionFreshness(card.dataDate, card.validUntil, OBSERVATION_DAY).startsWith('未知')).length;
  const currentCount = cards.filter(card => confirmations.some(c => c.decisionId === card.id && c.version === card.version)).length;
  return <section className="round-one" aria-label={view === 'overview' ? '决策首页' : view === 'history' ? '决策历史复盘' : '个股决策'}>
    <div className="os-heading"><div><p className="os-eyebrow">DECISION FIRST / 合成样例</p><h2>{view === 'overview' ? '今天先决定什么' : view === 'history' ? '决策历史复盘' : '个股决策卡'}</h2></div><span>演示观察日 {OBSERVATION_DAY}</span></div>
    <p>阅读与决策确认分开。决策确认仅记录用户在合成原型中接受某一版本建议及条件，不代表成交、持仓变化或真实投资决定。确认不验证条件已经满足。</p>
    {(view === 'overview' || (view === 'cards' && !selectedId)) && <div className="os-summary"><div><strong>{cards.length}</strong><span>合成样例数</span></div><div><strong>{unknownCount}</strong><span>当前数据未知</span></div><div><strong>{currentCount}</strong><span>当前版本决策确认</span></div></div>}
    {view === 'overview' && <div className="os-overview-list">{cards.map(card => <article className="os-card os-overview-row" key={card.id} aria-label={card.name}>
      <div><p className="os-eyebrow">{card.id} · 建议 v{card.version}</p><h3>{card.name}</h3><p className="os-conclusion">{card.suggestion}</p></div>
      <div><p>{card.condition}</p><p className="os-status">数据日期：{card.dataDate ?? '未知 · 尚无数据'} · {decisionFreshness(card.dataDate, card.validUntil, OBSERVATION_DAY)}</p><p className="os-eyebrow">{confirmations.some(c => c.decisionId === card.id && c.version === card.version) ? '当前版本已由用户确认（合成）· 未成交' : '当前版本待用户确认 · 未成交'}</p></div>
      <button className="inbox-action" onClick={() => onDecision?.(card.id)}>查看决策 · {card.id}</button>
    </article>)}<div className="os-actions"><button className="os-link" onClick={onKnowledge}>查看知识库索引</button><button className="os-link" onClick={onHistory}>查看决策历史</button></div></div>}
    {view === 'cards' && <div className={selectedId ? 'os-single-decision' : 'os-cards'}>{cards.filter(card => !selectedId || card.id === selectedId).map(card => {
      const key = `${card.id}@${card.version}`;
      const confirmation = confirmations.find(c => c.decisionId === card.id && c.version === card.version);
      const hasOlder = confirmations.some(c => c.decisionId === card.id && c.version !== card.version);
      return <article key={card.id} className="os-card" aria-label={card.name}>
        <p className="os-eyebrow">{card.id} · 建议 v{card.version} · SYNTHETIC</p><h3>{card.name}</h3>
        <p className="os-conclusion">建议 · {card.suggestion}</p>
        <dl><dt>适用条件 / 下一步</dt><dd>{card.condition}</dd><dt>失效 / 重新确认条件</dt><dd>{card.invalidation}</dd><dt>数据日期</dt><dd>{card.dataDate ?? '未知 · 尚无数据'}<br /><span className="os-status">{decisionFreshness(card.dataDate, card.validUntil, OBSERVATION_DAY)}</span></dd><dt>Notion合成索引占位</dt><dd><button className="os-link" onClick={onKnowledge}>{card.knowledge}</button></dd><dt>阅读状态</dt><dd>{read.includes(key) ? '已确认阅读 · 未成交' : '尚未阅读此版本'}</dd><dt>用户决策确认</dt><dd>{confirmation ? `v${card.version} 已由用户确认（合成）· 未成交` : hasOlder ? '旧版本确认已过时 · 当前版本待确认 · 未成交' : '待用户决策确认 · 未成交'}</dd>{confirmation && <><dt>确认时点（当前会话UTC）</dt><dd>{confirmation.confirmedAt}</dd></>}</dl>
        <div className="os-actions"><button className="inbox-action" disabled={read.includes(key)} onClick={() => setPreview({ id: card.id, version: card.version, kind: 'read' })}>预览阅读 · {card.id}</button><button className="inbox-action" disabled={!!confirmation} onClick={() => setPreview({ id: card.id, version: card.version, kind: 'decision' })}>预览决策确认 · {card.id}</button></div>
        {preview?.id === card.id && preview.version === card.version && <section className="os-preview" aria-label={preview.kind === 'read' ? '阅读确认预览' : '决策确认预览'}>
          <p>{preview.kind === 'read' ? '仅记录此版本已阅读，不确认建议。' : `确认对象：${card.id} / 建议v${card.version} / ${card.suggestion}`}</p>
          {preview.kind === 'decision' && <><p>适用：{card.condition}</p><p>失效：{card.invalidation}</p><p>仅记录本人对该合成建议与条件的确认；不写入正式系统，不代表成交。</p></>}
          <div className="os-actions"><button className="inbox-action" onClick={() => {
            if (preview.kind === 'read') setRead(keys => keys.includes(key) ? keys : [...keys, key]);
            else {
              const record: Confirmation = { decisionId: card.id, version: card.version, suggestion: card.suggestion, confirmedAt: new Date().toISOString(), appliesWhen: card.condition, invalidWhen: card.invalidation, scope: 'synthetic-only', actor: 'explicit-user-confirmation' };
              setConfirmations(records => records.some(c => c.decisionId === card.id && c.version === card.version) ? records : [...records, record]);
            }
            setPreview(null);
          }}>{preview.kind === 'read' ? '确认已阅读' : '本人确认此版本合成建议及条件'}</button><button className="inbox-action" onClick={() => setPreview(null)}>取消确认</button></div>
        </section>}
        {card.id === 'SYN-01' && <button className="inbox-action" disabled={card.version !== 1} onClick={() => {
          setCards(items => items.map(item => item.id === card.id ? { ...item, version: 2, suggestion: '等待新增证据', condition: '新增合成证据核验完成后重新复核。', invalidation: '新增证据失效或建议再次修订时重新确认。' } : item));
          setPreview(null);
        }}>演练建议更新 · SYN-01</button>}
      </article>;
    })}</div>}
    {view === 'cards' && onHistory && <button className="os-link" onClick={onHistory}>查看决策历史与原始证据链</button>}
    {(view === 'history' || (view === 'cards' && !selectedId)) && <details className="os-secondary" open={view === 'history' || undefined}><summary>二级入口 · 原始证据链与历史</summary><p>保留既有 Thesis / Expression 演练、exact 来源引用、revision 与导入导出。首页不替代底层证据。</p><button className="inbox-action" onClick={onEvidence}>打开原始证据链</button>
      <h3>本次阅读记录</h3><ol>{read.map(key => <li key={key}>{key} · 已阅读 · 不是决策确认</li>)}</ol>
      <h3>本次用户决策确认历史（只读，未导出）</h3><ol aria-label="决策确认历史">{confirmations.map(c => <li key={`${c.decisionId}@${c.version}`}><p>{c.decisionId} / 建议v{c.version} / {c.suggestion} · {cards.some(card => card.id === c.decisionId && card.version === c.version) ? '当前版本' : '旧版本，需重新确认'} · 未成交</p><p>确认时点：{c.confirmedAt} · 显式用户确认 · synthetic-only</p><p>适用：{c.appliesWhen}</p><p>失效：{c.invalidWhen}</p></li>)}</ol>{!confirmations.length && <p>尚无决策确认记录。</p>}
    </details>}
  </section>;
}
export function KnowledgeIndex() {
  return <section className="round-one" aria-label="合成知识库索引"><h2>Notion合成索引占位</h2><p>尚未接入Notion或私人知识库，未迁移正式App。此处仅为索引关系样例，不是当前建议版本的副本；没有外部链接，也不复制真实研究。返回请使用“决策首页”；本原型没有浏览器Back路由。</p>{decisionSamples.map(card => <article className="os-card" key={card.id}><h3>{card.knowledge}</h3><p>关联决策卡：{card.id} / {card.name}</p><p>来源：本仓库手工构造的合成索引占位 · 非正式结论</p></article>)}</section>;
}
