import { ExternalLink, History } from "lucide-react";
import { useState } from "react";
import type { ResearchEvent, ReviewEntry, WatchItemSnapshot } from "../../types";
import { sortReviewEntries } from "../../services/watchlistStore";

export function ReviewTimeline({ entries, events = [], onCorrect }: { entries: ReviewEntry[]; events?: ResearchEvent[]; onCorrect?: (entry: ReviewEntry) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortReviewEntries(entries);
  const visible = expanded ? sorted : sorted.slice(0, 5);
  if (!sorted.length) return <p className="rounded-md border border-borderSoft bg-bg2/60 p-3 text-sm text-textMuted">尚无复盘记录。首次提交后会在这里形成不可变时间线。</p>;
  return (
    <div className="min-w-0 space-y-3" aria-label="复盘时间线">
      {visible.map((entry) => {
        const linkedEvents = entry.triggerEventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is ResearchEvent => Boolean(event));
        const missingEventIds = entry.triggerEventIds.filter((id) => !events.some((event) => event.id === id));
        return (
          <article key={entry.id} aria-label={`复盘记录 ${entry.summary || entry.id}`} className="min-w-0 rounded-lg border border-borderSoft bg-bg2/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-textStrong"><History className="h-4 w-4 shrink-0 text-accent" /><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time></p>
              <span className="rounded border border-borderSoft px-2 py-1 text-xs text-textMuted">{triggerLabel(entry.triggerType)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-textStrong">{entry.summary || "未填写摘要"}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-textMuted">{entry.rationale || "未填写变化理由"}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <Snapshot label="复盘前" snapshot={entry.beforeSnapshot} />
              <Snapshot label="复盘后" snapshot={entry.afterSnapshot} />
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs text-textMuted">判断：{entry.decision || "保持原判断"} · 下一次复盘：{entry.nextReviewAt ?? "未设置"}</p>
            {entry.correctsReviewEntryId ? <p className="mt-2 break-all text-xs text-warning">纠正记录：{entry.correctsReviewEntryId}</p> : null}
            {linkedEvents.length ? <div className="mt-3 flex flex-wrap gap-2">{linkedEvents.map((event) => event.sourceUrl || event.pdfUrl ? <a key={event.id} href={event.sourceUrl ?? event.pdfUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 break-all text-xs text-accent hover:underline"><ExternalLink className="h-3 w-3 shrink-0" />{event.title}</a> : <span key={event.id} className="break-words text-xs text-textMuted">{event.title}（来源链接缺失）</span>)}</div> : null}
            {missingEventIds.length ? <p className="mt-2 break-all text-xs text-warning">关联事件暂不可用，记录 ID 保留：{missingEventIds.join("、")}</p> : null}
            {entry.evidenceRefs.length ? <div className="mt-2 space-y-1 text-xs text-textMuted">{entry.evidenceRefs.map((ref, index) => <p key={`${entry.id}-evidence-${index}`} className="break-all">证据：{ref.sourceName ?? ref.eventId ?? ref.announcementId ?? "用户记录"}{ref.reportPeriod ? ` · ${ref.reportPeriod}` : ""}{ref.sourceUrl ? <> · <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-accent hover:underline">查看证据来源</a></> : " · 来源链接未提供"}</p>)}</div> : null}
            {onCorrect ? <button type="button" onClick={() => onCorrect(entry)} className="mt-3 min-h-11 rounded border border-control px-3 text-sm text-accent hover:bg-selected">新增纠正记录</button> : null}
          </article>
        );
      })}
      {sorted.length > 5 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="min-h-11 text-sm text-accent hover:underline">{expanded ? "收起历史" : `展开全部 ${sorted.length} 条`}</button> : null}
    </div>
  );
}

function Snapshot({ label, snapshot }: { label: string; snapshot: WatchItemSnapshot }) {
  return <div className="min-w-0 rounded border border-borderSoft p-3"><p className="font-semibold text-textStrong">{label}：{snapshot.status}</p><p className="mt-2 whitespace-pre-wrap break-words text-textMuted">{snapshot.thesis || "未填写投资假设"}</p><SnapshotCriteria label="验证条件" values={snapshot.validationCriteria} /><SnapshotCriteria label="风险条件" values={snapshot.riskCriteria} /></div>;
}

function SnapshotCriteria({ label, values }: { label: string; values: string[] }) {
  return <div className="mt-3 text-textMuted"><p className="font-medium">{label}</p>{values.length ? <ul className="mt-1 space-y-1">{values.map((value, index) => <li key={index} className="whitespace-pre-wrap break-words">• {value}</li>)}</ul> : <p className="mt-1">未设置</p>}</div>;
}

function triggerLabel(value: ReviewEntry["triggerType"]) {
  return ({ manual: "手动复盘", review_due: "日期到期", financial_event: "财务事件", announcement_event: "公告事件", data_quality_warning: "数据质量警告" })[value];
}

function formatTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN", { hour12: false });
}
