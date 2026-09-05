import type { DataSourceStatus, EvidenceSourceType } from "../../types/dataSource";

type BadgeStatus = DataSourceStatus | EvidenceSourceType | "supported" | "realish";

const statusStyles: Record<BadgeStatus, { label: string; className: string }> = {
  error: { label: "错误", className: "border-danger/40 bg-danger/10 text-red-200" },
  conflicted: { label: "冲突", className: "border-danger/40 bg-danger/10 text-red-200" },
  source_unavailable: { label: "来源不可用", className: "border-danger/40 bg-danger/10 text-red-200" },
  stale: { label: "过期", className: "border-amber/40 bg-amber/10 text-amber" },
  not_implemented: { label: "未实现", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  missing: { label: "缺失", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
  partial: { label: "部分可用", className: "border-amber/40 bg-amber/10 text-amber" },
  manual_unverified: { label: "手工未核验", className: "border-amber/40 bg-amber/10 text-amber" },
  inferred: { label: "推断", className: "border-amber/40 bg-amber/10 text-amber" },
  unknown: { label: "未知", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
  manual_verified: { label: "手工已核验", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  generated_real: { label: "已生成真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  real: { label: "真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  static_reference: { label: "静态参考", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  mock: { label: "模拟数据", className: "border-violet/40 bg-violet/10 text-violet-200" },
  placeholder: { label: "占位数据", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
  supported: { label: "已支持", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  realish: { label: "真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  unsupported_market: { label: "当前市场不支持", className: "border-slate-500/40 bg-slate-700/40 text-slate-300" },
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const item = statusStyles[status] ?? statusStyles.missing;
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 ${item.className}`} title={label ?? item.label}>
      <span className="truncate">{label ?? item.label}</span>
    </span>
  );
}
