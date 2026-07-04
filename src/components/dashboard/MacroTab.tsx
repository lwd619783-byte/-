import { Activity, ArrowDownRight, ArrowUpRight, Minus, Radar } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DataSourceStatus, MacroIndicator } from "../../types";
import { ChartPanel, DashboardCard, StatusBadge } from "../common/terminal";

const trendIcon = {
  上行: ArrowUpRight,
  下行: ArrowDownRight,
  震荡: Minus,
  待验证: Radar,
};

const chartData = [
  { name: "增长", value: 58 },
  { name: "流动性", value: 66 },
  { name: "政策", value: 72 },
  { name: "风格", value: 54 },
];

export function MacroTab({ indicators }: { indicators: MacroIndicator[] }) {
  const realMetricCount = indicators.flatMap((indicator) => indicator.metrics).filter((metric) => metric.status === "real").length;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-4 lg:grid-cols-2">
        {indicators.map((indicator) => {
          const Icon = trendIcon[indicator.trend];
          return (
            <DashboardCard key={indicator.id} className="p-4" interactive>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-textMuted">{indicator.category}</p>
                  <h2 className="mt-1 text-lg font-semibold text-textStrong">{indicator.name}</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={indicatorStatus(indicator)} />
                  <span className="inline-flex items-center gap-1 rounded border border-borderSoft bg-bg2 px-2 py-1 text-xs text-textMuted">
                    <Icon className="h-3.5 w-3.5" />
                    {indicator.trend}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm font-medium text-textStrong">{indicator.currentStatus}</p>
              <p className="mt-2 text-sm leading-6 text-textMuted">{indicator.marketImpact}</p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {indicator.metrics.map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-md border border-borderSoft bg-bg2/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-textMuted" title={metric.label}>{metric.label}</p>
                      <StatusBadge status={metric.status ?? (metric.value.includes("X") || metric.value.includes("待") ? "missing" : "mock")} />
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-textStrong" title={metric.value}>{metric.value}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-textMuted" title={metric.note}>{metric.note}</p>
                    {metric.source ? (
                      <p className="mt-1 truncate text-[10px] text-textWeak" title={`${metric.source} · ${metric.updatedAt ?? ""}`}>
                        {metric.source}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-textMuted">继续跟踪</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {indicator.trackingIndicators.map((item) => (
                    <span key={item} className="max-w-full truncate rounded border border-borderSoft px-2 py-1 text-xs text-textMuted" title={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </DashboardCard>
          );
        })}
      </div>
      <ChartPanel
        title="宏观观察雷达"
        description="评分仍是展示用聚合视图；卡片中的底层指标已接入 AKShare 生成的宏观数据。"
        legend={<span className="inline-flex items-center gap-2 text-xs text-textMuted"><Activity className="h-4 w-4 text-cyan" />真实指标 {realMetricCount} 项</span>}
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#94A3B8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#94A3B8" }} width={60} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #334155", color: "#E5E7EB" }} labelStyle={{ color: "#E5E7EB" }} />
              <Bar dataKey="value" fill="#22D3EE" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
    </section>
  );
}

function indicatorStatus(indicator: MacroIndicator): DataSourceStatus {
  if (indicator.metrics.some((metric) => metric.status === "real")) return "real";
  if (indicator.metrics.some((metric) => metric.status === "stale")) return "stale";
  if (indicator.currentStatus.includes("X") || indicator.currentStatus.includes("待接入")) return "missing";
  return "mock";
}
