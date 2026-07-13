import { BellRing, CalendarClock } from "lucide-react";
import type { Industry, ResearchEvent, Stock, WatchlistItem } from "../../types";
import { buildWatchlistEventHints } from "../../services/researchEventProvider";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import { DashboardCard, EmptyState, TextClamp } from "../common/terminal";

interface WatchlistTabProps {
  watchlist: WatchlistItem[];
  stocks: Stock[];
  industries: Industry[];
  events?: ResearchEvent[];
  onOpenStock: (stock: Stock) => void;
}

export function WatchlistTab({ watchlist, stocks, industries, events = [], onOpenStock }: WatchlistTabProps) {
  const rows = watchlist
    .map((item) => ({ item, stock: stocks.find((stock) => stock.id === item.stockId) }))
    .filter((row): row is { item: WatchlistItem; stock: Stock } => Boolean(row.stock));

  if (rows.length === 0) {
    return (
      <EmptyState title="观察清单为空" description="暂无需要跟踪的资产，请在数据文件中新增关注项。" />
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {rows.map(({ item, stock }) => {
        const hints = buildWatchlistEventHints(item, events.filter((event) => event.stockId === stock.id));
        return (
        <DashboardCard key={item.id} className="p-4" interactive>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs text-textMuted" title={`${stock.market} · ${stock.code} · ${getIndustryName(industries, stock.industryId)} / ${getSegmentName(industries, stock.segmentId)}`}>
                {stock.market} · {stock.code} · {getIndustryName(industries, stock.industryId)} /{" "}
                {getSegmentName(industries, stock.segmentId)}
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-textStrong" title={stock.name}>{stock.name}</h2>
            </div>
            <span className="shrink-0 rounded border border-borderSoft bg-surface/80 px-2 py-1 text-xs text-textMuted">状态：{item.status}</span>
          </div>

          <TextClamp lines={2} title={item.reason} className="mt-3 text-sm font-medium text-textStrong">
            {item.reason}
          </TextClamp>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Info label="触发条件" value={item.trigger} />
            <Info label="最新备注" value={item.latestNote} />
          </div>

          <div className="mt-4 rounded-md border border-borderSoft bg-bg2/70 p-3">
            <p className="text-xs font-semibold text-textMuted">需要验证的问题</p>
            <ul className="mt-2 space-y-1 text-sm text-textMuted">
              {item.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>

          {hints.length ? (
            <div className="mt-4 rounded-md border border-warning/35 bg-warning/10 p-3">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-warning"><BellRing className="h-3.5 w-3.5" />真实事件提示（只读）</p>
              <ul className="mt-2 space-y-1 text-sm text-textMuted">
                {hints.map((hint) => <li key={hint}>• {hint}</li>)}
              </ul>
              <p className="mt-2 text-xs text-textWeak">提示不会自动改变“{item.status}”状态。</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm text-textMuted">
              <CalendarClock className="h-4 w-4 text-textMuted" />
              下一次复盘：{item.nextReviewDate}
            </div>
            <button
              className="h-9 rounded-md border border-borderGlow/60 px-3 text-sm font-medium text-textStrong transition hover:border-cyan hover:text-cyan focus:outline-none focus:ring-2 focus:ring-cyan/30"
              onClick={() => onOpenStock(stock)}
            >
              查看个股
            </button>
          </div>
        </DashboardCard>
        );
      })}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
      <p className="text-xs font-semibold text-textMuted">{label}</p>
      <TextClamp lines={3} title={value} className="mt-1 text-sm leading-6 text-textMuted">
        {value}
      </TextClamp>
    </div>
  );
}
