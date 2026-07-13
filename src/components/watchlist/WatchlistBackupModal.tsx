import { useMemo, useState } from "react";
import type { ImportValidationResult } from "../../services/watchlistRepository";
import { Modal } from "../common/Modal";

interface WatchlistBackupModalProps {
  exportJson: string;
  corruptedRaw?: string | null;
  onValidate: (raw: string) => ImportValidationResult;
  onMerge: (raw: string) => void;
  onReplace: (raw: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export function WatchlistBackupModal({ exportJson, corruptedRaw = null, onValidate, onMerge, onReplace, onReset, onClose }: WatchlistBackupModalProps) {
  const [raw, setRaw] = useState("");
  const validation = useMemo(() => raw.trim() ? onValidate(raw) : null, [onValidate, raw]);
  const download = (content: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal title="观察清单备份与恢复" description="默认采用安全合并；替换前会先保存当前状态备份。" onClose={onClose}>
      <div className="space-y-5">
        <section className="rounded-lg border border-borderSoft p-4">
          <h3 className="text-sm font-semibold text-textStrong">导出用户数据</h3>
          <p className="mt-1 text-xs text-textMuted">只包含观察项、复盘记录、任务状态和设置，不包含行情、公告或财务历史。</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => download(exportJson, "watchlist-review-workflow-v2.json")} className="h-9 rounded border border-cyan/50 px-3 text-sm text-cyan">下载 JSON</button>{corruptedRaw ? <button type="button" onClick={() => download(corruptedRaw, "watchlist-corrupted-raw.json")} className="h-9 rounded border border-warning/50 px-3 text-sm text-warning">导出损坏原始数据</button> : null}</div>
        </section>
        <section className="rounded-lg border border-borderSoft p-4">
          <h3 className="text-sm font-semibold text-textStrong">导入预览</h3>
          <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) file.text().then(setRaw); }} className="mt-3 block w-full min-w-0 text-sm text-textMuted file:mr-3 file:rounded file:border file:border-borderSoft file:bg-bg file:px-3 file:py-2 file:text-textStrong" />
          <textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="也可以粘贴 JSON" className="mt-3 min-h-32 w-full min-w-0 rounded border border-borderSoft bg-bg p-3 font-mono text-xs text-textStrong outline-none focus:border-cyan" />
          {validation ? <div className={`mt-3 rounded border p-3 text-xs ${validation.ok ? "border-success/35 bg-success/10 text-textMuted" : "border-warning/35 bg-warning/10 text-warning"}`}>
            <p>版本：{validation.preview.schemaVersion ?? "未知"} · 观察项：{validation.preview.watchItemCount} · 复盘记录：{validation.preview.reviewEntryCount} · 冲突：{validation.preview.conflictCount} · 无效：{validation.preview.invalidRecordCount}</p>
            <p className="mt-1">安全合并预计新增 {validation.preview.addCount}、跳过 {validation.preview.skipCount}；替换将替换当前 {validation.preview.replaceCount} 条记录。</p>
            {validation.errors.map((error) => <p key={error} className="mt-1">• {error}</p>)}
          </div> : null}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!validation?.ok} onClick={() => onMerge(raw)} className="h-9 rounded border border-cyan/50 px-3 text-sm text-cyan disabled:opacity-40">安全合并</button><button type="button" disabled={!validation?.ok} onClick={() => { if (window.confirm("替换会用导入文件覆盖当前用户数据。确认继续？")) onReplace(raw); }} className="h-9 rounded border border-warning/50 px-3 text-sm text-warning disabled:opacity-40">替换导入</button></div>
        </section>
        <section className="rounded-lg border border-danger/30 p-4"><h3 className="text-sm font-semibold text-textStrong">重置本地数据</h3><p className="mt-1 text-xs text-textMuted">用于损坏恢复。重置不会载入示例模板。</p><button type="button" onClick={() => { if (window.confirm("确认清空本地观察清单？历史复盘也会从当前存储移除。")) onReset(); }} className="mt-3 h-9 rounded border border-danger/50 px-3 text-sm text-danger">重置</button></section>
      </div>
    </Modal>
  );
}
