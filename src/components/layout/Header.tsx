import { Search, ShieldAlert } from "lucide-react";
import type { DashboardDataMode } from "../../types";

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  updatedAt: string;
  sourceNote: string;
  dataMode: DashboardDataMode;
  modeLabel: string;
  coverageSummary?: string;
  onDataModeChange: (mode: DashboardDataMode) => void;
}

export function Header({
  search,
  onSearchChange,
  updatedAt,
  sourceNote,
  dataMode,
  modeLabel,
  coverageSummary,
  onDataModeChange,
}: HeaderProps) {
  return (
    <header className="border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">投资研究看板</h1>
              <span className="rounded border border-line bg-panel px-2 py-1 text-xs text-steel">
                示例数据 / 待接入真实数据源
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">更新时间：{updatedAt} · {sourceNote}</p>
            {coverageSummary ? <p className="mt-1 text-xs text-slate-500">{coverageSummary}</p> : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <label className="block">
              <span className="sr-only">数据模式</span>
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/15"
                value={dataMode}
                onChange={(event) => onDataModeChange(event.target.value as DashboardDataMode)}
              >
                <option value="mock">Mock Data</option>
                <option value="mixed">Mixed Data</option>
                <option value="real">Real Data</option>
              </select>
            </label>
            <label className="relative block min-w-0 sm:w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-md border border-line bg-white pl-10 pr-3 text-sm outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/15"
                placeholder="搜索行业、细分板块、股票名称或代码"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            当前模式：{modeLabel}。数据源：A Stock Data / 本地生成缓存。本页面仅用于内部研究，不构成投资建议；未接入真实数据源的字段以 X、示例值或“数据暂缺”显示。
          </span>
        </div>
      </div>
    </header>
  );
}
