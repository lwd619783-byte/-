import type { PricePoint } from "../../types";

export function Sparkline({ points }: { points?: PricePoint[] }) {
  const data = (points ?? []).slice(-30);
  const valid = data.filter((point) => typeof point.close === "number" && Number.isFinite(point.close));
  if (valid.length === 0) {
    return (
      <div className="h-10 rounded border border-borderSoft bg-bg/50 text-center text-xs leading-10 text-textMuted">
        数据暂缺
      </div>
    );
  }

  const closes = valid.map((point) => point.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  let continues = false;
  const positions = data.map((point, index) => {
      const close = point.close;
      if (typeof close !== "number" || !Number.isFinite(close)) { continues = false; return null; }
      const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = 36 - ((close - min) / span) * 32;
      const command = `${continues ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
      continues = true;
      return { x, y, command, date: point.date };
    });
  const d = positions.map((point) => point?.command ?? "").join(" ");
  const change = closes[closes.length - 1] - closes[0];
  const stroke = change > 0 ? "var(--ui-up)" : change < 0 ? "var(--ui-down)" : "var(--ui-accent)";

  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full overflow-visible" role="img" aria-label={`最近 ${data.length} 个价格观察点，${valid.length} 个有效值；缺失处断线`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      {positions.map((point, index) => point && (!positions[index - 1] || !positions[index + 1]) ?
        <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="2" fill={stroke} /> : null)}
    </svg>
  );
}
