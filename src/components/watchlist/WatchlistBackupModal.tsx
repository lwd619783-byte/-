import { useEffect, useMemo, useRef, useState } from "react";
import { useSubmission } from "../../hooks/useSubmission";
import type { ImportValidationResult } from "../../services/watchlistRepository";
import { Modal } from "../common/Modal";

interface WatchlistBackupModalProps {
  exportJson: string;
  corruptedRaw?: string | null;
  onValidate: (raw: string) => ImportValidationResult;
  onMerge: (raw: string) => boolean | void;
  onReplace: (raw: string) => boolean | void;
  onReset: () => boolean | void;
  onClose: () => void;
  error?: string | null;
}

export function WatchlistBackupModal({ exportJson, corruptedRaw = null, onValidate, onMerge, onReplace, onReset, onClose, error }: WatchlistBackupModalProps) {
  const [raw, setRaw] = useState("");
  const { pending, run } = useSubmission();
  const [feedback,setFeedback]=useState<string|null>(null);
  const perform=(action:()=>boolean|void,label:string)=>void run(()=>{if(action()===true){setRaw("");setFeedback(label);}});
  const fileGeneration=useRef(0);
  const [fileError,setFileError]=useState<string|null>(null);
  useEffect(()=>()=>{fileGeneration.current++;},[]);
  const close=()=>{if(!raw || window.confirm("导入输入尚未提交，确认关闭？"))onClose();};
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
    <Modal error={fileError || error} busy={pending} hasUnsavedChanges={!!raw} onDiscard={onClose} size="import" title="观察清单备份与恢复" description="默认采用安全合并；替换前会先保存当前状态备份。" onClose={close}
      footer={<><button type="button" disabled={pending} onClick={close} className="rounded-md border border-control px-4 py-2">关闭</button><button type="button" disabled={pending || !validation?.ok} onClick={()=>perform(()=>onMerge(raw),"安全合并已完成，导出可查看最新用户记录。")} className="rounded-md border border-control px-4 py-2 text-accent disabled:opacity-40">{pending ? "提交中…" : "安全合并"}</button><button type="button" disabled={pending || !validation?.ok} onClick={()=>{if(window.confirm("替换会用导入文件覆盖当前用户数据。确认继续？"))perform(()=>onReplace(raw),"替换已完成，替换前备份已按原流程保存。");}} className="rounded-md border border-warning px-4 py-2 text-warning disabled:opacity-40">替换导入</button></>}>
      <div className="space-y-5">{feedback ? <p role="status" className="rounded-md border border-success p-3 text-sm text-success">{feedback}</p>:null}
        <section className="rounded-lg border border-borderSoft p-4">
          <h3 className="text-sm font-semibold text-textStrong">导出用户数据</h3>
          <p className="mt-1 text-xs text-textMuted">只包含观察项、复盘记录、任务状态和设置，不包含行情、公告或财务历史。</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => download(exportJson, "watchlist-review-workflow-v2.json")} className="h-9 rounded border border-cyan/50 px-3 text-sm text-cyan">下载 JSON</button>{corruptedRaw ? <button type="button" onClick={() => download(corruptedRaw, "watchlist-corrupted-raw.json")} className="h-9 rounded border border-warning/50 px-3 text-sm text-warning">导出损坏原始数据</button> : null}</div>
        </section>
        <section className="rounded-lg border border-borderSoft p-4">
          <h3 className="text-sm font-semibold text-textStrong">导入预览</h3>
          <input aria-label="选择观察清单备份文件" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if(file){const generation=++fileGeneration.current;setFileError(null);file.text().then(value=>{if(generation===fileGeneration.current)setRaw(value);}).catch(()=>{if(generation===fileGeneration.current)setFileError("文件读取失败，请重新选择。已有输入未清空。");});} }} className="mt-3 block w-full min-w-0 text-sm text-textMuted file:mr-3 file:rounded file:border file:border-borderSoft file:bg-bg file:px-3 file:py-2 file:text-textStrong" />
          <textarea aria-label="备份导入原文" value={raw} onChange={(event) => {fileGeneration.current++;setFileError(null);setRaw(event.target.value);}} placeholder="也可以粘贴 JSON" className="mt-3 min-h-32 w-full min-w-0 rounded border border-borderSoft bg-bg p-3 font-mono text-xs text-textStrong outline-none focus:border-cyan" />
          {validation ? <div className={`mt-3 rounded border p-3 text-xs ${validation.ok ? "border-success/35 bg-success/10 text-textMuted" : "border-warning/35 bg-warning/10 text-warning"}`}>
            <p>版本：{validation.preview.schemaVersion ?? "未知"} · 观察项：{validation.preview.watchItemCount} · 复盘记录：{validation.preview.reviewEntryCount} · 冲突：{validation.preview.conflictCount} · 无效：{validation.preview.invalidRecordCount}</p>
            <p className="mt-1">安全合并预计新增 {validation.preview.addCount}、跳过 {validation.preview.skipCount}；替换将替换当前 {validation.preview.replaceCount} 条记录。</p>
            {validation.errors.map((error) => <p key={error} className="mt-1">• {error}</p>)}
          </div> : null}

        </section>
        <section className="rounded-lg border border-danger/30 p-4"><h3 className="text-sm font-semibold text-textStrong">重置本地数据</h3><p className="mt-1 text-xs text-textMuted">用于损坏恢复。重置不会载入示例模板。</p><button type="button" onClick={() => { if (window.confirm("确认清空本地观察清单？历史复盘也会从当前存储移除。")) perform(onReset,"本地观察数据已重置。"); }} className="mt-3 h-9 rounded border border-danger/50 px-3 text-sm text-danger">重置</button></section>
      </div>
    </Modal>
  );
}
