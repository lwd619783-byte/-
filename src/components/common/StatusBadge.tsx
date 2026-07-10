import type { DataSourceStatus, EvidenceSourceType } from "../../types/dataSource";

type BadgeStatus = DataSourceStatus | EvidenceSourceType | "supported" | "realish";

const statusStyles: Record<BadgeStatus, { label: string; className: string }> = {
  error: { label: "error", className: "border-danger/40 bg-danger/10 text-red-200" },
  conflicted: { label: "conflicted", className: "border-danger/40 bg-danger/10 text-red-200" },
  source_unavailable: { label: "source unavailable", className: "border-danger/40 bg-danger/10 text-red-200" },
  stale: { label: "stale", className: "border-amber/40 bg-amber/10 text-amber" },
  not_implemented: { label: "not implemented", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  missing: { label: "missing", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
  partial: { label: "partial", className: "border-amber/40 bg-amber/10 text-amber" },
  manual_unverified: { label: "manual unverified", className: "border-amber/40 bg-amber/10 text-amber" },
  inferred: { label: "inferred", className: "border-amber/40 bg-amber/10 text-amber" },
  unknown: { label: "unknown", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
  manual_verified: { label: "manual verified", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  generated_real: { label: "generated real", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  real: { label: "real", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  static_reference: { label: "static reference", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  mock: { label: "mock", className: "border-violet/40 bg-violet/10 text-violet-200" },
  placeholder: { label: "placeholder", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  supported: { label: "supported", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  realish: { label: "real", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  unsupported_market: { label: "unsupported market", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const item = statusStyles[status] ?? statusStyles.missing;
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 ${item.className}`} title={label ?? item.label}>
      <span className="truncate">{label ?? item.label}</span>
    </span>
  );
}
