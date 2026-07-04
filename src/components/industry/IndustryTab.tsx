import { useMemo, useState } from "react";
import { Factory, Layers3 } from "lucide-react";
import { roboticsPrivateCompanies } from "../../data/privateCompanies";
import type { Industry, Stock } from "../../types";
import { findStocksForSegment } from "../../utils/filters";
import { StockCard } from "../stock/StockCard";
import { DashboardCard, MetricCard, OverflowTooltip, SectionHeader, TextClamp } from "../common/terminal";
import { RoboticsStockSection } from "./RoboticsStockSection";

interface IndustryTabProps {
  industries: Industry[];
  stocks: Stock[];
  globalSearch: string;
  onOpenStock: (stock: Stock) => void;
}

export function IndustryTab({ industries, stocks, globalSearch, onOpenStock }: IndustryTabProps) {
  const [activeIndustryId, setActiveIndustryId] = useState(industries[0]?.id ?? "");
  const activeIndustry = industries.find((industry) => industry.id === activeIndustryId) ?? industries[0];
  const [activeSegmentId, setActiveSegmentId] = useState(activeIndustry?.segments[0]?.id ?? "");
  const isRobotics = activeIndustry?.id === "robotics";

  const segment = useMemo(() => {
    const currentIndustry = industries.find((industry) => industry.id === activeIndustryId) ?? industries[0];
    if (activeSegmentId === "__all__" && currentIndustry?.id === "robotics") return undefined;
    return (
      currentIndustry?.segments.find((item) => item.id === activeSegmentId) ??
      currentIndustry?.segments[0]
    );
  }, [activeIndustryId, activeSegmentId, industries]);

  if (!activeIndustry) {
    return <EmptyState title="暂无行业数据" description="请先在 src/data/industries.ts 中新增行业与细分板块。" />;
  }

  const segmentStocks =
    isRobotics && activeSegmentId === "__all__"
      ? stocks.filter((stock) => stock.industryId === activeIndustry.id)
      : segment
        ? findStocksForSegment(stocks, segment.id)
        : [];
  const keyword = globalSearch.trim().toLowerCase();
  const visibleSegmentStocks = keyword
    ? segmentStocks.filter((stock) =>
        [stock.name, stock.code, stock.thesis, segment?.name ?? "全部", activeIndustry.name, stock.themeTags?.join(" ") ?? ""].join(" ").toLowerCase().includes(keyword),
      )
    : segmentStocks;

  function switchIndustry(industry: Industry) {
    setActiveIndustryId(industry.id);
    setActiveSegmentId(industry.id === "robotics" ? "__all__" : industry.segments[0]?.id ?? "");
  }

  return (
    <section className="grid gap-4 2xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-borderSoft bg-card p-3 shadow-soft 2xl:sticky 2xl:top-24 2xl:self-start">
        <p className="mb-3 px-2 text-xs font-semibold text-textMuted">行业 Tab</p>
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1 2xl:grid 2xl:overflow-visible 2xl:pb-0">
          {industries.map((industry) => (
            <button
              key={industry.id}
              className={`min-w-[150px] shrink-0 rounded-md px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan/30 2xl:min-w-0 ${
                activeIndustry.id === industry.id
                  ? "border border-cyan/45 bg-cyan/15 text-textStrong shadow-glow"
                  : "border border-borderSoft bg-surface/70 text-text hover:border-borderGlow hover:bg-cardHover"
              }`}
              onClick={() => switchIndustry(industry)}
            >
              <span className="block font-medium">{industry.name}</span>
              <span className="mt-1 block text-xs opacity-75">
                景气：{industry.prosperity} · {industry.stage}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <IndustryOverview industry={activeIndustry} />
        <ChainMap industry={activeIndustry} />

        <DashboardCard className="p-4">
          <SectionHeader
            eyebrow="Segment Analysis"
            title="细分板块"
            description="按产业链细分查看逻辑、关键变量、真实行情覆盖和龙头公司对比。"
            action={<Layers3 className="h-5 w-5 text-cyan" />}
          />
          <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-2">
            {(isRobotics ? [{ id: "__all__", name: "全部" }, ...activeIndustry.segments] : activeIndustry.segments).map((item) => (
                <button
                  key={item.id}
                  className={`min-w-fit shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan/30 ${
                    activeSegmentId === item.id
                      ? "border border-cyan/45 bg-cyan/15 text-textStrong"
                      : "border border-borderSoft bg-surface/70 text-text hover:border-borderGlow"
                  }`}
                  title={item.name}
                onClick={() => setActiveSegmentId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {segment ? <SegmentLogic industry={activeIndustry} segment={segment} /> : <AllRoboticsSummary industry={activeIndustry} stocks={visibleSegmentStocks} />}
            <div className="space-y-3">
              <SegmentMarketSummary stocks={visibleSegmentStocks} />
            </div>
          </div>
          <div className="mt-4">
            <StockCompare stocks={visibleSegmentStocks} />
          </div>
        </DashboardCard>

        {visibleSegmentStocks.length === 0 ? (
          <EmptyState title="没有匹配个股" description="调整搜索词，或在 src/data/stocks.ts 中为该细分板块补充个股。" />
        ) : isRobotics ? (
          <div className="space-y-4">
            <RoboticsStockSection stocks={visibleSegmentStocks} industries={industries} onOpenStock={onOpenStock} />
            <PrivateCompanySection />
          </div>
        ) : (
          <StockGrid stocks={visibleSegmentStocks} industries={industries} onOpenStock={onOpenStock} />
        )}
      </div>
    </section>
  );
}

function StockGrid({ stocks, industries, onOpenStock }: { stocks: Stock[]; industries: Industry[]; onOpenStock: (stock: Stock) => void }) {
  if (stocks.length === 0) return <EmptyState title="暂无公司" description="当前筛选条件下没有匹配公司。" compact />;

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {stocks.map((stock) => (
        <StockCard key={stock.id} stock={stock} industries={industries} onOpen={onOpenStock} />
      ))}
    </div>
  );
}

function IndustryOverview({ industry }: { industry: Industry }) {
  return (
    <DashboardCard className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-textMuted">行业总览</p>
          <h2 className="mt-1 text-2xl font-semibold text-textStrong">{industry.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs text-cyan">景气：{industry.prosperity}</span>
            <span className="rounded border border-terminalViolet/30 bg-terminalViolet/10 px-2 py-1 text-xs text-violet-200">阶段：{industry.stage}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {industry.styles.map((style) => (
            <span key={style} className="rounded border border-success/20 bg-success/10 px-2 py-1 text-xs text-green-100">
              {style}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoBlock title="核心驱动" items={industry.drivers} />
        <InfoBlock title="近期催化剂" items={industry.catalysts} />
        <InfoBlock title="主要风险" items={industry.risks} risk />
      </div>
    </DashboardCard>
  );
}

function ChainMap({ industry }: { industry: Industry }) {
  return (
    <DashboardCard className="p-4">
      <div className="flex items-center gap-2">
        <Factory className="h-5 w-5 text-textMuted" />
        <h2 className="text-lg font-semibold text-textStrong">产业链结构</h2>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {industry.chain.map((chain) => (
          <div key={chain.stage} className="rounded-lg border border-borderSoft bg-bg2/70 p-3">
            <p className="text-sm font-semibold text-textStrong">{chain.stage}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chain.items.map((item) => (
                <span key={item} className="rounded border border-borderSoft bg-surface/70 px-2 py-1 text-xs leading-5 text-textMuted" title={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function SegmentLogic({ industry, segment }: { industry: Industry; segment: Industry["segments"][number] }) {
  return (
    <article className="rounded-lg border border-borderSoft bg-surface/72 p-4">
      <p className="text-xs font-semibold text-textMuted">{industry.name}</p>
      <h3 className="mt-1 text-xl font-semibold text-textStrong">{segment.name}</h3>
      <TextClamp lines={4} title={segment.logic} className="mt-3 text-sm leading-6 text-textMuted">
        {segment.logic}
      </TextClamp>
      <div className="mt-4 grid gap-2 text-sm">
        <Field label="需求来源" value={segment.demandSource} />
        <Field label="供给格局" value={segment.supplyPattern} />
        <Field label="竞争壁垒" value={segment.moat} />
        <Field label="价格 / 订单 / 产能趋势" value={segment.trend} />
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-textMuted">未来 6-12 个月关键变量</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {segment.keyVariables.map((item) => (
            <span key={item} className="rounded border border-borderSoft bg-bg2/70 px-2 py-1 text-xs leading-5 text-textMuted" title={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function AllRoboticsSummary({ industry, stocks }: { industry: Industry; stocks: Stock[] }) {
  const coreCount = stocks.filter((stock) => stock.candidateType !== "观察池").length;
  const observationCount = stocks.filter((stock) => stock.candidateType === "观察池").length;
  return (
    <article className="rounded-lg border border-borderSoft bg-surface/72 p-4">
      <p className="text-xs font-semibold text-textMuted">{industry.name}</p>
      <h3 className="mt-1 text-xl font-semibold text-textStrong">全部机器人产业链</h3>
      <p className="mt-3 text-sm leading-6 text-textMuted">
        当前展示机器人行业全部上市公司池，覆盖本体整机、关节与执行器、精密减速器、线性执行器与丝杠、运动控制、感知层和汽零迁移。
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniSummary label="核心池" value={`${coreCount} 家`} />
        <MiniSummary label="观察池" value={`${observationCount} 家`} />
        <MiniSummary label="细分环节" value={`${industry.segments.length} 个`} />
      </div>
    </article>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-borderSoft bg-bg2/70 p-3">
      <p className="text-xs text-textMuted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-textStrong">{value}</p>
    </div>
  );
}

function PrivateCompanySection() {
  return (
    <DashboardCard className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-textStrong">未上市公司 / 待上市公司</h3>
        <p className="mt-1 text-sm text-textMuted">未上市公司不进入行情 merge，只作为产业链跟踪线索展示。</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {roboticsPrivateCompanies.map((company) => (
          <div key={company.id} className="rounded-lg border border-borderSoft bg-bg2/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-textStrong">{company.name}</h4>
                <p className="mt-1 text-xs text-textMuted">市场：{company.market} · 细分：本体整机</p>
              </div>
              <span className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">无法接入行情</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-textMuted">{company.thesis}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {company.themeTags.map((tag) => (
                <span key={tag} className="rounded border border-cyan/20 bg-cyan/10 px-2 py-1 text-xs text-cyan">{tag}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-textWeak">需跟踪：{company.trackingMetrics.join(" / ")}</p>
            <p className="mt-2 text-xs text-warning">无法接入行情，需跟踪 IPO 和产品进展。</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function StockCompare({ stocks }: { stocks: Stock[] }) {
  if (stocks.length === 0) {
    return <EmptyState title="暂无对比数据" description="该细分板块没有匹配个股。" compact />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-borderSoft bg-card">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="sticky top-0 bg-bg2 text-xs text-textMuted">
          <tr>
            {["股票", "市值", "营收增速", "利润增速", "毛利率", "ROE", "PE", "产业链位置", "龙头逻辑", "风险"].map(
              (header) => (
                <th key={header} className={`px-3 py-3 font-medium ${["市值", "营收增速", "利润增速", "毛利率", "ROE", "PE"].includes(header) ? "text-right" : ""}`}>
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.id} className="h-16 border-t border-borderSoft transition hover:bg-cyan/5">
              <td className="px-3 py-3 font-medium text-textStrong"><OverflowTooltip title={stock.name}>{stock.name}</OverflowTooltip></td>
              <ValueCell value={stock.financial.marketCap} numeric />
              <ValueCell value={stock.financial.revenueGrowth} numeric />
              <ValueCell value={stock.financial.profitGrowth} numeric />
              <ValueCell value={stock.financial.grossMargin} numeric />
              <ValueCell value={stock.financial.roe} numeric />
              <ValueCell value={stock.valuation.pe} numeric />
              <td className="px-3 py-3"><TextClamp lines={2} title={stock.chainPosition}>{stock.chainPosition}</TextClamp></td>
              <td className="px-3 py-3"><TextClamp lines={2} title={stock.leaderPosition}>{stock.leaderPosition}</TextClamp></td>
              <td className="px-3 py-3">{stock.riskLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentMarketSummary({ stocks }: { stocks: Stock[] }) {
  const realQuotes = stocks.map((stock) => stock.quote).filter(Boolean);
  const pctValues = realQuotes.map((quote) => quote?.pctChange).filter((value): value is number => typeof value === "number");
  const mcapValues = realQuotes.map((quote) => quote?.marketCap).filter((value): value is number => typeof value === "number");
  const amountValues = realQuotes.map((quote) => quote?.amount).filter((value): value is number => typeof value === "number");
  const averagePct = pctValues.length ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length : null;
  const totalMcap = mcapValues.length ? mcapValues.reduce((sum, value) => sum + value, 0) : null;
  const averageAmount = amountValues.length ? amountValues.reduce((sum, value) => sum + value, 0) / amountValues.length : null;
  const financialDates = stocks
    .map((stock) => stock.realFinancial?.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestFinancial = financialDates.length ? financialDates[financialDates.length - 1] : undefined;
  const coveredStocks = stocks.filter((stock) => stock.dataQuality?.some((item) => item.status === "real" || item.status === "stale")).length;
  const latestUpdates = stocks
    .flatMap((stock) => stock.dataQuality?.map((item) => item.updatedAt).filter(Boolean) ?? [])
    .sort();
  const latestUpdate = latestUpdates.length ? latestUpdates[latestUpdates.length - 1] : undefined;
  const coverage = stocks.length ? `${coveredStocks}/${stocks.length}` : "数据暂缺";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="龙头平均涨跌幅"
        value={averagePct === null ? "暂无" : `${averagePct.toFixed(2)}%`}
        tone={averagePct === null ? "neutral" : averagePct >= 0 ? "green" : "red"}
      />
      <MetricCard label="龙头总市值合计" value={totalMcap === null ? "暂无" : `${totalMcap.toFixed(1)} 亿`} />
      <MetricCard label="平均成交额" value={averageAmount === null ? "暂无" : `${averageAmount.toFixed(1)} 亿`} tone="cyan" />
      <MetricCard label="真实覆盖" value={coverage} tone="cyan" />
      <MetricCard label="财务数据更新时间" value={latestFinancial ?? "暂无"} />
      <MetricCard label="行情更新时间" value={latestUpdate ?? "暂无"} />
    </div>
  );
}

function ValueCell({ value, numeric = false }: { value: string; numeric?: boolean }) {
  const missing = !value || value.includes("数据暂缺");
  return (
    <td className={`px-3 py-3 ${numeric ? "text-right tabular-nums" : ""}`}>
      {missing ? (
        <span className="inline-flex rounded border border-borderSoft bg-surface/70 px-2 py-0.5 text-xs text-textWeak" title="数据源暂未覆盖">
          —
        </span>
      ) : (
        <span className="whitespace-nowrap text-text">{value}</span>
      )}
    </td>
  );
}

function InfoBlock({ title, items, risk = false }: { title: string; items: string[]; risk?: boolean }) {
  return (
    <div className="rounded-lg border border-borderSoft bg-bg2/70 p-3">
      <p className="text-sm font-semibold text-textStrong">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-textMuted">
        {items.map((item) => (
          <li key={item} className={risk ? "text-red-200" : ""}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-textStrong">{label}：</span>
      <span className="break-words text-textMuted">{value}</span>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-dashed border-borderSoft bg-surface/70 text-center ${compact ? "p-6" : "p-10"}`}>
      <p className="font-medium text-textStrong">{title}</p>
      <p className="mt-1 text-sm text-textMuted">{description}</p>
    </div>
  );
}
