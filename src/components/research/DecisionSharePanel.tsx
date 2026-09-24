import { useRef, useState } from 'react';
import { browserDecisionPublisher, type DecisionPublisher, type DecisionPreview } from '../../services/decisionPublish';
import type { ThesisWorkspaceDataset } from '../../services/thesisWorkspace';
const statusLabel: Record<string, string> = { available: '可读取', missing: '无当前正式记录', partial: '部分信息缺失或需复核', blocked: '已阻断', stale: '需复核更新', conflicted: '存在冲突', verified: '已验证', confirmed: '已确认' };

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
        else if (preview) { await service.publish(preview, secret, true); setPreview(null); setMessage('已共享经校验的正式状态快照，最多有效24小时。之后的本地修改需重新共享。'); }
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
      <p>仅共享以上状态及其证据引用、风险、失效条件和阻断信息。私有暂存最多24小时，可撤销。</p>
      <details><summary>查看本次共享记录</summary><ul className="break-words">{[...preview.snapshot.claims.rows, ...preview.snapshot.theses.rows, ...preview.snapshot.expressions.rows].map(row => <li key={`${row.authority}:${row.id}`}>{'statement' in row ? row.statement : row.instrument?.id ?? '标的不可解析'} · {statusLabel[row.status]}</li>)}</ul></details>
      <button className="rounded bg-slate-900 px-3 py-2 text-white" disabled={busy} onClick={() => void act('publish')}>确认共享上述正式状态</button>
      <button className="ml-3 rounded border px-3 py-2" disabled={busy} onClick={() => setPreview(null)}>取消</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
