import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { SectionHeader } from "./SectionHeader";

export function ChartPanel({
  title,
  description,
  legend,
  children,
  empty,
  summary,
  dataTable,
  className = "",
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  children: ReactNode;
  empty?: boolean;
  summary?: string;
  dataTable?: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard className={`p-4 ${className}`}>
      <SectionHeader title={title} description={description} action={legend} />
      <div className="mt-4 min-h-[220px] overflow-hidden rounded-md border border-borderSoft bg-bg/45 p-2">
        {empty ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-textMuted">图表数据暂缺</div>
        ) : (
          children
        )}
      </div>
      {summary ? <p className="mt-3 text-xs leading-5 text-textMuted">{summary}</p> : null}
      {dataTable ? <details className="mt-3 rounded-md border border-control bg-panel">
        <summary className="cursor-pointer px-3 py-2 text-sm text-accent">查看原始数据表</summary>
        <div className="max-h-80 overflow-auto px-3 pb-3">{dataTable}</div>
      </details> : null}
    </DashboardCard>
  );
}
