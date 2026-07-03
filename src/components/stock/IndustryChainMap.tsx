import { ArrowRight, Factory, Layers3 } from "lucide-react";
import type { Industry, Stock } from "../../types";

interface IndustryChainMapProps {
  industry?: Industry;
  segmentName: string;
  stock: Stock;
}

export function IndustryChainMap({ industry, segmentName, stock }: IndustryChainMapProps) {
  const stages = industry?.chain ?? [];
  const currentStage = findCurrentStage(stages, stock.chainPosition, segmentName);
  const elasticity = stock.researchProfile?.profitDrivers?.[0] ?? stock.growthDrivers?.[0] ?? "待接入";

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-borderSoft bg-bg2/70 p-4 text-sm text-textMuted">
        产业链数据暂缺，待补充上游 / 中游 / 下游结构。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {stages.map((stage, index) => {
          const active = stage.stage === currentStage;
          return (
            <div key={stage.stage} className="relative min-w-0">
              <div
                className={`h-full rounded-lg border p-4 transition ${
                  active
                    ? "border-cyan/70 bg-cyan/10 shadow-glow"
                    : "border-borderSoft bg-bg2/75"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers3 className={active ? "h-4 w-4 text-cyan" : "h-4 w-4 text-textMuted"} />
                  <p className={active ? "font-semibold text-cyan" : "font-semibold text-textStrong"}>{stage.stage}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage.items.map((item) => (
                    <span
                      key={item}
                      className={`max-w-full truncate rounded border px-2 py-1 text-xs ${
                        active && matchesPosition(item, stock.chainPosition, segmentName)
                          ? "border-cyan/50 bg-cyan/15 text-cyan"
                          : "border-borderSoft bg-surface/70 text-textMuted"
                      }`}
                      title={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {index < stages.length - 1 ? (
                <ArrowRight className="absolute -right-5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-textWeak lg:block" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-cyan/35 bg-cyan/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-cyan">
              <Factory className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Current Position</p>
            </div>
            <h4 className="mt-2 text-lg font-semibold text-textStrong">{stock.name}</h4>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              产业链位置：{stock.chainPosition || "数据暂缺"}；负责环节：{segmentName || "待补充"}。
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-borderSoft bg-bg2/80 p-3 sm:w-64">
            <p className="text-xs text-textMuted">盈利弹性来源</p>
            <p className="mt-1 text-sm font-semibold text-textStrong">{elasticity}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function findCurrentStage(
  stages: Array<{ stage: "上游" | "中游" | "下游"; items: string[] }>,
  chainPosition: string,
  segmentName: string,
) {
  const hit = stages.find((stage) => stage.items.some((item) => matchesPosition(item, chainPosition, segmentName)));
  return hit?.stage ?? stages[Math.floor(stages.length / 2)]?.stage;
}

function matchesPosition(item: string, chainPosition: string, segmentName: string) {
  const haystack = `${chainPosition} ${segmentName}`.toLowerCase();
  return haystack.includes(item.toLowerCase()) || item.toLowerCase().includes(segmentName.toLowerCase());
}
