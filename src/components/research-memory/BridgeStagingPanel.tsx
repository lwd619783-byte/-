import { useState } from 'react';
import type { BrowserSourceRepository, IngestionSnapshot, ResearchBatch } from '../../types/knowledgeIngestion';
import type { WikiData, WikiReadModel } from '../../types/wiki';
import { digestBytes } from '../../services/browserSourceRepository';
import { wikiRequire, wikiRevisionStatus } from '../../services/wiki';
import { wikiInputClass } from './WikiRevisionForm';

const button = 'inbox-action !whitespace-normal max-w-full';
const storageKey = (id: string) => `research-bridge.stage.v1:${id}`;
type StageStatus = { stageId: string; batchId: string; createdAt: string; expiresAt: string; status: 'uploading' | 'readable' | 'revoked' | 'expired' };
export function BridgeStagingPanel({ batch, snapshot, sourceRepository, wiki, model }: { batch: ResearchBatch; snapshot: IngestionSnapshot; sourceRepository: BrowserSourceRepository; wiki: WikiData; model: WikiReadModel | null }) {
  const [secret, setSecret] = useState(''), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [statuses, setStatuses] = useState<Record<string, StageStatus>>({});
  const [choices, setChoices] = useState<Record<string, string[]>>({}), [confirmed, setConfirmed] = useState('');
  const material = snapshot.sources.filter(s => s.batchId === batch.batchId);
  const chosen = choices[batch.batchId] ?? [];
  const selectionKey = JSON.stringify([batch.batchId, chosen, selected, material.map(s => [s.sourceId, s.sha256, s.parse.status])]);
  const omitted = material.filter(s => !chosen.includes(s.sourceId));
  const status = statuses[batch.batchId];
  const call = async (action: string, payload?: object): Promise<StageStatus> => {
    wikiRequire(secret.length >= 32, '请输入已配置的研究桥访问密钥');
    const encoded = payload === undefined ? undefined : JSON.stringify(payload);
    wikiRequire(!encoded || new TextEncoder().encode(encoded).byteLength <= 3 * 1024 * 1024, '单份解析文本或文章历史超过 3 MiB 暂存上限，请拆分资料');
    const response = await fetch(`/api/bridge/${action}`, { method: payload ? 'POST' : 'GET', headers: { 'X-Bridge-Owner-Secret': secret, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: encoded, cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('研究桥端点尚不可用，请检查 Preview 配置');
    const value = await response.json();
    if (!response.ok) throw new Error(value.message ?? (response.status === 401 ? '访问密钥不正确或尚未配置' : '研究桥请求失败'));
    return value as StageStatus;
  };
  const remember = (value: StageStatus) => { localStorage.setItem(storageKey(batch.batchId), value.stageId); setStatuses(prior => ({ ...prior, [batch.batchId]: value })); };
  const run = async (work: () => Promise<void>) => { setBusy(true); try { await work(); } catch (error) { setMessage(String(error)); } finally { setBusy(false); } };
  const send = () => run(async () => {
    const existingId = stageId();
    if (existingId) { const existing = await call(`status?stageId=${encodeURIComponent(existingId)}`); wikiRequire(existing.status === 'revoked' || existing.status === 'expired', '本批已有暂存，请先撤销访问再重新发送'); }
    wikiRequire(confirmed === selectionKey && chosen.length > 0, '请先选择资料并确认本次发送清单');
    const fresh = await sourceRepository.load(), selectedSources = chosen.map(sourceId => fresh.sources.find(s => s.sourceId === sourceId && s.batchId === batch.batchId));
    wikiRequire(selectedSources.every(s => s && s.parse.status === 'parsed' && material.some(old => old.sourceId === s.sourceId && old.sha256 === s.sha256)), '所选资料状态已变化，请重新核对清单');
    const sources = await Promise.all(selectedSources.map(async source => {
      const s = source!;
      // Local canonical snapshots sort keys; the bridge digest uses this fixed wire order.
      const segments = s.parse.segments.map(({ locator, label, text }) => ({ locator, label, text }));
      return { metadata: { sourceId: s.sourceId, batchId: s.batchId, filename: s.filename, mime: s.mime, size: s.size, sha256: s.sha256, capturedAt: s.capturedAt, kind: s.kind, parsedTextSha256: await digestBytes(new TextEncoder().encode(JSON.stringify(segments))) }, segments };
    }));
    const documents = selected.map(wikiId => {
      const page = model?.pages.find(p => p.entry.wikiId === wikiId); wikiRequire(page, '所选文章暂不可用');
      return { wikiId, currentRevisionId: page!.revision.revisionId, revisions: wiki.revisions.filter(r => r.wikiId === wikiId && wikiRevisionStatus(wiki, r.revisionId, model!.asOf) === 'reviewed').map(r => ({ revisionId: r.revisionId, title: r.title, summary: r.summary, bodyMarkdown: r.bodyMarkdown, createdAt: r.createdAt, asOf: r.asOf, sourceRefs: r.sourceRefs, reviewId: wiki.reviews.find(review => review.revisionId === r.revisionId && review.decision === 'reviewed')!.reviewId })) };
    });
    // Check payload bounds before creating a remote staging record.
    [...sources, ...documents].forEach(value => wikiRequire(new TextEncoder().encode(JSON.stringify(value)).byteLength < 3 * 1024 * 1024 - 1024, '单份解析文本或历史超过 3 MiB，请拆分后发送'));
    const stage = await call('begin', { batchId: batch.batchId, title: batch.title, sourceMetadata: sources.map(s => s.metadata), knowledgeIds: selected, consent: 'stage-selected-batch-and-knowledge' }); remember(stage);
    for (const source of sources) await call('source', { stageId: stage.stageId, source });
    for (const document of documents) await call('knowledge', { stageId: stage.stageId, document });
    remember(await call('publish', { stageId: stage.stageId })); setMessage(`所选 ${sources.length} 份资料已可供 ChatGPT 只读研究；${omitted.length} 份未发送。研究结果仍需导回人工审核。`);
  });
  const stageId = () => statuses[batch.batchId]?.stageId ?? localStorage.getItem(storageKey(batch.batchId));
  return <section className="space-y-3 rounded border border-cyan/30 p-3"><h4 className="font-semibold">交给 ChatGPT 整理</h4><p className="text-sm text-textMuted">本批共 {material.length} 份资料。请选择本次提供的资料；只有点击发送，所选资料的解析文本、原文定位和摘要身份才会暂存到私有研究桥。原文件保留在当前浏览器。</p>
    <p className="text-xs text-warning">暂存最多 24 小时；撤销会阻止后续读取，无法收回已被 ChatGPT 读取的内容。未选资料不会上传。</p>
    <fieldset disabled={busy} className="min-w-0"><legend className="text-sm font-semibold">本次发送的资料</legend>
      <button className={button} onClick={() => { setChoices(prior => ({ ...prior, [batch.batchId]: material.filter(s => s.parse.status === 'parsed').map(s => s.sourceId) })); setConfirmed(''); }}>选择全部已解析资料</button>
      {material.map(s => <label key={s.sourceId} className="flex min-h-11 items-center gap-2 break-all text-sm"><input type="checkbox" disabled={s.parse.status !== 'parsed'} checked={chosen.includes(s.sourceId)} onChange={e => { setChoices(prior => ({ ...prior, [batch.batchId]: e.target.checked ? [...chosen, s.sourceId] : chosen.filter(id => id !== s.sourceId) })); setConfirmed(''); }} />{s.filename}（{{ parsed: '已解析', failed: '解析失败，原件保留', pending: '等待解析' }[s.parse.status]}）</label>)}
      <p className="break-all text-sm">未发送清单：{omitted.length ? omitted.map(s => s.filename).join('、') : '无'}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!chosen.length} checked={confirmed === selectionKey} onChange={e => setConfirmed(e.target.checked ? selectionKey : '')} />我已核对清单，仅发送所选 {chosen.length} 份资料，保留 {omitted.length} 份不发送</label>
    </fieldset>
    <fieldset><legend className="text-sm font-semibold">同时提供已有知识（可选，默认不选）</legend>{!model?.pages.length && <p className="mt-1 text-xs text-textMuted">暂无已审核文章。</p>}{model?.pages.map(p => <label key={p.entry.wikiId} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(p.entry.wikiId)} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.entry.wikiId] : ids.filter(id => id !== p.entry.wikiId))} />{p.revision.title}（含已审核历史版本）</label>)}</fieldset>
    <label className="block text-sm">研究桥访问密钥<input className={wikiInputClass} type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder="仅在当前页面内存使用，不保存在浏览器" /></label>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || secret.length < 32 || !chosen.length || confirmed !== selectionKey} onClick={() => void send()}>发送给 ChatGPT</button><button className={button} disabled={busy || secret.length < 32} onClick={() => void run(async () => { const id = stageId(); wikiRequire(id, '本批尚未发送'); remember(await call(`status?stageId=${encodeURIComponent(id!)}`)); setMessage('已核对远端访问状态。'); })}>检查访问状态</button><button className={button} disabled={busy || secret.length < 32} onClick={() => void run(async () => { await call('revoke-batch', { batchId: batch.batchId }); const id = stageId(); if (id) remember(await call(`status?stageId=${encodeURIComponent(id)}`)); setMessage('已撤销本批此前全部暂存的资料与知识访问。之后重新发送需再次确认；其他批次不受影响。'); setConfirmed(''); })}>撤销 ChatGPT 访问</button></div>
    {status && <p className="text-sm text-cyan">{{ uploading: '尚在暂存，ChatGPT 不可读', readable: '已可读取', revoked: '已撤销', expired: '已过期' }[status.status]} · 截止 {new Date(status.expiresAt).toLocaleString('zh-CN')}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
