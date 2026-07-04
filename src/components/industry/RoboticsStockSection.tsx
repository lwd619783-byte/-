import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { Industry, Stock } from "../../types";
import { getSegmentName } from "../../utils/filters";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { DashboardCard, PriceChange, TextClamp } from "../common/terminal";

const OBSERVATION_PREVIEW_COUNT = 10;

export function RoboticsStockSection({
  stocks,
  industries,
  onOpenStock,
}: {
  stocks: Stock[];
  industries: Industry[];
  onOpenStock: (stock: Stock) => void;
}) {
  const [showObservationPool, setShowObservationPool] = useState(false);
  const [showAllObservation, setShowAllObservation] = useState(false);

  const { corePool, observationPool } = useMemo(
    () => ({
      corePool: stocks.filter((stock) => stock.candidateType !== "观察池"),
      observationPool: stocks.filter((stock) => stock.candidateType === "观察池"),
    }),
    [stocks],
  );

  const visibleObservationPool = showAllObservation ? observationPool : observationPool.slice(0, OBSERVATION_PREVIEW_COUNT);

  return (
    <div className="space-y-4">
      <PoolPanel
        title="核心池"
        description="重点跟踪的机器人产业链上市公司，用宽行卡片承载业务、投资逻辑、验证状态和行情摘要。"
        count={corePool.length}
      >
        <RoboticsStockList stocks={corePool} industries={industries} onOpenStock={onOpenStock} />
      </PoolPanel>

      <DashboardCard className="p-4">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan/25"
          onClick={() => setShowObservationPool((value) => !value)}
        >
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-textStrong">观察池</h3>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              机构纪要、主题映射或汽零迁移线索公司，默认折叠；仅作为待验证线索，不写成确定供货关系。
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-xs text-textMuted">
            {observationPool.length} 家
            {showObservationPool ? <ChevronDown className="h-4 w-4 text-cyan" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {showObservationPool ? (
          <div className="mt-4 space-y-3">
            <RoboticsStockList stocks={visibleObservationPool} industries={industries} onOpenStock={onOpenStock} />
            {observationPool.length > OBSERVATION_PREVIEW_COUNT ? (
              <button
                type="button"
                className="rounded-md border border-borderSoft px-3 py-2 text-sm text-textMuted transition hover:border-cyan/45 hover:text-cyan"
                onClick={() => setShowAllObservation((value) => !value)}
              >
                {showAllObservation ? "收起观察池" : `展开全部 ${observationPool.length} 家`}
              </button>
            ) : null}
          </div>
        ) : null}
      </DashboardCard>
    </div>
  );
}

function PoolPanel({ title, description, count, children }: { title: string; description: string; count: number; children: ReactNode }) {
  return (
    <DashboardCard className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-textStrong">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-textMuted">{description}</p>
        </div>
        <span className="shrink-0 rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-xs text-textMuted">{count} 家</span>
      </div>
      {children}
    </DashboardCard>
  );
}

function RoboticsStockList({ stocks, industries, onOpenStock }: { stocks: Stock[]; industries: Industry[]; onOpenStock: (stock: Stock) => void }) {
  if (stocks.length === 0) {
    return <p className="rounded-lg border border-dashed border-borderSoft bg-surface/70 p-6 text-center text-sm text-textMuted">当前筛选条件下没有匹配公司。</p>;
  }

  return (
    <div className="space-y-3">
      {stocks.map((stock) => (
        <RoboticsStockRow key={stock.id} stock={stock} industries={industries} onOpenStock={onOpenStock} />
      ))}
    </div>
  );
}

function RoboticsStockRow({ stock, industries, onOpenStock }: { stock: Stock; industries: Industry[]; onOpenStock: (stock: Stock) => void }) {
  const tags = stock.themeTags ?? [];
  const displayedTags = tags.slice(0, 5);
  const remainingTags = tags.length - displayedTags.length;
  const tracking = stock.trackingMetrics.slice(0, 3);

  return (
    <article className="grid gap-4 rounded-lg border border-borderSoft bg-card p-4 transition hover:border-cyan/35 hover:bg-cardHover xl:grid-cols-[minmax(190px,1.05fr)_minmax(0,2fr)_minmax(210px,0.95fr)]">
      <button type="button" className="min-w-0 text-left" onClick={() => onOpenStock(stock)}>
        <p className="text-xs text-textMuted">{stock.market} · {stock.code}</p>
        <h4 className="mt-1 break-words text-lg font-semibold leading-6 text-textStrong">{stock.name}</h4>
        <p className="mt-2 text-sm leading-5 text-textMuted">{getSegmentName(industries, stock.segmentId)}</p>
        <p className="mt-2 text-sm leading-5 text-textStrong">{stock.chainPosition}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="amber">{stock.candidateType ?? "核心池"}</Badge>
          <Badge tone="cyan">验证等级：{stock.evidenceLevel ?? "待验证"}</Badge>
          <Badge>状态：{stock.verificationStatus ?? "待验证"}</Badge>
        </div>
      </button>

      <div className="min-w-0">
        <TextClamp lines={2} title={stock.business} className="text-sm font-medium leading-6 text-textStrong">
          {stock.business}
        </TextClamp>
        <TextClamp lines={3} title={stock.thesis} className="mt-2 text-sm leading-6 text-textMuted">
          {stock.thesis}
        </TextClamp>
        <div className="mt-3 flex flex-wrap gap-2">
          {tracking.map((item) => (
            <span key={item} className="rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-xs leading-5 text-textMuted">
              {item}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {displayedTags.map((tag) => (
            <span key={tag} className="rounded bg-surface/80 px-2 py-1 text-xs leading-5 text-textMuted">
              {tag}
            </span>
          ))}
          {remainingTags > 0 ? <span className="rounded bg-surface/80 px-2 py-1 text-xs text-textWeak">+{remainingTags}</span> : null}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-borderSoft bg-bg2/60 p-3 xl:text-right">
        <div className="grid grid-cols-2 gap-2 text-left xl:grid-cols-1 xl:text-right">
          <QuoteField label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
          <div>
            <p className="text-xs leading-4 text-textMuted">涨跌幅</p>
            <div className="mt-1 text-sm font-semibold tabular-nums"><PriceChange value={stock.quote?.pctChange} /></div>
          </div>
          <QuoteField label="总市值" value={formatYi(stock.quote?.marketCap)} />
          <QuoteField label="PE / PB" value={`${numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} / ${numberToDisplay(stock.quote?.pb)}`} />
        </div>
        <button
          type="button"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-borderGlow/60 px-3 text-sm font-medium text-textStrong transition hover:border-cyan hover:text-cyan focus:outline-none focus:ring-2 focus:ring-cyan/30"
          onClick={() => onOpenStock(stock)}
        >
          查看详情
        </button>
      </div>
    </article>
  );
}

function QuoteField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs leading-4 text-textMuted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-textStrong tabular-nums">{value}</p>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "cyan" | "amber" }) {
  const tones = {
    neutral: "border-borderSoft bg-surface/70 text-textMuted",
    cyan: "border-cyan/25 bg-cyan/10 text-cyan",
    amber: "border-warning/25 bg-warning/10 text-warning",
  };
  return <span className={`rounded border px-2 py-1 text-xs leading-5 ${tones[tone]}`}>{children}</span>;
}
