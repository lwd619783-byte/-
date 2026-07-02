import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";

type KpiTone = "positive" | "negative" | "warning" | "neutral" | "info";

const toneClass: Record<KpiTone, { value: string; badge: string; label: string }> = {
  positive: { value: "text-success", badge: "border-success/30 bg-success/10 text-green-100", label: "正向" },
  negative: { value: "text-danger", badge: "border-danger/30 bg-danger/10 text-red-100", label: "负向" },
  warning: { value: "text-warning", badge: "border-warning/30 bg-warning/10 text-amber-100", label: "关注" },
  neutral: { value: "text-textStrong", badge: "border-borderSoft bg-surface/80 text-textMuted", label: "中性" },
  info: { value: "text-cyan", badge: "border-cyan/30 bg-cyan/10 text-cyan-100", label: "信息" },
};

const toneIcon = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  warning: ArrowRight,
  neutral: ArrowRight,
  info: ArrowRight,
};

export function KpiCard({
  label,
  value,
  delta,
  description,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  description: string;
  tone?: KpiTone;
  icon?: ReactNode;
}) {
  const Icon = toneIcon[tone];
  const styles = toneClass[tone];

  return (
    <DashboardCard className="p-4" interactive>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-textMuted" title={label}>
            {label}
          </p>
          <div className={`mt-2 truncate text-2xl font-semibold tabular-nums ${styles.value}`}>{value}</div>
        </div>
        <div className="rounded-md border border-borderSoft bg-surface/80 p-2 text-cyan">{icon ?? <Icon className="h-4 w-4" />}</div>
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${styles.badge}`}>
          <Icon className="h-3 w-3" />
          {delta ?? styles.label}
        </span>
        <span className="truncate text-xs text-textWeak" title={description}>
          {description}
        </span>
      </div>
    </DashboardCard>
  );
}
