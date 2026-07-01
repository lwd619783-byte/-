import { X } from "lucide-react";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Industry, Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";

interface StockDetailDrawerProps {
  stock: Stock | null;
  industries: Industry[];
  onClose: () => void;
}

export function StockDetailDrawer({ stock, industries, onClose }: StockDetailDrawerProps) {
  if (!stock) return null;

  const financialRows = [
    ["营收", stock.financial.revenue],
    ["归母净利润", stock.financial.netProfit],
    ["毛利率", stock.financial.grossMargin],
    ["净利率", stock.financial.netMargin],
    ["ROE", stock.financial.roe],
    ["资产负债率", stock.financial.debtRatio],
    ["经营现金流", stock.financial.operatingCashFlow],
  ];

  const valuationRows = [
    ["PE", stock.valuation.pe],
    ["PB", stock.valuation.pb],
    ["PS", stock.valuation.ps],
    ["股息率", stock.valuation.dividendYield ?? "不适用 / 待接入"],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-ink/30" role="dialog" aria-modal="true">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-sm text-steel">{stock.market} · {stock.code}</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{stock.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
            </p>
          </div>
          <button
            className="rounded-md border border-line p-2 text-slate-600 transition hover:border-risk hover:text-risk"
            onClick={onClose}
            aria-label="关闭详情"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          <Section title="基本面与核心看点">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
              <MiniMetric label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} />
              <MiniMetric label="总市值" value={formatYi(stock.quote?.marketCap)} />
              <MiniMetric label="流通市值" value={formatYi(stock.quote?.floatMarketCap)} />
              <MiniMetric label="PE TTM" value={numberToDisplay(stock.quote?.peTtm ?? stock.quote?.pe)} />
              <MiniMetric label="PB" value={numberToDisplay(stock.quote?.pb)} />
              <MiniMetric label="成交额" value={formatYi(stock.quote?.amount)} />
              <MiniMetric label="覆盖率" value={typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"} />
            </div>
            <p className="text-sm leading-6 text-slate-700">{stock.business}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{stock.thesis}</p>
            <p className="mt-2 text-sm font-medium text-ink">{stock.leaderPosition}</p>
          </Section>

          <Section title="F10 / 公司资料">
            <Grid
              rows={[
                ["上市日期", stock.profile?.listDate ?? "数据暂缺"],
                ["所属行业", stock.profile?.industryName ?? "数据暂缺"],
                ["总股本", stock.profile?.totalShares ? `${stock.profile.totalShares.toFixed(2)} 亿股` : "数据暂缺"],
                ["流通股本", stock.profile?.floatShares ? `${stock.profile.floatShares.toFixed(2)} 亿股` : "数据暂缺"],
              ]}
            />
            <p className="mt-3 text-sm leading-6 text-slate-700">{stock.profile?.businessScope ?? stock.profile?.companyProfile ?? "数据暂缺"}</p>
            {stock.profile?.f10Summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{stock.profile.f10Summary}</p> : null}
          </Section>

          <Section title="最近 60 个交易日价格">
            {stock.priceHistory && stock.priceHistory.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stock.priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip />
                    <Line type="monotone" dataKey="close" stroke="#1f8a70" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500">价格历史数据暂缺。</p>
            )}
          </Section>

          <Section title="财务概览">
            <Grid rows={financialRows} />
          </Section>

          <Section title="估值">
            <Grid rows={valuationRows} />
          </Section>

          <Section title="研报列表">
            <ArticleList
              rows={(stock.research?.reports ?? []).slice(0, 5).map((item) => ({
                title: item.title,
                meta: [item.date, item.org, item.rating].filter(Boolean).join(" · ") || "数据暂缺",
                url: item.url,
              }))}
            />
          </Section>

          <Section title="公告列表">
            <ArticleList
              rows={(stock.announcements?.announcements ?? []).slice(0, 5).map((item) => ({
                title: item.title,
                meta: [item.date, item.type, item.source].filter(Boolean).join(" · ") || "数据暂缺",
                url: item.url,
              }))}
            />
          </Section>

          <Section title="资金 / 信号摘要">
            <Grid
              rows={[
                ["最新主力净流入", formatYi(stock.signals?.latestMainFundFlow)],
                ["20 日主力净流入", formatYi(stock.signals?.mainFundFlow20d)],
                ["30 日龙虎榜次数", stock.signals?.dragonTigerCount30d === null || stock.signals?.dragonTigerCount30d === undefined ? "数据暂缺" : String(stock.signals.dragonTigerCount30d)],
                ["融资余额", formatYi(stock.signals?.marginBalance)],
                ["股东户数变化", formatPercent(stock.signals?.holderChangePct)],
                ["近期解禁项", stock.signals?.upcomingLockupCount === null || stock.signals?.upcomingLockupCount === undefined ? "数据暂缺" : String(stock.signals.upcomingLockupCount)],
              ]}
            />
            <p className="mt-3 text-sm leading-6 text-slate-700">{stock.signals?.hotReason ?? "数据暂缺"}</p>
          </Section>

          <Section title="板块 / 概念归属">
            <div className="space-y-3">
              <TagList items={(stock.sectorMembership?.industry ?? []).map((item) => item.name)} color="blue" />
              <TagList items={(stock.sectorMembership?.concept ?? []).map((item) => item.name)} color="green" />
              <TagList items={(stock.sectorMembership?.region ?? []).map((item) => item.name)} color="blue" />
              {!stock.sectorMembership ? <p className="text-sm text-slate-500">数据暂缺</p> : null}
            </div>
          </Section>

          <Section title="增长驱动">
            <TagList items={stock.growthDrivers} color="green" />
          </Section>

          <Section title="主要风险">
            <TagList items={stock.risks} color="red" />
          </Section>

          <Section title="跟踪指标">
            <TagList items={stock.trackingMetrics} color="blue" />
          </Section>

          <Section title="数据来源与质量">
            <Grid
              rows={[
                ["来源", stock.dataQuality?.map((item) => item.source).join(" / ") || "mock"],
                ["状态", stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"],
                ["更新时间", stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"],
                ["缺失字段数", String(stock.missingFields?.length ?? 0)],
                ["财务更新时间", stock.realFinancial?.updatedAt ?? "数据暂缺"],
                ["原始数据源", stock.quote?.quality.source ?? stock.realFinancial?.quality.source ?? "mock"],
                ["源分层", stock.dataQuality?.map((item) => item.sourceLayer).filter(Boolean).join(" / ") || "数据暂缺"],
                ["源端点", stock.dataQuality?.map((item) => item.sourceEndpoint).filter(Boolean).join(" / ") || "数据暂缺"],
              ]}
            />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-line bg-white p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: "green" | "red" | "blue" }) {
  const palette = {
    green: "border-signal/20 bg-signal/10 text-emerald-800",
    red: "border-risk/20 bg-risk/10 text-red-800",
    blue: "border-steel/20 bg-steel/10 text-slate-800",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.length === 0 ? <span className="text-sm text-slate-500">数据暂缺</span> : null}
      {items.map((item) => (
        <span key={item} className={`rounded border px-2 py-1 text-xs ${palette[color]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ArticleList({ rows }: { rows: Array<{ title: string; meta: string; url?: string | null }> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">数据暂缺</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <a
          key={`${row.title}-${row.meta}`}
          className="block rounded-md border border-line bg-white p-3 text-sm transition hover:border-signal"
          href={row.url ?? undefined}
          target={row.url ? "_blank" : undefined}
          rel="noreferrer"
        >
          <span className="font-medium text-ink">{row.title}</span>
          <span className="mt-1 block text-xs text-slate-500">{row.meta}</span>
        </a>
      ))}
    </div>
  );
}
