import { ChartAuditPanel } from "../components/charts/ChartAuditPanel";
import type { ChartAuditView } from "../services/chartAudit";

/** Isolated presentation samples, never a business Evidence or ResearchEvent. */
export function ChartAuditStateReview() {
  const audit: ChartAuditView = {
    title: "合成审计状态传播样例", scope: "UI review only；不是价格或财务 Provider 准入事实",
    quality: ["missing", "partial", "stale", "conflicted", "not_admitted", "unknown"],
    rows: [
      { label: "数据准入（合成）", value: "NOT_ADMITTED" }, { label: "生产准入（合成）", value: "NOT_ADMITTED" },
      { label: "PIT（合成）", value: "unknown" }, { label: "零值（合成）", value: "0" },
      { label: "不安全来源（合成）", value: "不生成链接", href: "javascript:void(0)" },
    ], records: [], linkage: null,
  };
  return <section className="my-4 min-w-0" aria-label="合成审计状态验收"><p className="text-sm text-warning">仅验收状态传播，不改变任何业务 owner 或准入。</p><ChartAuditPanel audit={audit} /></section>;
}
