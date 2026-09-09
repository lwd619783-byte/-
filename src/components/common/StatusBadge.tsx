import type { DataSourceStatus, EvidenceSourceType } from "../../types/dataSource";

type BadgeStatus = DataSourceStatus | EvidenceSourceType | "supported" | "realish";

const statusStyles: Record<BadgeStatus, { label: string; className: string }> = {
  error: { label: "错误", className: "border-danger/40 bg-danger/10 text-danger" },
  conflicted: { label: "冲突", className: "border-danger/40 bg-danger/10 text-danger" },
  source_unavailable: { label: "来源不可用", className: "border-danger/40 bg-danger/10 text-danger" },
  stale: { label: "过期", className: "border-amber/40 bg-amber/10 text-amber" },
  not_implemented: { label: "未实现", className: "border-border bg-panel2 text-textMuted" },
  missing: { label: "缺失", className: "border-border bg-panel2 text-textMuted" },
  partial: { label: "部分可用", className: "border-amber/40 bg-amber/10 text-amber" },
  manual_unverified: { label: "手工未核验", className: "border-amber/40 bg-amber/10 text-amber" },
  inferred: { label: "推断", className: "border-amber/40 bg-amber/10 text-amber" },
  unknown: { label: "未知", className: "border-border bg-panel2 text-textMuted" },
  manual_verified: { label: "手工已核验", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  generated_real: { label: "已生成真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  real: { label: "真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  static_reference: { label: "静态参考", className: "border-border bg-panel2 text-textMuted" },
  mock: { label: "模拟数据", className: "border-violet/40 bg-violet/10 text-violet" },
  placeholder: { label: "占位数据", className: "border-border bg-panel2 text-textMuted" },
  supported: { label: "已支持", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  realish: { label: "真实数据", className: "border-cyan/40 bg-cyan/10 text-cyan" },
  unsupported_market: { label: "当前市场不支持", className: "border-border bg-panel2 text-textMuted" },
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const item = statusStyles[status] ?? statusStyles.missing;
  return (
    <span className={`inline-flex max-w-full items-center rounded-[5px] border px-2 py-0.5 text-xs font-medium leading-5 ${item.className}`} title={label ?? item.label}>
      <span className="break-words">{label ?? item.label}</span>
    </span>
  );
}
