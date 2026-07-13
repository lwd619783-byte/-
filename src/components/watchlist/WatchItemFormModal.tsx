import { useCallback, useState, type ReactNode } from "react";
import type { CreateWatchItemInput, WatchItemMetadataInput } from "../../services/watchlistStore";
import type { Stock, WatchItem, WatchPriority } from "../../types";
import { Modal } from "../common/Modal";

interface WatchItemFormModalProps {
  stocks: Stock[];
  item?: WatchItem | null;
  initialStockId?: string;
  onClose: () => void;
  onCreate: (input: CreateWatchItemInput) => void;
  onUpdate: (input: WatchItemMetadataInput) => void;
}

export function WatchItemFormModal({ stocks, item = null, initialStockId = "", onClose, onCreate, onUpdate }: WatchItemFormModalProps) {
  const [dirty, setDirty] = useState(false);
  const [stockId, setStockId] = useState(item?.stockId ?? initialStockId ?? stocks[0]?.id ?? "");
  const [reason, setReason] = useState(item?.reason ?? "");
  const [priority, setPriority] = useState<WatchPriority>(item?.priority ?? "medium");
  const [tags, setTags] = useState(item?.tags.join("，") ?? "");
  const [nextReviewAt, setNextReviewAt] = useState(item?.nextReviewAt ?? "");
  const [thesis, setThesis] = useState(item?.thesis ?? "");
  const [validation, setValidation] = useState(item?.validationCriteria.join("\n") ?? "");
  const [risk, setRisk] = useState(item?.riskCriteria.join("\n") ?? "");
  const update = <T,>(setter: (value: T) => void, value: T) => { setter(value); setDirty(true); };
  const requestClose = useCallback(() => {
    if (!dirty || typeof window === "undefined" || window.confirm("有未保存的修改，确认关闭？")) onClose();
  }, [dirty, onClose]);
  const submit = () => {
    const metadata = { reason, priority, tags: split(tags), nextReviewAt: nextReviewAt || null };
    if (item) onUpdate(metadata);
    else onCreate({ ...metadata, stockId, thesis, validationCriteria: lines(validation), riskCriteria: lines(risk) });
  };
  return (
    <Modal title={item ? "编辑观察项元数据" : "添加观察项"} description={item ? "投资假设、验证条件、风险条件和状态只能通过复盘流程更新。" : "首次加入时记录投资假设；后续核心变化进入不可变复盘时间线。"} onClose={requestClose} footer={<><button type="button" onClick={requestClose} className="h-10 rounded-md border border-borderSoft px-4 text-sm text-textMuted">取消</button><button type="button" onClick={submit} disabled={!item && !stockId} className="h-10 rounded-md border border-cyan/50 bg-cyan/10 px-4 text-sm font-semibold text-cyan disabled:opacity-40">保存</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {!item ? <Field label="公司"><select value={stockId} onChange={(event) => update(setStockId, event.target.value)} className={inputClass}>{stocks.map((stock) => <option key={stock.id} value={stock.id}>{stock.name} · {stock.code}</option>)}</select></Field> : <Field label="公司"><input value={stocks.find((stock) => stock.id === item.stockId)?.name ?? item.stockId} readOnly className={`${inputClass} opacity-70`} /></Field>}
        <Field label="优先级"><select value={priority} onChange={(event) => update(setPriority, event.target.value as WatchPriority)} className={inputClass}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></Field>
        <Field label="关注理由"><textarea value={reason} onChange={(event) => update(setReason, event.target.value)} className={`${inputClass} min-h-24`} /></Field>
        <Field label="标签（逗号分隔）"><textarea value={tags} onChange={(event) => update(setTags, event.target.value)} className={`${inputClass} min-h-24`} /></Field>
        <Field label="下一次复盘日期"><input type="date" value={nextReviewAt} onChange={(event) => update(setNextReviewAt, event.target.value)} className={inputClass} /></Field>
        {!item ? <><Field label="投资假设"><textarea value={thesis} onChange={(event) => update(setThesis, event.target.value)} className={`${inputClass} min-h-24`} /></Field><Field label="验证条件（每行一条）"><textarea value={validation} onChange={(event) => update(setValidation, event.target.value)} className={`${inputClass} min-h-28`} /></Field><Field label="风险条件（每行一条）"><textarea value={risk} onChange={(event) => update(setRisk, event.target.value)} className={`${inputClass} min-h-28`} /></Field></> : null}
      </div>
    </Modal>
  );
}

const inputClass = "w-full min-w-0 rounded-md border border-borderSoft bg-bg px-3 py-2 text-sm text-textStrong outline-none focus:border-cyan";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>; }
function lines(value: string) { return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]; }
function split(value: string) { return [...new Set(value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))]; }
