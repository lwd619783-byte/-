import { useState } from "react";
import type { EarningsExpectationSnapshot, ResearchEvent, Stock } from "../../types";
import { EvidenceDrawer } from "./EvidenceDrawer";

/** Company-level navigation only. It never certifies a chart/metric/revision linkage. */
export function RelatedResearchEvidence({ stock, events, expectationSnapshots, onOpenStock, onOpenEvent }: {
  stock: Stock; events: ResearchEvent[]; expectationSnapshots?: EarningsExpectationSnapshot[];
  onOpenStock: (stock: Stock) => void; onOpenEvent?: (event: ResearchEvent) => void;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const related = events.filter(event => event.stockId === stock.id && event.stockCode === stock.code && event.market === stock.market && events.filter(candidate => candidate.id === event.id).length === 1)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return <>
    <button type="button" className="inbox-action" disabled={!related.length} onClick={() => setOpenFor(stock.id)}>公司相关证据（{related.length}）</button>
    {openFor === stock.id ? <EvidenceDrawer key={stock.id} events={related} stocks={[stock]} expectationSnapshots={expectationSnapshots} onClose={() => setOpenFor(null)} onOpenStock={onOpenStock} onOpenEvent={onOpenEvent} /> : null}
  </>;
}
