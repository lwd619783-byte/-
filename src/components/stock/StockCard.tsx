import { ChevronRight } from "lucide-react";
import type { Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import type { Industry } from "../../types";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { DataQualityBadge, GlassCard, MetricCard, OverflowTooltip, Sparkline, TextClamp } from "../common/terminal";

interface StockCardProps {
  stock: Stock;
  industries: Industry[];
  onOpen: (stock: Stock) => void;
}

export function StockCard({ stock, industries, onOpen }: StockCardProps) {
  return (
    <GlassCard className="flex h-full flex-col p-4 transition hover:border-cyan/60 hover:shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-textMuted">{stock.market} · {stock.code}</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-textStrong" title={stock.name}>{stock.name}</h3>
          <p className="mt-1 truncate text-xs text-textMuted" title={`${getIndustryName(industries, stock.industryId)} / ${getSegmentName(industries, stock.segmentId)}`}>
            {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DataQualityBadge quality={stock.dataQuality} />
          <span className="rounded border border-borderSoft bg-surface/80 px-2 py-1 text-xs text-textMuted">风险：{stock.riskLevel}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <MetricCard label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
        <MetricCard label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} tone={(stock.quote?.pctChange ?? 0) > 0 ? "green" : (stock.quote?.pctChange ?? 0) < 0 ? "red" : "neutral"} />
        <MetricCard label="总市值" value={formatYi(stock.quote?.marketCap)} />
      </div>
      <div className="mt-3 rounded-md border border-borderSoft bg-bg2/60 p-2">
        <Sparkline points={stock.priceHistory} />
      </div>
      <TextClamp lines={2} title={stock.leaderPosition} className="mt-3 text-sm font-medium text-textStrong">
        {stock.leaderPosition}
      </TextClamp>
      <TextClamp lines={3} title={stock.thesis} className="mt-2 text-sm leading-6 text-textMuted">
        {stock.thesis}
      </TextClamp>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <MetricCard label="PE / PB" value={`${numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} / ${numberToDisplay(stock.quote?.pb)}`} />
        <MetricCard label="报告期" value={stock.realFinancial?.reportDate ?? "数据暂缺"} />
        <MetricCard label="覆盖率" value={typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"} tone="cyan" />
      </div>
      <div className="mt-3 rounded-md border border-borderSoft bg-surface/70 p-2 text-xs text-textMuted">
        <p className="flex min-w-0 gap-1">
          <span className="shrink-0">来源：</span>
          <OverflowTooltip title={stock.dataQuality?.map((item) => item.source).filter(Boolean).join(" / ") || "mock"}>
            {stock.dataQuality?.map((item) => item.source).filter(Boolean).join(" / ") || "mock"}
          </OverflowTooltip>
        </p>
        <p className="truncate" title={stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"}>
          状态：{stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"}
        </p>
        <p className="truncate" title={stock.quote?.updatedAt ?? stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"}>
          更新：{stock.quote?.updatedAt ?? stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"}
        </p>
        <p>
          缺失字段：
          <span className={(stock.missingFields?.length ?? 0) > 0 ? "text-warning" : "text-success"}>{stock.missingFields?.length ?? 0}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.growthDrivers.slice(0, 3).map((driver) => (
          <span key={driver} className="max-w-full truncate rounded border border-cyan/20 bg-cyan/10 px-2 py-1 text-xs text-cyan" title={driver}>
            {driver}
          </span>
        ))}
      </div>

      <button
        className="mt-auto inline-flex h-9 w-fit items-center gap-1 rounded-md border border-borderGlow/60 px-3 text-sm font-medium text-textStrong transition hover:border-cyan hover:text-cyan focus:outline-none focus:ring-2 focus:ring-cyan/30"
        onClick={() => onOpen(stock)}
      >
        查看详情
        <ChevronRight className="h-4 w-4" />
      </button>
    </GlassCard>
  );
}
