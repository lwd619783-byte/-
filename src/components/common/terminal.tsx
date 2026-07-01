import type { ReactNode } from "react";
import type { DataQualityMeta, DataSourceStatus, PricePoint } from "../../types";
import { formatNumber, formatPercent } from "../../utils/normalize";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-borderGlow/60 bg-card shadow-soft backdrop-blur-xl ${className}`}>{children}</div>;
}

export function SectionPanel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel/72 p-4 shadow-soft ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "cyan" | "red" | "green" | "amber" }) {
  const tones = {
    neutral: "text-ink",
    cyan: "text-signal",
    red: "text-rise",
    green: "text-fall",
    amber: "text-warning",
  };
  return (
    <div className="rounded-md border border-line bg-bg2/80 p-3">
      <p className="text-xs text-steel">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: DataSourceStatus | "supported" | "realish" }) {
  const palette: Record<string, string> = {
    real: "border-cyan/40 bg-cyan/10 text-cyan",
    realish: "border-cyan/40 bg-cyan/10 text-cyan",
    stale: "border-amber/40 bg-amber/10 text-amber",
    missing: "border-slate-500/40 bg-slate-500/10 text-slate-300",
    error: "border-red/40 bg-red/10 text-red",
    mock: "border-violet/40 bg-violet/10 text-violet",
    unsupported_market: "border-slate-500/40 bg-slate-700/40 text-slate-300",
    supported: "border-cyan/40 bg-cyan/10 text-cyan",
  };
  return <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${palette[status] ?? palette.missing}`}>{status}</span>;
}

export function DataQualityBadge({ quality }: { quality?: DataQualityMeta[] }) {
  const status = quality?.find((item) => item.status === "real")?.status ?? quality?.[0]?.status ?? "mock";
  return <StatusBadge status={status} />;
}

export function PriceChange({ value }: { value: number | null | undefined }) {
  const tone = value === null || value === undefined ? "text-steel" : value > 0 ? "text-rise" : value < 0 ? "text-fall" : "text-steel";
  return <span className={`font-semibold ${tone}`}>{formatPercent(value)}</span>;
}

export function Sparkline({ points }: { points?: PricePoint[] }) {
  const data = (points ?? []).filter((point) => typeof point.close === "number").slice(-30);
  if (data.length < 2) return <div className="h-10 rounded border border-line bg-bg/50 text-center text-xs leading-10 text-steel">数据暂缺</div>;
  const closes = data.map((point) => point.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const d = closes
    .map((close, index) => {
      const x = (index / (closes.length - 1)) * 100;
      const y = 36 - ((close - min) / span) * 32;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const positive = closes[closes.length - 1] >= closes[0];
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full overflow-visible">
      <path d={d} fill="none" stroke={positive ? "#EF4444" : "#22C55E"} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function metricTone(value: number | null | undefined): "neutral" | "red" | "green" {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "red" : "green";
}

export function displayNumber(value: number | null | undefined, suffix = "") {
  const formatted = formatNumber(value);
  return formatted === "数据暂缺" ? formatted : `${formatted}${suffix}`;
}
