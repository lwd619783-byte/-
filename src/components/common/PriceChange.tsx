import { formatPercent } from "../../utils/normalize";

export function PriceChange({ value }: { value: number | null | undefined }) {
  const tone = value === null || value === undefined ? "text-neutral" : value > 0 ? "text-rise" : value < 0 ? "text-fall" : "text-neutral";
  return <span className={`font-semibold tabular-nums ${tone}`}>{formatPercent(value)}</span>;
}

export function priceTone(value: number | null | undefined): "neutral" | "red" | "green" {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "red" : "green";
}
