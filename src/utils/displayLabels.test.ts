import { describe, expect, it } from "vitest";
import { statusDisplayLabel, auditDisplayText, unitDisplayLabel, financialMetricLabel } from "./displayLabels";

describe("业绩预期状态与时间分辨率中文展示", () => {
  it("保留来源核验状态的语义差异", () => {
    expect(statusDisplayLabel("verified")).toBe("已核验");
    expect(statusDisplayLabel("pending")).toBe("待核验");
    expect(statusDisplayLabel("unverified")).toBe("未核验");
    expect(statusDisplayLabel("invalid")).toBe("无效");
  });

  it("覆盖所有来源时间分辨率", () => {
    expect(statusDisplayLabel("date")).toBe("日期");
    expect(statusDisplayLabel("absolute")).toBe("绝对时间");
    expect(statusDisplayLabel("workflow_time_zone")).toBe("工作流时区");
    expect(statusDisplayLabel("unresolved_legacy")).toBe("旧记录时区未解析");
  });

  it("对未知状态保留安全透传", () => {
    expect(statusDisplayLabel("future_status")).toBe("future_status");
  });
});

it('localizes admission, uncertainty, units and financial abbreviations only for display', () => {
  expect(unitDisplayLabel('Thousand Barrels')).toBe('千桶');
  expect(financialMetricLabel('FCF')).toBe('自由现金流（FCF）');
  expect(auditDisplayText('freshness：unknown；releaseAvailableAt：NOT_ADMITTED')).toBe('数据新鲜度：未确认；公开可得时间：尚未准入');
  for (const [input, label] of [['unknown', '未确认'], ['NOT_ADMITTED', '尚未准入'], ['not_admitted', '尚未准入'], ['blocked', '暂不可用'], ['missing_evidence', '证据缺失'], ['UNPROVED', '未证明']]) expect(statusDisplayLabel(input)).toBe(label);
});
