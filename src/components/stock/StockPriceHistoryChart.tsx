import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Stock } from "../../types";
import { numberToDisplay } from "../../utils/normalize";
import { chartColors, chartTickStyle, chartTooltipStyle } from "../charts/theme";
import { ChartPanel } from "../common/ChartPanel";

/** Uses only the selected company's existing observations, including their gaps. */
export function StockPriceHistoryChart({ stock, compact = false }: { stock: Stock; compact?: boolean }) {
  const points = stock.priceHistory ?? [];
  const currency = "币种：源字段未提供";
  const source = stock.dataQuality?.filter((item) => /price|history|kline/i.test(`${item.sourceEndpoint ?? ""} ${item.source}`)).map((item) => item.source).join(" / ") || "历史序列来源未单独提供";
  const period = points.length ? `${points[0].date} 至 ${points[points.length - 1].date}` : "尚无历史价格";
  return <ChartPanel title={compact ? "价格脉络" : "60 日价格走势"}
    description={`${stock.name} · 收盘价 · ${currency} · ${period}`}
    empty={!points.some((point) => typeof point.close === "number" && Number.isFinite(point.close))}
    summary={`${points.length} 个已有观测点；${source}。缺失点不连接，不以采集时间替代交易日期。`}
    dataTable={<table className="w-full text-left text-xs"><caption className="py-2 text-left">{stock.name} · 收盘价原始序列（{currency}）</caption><thead><tr><th className="p-2">交易日期</th><th className="p-2 text-right">收盘价</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.date}-${index}`} className="border-t border-borderSoft"><td className="p-2">{point.date}</td><td className="p-2 text-right tabular-nums">{numberToDisplay(point.close)}</td></tr>)}</tbody></table>}>
    <div className={compact ? "h-52" : "h-72"} role="img" aria-label={`${stock.name}收盘价折线图，${currency}，完整数值可展开原始数据表`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={chartTickStyle} minTickGap={32} />
          <YAxis tick={chartTickStyle} width={56} />
          <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: "var(--ui-text)" }} formatter={(value: number) => [`${numberToDisplay(value)} ${currency}`, "收盘价"]} />
          <Line type="linear" dataKey="close" name="收盘价" stroke={chartColors.primary} strokeWidth={2} connectNulls={false} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </ChartPanel>;
}
