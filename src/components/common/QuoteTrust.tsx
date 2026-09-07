import type { Stock, StockQuote } from "../../types";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import { describeQuote, summarizeQuotes } from "../../utils/dataTrustDisplay";

export function QuoteTrust({ quote, now }: { quote?: StockQuote; now?: Date }) {
  const display = describeQuote(quote, useDisplayNow(now));
  return <span className="block min-w-0 break-words text-xs font-normal leading-5 text-textMuted" aria-label="行情来源与时效">
    <span className="block">{display.source} · {display.coverage}</span>
    <span className="block">{display.time.text} · 市场观测时间未知</span>
  </span>;
}

export function QuoteTrustSummary({ stocks, now }: { stocks: Stock[]; now?: Date }) {
  const summary = summarizeQuotes(stocks.map((stock) => stock.quote), useDisplayNow(now));
  return <p className="min-w-0 break-words text-xs leading-5 text-textMuted" aria-label="行情覆盖与时效汇总">{summary.text} 覆盖和模式不代表实时行情。</p>;
}
