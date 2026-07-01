export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "数据暂缺";
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function formatPercent(value: number | null | undefined, digits = 2) {
  const formatted = formatNumber(value, digits);
  return formatted === "数据暂缺" ? formatted : `${formatted}%`;
}

export function formatYi(value: number | null | undefined, digits = 1) {
  const formatted = formatNumber(value, digits);
  return formatted === "数据暂缺" ? formatted : `${formatted} 亿`;
}

export function numberToDisplay(value: number | null | undefined, digits = 2) {
  return formatNumber(value, digits);
}
