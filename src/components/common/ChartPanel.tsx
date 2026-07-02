import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { SectionHeader } from "./SectionHeader";

export function ChartPanel({
  title,
  description,
  legend,
  children,
  empty,
  className = "",
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  children: ReactNode;
  empty?: boolean;
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
    </DashboardCard>
  );
}
