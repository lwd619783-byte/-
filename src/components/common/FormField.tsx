import { Children, cloneElement, createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode } from "react";

export const FormFeedback = createContext<string | null>(null);
const fieldTerms: Record<string, string[]> = {
  "报告期": ["报告期"], "预测值": ["点预测", "value"], "区间下限": ["区间", "lowerBound"], "区间上限": ["区间", "upperBound"],
  "预期形成日期": ["预期形成日期", "asOfDate"], "精确形成时间（可选）": ["formedAt", "精确预期形成时间"],
  "来源发布日期 / 时间": ["来源时间", "来源发布日期", "sourcePublishedAt"], "机构数量": ["institutionCount", "机构数量"],
  "分析师数量": ["analystCount", "分析师数量"], "来源链接": ["来源链接", "sourceUrl"],
};
/** Presents the existing validator's messages; never adds a second validation contract. */
export function FormField({ label, children }: { label: string; children: ReactNode }) {
  const message = useContext(FormFeedback); const id = useId();
  const error = message?.split("；").filter(part => fieldTerms[label]?.some(term => part.includes(term))).join("；");
  return <label className="block min-w-0 text-xs text-textMuted"><span className="mb-1 block">{label}</span>{Children.map(children, child => {
    if (!isValidElement(child) || !["input", "textarea", "select"].includes(String(child.type))) return child;
    const control = child as ReactElement<Record<string, unknown>>;
    return cloneElement(control, { "aria-label": label, ...(error ? { "aria-invalid": true, "aria-describedby": id } : {}) });
  })}{error ? <span id={id} className="mt-1 block leading-5 text-danger">{error}</span> : null}</label>;
}
