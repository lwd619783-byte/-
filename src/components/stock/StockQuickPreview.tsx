import type { Stock } from "../../types";
import { Modal } from "../common/Modal";
import { QuoteTrust } from "../common/QuoteTrust";
import { PriceChange, Sparkline } from "../common/terminal";
export function StockQuickPreview({stock,onClose,onOpenResearch}:{stock:Stock;onClose:()=>void;onOpenResearch:(stock:Stock)=>void}) {
 return <Modal size="drawer" title={`${stock.name} · 快速预览`} description={`${stock.code} / ${stock.market}`} onClose={onClose}
 footer={<><button type="button" onClick={onClose} className="rounded-md border border-control px-4 py-2">返回列表</button><button type="button" data-stock-id={stock.id} onClick={()=>onOpenResearch(stock)} className="rounded-md bg-accent px-4 py-2 font-semibold text-onaccent">打开完整研究</button></>}>
  <div className="space-y-5">
   <section><div className="flex flex-wrap items-baseline gap-4"><strong className="text-3xl tabular-nums">{stock.quote?.latestPrice ?? "—"}</strong><PriceChange value={stock.quote?.pctChange}/></div><p className="my-2 text-xs text-textMuted">价格单位 / 币种以原始来源为准</p><QuoteTrust quote={stock.quote}/></section>
   <section className="rounded-md border border-warning/60 bg-warning/5 p-3 text-sm leading-6"><p className="font-semibold text-warning">风险：{stock.riskLevel} · 研究限制</p><p>{stock.risks?.join("；") || "风险资料暂缺"}</p>{stock.missingFields?.length ? <p className="mt-2">缺失字段：{stock.missingFields.join("、")}</p>:null}</section>
   <section><h3 className="mb-3 font-semibold">已有收盘价脉络</h3><div className="min-h-24"><Sparkline points={stock.priceHistory ?? []}/></div><p className="mt-2 text-xs text-textMuted">{stock.priceHistory?.length ? `${stock.priceHistory[0].date} — ${stock.priceHistory[stock.priceHistory.length-1].date}；完整坐标与原始数据见完整研究。` : "暂无价格历史；其他研究内容仍可查看。"}</p></section>
   <section className="space-y-2 text-sm leading-7"><h3 className="font-semibold">研究摘要</h3><p>{stock.business || "主营业务资料暂缺"}</p><p className="text-textMuted">{stock.thesis || "研究依据暂缺"}</p></section>
  </div>
 </Modal>;
}
