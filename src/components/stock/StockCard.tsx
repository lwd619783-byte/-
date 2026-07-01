import { ChevronRight } from "lucide-react";
import type { Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import type { Industry } from "../../types";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { DataQualityBadge, GlassCard, MetricCard, Sparkline } from "../common/terminal";

interface StockCardProps {
  stock: Stock;
  industries: Industry[];
  onOpen: (stock: Stock) => void;
}

export function StockCard({ stock, industries, onOpen }: StockCardProps) {
  return (
    <GlassCard className="p-4 transition hover:border-signal/60 hover:shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-steel">{stock.market} · {stock.code}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{stock.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DataQualityBadge quality={stock.dataQuality} />
          <span className="rounded border border-line bg-panel/80 px-2 py-1 text-xs text-steel">风险：{stock.riskLevel}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <MetricCard label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
        <MetricCard label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} tone={(stock.quote?.pctChange ?? 0) > 0 ? "red" : (stock.quote?.pctChange ?? 0) < 0 ? "green" : "neutral"} />
        <MetricCard label="总市值" value={formatYi(stock.quote?.marketCap)} />
      </div>
      <div className="mt-3 rounded-md border border-line bg-bg2/60 p-2">
        <Sparkline points={stock.priceHistory} />
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{stock.leaderPosition}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{stock.thesis}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <MetricCard label="PE / PB" value={`${numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} / ${numberToDisplay(stock.quote?.pb)}`} />
        <MetricCard label="报告期" value={stock.realFinancial?.reportDate ?? "数据暂缺"} />
        <MetricCard label="覆盖率" value={typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"} tone="cyan" />
      </div>
      <div className="mt-3 rounded-md border border-line bg-panel/70 p-2 text-xs text-steel">
        <p>来源：{stock.dataQuality?.map((item) => item.source).filter(Boolean).join(" / ") || "mock"}</p>
        <p>状态：{stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"}</p>
        <p>更新：{stock.quote?.updatedAt ?? stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"}</p>
        <p>
          缺失字段：
          <span className={(stock.missingFields?.length ?? 0) > 0 ? "text-warning" : "text-signal"}>{stock.missingFields?.length ?? 0}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.growthDrivers.slice(0, 3).map((driver) => (
          <span key={driver} className="rounded border border-signal/20 bg-signal/10 px-2 py-1 text-xs text-emerald-800">
            {driver}
          </span>
        ))}
      </div>

      <button
        className="mt-4 inline-flex h-9 items-center gap-1 rounded-md border border-borderGlow/60 px-3 text-sm font-medium text-ink transition hover:border-signal hover:text-signal"
        onClick={() => onOpen(stock)}
      >
        查看详情
        <ChevronRight className="h-4 w-4" />
      </button>
    </GlassCard>
  );
}
