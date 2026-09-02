import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  Binoculars,
  Building2,
  CircleDot,
  FlaskConical,
  Globe2,
  LineChart,
  Radar,
  ScrollText,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { DashboardDataMode, Stock } from "../../types";
import { formatPercent } from "../../utils/normalize";

export type ResearchDestination = "宏观" | "行业" | "个股池" | "观察清单" | "验证中心" | "预期证据";

interface HomeStats {
  segments: number;
  missingFields: number;
  highRisk: number;
  recentEvents: number;
  verificationChains: number;
  todayReview: number;
  overdueReview: number;
  newEventReminder: number;
  quoteCoverageReal: number;
  quoteCoverageTotal: number;
  pendingExpectationSources: number;
}

interface HomePageProps {
  dataMode: DashboardDataMode;
  modeLabel: string;
  updatedAt: string;
  sourceNote: string;
  coverageSummary: string;
  industriesCount: number;
  stocksCount: number;
  activeWatchCount: number;
  expectationCount: number;
  macroCount: number;
  stats: HomeStats;
  focusStocks: Stock[];
  onDataModeChange: (mode: DashboardDataMode) => void;
  onNavigate: (destination: ResearchDestination) => void;
  onOpenStock: (stock: Stock) => void;
}

const MODULES: Array<{
  id: ResearchDestination;
  icon: LucideIcon;
  index: string;
  label: string;
  description: string;
  tone: "cyan" | "blue" | "violet";
}> = [
  { id: "宏观", icon: Globe2, index: "01", label: "宏观雷达", description: "政策、流动性与跨市场变量", tone: "cyan" },
  { id: "行业", icon: Building2, index: "02", label: "产业图谱", description: "行业景气、驱动与产业链结构", tone: "blue" },
  { id: "个股池", icon: BarChart3, index: "03", label: "资产核心池", description: "A/H 股标的、财务与风险跟踪", tone: "violet" },
  { id: "观察清单", icon: Binoculars, index: "04", label: "观察工作流", description: "观察项、复盘任务与历史留痕", tone: "cyan" },
  { id: "验证中心", icon: FlaskConical, index: "05", label: "事件验证", description: "ResearchEvent 与证据链核验", tone: "blue" },
  { id: "预期证据", icon: ScrollText, index: "06", label: "预期证据", description: "预期快照、修正与实际值对账", tone: "violet" },
];

