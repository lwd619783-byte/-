import type { PricePoint } from "../../types";

export function Sparkline({ points }: { points?: PricePoint[] }) {
  const data = (points ?? []).filter((point) => typeof point.close === "number").slice(-30);
  if (data.length < 2) {
    return (
      <div className="h-10 rounded border border-borderSoft bg-bg/50 text-center text-xs leading-10 text-textMuted">
        数据暂缺
      </div>
    );
  }

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
    <svg viewBox="0 0 100 40" className="h-10 w-full overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={positive ? "#EF4444" : "#22C55E"} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
