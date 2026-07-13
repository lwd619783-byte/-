import { ExternalLink, History } from "lucide-react";
import { useState } from "react";
import type { ResearchEvent, ReviewEntry } from "../../types";
import { sortReviewEntries } from "../../services/watchlistStore";

export function ReviewTimeline({ entries, events = [], onCorrect }: { entries: ReviewEntry[]; events?: ResearchEvent[]; onCorrect?: (entry: ReviewEntry) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortReviewEntries(entries);
  const visible = expanded ? sorted : sorted.slice(0, 5);
  if (!sorted.length) return <p className="rounded-md border border-borderSoft bg-bg2/60 p-3 text-sm text-textMuted">尚无复盘记录。首次提交后会在这里形成不可变时间线。</p>;
  return (
    <div className="space-y-3" aria-label="复盘时间线">
      {visible.map((entry) => {
        const linkedEvents = entry.triggerEventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is ResearchEvent => Boolean(event));
        return (
          <article key={entry.id} className="rounded-lg border border-borderSoft bg-bg2/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-textStrong"><History className="h-4 w-4 text-cyan" />{formatTime(entry.createdAt)}</p>
              <span className="rounded border border-borderSoft px-2 py-1 text-xs text-textMuted">{triggerLabel(entry.triggerType)}</span>
            </div>
            <p className="mt-2 text-sm text-textStrong">{entry.summary || "未填写摘要"}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-textMuted">{entry.rationale || "未填写变化理由"}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <Snapshot label="复盘前" status={entry.beforeSnapshot.status} thesis={entry.beforeSnapshot.thesis} />
              <Snapshot label="复盘后" status={entry.afterSnapshot.status} thesis={entry.afterSnapshot.thesis} />
            </div>
            <p className="mt-2 text-xs text-textMuted">判断：{entry.decision || "保持原判断"} · 下一次复盘：{entry.nextReviewAt ?? "未设置"}</p>
            {entry.correctsReviewEntryId ? <p className="mt-2 text-xs text-warning">纠正记录：{entry.correctsReviewEntryId}</p> : null}
            {linkedEvents.length ? <div className="mt-3 flex flex-wrap gap-2">{linkedEvents.map((event) => event.sourceUrl || event.pdfUrl ? <a key={event.id} href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-cyan hover:underline"><ExternalLink className="h-3 w-3 shrink-0" />{event.title}</a> : <span key={event.id} className="text-xs text-textMuted">{event.title}（来源链接缺失）</span>)}</div> : null}
            {entry.evidenceRefs.length ? <div className="mt-2 space-y-1 text-xs text-textMuted">{entry.evidenceRefs.map((ref, index) => <p key={`${entry.id}-evidence-${index}`} className="break-all">证据：{ref.sourceName ?? ref.eventId ?? ref.announcementId ?? "用户记录"}{ref.reportPeriod ? ` · ${ref.reportPeriod}` : ""}{ref.sourceUrl ? <> · <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan hover:underline">官方来源</a></> : null}</p>)}</div> : null}
            {onCorrect ? <button type="button" onClick={() => onCorrect(entry)} className="mt-3 text-xs text-cyan hover:underline">新增纠正记录</button> : null}
          </article>
        );
      })}
      {sorted.length > 5 ? <button type="button" onClick={() => setExpanded((value) => !value)} className="text-sm text-cyan hover:underline">{expanded ? "收起历史" : `展开全部 ${sorted.length} 条`}</button> : null}
    </div>
  );
}

function Snapshot({ label, status, thesis }: { label: string; status: string; thesis: string }) {
  return <div className="min-w-0 rounded border border-borderSoft p-2"><p className="font-semibold text-textMuted">{label}：{status}</p><p className="mt-1 whitespace-pre-wrap break-words text-textMuted">{thesis || "未填写投资假设"}</p></div>;
}

function triggerLabel(value: ReviewEntry["triggerType"]) {
  return ({ manual: "手动复盘", review_due: "日期到期", financial_event: "财务事件", announcement_event: "公告事件", data_quality_warning: "数据质量警告" })[value];
}

function formatTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN", { hour12: false });
}
