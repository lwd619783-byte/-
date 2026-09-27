import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewHistory, ReviewRead, ReviewStatus, ReviewNote } from '../../../shared/daily-review.mjs';
import { dailyReviewRequest, validateReviewRead, validateReviewHistory } from '../../services/dailyReview';
import './daily-review.css';

const statuses: Record<ReviewStatus, string> = { AI_DRAFT: 'AI 草稿 / 未发布', AI_PUBLISHED: 'AI 复盘 / 未人工确认', USER_CONFIRMED: 'AI 复盘 / 已人工确认', SUPERSEDED: '历史版本 / 已被后续版本替代', WITHDRAWN: '已撤回 / 历史保留' };
const kinds = { fact: '引用事实', derived: '引用派生结果', interpretation: 'AI 解释' };
const availability = { available: '可用', missing: '缺失', stale: '过期', conflicted: '冲突', blocked: '不可用' };
const impacts = { none: '正式判断未变化', review_required: '建议人工复核', candidate_for_formal_update: '存在候选正式更新，尚未晋升' };
const dateTime = (s: string) => new Date(s).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const noteList = (notes: ReviewNote[], empty = '暂无新增证据') => notes.length ? <ul>{notes.map((n,i) => <li key={i}>{n.text}</li>)}</ul> : <p className="review-muted">{empty}</p>;

export function DailyReviewCard({ value }: { value: ReviewRead }) {
  if (!value.record) return <p className="review-muted">暂无每日复盘。授权 ChatGPT 发布后会在这里展示。</p>;
  const record = value.record, r = record.content;
  const stale = Date.now() - Date.parse(r.asOf) > 48 * 3600000;
  return <article className="daily-review-card">
    <header><strong>{r.reviewDate}</strong><span className="review-status">{statuses[value.effectiveStatus!]}</span><span>v{record.revision} · {record.audit.actor === 'owner' ? '人工操作' : 'AI 生成'}</span>{value.scope === 'synthetic' && <span>合成测试 · 非真实复盘</span>}</header>
    <p className="review-muted">观察截至 {dateTime(r.asOf)} · 更新 {dateTime(record.updatedAt)}{stale ? ' · 复盘已过期，请核对新数据' : ''}</p>
    {record.status === 'WITHDRAWN' ? <p>此版本已撤回，不作为当前研究结论。可在历史中查阅原内容。</p> : <>
      <p className="review-summary">{r.summary}</p>
      <section><h4>今日变化</h4>{r.observations.length ? <ul>{r.observations.map((o,i) => <li key={i}><span className="review-kind">{kinds[o.kind]}</span>{o.text}</li>)}</ul> : <p className="review-muted">暂无可确认的新变化</p>}</section>
      <div className="review-columns"><section><h4>支持原判断</h4>{noteList(r.supports)}</section><section><h4>挑战原判断</h4>{noteList(r.challenges)}</section></div>
      <section><h4>下一观察日</h4>{r.watchNext.length ? <ul>{r.watchNext.map((w,i) => <li key={i}><strong>{w.condition}</strong><span className="review-muted"> · {w.metric} · {w.currentState} · {w.horizon} · 方向：{{ up:'上行', down:'下行', change:'变化', available:'可用', unknown:'未知' }[w.direction]}</span></li>)}</ul> : <p className="review-muted">暂无新增观察条件</p>}</section>
      <p className="review-impact">{impacts[r.formalDecisionImpact]}。Review 不改变 Claim、Thesis、投资表达或组合。</p>
      <details><summary>变化、风险与来源（{r.sources.length}）</summary><h4>较上期变化</h4>{noteList(r.delta, '暂无上期对比')}<h4>风险变化</h4>{noteList(r.risks)}<p>置信度：{{low:'低',medium:'中',high:'高',unknown:'未知'}[r.confidence]}</p>{noteList(r.uncertainty.map(text => ({text,sourceIds:[]})))}
        <p className="review-muted">AI 所列引用未经独立证据审核；数据事实和确定性计算以上方数据区域为准。</p>
        <ul>{r.sources.map(s => <li key={s.id}><strong>{s.title}</strong> · {availability[s.availability]} · 来源日期 {s.sourceDate ?? '未知'} · 截至 {dateTime(s.asOf)}{s.relationToOS === 'external_conflict' ? ' · 外部证据与 OS 状态冲突' : s.kind !== 'os' ? ' · 外部研究引用，未覆盖 OS 状态' : ' · OS 引用'}<br/>{s.kind === 'os' ? <span>{s.locator} · revision {s.revision}</span> : <a href={s.locator} target="_blank" rel="noreferrer">打开来源</a>}</li>)}</ul>
      </details>
    </>}
  </article>;
}

