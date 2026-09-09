import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";

type KpiTone = "positive" | "negative" | "warning" | "neutral" | "info";

const toneClass: Record<KpiTone, { value: string; badge: string; label: string }> = {
  positive: { value: "text-success", badge: "border-success/30 bg-success/10 text-success", label: "正向" },
  negative: { value: "text-danger", badge: "border-danger/30 bg-danger/10 text-danger", label: "负向" },
  warning: { value: "text-warning", badge: "border-warning/30 bg-warning/10 text-warning", label: "关注" },
  neutral: { value: "text-textStrong", badge: "border-borderSoft bg-surface/80 text-textMuted", label: "中性" },
  info: { value: "text-cyan", badge: "border-cyan/30 bg-cyan/10 text-cyan", label: "信息" },
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
    <DashboardCard className="p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-xs font-medium text-textMuted" title={label}>
            {label}
          </p>
          <div className={`mt-2 break-words text-[28px] font-semibold leading-tight tabular-nums ${styles.value}`}>{value}</div>
        </div>
        {icon ? <div className="rounded-md border border-borderSoft bg-surface/80 p-2 text-cyan">{icon}</div> : null}
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        {delta ? <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${styles.badge}`}>
          <Icon className="h-3 w-3" />
          {delta}
        </span> : null}
        <span className="break-words text-xs leading-5 text-textWeak" title={description}>
          {description}
        </span>
      </div>
    </DashboardCard>
  );
}
