import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title = "暂无数据",
  description = "请调整筛选条件后重试。",
  state = "empty",
  action,
  compact = false,
}: {
  title?: string;
  description?: string;
  state?: "empty" | "loading" | "error";
  action?: ReactNode;
  compact?: boolean;
}) {
  const Icon = state === "loading" ? Loader2 : AlertCircle;
  return (
    <div className={`rounded-lg border border-dashed border-borderSoft bg-surface/55 text-center ${compact ? "p-6" : "p-10"}`}>
      <Icon className={`mx-auto h-5 w-5 text-textMuted ${state === "loading" ? "animate-spin" : ""}`} />
      <p className="mt-3 font-medium text-textStrong">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-textMuted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
