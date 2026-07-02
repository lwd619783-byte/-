import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";

export function FilterBar({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard className={`p-4 ${className}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-7">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </DashboardCard>
  );
}
