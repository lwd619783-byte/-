import { useRef, useState } from 'react';
import { browserDecisionPublisher, type DecisionPublisher, type DecisionPreview } from '../../services/decisionPublish';
import type { ThesisWorkspaceDataset } from '../../services/thesisWorkspace';
const statusLabel: Record<string, string> = { available: '可读取', missing: '无当前正式记录', partial: '部分信息缺失或需复核', blocked: '已阻断', stale: '需复核更新', conflicted: '存在冲突', verified: '已验证', confirmed: '已确认' };
const roleLabel = { direct: '直接表达', leader: '龙头', high_beta: '高弹性', defensive: '防御', unknown: '未知' };
const accountStatusLabel = { active: '活跃', inactive: '停用', archived: '已归档' };
const expressionFields = { directness: '直接性', correlation: '相关性', liquidity: '流动性', valuation: '估值', sensitivity: '敏感性', idiosyncraticRisk: '个体风险' } as const;
function TextItems({ label, values }: { label: string; values: string[] }) {
  return <div><p className="font-medium">{label}</p>{values.length ? <ul className="list-disc pl-5">{values.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p>未记录</p>}</div>;
}

export function DecisionSharePanel({ dataset, createPublisher }: { dataset: ThesisWorkspaceDataset; createPublisher?: () => Promise<DecisionPublisher> }) {
  const [secret, setSecret] = useState(''), [preview, setPreview] = useState<DecisionPreview | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const publisher = useRef<DecisionPublisher | null>(null);
  const getPublisher = async () => publisher.current ?? (publisher.current = await (createPublisher ? createPublisher() : browserDecisionPublisher(dataset, window.localStorage)));
  const act = async (kind: 'prepare' | 'publish' | 'revoke') => {
    setBusy(true); setMessage('');
    try {
      // Revoke must work even when local formal owners or providers are corrupt/unavailable.
      if (kind === 'revoke') {
        const { domainRequest } = await import('../../services/decisionPublish');
        if (createPublisher) await (await getPublisher()).revoke(secret);
        else { const status = await domainRequest('status', secret); await domainRequest('revoke', secret, { expectedGeneration: status.generation }); }
        setPreview(null); setMessage('已撤销共享，Domain MCP 后续读取将被拒绝。');
      } else {
        const service = await getPublisher();
        if (kind === 'prepare') setPreview(await service.prepare(secret));
        else if (preview) { await service.publish(preview, secret, true); setPreview(null); setMessage('已共享经校验的正式状态快照，只读访问最长有效24小时。到期或撤销后拒绝后续读取，不保证底层私有存储对象届时物理删除。之后的本地修改需重新共享。'); }
      }
    } catch { setPreview(null); setMessage('操作未完成：服务未配置、认证失败，或正式状态已变化/无法校验。请保留本地资料，重新生成预览后重试。'); }
    finally { setBusy(false); }
  };
  return <section aria-label="共享正式投资状态" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
    <h2 className="font-semibold text-slate-900">共享当前正式投资状态给 ChatGPT</h2>
    <p className="text-sm text-slate-600">只读共享 Verified Claim、已确认 Thesis、投资表达及可读取的组合投影。不会共享 Wiki、Drive 原件或账本数据库；不会执行交易。</p>
    <p className="text-sm text-slate-600">组合依赖 localhost 本地环境。线上或未连接时会明确显示不可读取，其他正式状态仍可共享。</p>
    <label className="block text-sm">共享访问密钥<input className="block max-w-full w-80 rounded border p-2" type="password" autoComplete="off" value={secret} onChange={e => { setSecret(e.target.value); setPreview(null); }} /></label>
    <p className="text-xs text-slate-500">密钥仅保留在当前页面内存。需已配置独立 OS Domain MCP；在 ChatGPT 连接 /api/os-mcp 并完成只读授权。</p>
    <div className="flex flex-wrap gap-3"><button className="rounded border px-3 py-2" disabled={busy || secret.length < 32} onClick={() => void act('prepare')}>生成并校验共享预览</button>
      <button className="rounded border px-3 py-2" disabled={busy || secret.length < 32} onClick={() => void act('revoke')}>撤销当前共享</button></div>
    {preview && <div className="space-y-2 rounded bg-slate-50 p-3">
      <p>快照时间：{preview.snapshot.asOf}</p>
      <ul><li>Claim：{preview.snapshot.claims.rows.length} 条正式记录，其中已验证 {preview.snapshot.claims.rows.filter(r => r.status === 'verified').length} 条（{statusLabel[preview.snapshot.claims.status]}）</li>
        <li>Thesis：{preview.snapshot.theses.rows.length} 条（{statusLabel[preview.snapshot.theses.status]}）</li><li>投资表达：{preview.snapshot.expressions.rows.length} 条（{statusLabel[preview.snapshot.expressions.status]}）</li>
        <li>组合：{preview.snapshot.portfolio.status === 'unavailable' ? '不可读取，不含组合数据' : `${preview.snapshot.portfolio.projection?.positions.length} 个已记录仓位，仅投影，可能不完整`}</li></ul>
      <p className="font-medium">下列内容就是本次将发送到私人暂存区，并供 ChatGPT 通过只读 Domain MCP 读取的数据范围。请展开各类记录核对后确认。</p>
      <div className="space-y-3 break-words">
        <details open><summary>Claim 记录（{preview.snapshot.claims.rows.length}）</summary>
          {preview.snapshot.claims.rows.map(row => <article key={row.id} className="my-2 space-y-2 rounded border p-3">
            <p>{row.statement}</p><p>状态：{statusLabel[row.status]}</p><p>范围：{row.scope}</p>
            <p>证据门禁：{row.gate.verifiable ? '通过' : '未通过'}（{row.gate.outcome}）</p>
            {row.gate.conditions.length > 0 && <TextItems label="门禁条件" values={row.gate.conditions} />}
            {row.blockers.length > 0 && <TextItems label="阻断原因" values={row.blockers} />}
          </article>)}
        </details>
        <details><summary>Thesis 记录与风险、失效条件（{preview.snapshot.theses.rows.length}）</summary>
          {preview.snapshot.theses.rows.map(row => <article key={row.id} className="my-2 space-y-2 rounded border p-3">
            <p>{row.statement}</p><p>状态：{statusLabel[row.status]}；证据门禁：{row.gate.publishable ? '通过' : '未通过'}</p>
            <TextItems label="风险" values={row.risks} /><TextItems label="失效条件" values={row.invalidation} />
            {row.blockers.length > 0 && <TextItems label="阻断原因" values={row.blockers} />}
            <p>乐观情景：{row.bull || '未记录'}</p><p>基准情景：{row.base || '未记录'}</p><p>悲观情景：{row.bear || '未记录'}</p>
            <TextItems label="关键驱动" values={row.keyDrivers} /><TextItems label="催化因素" values={row.catalysts} />
            <p>信心：{{ low: '低', medium: '中', high: '高', unknown: '未知' }[row.confidence]}</p>
          </article>)}
        </details>
        <details><summary>投资表达与未知项（{preview.snapshot.expressions.rows.length}）</summary>
          {preview.snapshot.expressions.rows.map(row => <article key={row.id} className="my-2 space-y-2 rounded border p-3">
            <p>标的：{row.instrument ? `${row.instrument.id} · ${row.instrument.type} / ${row.instrument.market}` : '不可解析'}</p>
            <p>角色：{roleLabel[row.role]}；状态：{statusLabel[row.status]}</p><p>证据门禁：{row.gate.publishable ? '通过' : '未通过'}</p>
            <TextItems label="未知项" values={row.gate.unknowns.map(key => key === 'role' ? '角色' : expressionFields[key as keyof typeof expressionFields] ?? key)} />
            {row.blockers.length > 0 && <TextItems label="阻断原因" values={row.blockers} />}
            {(Object.keys(expressionFields) as (keyof typeof expressionFields)[]).map(key => <p key={key}>{expressionFields[key]}：{row[key].status === 'unknown' ? '未知' : '研究判断'}；{row[key].rationale || '未记录说明'}</p>)}
          </article>)}
        </details>
        {preview.snapshot.portfolio.status !== 'unavailable' && <div className="space-y-2" aria-label="本次共享的组合数据">
          <p className="font-medium">本次共享的每个已记录仓位</p>
          <p>组合可能不完整；还将共享已记录金额、分类暴露及审计引用。</p>
          {preview.snapshot.portfolio.blockers.length > 0 && <TextItems label="组合阻断原因" values={preview.snapshot.portfolio.blockers} />}
          {preview.snapshot.portfolio.projection?.positions.map(position => <article key={position.positionId} className="space-y-1 rounded border p-3">
            <p>账户：{position.accountName}；账户状态：{accountStatusLabel[position.accountStatus]}</p><p>资产：{position.assetName}</p>
            <p>数量：{position.quantity}</p><p>市值：{position.marketValue} {position.currency}</p><p>快照日期：{position.snapshotDate}</p>
            {position.primaryCategory && <p>主要类别：{position.primaryCategory}</p>}{position.strategyBucket && <p>策略分类：{position.strategyBucket}</p>}
            {position.blockers.length > 0 && <TextItems label="仓位阻断原因" values={position.blockers} />}
          </article>)}
        </div>}
      </div>
      <p className="text-sm">上述记录还保留来源、时间、精确版本、证据及审计引用；此处不展示原始 JSON 或技术摘要。</p>
      <p className="text-sm">本次只读共享访问最长有效24小时，可随时撤销。到期或撤销后 Domain MCP 将拒绝后续读取；这是访问有效期，不代表底层私有存储对象届时一定完成物理删除。</p>
      <button className="rounded bg-slate-900 px-3 py-2 text-white" disabled={busy} onClick={() => void act('publish')}>确认共享上述正式状态</button>
      <button className="ml-3 rounded border px-3 py-2" disabled={busy} onClick={() => setPreview(null)}>取消</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
