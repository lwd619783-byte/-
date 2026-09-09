import { QuoteTrust } from "../common/QuoteTrust";
import { ChevronRight } from "lucide-react";
import type { Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import type { Industry } from "../../types";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { statusDisplayLabel } from "../../utils/displayLabels";
import { formatStockFieldCoverage, formatStockModuleCoverage } from "../../utils/stockCoverage";
import { DataQualityBadge, GlassCard, MetricCard, Sparkline, TextClamp, metricTone } from "../common/terminal";

interface StockCardProps {
  stock: Stock;
  industries: Industry[];
  onOpen: (stock: Stock) => void;
  onOpenResearch?: (stock: Stock) => void;
}

export function StockCard({ stock, industries, onOpen, onOpenResearch }: StockCardProps) {
  const topEvidence = stock.evidenceItems?.[0];

  return (
    <GlassCard className="flex h-full w-full min-w-0 flex-col p-4 transition hover:border-cyan/60 hover:shadow-glow">
      <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <p className="text-xs text-textMuted">{stock.market} · {stock.code}</p>
          <h3 className="mt-1 break-words text-lg font-semibold text-textStrong">{stock.name}</h3>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:flex-col sm:items-end">
          <DataQualityBadge quality={stock.dataQuality} />
          <span className="rounded border border-borderSoft bg-surface/80 px-2 py-1 text-xs text-textMuted">风险：{stock.riskLevel}</span>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <MetricCard label="快照价格" value={numberToDisplay(stock.quote?.latestPrice)} />
        <MetricCard label="涨跌幅" value={`${(stock.quote?.pctChange ?? 0) > 0 ? "+" : ""}${formatPercent(stock.quote?.pctChange)}`} tone={metricTone(stock.quote?.pctChange)} />
        <MetricCard label="总市值" value={formatYi(stock.quote?.marketCap)} />
      </div>
      <p className="mt-2 text-xs text-textMuted">币种：源字段未提供</p>
      <div className="mt-3 rounded-md border border-borderSoft bg-bg2/60 p-2">
        <Sparkline points={stock.priceHistory} />
      </div>
      <p className="mt-3 break-words text-sm font-medium text-textStrong">
        {stock.leaderPosition}
      </p>
      <p className="mt-2 break-words text-sm leading-6 text-textMuted">
        {stock.thesis}
      </p>

      {stock.evidenceLevel ? (
        <div className="mt-3 rounded-md border border-borderSoft bg-bg2/60 p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-cyan/20 bg-cyan/10 px-2 py-1 text-cyan">验证等级：{stock.evidenceLevel}</span>
            <span className="rounded border border-borderSoft bg-surface/70 px-2 py-1 text-textMuted">状态：{stock.verificationStatus ?? "待验证"}</span>
            <span className="rounded border border-warning/25 bg-warning/10 px-2 py-1 text-warning">{stock.candidateType ?? "观察池"}</span>
          </div>
          {stock.themeTags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stock.themeTags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded bg-surface/80 px-2 py-0.5 text-xs leading-5 text-textMuted" title={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {topEvidence ? (
            <div className="mt-3 rounded border border-borderSoft bg-surface/70 p-2">
              <div className="mb-1 flex flex-wrap gap-1.5 text-xs leading-5">
                <span className="rounded bg-bg2/80 px-2 py-0.5 text-textMuted">证据 {stock.evidenceItems?.length ?? 0} 条</span>
                <span className={topEvidence.confidence === "高" ? "rounded bg-cyan/10 px-2 py-0.5 text-cyan" : "rounded bg-warning/10 px-2 py-0.5 text-warning"}>
                  {topEvidence.confidence}可信
                </span>
              </div>
              <TextClamp lines={2} title={topEvidence.claim} className="text-xs leading-5 text-textMuted">
                {topEvidence.claim}
              </TextClamp>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <MetricCard label="PE / PB" value={`${numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} / ${numberToDisplay(stock.quote?.pb)}`} />
        <MetricCard label="报告期" value={stock.realFinancial?.reportDate ?? "数据暂缺"} />
        <MetricCard label="行情/财务字段" value={formatStockFieldCoverage(stock.dataCoverageDetails)} tone="cyan" />
      </div>
      <div className="mt-3 rounded-md border border-borderSoft bg-surface/70 p-2 text-xs text-textMuted">
        <p className="flex min-w-0 gap-1">
          <span className="shrink-0">来源：</span>
          <span className="break-words">{stock.dataQuality?.map((item) => item.source).filter(Boolean).join(" / ") || "来源未知"}</span>
        </p>
        <p className="break-words">
          状态：{stock.dataQuality?.map((item) => statusDisplayLabel(item.status)).join(" / ") || "状态未知"}
        </p>
        <QuoteTrust quote={stock.quote} />
        <p>{formatStockModuleCoverage(stock.dataCoverageDetails)}</p>
        <p>
          缺失字段：
          <span className={(stock.missingFields?.length ?? 0) > 0 ? "text-warning" : "text-success"}>{stock.missingFields?.length ?? 0}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.growthDrivers.slice(0, 3).map((driver) => (
          <span key={driver} className="rounded border border-cyan/20 bg-cyan/10 px-2 py-1 text-xs leading-5 text-cyan" title={driver}>
            {driver}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button type="button" data-stock-id={stock.id} aria-label={`快速预览 ${stock.name}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-md border border-control px-3 text-sm font-medium text-accent transition hover:bg-selected"
          onClick={() => onOpen(stock)}>
          快速预览<ChevronRight className="h-4 w-4" />
        </button>
        {onOpenResearch ? <button type="button" aria-label={`完整研究 ${stock.name}`}
          className="min-h-11 rounded-md border border-control px-3 text-sm font-medium text-text transition hover:bg-selected"
          onClick={() => onOpenResearch(stock)}>完整研究</button> : null}
      </div>
    </GlassCard>
  );
}
