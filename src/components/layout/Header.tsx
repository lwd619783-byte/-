import { Search, ShieldAlert } from "lucide-react";
import type { DashboardDataMode } from "../../types";
import { StatusBadge } from "../common/terminal";

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
  const tradeDate = updatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const modeStatus = dataMode === "mock" ? "mock" : modeLabel === "Real Data" ? "real" : "stale";
  return (
    <header className="border-b border-borderGlow/50 bg-bg/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="grid gap-3 xl:grid-cols-[360px_minmax(280px,1fr)_420px] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-wide text-ink">投资研究看板</h1>
              <StatusBadge status={modeStatus} />
            </div>
            <p className="mt-1 text-sm text-steel">交易日：{tradeDate} · 更新时间：{updatedAt}</p>
            {coverageSummary ? <p className="mt-1 text-xs text-slate-500">{coverageSummary}</p> : null}
          </div>
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-signal" />
            <input
              className="h-11 w-full rounded-md border border-borderGlow/60 bg-panel/80 pl-10 pr-3 text-sm text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/15"
              placeholder="搜索行业、细分板块、股票名称或代码"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="block">
              <span className="sr-only">数据模式</span>
              <select
                className="h-11 rounded-md border border-borderGlow/60 bg-panel px-3 text-sm font-medium text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/15"
                value={dataMode}
                onChange={(event) => onDataModeChange(event.target.value as DashboardDataMode)}
              >
                <option value="mock">Mock Data</option>
                <option value="mixed">Mixed Data</option>
                <option value="real">Real Data</option>
              </select>
            </label>
            <div className="rounded-md border border-line bg-panel/70 px-3 py-2 text-xs text-steel">{modeLabel}</div>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            当前模式：{modeLabel}。{sourceNote} 本页面仅用于内部研究，不构成投资建议；missing / stale / unsupported 字段会明确显示。
          </span>
        </div>
      </div>
    </header>
  );
}
