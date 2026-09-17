import { useState } from "react";
import type { EarningsExpectationSnapshot, ResearchEvent, ReviewTask, Stock, WatchItem } from "../../types";
import { Modal } from "../common/Modal";
import { ResearchEventEvidence } from "./ResearchEventEvidence";
import type { ChartAuditView } from "../../services/chartAudit";
import { ChartAuditPanel } from "../charts/ChartAuditPanel";

export interface EvidenceDrawerProps {
  events: ResearchEvent[];
  expectationSnapshots?: EarningsExpectationSnapshot[];
  tasks?: ReviewTask[];
  watchItem?: WatchItem;
  unresolvedEventIds?: string[];
  stocks: Stock[];
  onClose: () => void;
  onOpenStock: (stock: Stock) => void;
  onOpenEvent?: (event: ResearchEvent) => void;
  onStartReview?: (item: WatchItem) => void;
}

export function EvidenceDrawer(props: EvidenceDrawerProps | { audit: ChartAuditView; onClose: () => void }) {
  if ('audit' in props) return <Modal title="Evidence Drawer / 证据核对" size="drawer" onClose={props.onClose} description="留存来源核对；candidate 证据不代表 PIT 或生产准入。"><ChartAuditPanel audit={props.audit} /></Modal>;
  return <EventEvidenceDrawer {...props} />;
}

function EventEvidenceDrawer({ events, expectationSnapshots = [], tasks = [], watchItem, unresolvedEventIds = [], stocks, onClose, onOpenStock, onOpenEvent, onStartReview }: EvidenceDrawerProps) {
  const [selectedId, setSelectedId] = useState(events[0]?.id);
  const event = events.find(event => event.id === selectedId);
  const snapshotMatches = expectationSnapshots.filter(snapshot => snapshot.id === event?.expectation?.snapshotId && snapshot.stockId === event.stockId);
  const expectationSnapshot = snapshotMatches.length === 1 ? snapshotMatches[0] : undefined;
  const reviewItem = watchItem && !watchItem.archivedAt ? watchItem : undefined;
  const stock = stocks.find(stock => stock.id === (event?.stockId ?? reviewItem?.stockId));
  const leave = (action: () => void) => { onClose(); action(); };
  return <Modal title="Evidence Drawer / 证据核对" size="drawer" onClose={onClose}
    description="核对来源、时间与数据限制，再继续研究。"
    footer={<div className="flex flex-wrap gap-2">
      {event && onOpenEvent ? <button type="button" className="inbox-action" onClick={() => leave(() => onOpenEvent(event))}>打开对应事件</button> : null}
      {stock ? <button type="button" className="inbox-action" data-stock-id={stock.id} onClick={() => leave(() => onOpenStock(stock))}>打开对应公司</button> : <span className="text-sm text-warning">公司未解析，无法跳转</span>}
      {reviewItem && onStartReview ? <button type="button" className="inbox-action" onClick={() => leave(() => onStartReview(reviewItem))}>开始复盘</button> : null}
    </div>}>
    {tasks.length ? <details className="mb-4" aria-label="关联既有复盘任务"><summary className="min-h-11 font-semibold">关联复盘任务 · {tasks.length}（展开原因）</summary><ul className="mt-2 space-y-2">{tasks.map(task => <li key={task.id} className="text-sm"><p>{task.title}</p><p className="text-xs text-textMuted">{task.description}</p><p className="text-xs text-warning">状态 {task.status} · 严重程度 {task.severity} · 任务日期 {task.dueAt ?? "未提供"}</p></li>)}</ul></details> : null}
    {unresolvedEventIds.length ? <p role="status" className="mb-3 break-all text-sm text-warning">关联事件未提供或公司不匹配：{unresolvedEventIds.join("、")}。未替换为其他事件。</p> : null}
    {events.length > 1 ? <label className="mb-4 block text-sm">关联证据<select className="mt-2 min-h-11 w-full" value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value)}>{events.map(event => <option key={event.id} value={event.id}>{event.title} · {event.id}</option>)}</select></label> : null}
    {event ? <ResearchEventEvidence expectationSnapshot={expectationSnapshot} event={event} tasks={tasks} onOpenStock={onOpenStock} /> : <section className="rounded-md border border-warning/40 p-4 text-sm leading-7 text-warning"><h3 className="font-semibold">未提供关联事件证据</h3><p>当前仅有复盘提醒；来源、URL、事件时间、解析、核验、数值与关联 revision 均未提供。</p><p>严格 PIT / 生产准入 / Evidence Graph：未证明。任务到期不代表新的公司披露。</p></section>}
  </Modal>;
}
