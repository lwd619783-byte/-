import type { Stock } from "../../types";
import type { ReactNode } from "react";
import { formatPercent } from "../../utils/normalize";
import { DashboardCard, StatusBadge } from "../common/terminal";

export function RightRail({
  mode,
  modeLabel,
  coverageSummary,
  highRisk,
  missingFields,
  focusStocks,
  missingStocks,
  onOpenStock,
}: {
  mode: "mock" | "real" | "mixed";
  modeLabel: string;
  coverageSummary: string;
  highRisk: number;
  missingFields: number;
  focusStocks: Stock[];
  missingStocks: Stock[];
  onOpenStock: (stock: Stock) => void;
}) {
  const modeStatus = mode === "mock" ? "mock" : mode === "real" ? "real" : "stale";

  return (
    <aside className="right-rail-stack space-y-3">
      <InfoPanel title="数据控制台" subtitle="DATA CONSOLE">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={modeStatus} />
          <StatusBadge status="unsupported_market" />
        </div>
        <p className="mt-3 line-clamp-4 text-sm leading-6 text-textMuted" title={coverageSummary}>
          {coverageSummary}
        </p>
      </InfoPanel>

      <InfoPanel title="风险雷达" subtitle="RISK RADAR">
        <div className="grid grid-cols-2 gap-2">
          <RailKpi label="高风险" value={highRisk} tone="warning" />
          <RailKpi label="缺失字段" value={missingFields} tone="warning" />
        </div>
      </InfoPanel>

      <InfoPanel title="重点资产" subtitle="FOCUS ASSETS">
        <div className="space-y-2">
          {focusStocks.map((stock) => {
            const pct = stock.quote?.pctChange;
            return (
              <button
                key={stock.id}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-borderSoft bg-bg2/60 px-3 py-2 text-left transition hover:border-borderGlow hover:bg-cardHover focus:outline-none focus:ring-2 focus:ring-cyan/25"
                onClick={() => onOpenStock(stock)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-textStrong" title={stock.name}>
                    {stock.name}
                  </span>
                  <span className="block truncate text-xs text-textMuted">
                    {stock.market} · {stock.code}
                  </span>
                </span>
                <span className={`shrink-0 text-sm tabular-nums ${toneForPct(pct)}`}>{formatPercent(pct)}</span>
              </button>
            );
          })}
        </div>
      </InfoPanel>

      <InfoPanel title="缺失数据监控" subtitle="MISSING WATCH">
        <div className="space-y-1 text-sm text-textMuted">
          {missingStocks.length === 0 ? <p className="text-sm text-textMuted">暂无缺失字段。</p> : null}
          {missingStocks.map((stock) => (
            <div key={stock.id} className="flex items-center justify-between gap-3 border-b border-borderSoft/70 py-2 last:border-b-0">
              <span className="truncate" title={stock.name}>
                {stock.name}
              </span>
              <span className="shrink-0 text-right font-semibold text-warning tabular-nums">{stock.missingFields?.length ?? 0}</span>
            </div>
          ))}
        </div>
      </InfoPanel>
    </aside>
  );
}

function InfoPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <DashboardCard className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-textStrong">{title}</h3>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan/80">{subtitle}</p>
      </div>
      {children}
    </DashboardCard>
  );
}

function RailKpi({ label, value, tone }: { label: string; value: number; tone: "warning" | "neutral" }) {
  return (
    <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
      <p className="text-xs text-textMuted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "warning" && value > 0 ? "text-warning" : "text-textStrong"}`}>{value}</p>
    </div>
  );
}

function toneForPct(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-textMuted";
  return value > 0 ? "text-success" : "text-danger";
}
