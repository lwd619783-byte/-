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

  it("prioritizes unavailable and not-implemented states over partial or real", () => {
    expect(getHighestRiskStatus([
      { source: "provider", status: "real" },
      { source: "partial", status: "partial" },
      { source: "missing-provider", status: "source_unavailable" },
    ])).toBe("source_unavailable");
    expect(getHighestRiskStatus([
      { source: "provider", status: "real" },
      { source: "gap", status: "not_implemented" },
    ])).toBe("not_implemented");
  });

  it("prioritizes explicit errors over every evidence state", () => {
    expect(getHighestRiskStatus([
      { source: "provider", status: "conflicted" },
      { source: "request", status: "error" },
    ])).toBe("error");
  });
});