export function DailyReviewPanel() {
  const [secret, setSecret] = useState(''), [connected, setConnected] = useState(false), [value, setValue] = useState<ReviewRead | null>(null);
  const [history, setHistory] = useState<ReviewHistory | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState(''), [pending, setPending] = useState<{ action: 'confirm'|'withdraw'; date: string; revision: number }|null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async (query = selection) => {
    const id = ++requestId.current; setBusy(true);
    try {
      const [data, list] = await Promise.all([dailyReviewRequest(`current${query}`, secret), dailyReviewRequest('history', secret)]);
      const parsed = validateReviewRead(data), hist = validateReviewHistory(list);
      if (id !== requestId.current) return;
      setValue(parsed); setHistory(hist); setConnected(true); setError('');
    } catch (e) { if (id === requestId.current) { setValue(null); setHistory(null); setError(e instanceof Error ? e.message : '复盘读取失败。'); } }
    finally { if (id === requestId.current) setBusy(false); }
  }, [secret, selection]);
  useEffect(() => {
    if (!connected) return;
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(refreshVisible, 30000); window.addEventListener('focus', refreshVisible);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshVisible); };
  }, [connected, refresh]);
  useEffect(() => () => { requestId.current++; }, []);
  async function transition() {
    if (!value?.record || !pending) return;
    setBusy(true);
    try { await dailyReviewRequest('transition', secret, { reviewDate: pending.date, expectedRevision: pending.revision, action: pending.action, confirmation: 'confirm-exact-review-only' }); setPending(null); setSelection(''); await refresh(''); }
    catch { setError('操作未完成，版本可能已变化。请刷新后核对。'); setBusy(false); }
  }
  return <section className="daily-review" aria-label="每日复盘">
    <div className="review-toolbar"><div><h3>每日复盘</h3><p className="review-muted">AI 研究解释 · 与数据事实、确定性指标及正式判断分层</p></div>{connected && <button disabled={busy} onClick={() => void refresh()}>刷新复盘</button>}</div>
    {!connected && <form onSubmit={e => { e.preventDefault(); void refresh(''); }} className="review-connect"><label>复盘访问密钥<input aria-label="复盘访问密钥" type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} required minLength={32}/></label><button disabled={busy}>连接复盘</button><p className="review-muted">密钥仅用于本次页面访问，不保存到浏览器。未连接时无法判断是否已有复盘。</p></form>}
    {error && <p role="alert">{error}</p>}{busy && <p role="status">正在同步复盘…</p>}
    {value && <DailyReviewCard value={value}/>}
    {history && <details><summary>历史版本（最近 {history.items.length} 条）</summary><div className="review-history"><button onClick={() => { setSelection(''); setPending(null); void refresh(''); }}>查看当前复盘</button>{history.items.map(h => <button key={`${h.reviewId}:${h.revision}`} onClick={() => { const q = `?reviewDate=${h.reviewDate}&revision=${h.revision}`; setSelection(q); setPending(null); void refresh(q); }}>{h.reviewDate} · v{h.revision} · {statuses[h.status]}</button>)}{history.next !== null && <button disabled={busy} onClick={async () => { setBusy(true); try { const more = validateReviewHistory(await dailyReviewRequest(`history?before=${history.next}`, secret)); setHistory({ items: [...history.items, ...more.items], next: more.next }); } catch { setError('历史读取失败。'); } finally { setBusy(false); } }}>更多历史</button>}</div></details>}
    {value?.record && value.isCurrent && value.record.status !== 'WITHDRAWN' && <details><summary>人工复核</summary><p>仅确认或撤回当前 Review，不晋升任何正式投资判断。</p><button disabled={busy || value.record.status === 'USER_CONFIRMED'} onClick={() => setPending({action:'confirm',date:value.record!.content.reviewDate,revision:value.record!.revision})}>人工确认此版本</button> <button disabled={busy} onClick={() => setPending({action:'withdraw',date:value.record!.content.reviewDate,revision:value.record!.revision})}>撤回复盘</button>{pending && <div role="group" aria-label="确认复盘操作"><p>确认{pending.action === 'confirm' ? '已核对' : '撤回'} {pending.date} v{pending.revision}？操作将追加新版本。</p><button disabled={busy} onClick={() => void transition()}>确认操作</button> <button onClick={() => setPending(null)}>取消</button></div>}</details>}
    {connected && <details><summary>访问设置</summary><button disabled={busy} onClick={async () => { setBusy(true); try { await dailyReviewRequest('revoke', secret, {}); setError('已撤销现有 ChatGPT 复盘授权；再次写入需要重新授权。'); } catch { setError('撤销失败，请重试。'); } finally { setBusy(false); } }}>撤销全部 ChatGPT 复盘授权</button> <button onClick={() => { requestId.current++; setConnected(false); setSecret(''); setValue(null); setHistory(null); setError(''); setPending(null); setBusy(false); }}>断开页面访问</button></details>}
  </section>;
}
