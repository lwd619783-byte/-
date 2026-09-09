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
