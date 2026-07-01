import { Activity, ArrowDownRight, ArrowUpRight, Minus, Radar } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MacroIndicator } from "../../types";
import { GlassCard, StatusBadge } from "../common/terminal";

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
  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-4 lg:grid-cols-2">
        {indicators.map((indicator) => {
          const Icon = trendIcon[indicator.trend];
          return (
            <GlassCard key={indicator.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-steel">{indicator.category}</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">{indicator.name}</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={indicator.currentStatus.includes("X") || indicator.currentStatus.includes("待接入") ? "missing" : "mock"} />
                  <span className="inline-flex items-center gap-1 rounded border border-line bg-bg2 px-2 py-1 text-xs text-steel">
                    <Icon className="h-3.5 w-3.5" />
                    {indicator.trend}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm font-medium text-ink">{indicator.currentStatus}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{indicator.marketImpact}</p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {indicator.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-md border border-line bg-bg2/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-steel">{metric.label}</p>
                      <StatusBadge status={metric.value.includes("X") || metric.value.includes("待") ? "missing" : "mock"} />
                    </div>
                    <p className="mt-1 text-base font-semibold text-ink">{metric.value}</p>
                    <p className="mt-1 text-xs text-steel">{metric.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-steel">继续跟踪</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {indicator.trackingIndicators.map((item) => (
                    <span key={item} className="rounded border border-line px-2 py-1 text-xs text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
      <GlassCard className="p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-signal" />
          <h2 className="text-lg font-semibold text-ink">宏观观察雷达</h2>
        </div>
        <p className="mt-2 text-sm text-steel">
          下图为示例评分，用于展示未来接入真实指标后的呈现方式，不代表当前市场实时判断。
        </p>
        <div className="mt-4 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#94A3B8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#94A3B8" }} width={60} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", color: "#E5E7EB" }} />
              <Bar dataKey="value" fill="#22D3EE" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </section>
  );
}
