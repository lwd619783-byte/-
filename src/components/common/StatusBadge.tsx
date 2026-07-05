import type { DataSourceStatus } from "../../types";

type BadgeStatus = DataSourceStatus | "supported" | "realish";

const statusStyles: Record<BadgeStatus, { label: string; className: string }> = {
  real: { label: "真实", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  realish: { label: "真实", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  partial: { label: "部分", className: "border-amber/40 bg-amber/10 text-amber" },
  stale: { label: "过期", className: "border-amber/40 bg-amber/10 text-amber" },
  missing: { label: "缺失", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
  error: { label: "错误", className: "border-danger/40 bg-danger/10 text-red-200" },
  mock: { label: "示例", className: "border-violet/40 bg-violet/10 text-violet-200" },
  not_implemented: { label: "未接入", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  unsupported_market: { label: "暂不支持", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  supported: { label: "支持", className: "border-cyan/40 bg-cyan/10 text-cyan" },
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const item = statusStyles[status] ?? statusStyles.missing;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 ${item.className}`}
      title={label ?? item.label}
    >
      <span className="truncate">{label ?? item.label}</span>
    </span>
  );
}
