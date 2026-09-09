/** Presentation only: stable series roles; themes never choose data or chart types. */
export const chartColors = {
  primary: "var(--ui-accent)",
  secondary: "var(--ui-secondary)",
  info: "var(--ui-info)",
  up: "var(--ui-up)",
  down: "var(--ui-down)",
  grid: "var(--ui-border)",
  axis: "var(--ui-weak)",
} as const;

export const chartTickStyle = { fontSize: 12, fill: chartColors.axis } as const;

export const chartTooltipStyle = {
  background: "var(--ui-raised)",
  border: "1px solid var(--ui-control)",
  borderRadius: "6px",
  color: "var(--ui-text)",
  fontSize: "13px",
} as const;
/** Compact axis labels only; tooltips and raw tables retain full values/units. */
export function formatAxisNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 0.001)) return value.toExponential(1);
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}
