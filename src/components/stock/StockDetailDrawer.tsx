import { X } from "lucide-react";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Industry, Stock } from "../../types";
import { getIndustryName, getSegmentName } from "../../utils/filters";
import { formatPercent, formatYi, numberToDisplay } from "../../utils/normalize";
import { DataQualityBadge, MetricCard, PriceChange, SectionPanel, TextClamp } from "../common/terminal";

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
    ["ROE", stock.financial.roe],
    ["毛利率", stock.financial.grossMargin],
    ["净利率", stock.financial.netMargin],
    ["资产负债率", stock.financial.debtRatio],
    ["经营现金流", stock.financial.operatingCashFlow],
    ["报告期", stock.realFinancial?.reportDate ?? "数据暂缺"],
  ];

  const valuationRows = [
    ["PE", stock.valuation.pe],
    ["PB", stock.valuation.pb],
    ["PS", stock.valuation.ps],
    ["股息率", stock.valuation.dividendYield ?? "数据暂缺"],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-bg/75 backdrop-blur-sm" role="dialog" aria-modal="true">
      <aside className="ml-auto flex h-full w-full max-w-[920px] flex-col border-l border-borderGlow/50 bg-bg2/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-borderGlow/40 p-5">
          <div className="min-w-0">
            <p className="truncate text-sm text-textMuted" title={`${stock.market} · ${stock.code}`}>{stock.market} · {stock.code}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold text-textStrong" title={stock.name}>{stock.name}</h2>
              <DataQualityBadge quality={stock.dataQuality} />
            </div>
            <p className="mt-1 truncate text-sm text-textMuted" title={`${getIndustryName(industries, stock.industryId)} / ${getSegmentName(industries, stock.segmentId)}`}>
              {getIndustryName(industries, stock.industryId)} / {getSegmentName(industries, stock.segmentId)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span>最新价 {numberToDisplay(stock.quote?.latestPrice)}</span>
              <PriceChange value={stock.quote?.pctChange} />
              <span className="text-textMuted">覆盖率 {typeof stock.dataCoverage === "number" ? `${stock.dataCoverage}%` : "数据暂缺"}</span>
            </div>
          </div>
          <button
            className="shrink-0 rounded-md border border-borderSoft p-2 text-textMuted transition hover:border-danger hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-danger/30"
            onClick={onClose}
            aria-label="关闭详情"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          <Section title="行情">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard label="最新价" value={numberToDisplay(stock.quote?.latestPrice)} />
              <MetricCard label="涨跌幅" value={formatPercent(stock.quote?.pctChange)} tone={(stock.quote?.pctChange ?? 0) > 0 ? "red" : (stock.quote?.pctChange ?? 0) < 0 ? "green" : "neutral"} />
              <MetricCard label="成交额" value={formatYi(stock.quote?.amount)} />
              <MetricCard label="换手率" value={formatPercent(stock.quote?.turnover)} />
              <MetricCard label="总市值" value={formatYi(stock.quote?.marketCap)} />
              <MetricCard label="流通市值" value={formatYi(stock.quote?.floatMarketCap)} />
              <MetricCard label="涨停价" value={numberToDisplay(stock.quote?.limitUp)} />
              <MetricCard label="跌停价" value={numberToDisplay(stock.quote?.limitDown)} />
            </div>
            {stock.priceHistory && stock.priceHistory.length > 0 ? (
              <div className="h-56 rounded-md border border-borderSoft bg-bg/50 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stock.priceHistory}>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} width={48} />
                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #334155", color: "#E5E7EB" }} labelStyle={{ color: "#E5E7EB" }} />
                    <Line type="monotone" dataKey="close" stroke="#22D3EE" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-textMuted">价格历史数据暂缺。</p>
            )}
          </Section>

          <Section title="财务"><Grid rows={financialRows} /></Section>
          <Section title="估值"><Grid rows={valuationRows} /></Section>

          <Section title="F10">
            <Grid
              rows={[
                ["公司全称", stock.profile?.fullName ?? "数据暂缺"],
                ["上市日期", stock.profile?.listDate ?? "数据暂缺"],
                ["行业分类", stock.profile?.industryName ?? "数据暂缺"],
                ["总股本", stock.profile?.totalShares ? `${stock.profile.totalShares.toFixed(2)} 亿股` : "数据暂缺"],
                ["流通股本", stock.profile?.floatShares ? `${stock.profile.floatShares.toFixed(2)} 亿股` : "数据暂缺"],
              ]}
            />
            <TextBlock title="主营业务" value={stock.profile?.businessScope} />
            <TextBlock title="公司简介" value={stock.profile?.companyProfile} />
          </Section>

          <Section title="信号雷达">
            <Grid
              rows={[
                ["最新主力净流入", formatYi(stock.signals?.latestMainFundFlow)],
                ["5 日主力净流入", formatYi(stock.signals?.mainFundFlow5d)],
                ["20 日主力净流入", formatYi(stock.signals?.mainFundFlow20d)],
                ["融资余额", formatYi(stock.signals?.marginBalance)],
                ["30 日龙虎榜次数", nullableNumber(stock.signals?.dragonTigerCount30d)],
                ["股东户数变化", formatPercent(stock.signals?.holderChangePct)],
                ["未来 90 天解禁", nullableNumber(stock.signals?.upcomingLockupCount)],
                ["人气排名", nullableNumber(stock.signals?.popularityRank)],
              ]}
            />
            <TextClamp lines={3} title={stock.signals?.hotReason ?? stock.signals?.latestInteraction ?? "数据暂缺"} className="mt-3 text-sm leading-6 text-textMuted">
              {stock.signals?.hotReason ?? stock.signals?.latestInteraction ?? "数据暂缺"}
            </TextClamp>
          </Section>

          <Section title="研报">
            <ArticleList
              rows={(stock.research?.reports ?? []).slice(0, 5).map((item) => ({
                title: item.title,
                meta: [item.date, item.org, item.rating].filter(Boolean).join(" · ") || "数据暂缺",
                url: item.url,
              }))}
            />
          </Section>

          <Section title="公告">
            <ArticleList
              rows={(stock.announcements?.announcements ?? []).slice(0, 5).map((item) => ({
                title: item.title,
                meta: [item.date, item.type, item.source].filter(Boolean).join(" · ") || "数据暂缺",
                url: item.url,
              }))}
            />
          </Section>

          <Section title="板块 / 概念">
            <div className="space-y-3">
              <TagList items={[stock.profile?.industryName, ...(stock.sectorMembership?.industry ?? []).map((item) => item.name)].filter(Boolean) as string[]} color="blue" />
              <TagList items={(stock.sectorMembership?.concept ?? []).map((item) => item.name)} color="green" />
              <TagList items={(stock.sectorMembership?.region ?? []).map((item) => item.name)} color="blue" />
            </div>
          </Section>

          <Section title="数据质量">
            <Grid
              rows={[
                ["来源", stock.dataQuality?.map((item) => item.source).join(" / ") || "mock"],
                ["状态", stock.dataQuality?.map((item) => item.status).join(" / ") || "mock"],
                ["更新时间", stock.dataQuality?.find((item) => item.updatedAt)?.updatedAt ?? "数据暂缺"],
                ["缺失字段数", String(stock.missingFields?.length ?? 0)],
                ["财务更新时间", stock.realFinancial?.updatedAt ?? "数据暂缺"],
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionPanel title={title} className="mb-5">
      {children}
    </SectionPanel>
  );
}

function Grid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-md border border-borderSoft bg-bg2/70 p-3">
          <p className="truncate text-xs text-textMuted" title={label}>{label}</p>
          <p className="mt-1 break-all text-sm font-semibold text-textStrong" title={value}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  const displayValue = value || "数据暂缺";
  return (
    <div className="mt-3 rounded-md border border-borderSoft bg-bg2/70 p-3">
      <p className="text-xs text-textMuted">{title}</p>
      <TextClamp lines={4} title={displayValue} className="mt-2 text-sm leading-6 text-textMuted">
        {displayValue}
      </TextClamp>
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: "green" | "red" | "blue" }) {
  const palette = {
    green: "border-success/25 bg-success/10 text-green-100",
    red: "border-danger/25 bg-danger/10 text-red-100",
    blue: "border-cyan/25 bg-cyan/10 text-cyan-100",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.length === 0 ? <span className="text-sm text-textMuted">数据暂缺</span> : null}
      {items.map((item) => (
        <span key={item} className={`max-w-full truncate rounded border px-2 py-1 text-xs ${palette[color]}`} title={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ArticleList({ rows }: { rows: Array<{ title: string; meta: string; url?: string | null }> }) {
  if (rows.length === 0) return <p className="text-sm text-textMuted">数据暂缺</p>;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <a
          key={`${row.title}-${row.meta}`}
          className="block min-w-0 rounded-md border border-borderSoft bg-bg2/70 p-3 text-sm transition hover:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/25"
          href={row.url ?? undefined}
          target={row.url ? "_blank" : undefined}
          rel="noreferrer"
          title={[row.title, row.meta, row.url].filter(Boolean).join(" | ")}
        >
          <TextClamp lines={2} className="font-medium text-textStrong">{row.title}</TextClamp>
          <span className="mt-1 block truncate text-xs text-textMuted">{row.meta}</span>
        </a>
      ))}
    </div>
  );
}

function nullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "数据暂缺" : String(value);
}
