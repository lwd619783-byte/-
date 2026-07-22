import { useCallback, useMemo, useState } from "react";
import type { CompleteReviewInput } from "../../services/watchlistStore";
import type { ResearchEvent, ReviewEntry, ReviewTask, ReviewTriggerType, WatchItem, WatchStatus } from "../../types";
import { Modal } from "../common/Modal";

interface ReviewFormModalProps {
  watchItem: WatchItem;
  events: ResearchEvent[];
  tasks: ReviewTask[];
  correctionTarget?: ReviewEntry | null;
  onClose: () => void;
  onSubmit: (input: CompleteReviewInput) => void;
}

const STATUSES: WatchStatus[] = ["观察", "已配置", "等回调", "等业绩验证", "剔除观察"];

export function ReviewFormModal({ watchItem, events, tasks, correctionTarget = null, onClose, onSubmit }: ReviewFormModalProps) {
  const [dirty, setDirty] = useState(false);
  const [triggerType, setTriggerType] = useState<ReviewTriggerType>(correctionTarget ? correctionTarget.triggerType : "manual");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(correctionTarget?.triggerEventIds ?? tasks.flatMap((task) => task.relatedEventIds));
  const [newEvidence, setNewEvidence] = useState("");
  const [decision, setDecision] = useState("保持原判断");
  const [rationale, setRationale] = useState("");
  const [thesis, setThesis] = useState(watchItem.thesis);
  const [validation, setValidation] = useState(watchItem.validationCriteria.join("\n"));
  const [risk, setRisk] = useState(watchItem.riskCriteria.join("\n"));
  const [status, setStatus] = useState<WatchStatus>(watchItem.status);
  const [nextReviewAt, setNextReviewAt] = useState(watchItem.nextReviewAt ?? "");
  const [note, setNote] = useState("");
  const stockEvents = useMemo(() => events.filter((event) => event.stockId === watchItem.stockId), [events, watchItem.stockId]);
  const set = <T,>(setter: (value: T) => void, value: T) => { setter(value); setDirty(true); };
  const requestClose = useCallback(() => {
    if (!dirty || typeof window === "undefined" || window.confirm("有未保存的复盘内容，确认关闭？")) onClose();
  }, [dirty, onClose]);

  const submit = () => {
    const linked = stockEvents.filter((event) => selectedEvents.includes(event.id));
    onSubmit({
      triggerType,
      triggerEventIds: [...new Set(selectedEvents)],
      handledTaskIds: tasks.filter((task) => task.status === "pending" && task.relatedEventIds.every((id) => selectedEvents.includes(id))).map((task) => task.id),
      summary: newEvidence || "本次复盘未补充文字证据",
      rationale: [rationale, note].filter(Boolean).join("\n"),
      evidenceRefs: linked.map((event) => ({
        eventId: event.id,
        announcementId: event.relatedAnnouncementIds[0],
        reportPeriod: event.reportPeriod ?? undefined,
        sourceName: event.sourceName,
        sourceUrl: event.sourceUrl ?? event.pdfUrl ?? undefined,
      })),
      decision,
      thesis,
      validationCriteria: lines(validation),
      riskCriteria: lines(risk),
      status,
      nextReviewAt: nextReviewAt || null,
      correctsReviewEntryId: correctionTarget?.id ?? null,
    });
  };

  return (
    <Modal
      title={correctionTarget ? "新增纠正复盘记录" : "完成一次投研复盘"}
      description="提交后会追加不可变 ReviewEntry，并原子更新当前观察项。"
      onClose={requestClose}
      footer={<><button type="button" onClick={requestClose} className="h-10 rounded-md border border-borderSoft px-4 text-sm text-textMuted">取消</button><button type="button" onClick={submit} className="h-10 rounded-md border border-cyan/50 bg-cyan/10 px-4 text-sm font-semibold text-cyan">提交复盘</button></>}
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="本次触发原因"><select value={triggerType} onChange={(event) => set(setTriggerType, event.target.value as ReviewTriggerType)} className={inputClass}><option value="manual">手动复盘</option><option value="review_due">日期到期</option><option value="financial_event">财务事件</option><option value="announcement_event">公告事件</option><option value="data_quality_warning">数据质量警告</option></select></Field>
        <Field label="判断是否变化"><select value={decision} onChange={(event) => set(setDecision, event.target.value)} className={inputClass}><option>保持原判断</option><option>提高关注</option><option>降低关注</option><option>等待更多证据</option><option>结束观察</option></select></Field>
        <div className="sm:col-span-2"><p className="mb-2 text-xs text-textMuted">关联 ResearchEvent</p><div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-borderSoft p-3">{stockEvents.length ? stockEvents.map((event) => <label key={event.id} className="flex items-start gap-2 text-sm text-textMuted"><input type="checkbox" checked={selectedEvents.includes(event.id)} onChange={(change) => set(setSelectedEvents, change.target.checked ? [...selectedEvents, event.id] : selectedEvents.filter((id) => id !== event.id))} className="mt-1" /><span className="min-w-0 break-words">{event.eventDate ?? "日期缺失"} · {event.title} · {event.parseStatus}{event.expectation?.ingestionMethod === "provider" ? ` · 公司官方指引 Provider ${event.expectation.providerVersion ?? "-"}（只读）` : ""}</span></label>) : <p className="text-sm text-textMuted">当前没有可关联事件，可继续手动复盘。</p>}</div></div>
        <Field label="当前投资假设"><textarea value={watchItem.thesis} readOnly className={`${inputClass} min-h-24 opacity-75`} /></Field>
        <Field label="本次新证据"><textarea value={newEvidence} onChange={(event) => set(setNewEvidence, event.target.value)} className={`${inputClass} min-h-24`} placeholder="记录事实或来源，不填写无来源数字" /></Field>
        <Field label="变化原因"><textarea value={rationale} onChange={(event) => set(setRationale, event.target.value)} className={`${inputClass} min-h-24`} /></Field>
        <Field label="更新后的投资假设"><textarea value={thesis} onChange={(event) => set(setThesis, event.target.value)} className={`${inputClass} min-h-24`} /></Field>
        <Field label="更新后的验证条件（每行一条）"><textarea value={validation} onChange={(event) => set(setValidation, event.target.value)} className={`${inputClass} min-h-28`} /></Field>
        <Field label="更新后的风险条件（每行一条）"><textarea value={risk} onChange={(event) => set(setRisk, event.target.value)} className={`${inputClass} min-h-28`} /></Field>
        <Field label="更新后的观察状态"><select value={status} onChange={(event) => set(setStatus, event.target.value as WatchStatus)} className={inputClass}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="下一次复盘日期"><input type="date" value={nextReviewAt} onChange={(event) => set(setNextReviewAt, event.target.value)} className={inputClass} /></Field>
        <div className="sm:col-span-2"><Field label="自定义备注"><textarea value={note} onChange={(event) => set(setNote, event.target.value)} className={`${inputClass} min-h-20`} /></Field></div>
      </div>
    </Modal>
  );
}

const inputClass = "w-full min-w-0 rounded-md border border-borderSoft bg-bg px-3 py-2 text-sm text-textStrong outline-none focus:border-cyan";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{children}</label>;
}

function lines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}
