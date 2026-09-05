import { describe, expect, it } from "vitest";
import { statusDisplayLabel } from "./displayLabels";

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
