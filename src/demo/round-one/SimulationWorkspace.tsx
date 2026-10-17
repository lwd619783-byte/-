import { useState } from 'react';
import { candidates, createSimulation, defaultRules, projectRound, sessions, statusLabels, type Rules } from './simulation';

export function SimulationWorkspace() {
  const [store] = useState(createSimulation);
  const [rounds, setRounds] = useState(store.list);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rules, setRules] = useState<Rules>({ ...defaultRules });
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState<'lock' | 'skip' | null>(null);
  const [backup, setBackup] = useState('');
  const [importPreview, setImportPreview] = useState<ReturnType<typeof store.previewImport> | null>(null);
  const [message, setMessage] = useState('');
  const round = rounds.find(r => r.id === activeId), view = round ? projectRound(round) : null;
  const run = (action: () => void) => { try { action(); setRounds(store.list()); } catch { setMessage('操作被拒绝：请检查合成格式、20只唯一候选、锁定状态或历史冲突。没有覆盖已有记录。'); } };
  const exportBackup = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'synthetic-oversold-backup-v1.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('已导出合成轮次、候选池、锁定规则与逐日事件。');
  };
  return <section className="round-one" aria-label="超跌模拟">
    <div className="os-heading"><div><p className="os-eyebrow">OVERSOLD LAB / 独立合成模拟</p><h2>有机会才开一轮</h2></div><span>20 只 × 初始 5% · 20 交易日</span></div>
    <p>本轮只使用 24 只合成候选，需你逐只筛选 20 只。没有机会可保留候选池并跳过。锁定后不日常再平衡、不替换、不回改。</p>
    <p className="os-notice">此处不是策略回测结论。所有轮次重复同一个合成场景；两三轮不能证明稳定有效。仅页面内存，刷新重置；本模块备份只含超跌轮次。</p>
    <p className="os-notice">日级合成成交假设：在16:00检查整日价格与状态，再以选定的open/close字段计算。开盘价字段不证明开盘可成交；未建模盘中订单、执行时点或成交证据，不可用于真实时点回测，也不声称无前视偏差。</p>
    <div className="os-actions"><button className="inbox-action" disabled={rounds.some(r => !['completed', 'skipped'].includes(projectRound(r).status))} onClick={() => run(() => { const next = store.create(); setActiveId(next.id); setSelected([]); setAcknowledged(false); setPreview(null); setMessage('候选池已保存；尚未筛选或锁定。'); })}>新建合成轮次</button><button className="inbox-action" onClick={exportBackup}>导出超跌 JSON</button></div>
    <nav aria-label="模拟轮次历史" className="os-actions">{rounds.map(item => <button className="inbox-action" key={item.id} aria-pressed={item.id === activeId} onClick={() => { setActiveId(item.id); setSelected([]); setPreview(null); }}>{item.id} · {({ draft: '待筛选', skipped: '无机会 · 已跳过', locked: '已锁定', 'pending-exit': '待退出', completed: '已完成' })[projectRound(item).status]}</button>)}</nav>
    <p role="status">{message}</p>
    {round && view && <article aria-label="当前合成轮次">
      <h3>{round.id}</h3><p>候选快照：2026-01-05 · {round.candidates.length} 只 · 合成日历（含周末与人为休市日）</p>
      {view.status === 'draft' && <>
        <fieldset disabled={preview !== null}><legend>用户筛选 · 已选 {selected.length} / 20</legend><div className="os-candidates">{candidates.map(candidate => <label key={candidate.id}><input type="checkbox" aria-label={`选择 ${candidate.id}`} checked={selected.includes(candidate.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, candidate.id] : ids.filter(id => id !== candidate.id))} />{candidate.id}</label>)}</div>
          <div className="os-fields"><label>入场价格口径 · 待确认<select value={rules.entryPrice} onChange={event => { setAcknowledged(false); setRules({ ...rules, entryPrice: event.target.value as Rules['entryPrice'] }); }}><option value="open">下一日open字段（日级假设）</option><option value="close">下一日close字段（日级假设）</option></select></label>
            <label>单边成本 bps · 待确认<input type="number" min="0" max="1000" step="1" value={rules.costBps} onChange={event => { setAcknowledged(false); setRules({ ...rules, costBps: event.target.value === '' ? NaN : Number(event.target.value) }); }} /></label>
            <label>交易日计数口径 · 待确认<select value={rules.dayCount} onChange={event => { setAcknowledged(false); setRules({ ...rules, dayCount: event.target.value as Rules['dayCount'] }); }}><option value="include-entry">入场尝试日计第1日</option><option value="exclude-entry">入场尝试日计第0日</option></select></label></div>
          <p>到期统一尝试收盘退出。20日按轮次计划入场日计算，不按每只成交日；成本双边计入。归一化本金 10,000 合成单位，允许碎股，不计税费细项或滑点，均非真实交易模型。</p>
          <label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> 我确认本轮合成参数；不表示真实交易口径已获批准</label>
        </fieldset>
        <div className="os-actions"><button className="inbox-action" disabled={selected.length !== 20 || !acknowledged || !Number.isInteger(rules.costBps) || rules.costBps < 0 || rules.costBps > 1000 || preview !== null} onClick={() => setPreview('lock')}>预览锁定20只</button><button className="inbox-action" disabled={preview !== null} onClick={() => setPreview('skip')}>没有机会 · 跳过本轮</button></div>
        {preview && <section className="os-preview" aria-label="轮次确认预览"><h3>{preview === 'lock' ? '确认锁定快照' : '确认无机会'}</h3><p>{preview === 'lock' ? `${selected.join(' / ')}；每只初始5%，总计100%。候选池、规则与锁定快照将不可回改。锁定不是成交；未成交份额保留现金。` : '保留本轮完整候选池与无机会记录，不产生持仓。'}</p><div className="os-actions"><button className="inbox-action" onClick={() => run(() => { if (preview === 'lock') store.lock(round.id, selected, rules); else store.skip(round.id); setPreview(null); setMessage('合成记录已追加；未触及正式系统。'); })}>确认本轮</button><button className="inbox-action" onClick={() => setPreview(null)}>取消本轮操作</button></div></section>}
      </>}
      {view.lock && <>
        <div className="os-summary"><div><strong>{view.elapsed} / 20</strong><span>已计交易日</span></div><div><strong>{view.unfilled}</strong><span>未成交 · 现金保留</span></div><div><strong>{view.pendingExit}</strong><span>待退出</span></div></div>
        <p>模拟时点：{view.asOf} 16:00 UTC · 计划到期：{view.plannedExitSession} · 最终退出：{view.finalExitSession ?? '未知 / 尚未完成'} · 延期交易日数：{view.delaySessions}{!view.complete && view.due ? '（当前已延期，最终未知）' : ''} · {view.complete ? '本轮完成' : view.due ? '已到期，仍有待退出' : '等待计划到期'}</p>
        <p>锁定规则 {view.lock.rules.version}：入场 {view.lock.rules.entryPrice} / 单边 {view.lock.rules.costBps} bps / {view.lock.rules.dayCount === 'include-entry' ? '入场日计1' : '入场日计0'} · 合成参数已确认；真实口径仍待确认。</p>
        <p className="os-notice">最终清算净收益：{view.finalLiquidationReturnPct === null ? '未知 / 尚未完成全部退出' : `${view.finalLiquidationReturnPct.toFixed(2)}%（合成示例，非策略有效性证据）`}。包含延期退出期间的收益，不是第20日收益；本原型不提供独立到期估值快照。日级快照缺失、停牌、涨跌停或晚于日终观察时点可得时不模拟成交；这不是盘中成交或无前视证明。</p>
        <button className="inbox-action" disabled={view.complete || view.cursor >= sessions.length - 1} onClick={() => run(() => { store.advance(round.id, view.cursor); setMessage('已追加下一合成交易日；未回填历史。'); })}>推进下一合成交易日</button>
        <ul className="os-position-list" aria-label="模拟持仓状态">{view.positions.map(position => <li key={position.id}><strong>{position.id} · 初始 5% · {statusLabels[position.status]}</strong><p>{position.reason}</p><p>入场价 {position.entryPrice?.toFixed(2) ?? '未知 / 未成交'} · 退出价 {position.exitPrice?.toFixed(2) ?? '未知 / 未退出'}</p><p>入场日 {position.entrySession ?? '无'} · 退出日 {position.exitSession ?? '无'}</p></li>)}</ul>
      </>}
      <details className="os-secondary"><summary>候选、锁定与事件历史 · 只读</summary><p>候选池：{round.candidates.map(c => c.id).join(' / ')}</p><p>候选来源：synthetic-only · 原因：人为构造的超跌观察样例，非真实推荐。</p><p>规则版本：{view.lock?.rules.version ?? '尚未锁定'} · 事件数：{round.events.length}</p><ol>{round.events.map((event, index) => <li key={index}>{index + 1}. {event.type === 'advance' ? `推进 ${sessions[event.sessionIndex]}` : event.type === 'lock' ? '用户锁定20只与规则快照（未成交）' : '无机会 · 跳过'}</li>)}</ol></details>
    </article>}
    <details className="os-secondary"><summary>导入合成轮次备份</summary><p>只接受此模块导出的有限合成格式。先预览再确认；同名且不同的历史拒绝覆盖，重复备份不重复写入。请勿粘贴私人资料。</p><label>合成备份 JSON<textarea aria-label="合成备份 JSON" rows={5} maxLength={1000000} value={backup} onChange={event => { setBackup(event.target.value); setImportPreview(null); }} /></label><button className="inbox-action" onClick={() => run(() => { setImportPreview(null); setImportPreview(store.previewImport(backup)); setMessage('已验证导入预览，尚未写入。'); })}>预览导入超跌</button>
      {importPreview && <section className="os-preview" aria-label="导入预览"><p>总轮次 {importPreview.total} / 新增 {importPreview.additions} / 重复 {importPreview.duplicates}</p><div className="os-actions"><button className="inbox-action" onClick={() => run(() => { const count = store.import(backup); setImportPreview(null); setActiveId(store.list().at(-1)?.id ?? null); setMessage(`导入完成：新增 ${count} 轮。`); })}>确认导入超跌</button><button className="inbox-action" onClick={() => { setImportPreview(null); setMessage('已取消导入；没有写入。'); }}>取消导入超跌</button></div></section>}
    </details>
  </section>;
}
