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
    const fresh = await sourceRepository.load(), material = fresh.sources.filter(s => s.batchId === batch.batchId);
    wikiRequire(material.length === batch.sourceIds.length && material.every(s => s.parse.status === 'parsed'), '请先完成本批全部资料的文字提取；失败原件不会被静默跳过');
    const sources = await Promise.all(material.map(async s => ({ metadata: { sourceId: s.sourceId, batchId: s.batchId, filename: s.filename, mime: s.mime, size: s.size, sha256: s.sha256, capturedAt: s.capturedAt, kind: s.kind, parsedTextSha256: await digestBytes(new TextEncoder().encode(JSON.stringify(s.parse.segments))) }, segments: s.parse.segments })));
    const documents = selected.map(wikiId => {
      const page = model?.pages.find(p => p.entry.wikiId === wikiId); wikiRequire(page, '所选文章暂不可用');
      return { wikiId, currentRevisionId: page!.revision.revisionId, revisions: wiki.revisions.filter(r => r.wikiId === wikiId && wikiRevisionStatus(wiki, r.revisionId, model!.asOf) === 'reviewed').map(r => ({ revisionId: r.revisionId, title: r.title, summary: r.summary, bodyMarkdown: r.bodyMarkdown, createdAt: r.createdAt, asOf: r.asOf, sourceRefs: r.sourceRefs, reviewId: wiki.reviews.find(review => review.revisionId === r.revisionId && review.decision === 'reviewed')!.reviewId })) };
    });
    // Check payload bounds before creating a remote staging record.
    [...sources, ...documents].forEach(value => wikiRequire(new TextEncoder().encode(JSON.stringify(value)).byteLength < 3 * 1024 * 1024 - 1024, '单份解析文本或历史超过 3 MiB，请拆分后发送'));
    const stage = await call('begin', { batchId: batch.batchId, title: batch.title, sourceMetadata: sources.map(s => s.metadata), knowledgeIds: selected, consent: 'stage-selected-batch-and-knowledge' }); remember(stage);
    for (const source of sources) await call('source', { stageId: stage.stageId, source });
    for (const document of documents) await call('knowledge', { stageId: stage.stageId, document });
    remember(await call('publish', { stageId: stage.stageId })); setMessage('本批已可供 ChatGPT 只读研究。请连接研究桥并选择此批次；研究结果仍需导回人工审核。');
  });
  const stageId = () => statuses[batch.batchId]?.stageId ?? localStorage.getItem(storageKey(batch.batchId));
  return <section className="space-y-3 rounded border border-cyan/30 p-3"><h4 className="font-semibold">交给 ChatGPT 整理</h4><p className="text-sm text-textMuted">只有点击下方发送按钮，才会将本批 {snapshot.sources.filter(s => s.batchId === batch.batchId).length} 份资料的解析文本、原文定位和摘要身份暂存到私有研究桥。原文件保留在当前浏览器。</p>
    <p className="text-xs text-warning">暂存最多 24 小时；撤销会阻止后续读取，无法收回已被 ChatGPT 读取的内容。未选资料不会上传。</p>
    <fieldset><legend className="text-sm font-semibold">同时提供已有知识（可选，默认不选）</legend>{!model?.pages.length && <p className="mt-1 text-xs text-textMuted">暂无已审核文章。</p>}{model?.pages.map(p => <label key={p.entry.wikiId} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(p.entry.wikiId)} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.entry.wikiId] : ids.filter(id => id !== p.entry.wikiId))} />{p.revision.title}（含已审核历史版本）</label>)}</fieldset>
    <label className="block text-sm">研究桥访问密钥<input className={wikiInputClass} type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder="仅在当前页面内存使用，不保存在浏览器" /></label>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || secret.length < 32} onClick={() => void send()}>发送给 ChatGPT</button><button className={button} disabled={busy || secret.length < 32} onClick={() => void run(async () => { const id = stageId(); wikiRequire(id, '本批尚未发送'); remember(await call(`status?stageId=${encodeURIComponent(id!)}`)); setMessage('已核对远端访问状态。'); })}>检查访问状态</button><button className={button} disabled={busy || secret.length < 32} onClick={() => void run(async () => { const id = stageId(); wikiRequire(id, '本批尚未发送'); await call('revoke-batch', { batchId: batch.batchId }); remember(await call(`status?stageId=${encodeURIComponent(id!)}`)); setMessage('已撤销，ChatGPT 无法继续读取此暂存批次。'); })}>撤销 ChatGPT 访问</button></div>
    {status && <p className="text-sm text-cyan">{{ uploading: '尚在暂存，ChatGPT 不可读', readable: '已可读取', revoked: '已撤销', expired: '已过期' }[status.status]} · 截止 {new Date(status.expiresAt).toLocaleString('zh-CN')}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
