import { formatPercent } from "../../utils/normalize";

export function PriceChange({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <span className="inline-flex rounded border border-borderSoft bg-surface/70 px-2 py-0.5 text-xs font-medium text-textWeak" title="数据源暂未覆盖">
        —
      </span>
    );
  }
  const tone = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-neutral";
  return <span className={`font-semibold tabular-nums ${tone}`}>{value > 0 ? "+" : ""}{formatPercent(value)}</span>;
}

export function priceTone(value: number | null | undefined): "neutral" | "red" | "green" {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "red" : "green";
}
