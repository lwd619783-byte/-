import { ChevronRight } from "lucide-react";
import type { Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import type { Industry } from "../../types";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";

interface StockCardProps {
  stock: Stock;
  industries: Industry[];
  onOpen: (stock: Stock) => void;
}

export function StockCard({ stock, industries, onOpen }: StockCardProps) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-steel">{stock.market} · {stock.code}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{stock.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
          </p>
        </div>
        <span className="rounded border border-line bg-panel px-2 py-1 text-xs">风险：{stock.riskLevel}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Metric label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
        <Metric label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} />
        <Metric label="总市值" value={formatYi(stock.quote?.marketCap)} />
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{stock.leaderPosition}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{stock.thesis}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Metric label="PE TTM" value={numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} />
        <Metric label="PB" value={numberToDisplay(stock.quote?.pb)} />
        <Metric label="覆盖率" value={typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"} />
      </div>
      <div className="mt-3 rounded-md border border-line bg-panel p-2 text-xs text-slate-600">
        <p>来源：{stock.dataQuality?.map((item) => item.source).filter(Boolean).join(" / ") || "mock"}</p>
        <p>状态：{stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"}</p>
        <p>更新：{stock.quote?.updatedAt ?? stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"}</p>
        <p>缺失字段：{stock.missingFields?.length ?? 0}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.growthDrivers.slice(0, 3).map((driver) => (
          <span key={driver} className="rounded border border-signal/20 bg-signal/10 px-2 py-1 text-xs text-emerald-800">
            {driver}
          </span>
        ))}
      </div>

      <button
        className="mt-4 inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm font-medium text-ink transition hover:border-signal hover:text-signal"
        onClick={() => onOpen(stock)}
      >
        查看详情
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
