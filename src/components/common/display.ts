import { formatNumber } from "../../utils/normalize";

export function displayNumber(value: number | null | undefined, suffix = "") {
  const formatted = formatNumber(value);
  return formatted === "数据暂缺" ? formatted : `${formatted}${suffix}`;
}
