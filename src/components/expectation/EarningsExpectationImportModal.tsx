import { useState } from "react";
import type { EarningsExpectationImportPreview } from "../../services/earningsExpectationRepository";
import { Modal } from "../common/Modal";

interface EarningsExpectationImportModalProps {
  exportJson: string;
  exportCsv: string;
  csvTemplate: string;
  corruptedRaw?: string | null;
  onPreviewJson: (raw: string) => EarningsExpectationImportPreview;
  onPreviewCsv: (raw: string, fileName?: string | null) => EarningsExpectationImportPreview;
  onImport: (preview: EarningsExpectationImportPreview, method: "json_import" | "csv_import", mode: "merge" | "replace", fileName?: string | null) => void;
  onReset: () => void;
  onClose: () => void;
}

export function EarningsExpectationImportModal(props: EarningsExpectationImportModalProps) {
  const [method, setMethod] = useState<"json_import" | "csv_import">("json_import");
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<EarningsExpectationImportPreview | null>(null);
  const updateRaw = (value: string, name: string | null = null) => { setRaw(value); setFileName(name); setPreview(method === "json_import" ? props.onPreviewJson(value) : props.onPreviewCsv(value, name)); };
  return (
    <Modal title="业绩预期备份与结构化导入" description="导入先预览；无效、冲突或口径不明记录不会写入有效快照。" onClose={props.onClose}>
      <div className="space-y-4">
        <section className="rounded-lg border border-borderSoft p-4">
          <h3 className="text-sm font-semibold text-textStrong">导出与模板</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => download(props.exportJson, "earnings-expectation-v1.json", "application/json")} className={buttonClass}>导出 JSON</button>
            <button type="button" onClick={() => download(props.exportCsv, "earnings-expectation-v1.csv", "text/csv;charset=utf-8")} className={buttonClass}>导出 CSV</button>
            <button type="button" onClick={() => download(`\uFEFF${props.csvTemplate}`, "earnings-expectation-template.csv", "text/csv;charset=utf-8")} className={buttonClass}>下载 CSV 模板</button>
            {props.corruptedRaw ? <button type="button" onClick={() => download(props.corruptedRaw ?? "", "earnings-expectation-corrupted-raw.json", "application/json")} className={`${buttonClass} border-warning/50 text-warning`}>导出损坏原始数据</button> : null}
          </div>
        </section>

        <section className="rounded-lg border border-borderSoft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-textStrong">导入预览</h3><select value={method} onChange={(event) => { const value = event.target.value as typeof method; setMethod(value); setRaw(""); setFileName(null); setPreview(null); }} className={inputClass}><option value="json_import">JSON 导入</option><option value="csv_import">CSV 导入</option></select></div>
          <p className="mt-2 text-xs text-textMuted">限制：UTF-8、最大 2MB、最多 5000 条。CSV 口径不明行进入核验记录，不参与比较。</p>
          <input type="file" accept={method === "json_import" ? "application/json,.json" : "text/csv,.csv"} onChange={(event) => { const file = event.target.files?.[0]; if (file) file.text().then((value) => updateRaw(value, file.name)); }} className="mt-3 block w-full min-w-0 text-sm text-textMuted file:mr-3 file:rounded file:border file:border-borderSoft file:bg-bg file:px-3 file:py-2 file:text-textStrong" />
          <textarea value={raw} onChange={(event) => updateRaw(event.target.value, fileName)} placeholder={method === "json_import" ? "也可以粘贴 JSON" : "也可以粘贴 CSV"} className="mt-3 min-h-36 w-full min-w-0 rounded border border-borderSoft bg-bg p-3 font-mono text-xs text-textStrong outline-none focus:border-cyan" />
          {preview ? <Preview value={preview} /> : null}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!preview?.ok} onClick={() => preview && props.onImport(preview, method, "merge", fileName)} className={`${buttonClass} border-cyan/50 text-cyan disabled:opacity-40`}>合并导入</button><button type="button" disabled={!preview?.ok} onClick={() => { if (preview && window.confirm("替换导入会先备份当前业绩预期，再原子覆盖。确认继续？")) props.onImport(preview, method, "replace", fileName); }} className={`${buttonClass} border-warning/50 text-warning disabled:opacity-40`}>替换导入</button></div>
        </section>

        <section className="rounded-lg border border-danger/30 p-4"><h3 className="text-sm font-semibold text-textStrong">损坏恢复</h3><p className="mt-1 text-xs text-textMuted">重置只在用户明确确认后执行，不会写入示例预期。</p><button type="button" onClick={() => { if (window.confirm("确认清空本地业绩预期？请先导出需要保留的数据。")) props.onReset(); }} className={`${buttonClass} mt-3 border-danger/50 text-danger`}>重置为空状态</button></section>
      </div>
    </Modal>
  );
}

function Preview({ value }: { value: EarningsExpectationImportPreview }) { return <div className={`mt-3 rounded border p-3 text-xs ${value.ok ? "border-success/35 bg-success/10 text-textMuted" : "border-warning/35 bg-warning/10 text-warning"}`}><p>版本：{value.schemaVersion ?? "未知"} · 总数：{value.totalCount} · 有效：{value.validCount}</p><p className="mt-1">新增：{value.addCount} · 重复：{value.duplicateCount} · 冲突：{value.conflictCount} · 无效/待核验：{value.invalidCount}</p>{value.issues.slice(0, 20).map((issue, index) => <p key={`${issue.row}-${issue.code}-${index}`} className="mt-1 break-words">• 第 {issue.row || "-"} 行：{issue.message}</p>)}</div>; }
function download(value: string, name: string, type: string) { const url = URL.createObjectURL(new Blob([value], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
const inputClass = "h-10 min-w-0 rounded border border-borderSoft bg-bg px-3 text-sm text-textStrong outline-none focus:border-cyan";
const buttonClass = "h-9 rounded border border-borderSoft px-3 text-sm text-textStrong";
