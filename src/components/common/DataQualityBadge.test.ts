import { describe, expect, it } from "vitest";
import { getHighestRiskStatus } from "./DataQualityBadge";

describe("DataQualityBadge priority", () => {
  it("does not let real hide stale, partial, or conflicted data", () => {
    expect(getHighestRiskStatus([
      { source: "provider", status: "real" },
      { source: "cache", status: "partial" },
      { source: "old-cache", status: "stale" },
      { source: "conflict", status: "conflicted" },
    ])).toBe("conflicted");
    expect(getHighestRiskStatus([
      { source: "provider", status: "real" },
      { source: "cache", status: "stale" },
    ])).toBe("stale");
  });

  it("keeps manual verification and inference distinct", () => {
    expect(getHighestRiskStatus([
      { source: "manual", status: "manual_verified" },
      { source: "lead", status: "manual_unverified" },
    ])).toBe("manual_unverified");
    expect(getHighestRiskStatus([{ source: "model", status: "inferred" }])).toBe("inferred");
  });
});
