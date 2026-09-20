import { useState } from 'react';
import type { WikiData } from '../../types/wiki';
import type { WikiRepository, WikiImportPreview } from '../../services/wikiRepository';
import { Modal } from '../common/Modal';
import { wikiInputClass } from './WikiRevisionForm';

export function downloadWikiFile(content: string | Uint8Array, name: string, type: string) {
  const bytes = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([bytes], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WikiBackupModal({ repository, data, corruptedRaw, onSaved, onClose }: { repository: WikiRepository; data: WikiData; corruptedRaw?: string; onSaved: (data: WikiData) => void; onClose: () => void }) {
  const [raw, setRaw] = useState(''), [error, setError] = useState<string | null>(null), [preview, setPreview] = useState<WikiImportPreview | null>(null);
  const act = (action: () => void) => { try { action(); setError(null); } catch (cause) { setError(String(cause)); } };
  return <Modal title={corruptedRaw === undefined ? '导入文章备份' : '恢复文章存储'} description="备份保存全部文章、版本和审核历史。原始资料需要另行保存；导出的阅读文件不能替代备份。" onClose={onClose} error={error}>
    <label className="block text-sm">文章备份内容<textarea className={`${wikiInputClass} mt-2`} rows={10} value={raw} onChange={event => { setRaw(event.target.value); setPreview(null); }} /></label>
    <button type="button" className="inbox-action mt-3" onClick={() => act(() => setPreview(corruptedRaw === undefined ? repository.previewImport(raw, data) : repository.previewRecovery(raw, corruptedRaw)))}>校验文章备份</button>
    {preview && <div className="mt-4 space-y-3"><p role="status">预览：追加 {preview.addCount} 条；相同记录跳过 {preview.skipCount} 条。已有历史不可覆盖。</p><button type="button" className="inbox-action" onClick={() => act(() => {
      downloadWikiFile(corruptedRaw ?? repository.export(data), 'wiki-pre-restore.json', 'application/json');
      onSaved(corruptedRaw === undefined ? repository.import(data, raw, true) : repository.recoverCorrupt(raw, corruptedRaw, true)); onClose();
    })}>备份当前字节并确认导入</button></div>}
  </Modal>;
}