export function HomePage({
  dataMode,
  modeLabel,
  updatedAt,
  sourceNote,
  coverageSummary,
  industriesCount,
  stocksCount,
  activeWatchCount,
  expectationCount,
  macroCount,
  stats,
  focusStocks,
  onDataModeChange,
  onNavigate,
  onOpenStock,
}: HomePageProps) {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const revealItems = [...document.querySelectorAll<HTMLElement>("[data-home-reveal]")];
    if (typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.12 },
    );
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const updatePointer = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = heroRef.current?.getBoundingClientRect();
    if (!bounds || event.pointerType === "touch") return;
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroRef.current?.style.setProperty("--pointer-x", x.toFixed(3));
    heroRef.current?.style.setProperty("--pointer-y", y.toFixed(3));
  };

  const resetPointer = () => {
    heroRef.current?.style.setProperty("--pointer-x", "0");
    heroRef.current?.style.setProperty("--pointer-y", "0");
  };

  const metricFor = (id: ResearchDestination) => {
    if (id === "宏观") return `${macroCount} 项指标`;
    if (id === "行业") return `${industriesCount} 行业 / ${stats.segments} 细分`;
    if (id === "个股池") return `${stocksCount} 个资产`;
    if (id === "观察清单") return `${activeWatchCount} 个观察项`;
    if (id === "验证中心") return `${stats.verificationChains} 条验证链`;
    return `${expectationCount} 条预期快照`;
  };

  return (
    <div className="home-shell min-h-screen bg-bg text-text">
      <section
        ref={heroRef}
        className="home-hero relative isolate min-h-[780px] overflow-hidden"
        onPointerMove={updatePointer}
        onPointerLeave={resetPointer}
      >
        <div className="home-hero-grid" aria-hidden="true" />
        <div className="home-aurora home-aurora-one" aria-hidden="true" />
        <div className="home-aurora home-aurora-two" aria-hidden="true" />

        <header className="home-nav relative z-30 mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <button type="button" className="group flex items-center gap-3 text-left" aria-label="投资研究看板首页">
            <span className="home-brand-mark"><Radar className="h-4 w-4" /></span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-textStrong">IR SYSTEM</span>
              <span className="hidden text-[10px] tracking-[0.12em] text-textWeak sm:block">GLOBAL ASSET INTELLIGENCE</span>
            </span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-textMuted backdrop-blur-md md:flex">
              <span className={`home-live-dot ${dataMode === "mock" ? "is-mock" : ""}`} />
              SYSTEM ONLINE
            </div>
            <label className="home-mode-select">
              <span className="sr-only">数据模式</span>
              <select value={dataMode} onChange={(event) => onDataModeChange(event.target.value as DashboardDataMode)}>
                <option value="mock">Mock Data</option>
                <option value="mixed">Mixed Data</option>
                <option value="real">Real Data</option>
              </select>
            </label>
          </div>
        </header>

        <div className="relative z-20 mx-auto grid min-h-[690px] max-w-[1560px] items-center gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:pb-24 lg:pt-2">
          <div className="home-hero-copy max-w-[680px]" data-home-reveal>
            <div className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan">
              <span className="h-px w-10 bg-cyan/70" />
              Research infrastructure / V1
            </div>
            <h1 className="home-display-title text-balance text-[clamp(3.3rem,7vw,7.4rem)] font-medium leading-[0.88] tracking-[-0.065em] text-textStrong">
              全球资产
              <span className="block text-transparent">投研系统</span>
            </h1>
            <p className="mt-8 max-w-xl text-balance text-base leading-7 text-textMuted sm:text-lg sm:leading-8">
              从宏观变量到产业链、核心资产与事件证据，把分散的研究信号组织成一套可追溯、可验证、持续运转的决策界面。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate("行业")} className="home-primary-action">
                进入研究终端 <ArrowUpRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onNavigate("验证中心")} className="home-secondary-action">
                查看事件验证 <FlaskConical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="home-orbit-stage" aria-label="市场、行业、资产与证据组成的研究网络" data-home-reveal>
            <div className="home-orbit-aura" aria-hidden="true" />
            <div className="home-orbit home-orbit-outer" aria-hidden="true">
              <span className="home-orbit-node node-one" />
              <span className="home-orbit-node node-two" />
            </div>
            <div className="home-orbit home-orbit-mid" aria-hidden="true">
              <span className="home-orbit-node node-three" />
            </div>
            <div className="home-orbit home-orbit-inner" aria-hidden="true" />
            <div className="home-core">
              <div className="home-core-scan" aria-hidden="true" />
              <Globe2 className="h-10 w-10 text-cyan sm:h-12 sm:w-12" strokeWidth={1.2} />
              <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-textMuted">Market Core</span>
              <strong className="mt-1 text-2xl font-medium tracking-tight text-textStrong tabular-nums">{stocksCount}</strong>
              <span className="text-[10px] uppercase tracking-[0.18em] text-textWeak">tracked assets</span>
            </div>
            <OrbitLabel className="label-macro" eyebrow="MACRO" value={`${macroCount} signals`} />
            <OrbitLabel className="label-industry" eyebrow="SECTORS" value={`${industriesCount} mapped`} />
            <OrbitLabel className="label-evidence" eyebrow="EVIDENCE" value={`${stats.verificationChains} chains`} />
            <div className="home-axis home-axis-x" aria-hidden="true" />
            <div className="home-axis home-axis-y" aria-hidden="true" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 border-y border-white/[0.07] bg-black/25 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[1560px] gap-px px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-[1.1fr_1fr_1.4fr_auto] lg:px-12">
            <HeroSignal label="DATA MODE" value={modeLabel} />
            <HeroSignal label="QUOTE COVERAGE" value={`${stats.quoteCoverageReal} / ${stats.quoteCoverageTotal}`} />
            <HeroSignal label="LAST DATA UPDATE" value={updatedAt || "UNAVAILABLE"} />
            <button type="button" className="home-scroll-cue hidden items-center gap-3 px-5 text-[10px] uppercase tracking-[0.2em] text-textMuted lg:flex" onClick={() => document.getElementById("research-grid")?.scrollIntoView({ behavior: "smooth" })}>
              Explore <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <main className="relative z-10 bg-[#050913]">
        <section id="research-grid" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end" data-home-reveal>
            <div>
              <p className="home-section-kicker">RESEARCH WORKSPACE</p>
              <h2 className="mt-4 max-w-lg text-balance text-3xl font-medium tracking-[-0.035em] text-textStrong sm:text-5xl">从全局信号进入具体研究。</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-textMuted lg:justify-self-end lg:text-base">
              首页不替代工作流，只负责缩短抵达路径。每个入口都连接现有模块，并保留原有的数据来源、缺失状态和审计边界。
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-home-reveal>
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <button key={module.id} type="button" className={`home-module-card tone-${module.tone}`} onClick={() => onNavigate(module.id)}>
                  <span className="home-module-index">{module.index}</span>
                  <span className="home-module-icon"><Icon className="h-5 w-5" /></span>
                  <span className="mt-8 block text-lg font-medium text-textStrong">{module.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-textMuted">{module.description}</span>
                  <span className="mt-8 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4 text-xs">
                    <span className="text-textWeak tabular-nums">{metricFor(module.id)}</span>
                    <ArrowUpRight className="h-4 w-4 text-textWeak transition duration-300 group-hover:text-cyan" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto grid max-w-[1480px] gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-24">
            <div className="home-pulse-panel" data-home-reveal>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="home-section-kicker">SYSTEM PULSE</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight text-textStrong sm:text-3xl">研究脉冲</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                  <CircleDot className="h-3.5 w-3.5" /> Live dataset
                </span>
              </div>
              <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2">
                <PulseMetric label="近 7 日研究事件" value={stats.recentEvents} meta="ResearchEvent" />
                <PulseMetric label="今日待复盘" value={stats.todayReview} meta={stats.overdueReview ? `${stats.overdueReview} 项逾期` : "无逾期项"} tone={stats.overdueReview ? "warning" : "default"} />
                <PulseMetric label="高风险资产" value={stats.highRisk} meta="风险标签，不代表建议" tone={stats.highRisk ? "warning" : "default"} />
                <PulseMetric label="来源待核验" value={stats.pendingExpectationSources} meta="保持为证据缺口" tone={stats.pendingExpectationSources ? "warning" : "default"} />
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-cyan/10 bg-cyan/[0.035] p-4 text-sm leading-6 text-textMuted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
                <p><strong className="font-medium text-textStrong">证据优先。</strong> {sourceNote} 缺失、过期或不支持的字段继续明确展示，不以视觉效果掩盖数据状态。</p>
              </div>
            </div>

            <div className="home-focus-panel" data-home-reveal>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="home-section-kicker">FOCUS ASSETS</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight text-textStrong">重点资产</h2>
                </div>
                <Sparkles className="h-5 w-5 text-violet/80" />
              </div>
              <div className="mt-7 divide-y divide-white/[0.07]">
                {focusStocks.map((stock, index) => (
                  <button key={stock.id} type="button" className="home-asset-row" onClick={() => onOpenStock(stock)}>
                    <span className="w-6 text-[10px] text-textWeak tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-textStrong">{stock.name}</span>
                      <span className="mt-1 block truncate text-[11px] uppercase tracking-[0.1em] text-textWeak">{stock.market} / {stock.code}</span>
                    </span>
                    <span className={`text-sm font-medium tabular-nums ${priceTone(stock.quote?.pctChange)}`}>{formatPercent(stock.quote?.pctChange)}</span>
                    <ArrowUpRight className="h-4 w-4 text-textWeak" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => onNavigate("个股池")} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-3 text-xs font-medium text-textMuted transition hover:border-cyan/30 hover:bg-cyan/[0.04] hover:text-textStrong focus:outline-none focus:ring-2 focus:ring-cyan/30">
                打开完整资产池 <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1480px] flex-col gap-5 px-5 py-10 text-xs text-textWeak sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div className="flex items-center gap-3"><Radar className="h-4 w-4 text-cyan/70" /><span>Investment Research System / Internal Workspace</span></div>
          <p className="max-w-2xl md:text-right">{coverageSummary} · 仅供内部研究与决策参考，不构成投资建议。</p>
        </footer>
      </main>
    </div>
  );
}

function OrbitLabel({ className, eyebrow, value }: { className: string; eyebrow: string; value: string }) {
  return (
    <div className={`home-orbit-label ${className}`}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HeroSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-white/[0.07] py-3.5 sm:border-r sm:px-5 first:pl-0">
      <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-textWeak">{label}</span>
      <strong className="mt-1 block truncate text-[11px] font-medium text-textStrong tabular-nums" title={value}>{value}</strong>
    </div>
  );
}

function PulseMetric({ label, value, meta, tone = "default" }: { label: string; value: number; meta: string; tone?: "default" | "warning" }) {
  return (
    <div className="bg-[#080d18] p-5 sm:p-6">
      <span className="text-xs text-textMuted">{label}</span>
      <div className="mt-5 flex items-end justify-between gap-4">
        <strong className={`text-4xl font-light tracking-tight tabular-nums ${tone === "warning" && value > 0 ? "text-warning" : "text-textStrong"}`}>{value}</strong>
        <span className="pb-1 text-right text-[10px] uppercase tracking-[0.12em] text-textWeak">{meta}</span>
      </div>
    </div>
  );
}

function priceTone(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-textMuted";
  return value > 0 ? "text-rise" : "text-fall";
}
