import { CalendarClock } from "lucide-react";
import type { Industry, Stock, WatchlistItem } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import { GlassCard } from "../common/terminal";

interface WatchlistTabProps {
  watchlist: WatchlistItem[];
  stocks: Stock[];
  industries: Industry[];
  onOpenStock: (stock: Stock) => void;
}

export function WatchlistTab({ watchlist, stocks, industries, onOpenStock }: WatchlistTabProps) {
  const rows = watchlist
    .map((item) => ({ item, stock: stocks.find((stock) => stock.id === item.stockId) }))
    .filter((row): row is { item: WatchlistItem; stock: Stock } => Boolean(row.stock));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-panel/70 p-10 text-center">
        <p className="font-medium text-ink">观察清单为空</p>
        <p className="mt-1 text-sm text-slate-500">请在 src/data/watchlist.ts 中新增关注项。</p>
      </div>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {rows.map(({ item, stock }) => (
        <GlassCard key={item.id} className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs text-steel">
                {stock.market} · {stock.code} · {getIndustryName(industries, stock.industryId)} /{" "}
                {getSegmentName(industries, stock.segmentId)}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{stock.name}</h2>
            </div>
            <span className="rounded border border-line bg-panel/80 px-2 py-1 text-xs text-steel">状态：{item.status}</span>
          </div>

          <p className="mt-3 text-sm font-medium text-ink">{item.reason}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Info label="触发条件" value={item.trigger} />
            <Info label="最新备注" value={item.latestNote} />
          </div>

          <div className="mt-4 rounded-md border border-line bg-bg2/70 p-3">
            <p className="text-xs font-semibold text-steel">需要验证的问题</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {item.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm text-steel">
              <CalendarClock className="h-4 w-4 text-steel" />
              下一次复盘：{item.nextReviewDate}
            </div>
            <button
              className="h-9 rounded-md border border-borderGlow/60 px-3 text-sm font-medium text-ink transition hover:border-signal hover:text-signal"
              onClick={() => onOpenStock(stock)}
            >
              查看个股
            </button>
          </div>
        </GlassCard>
      ))}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-bg2/70 p-3">
      <p className="text-xs font-semibold text-steel">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}
