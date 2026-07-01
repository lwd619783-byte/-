import { describe, expect, it } from "vitest";
import { countMissingFields, dataModeLabel, isRecentlyUpdated } from "./dataQuality";
import type { DataQualityMeta } from "../types/dataSource";

describe("data quality helpers", () => {
  it("counts null, empty, and N/A fields as missing", () => {
    const missing = countMissingFields({
      latestPrice: 12.3,
      pe: null,
      pb: "N/A",
      dividendYield: "",
    });

    expect(missing).toEqual(["pe", "pb", "dividendYield"]);
  });

  it("labels mixed data when real and mock statuses coexist", () => {
    const quality: DataQualityMeta[] = [
      { source: "AKShare", status: "real", updatedAt: "2026-06-30T10:00:00+08:00" },
      { source: "mock", status: "mock" },
    ];

    expect(dataModeLabel(quality)).toBe("Mixed Data");
  });

  it("keeps unsupported markets distinct from missing data", () => {
    const quality: DataQualityMeta[] = [{ source: "A Stock Data", status: "unsupported_market" }];

    expect(dataModeLabel(quality)).toBe("Mixed Data");
  });

  it("detects recently updated records by threshold", () => {
    expect(isRecentlyUpdated("2026-06-30T10:00:00+08:00", new Date("2026-06-30T12:00:00+08:00"), 1)).toBe(false);
    expect(isRecentlyUpdated("2026-06-30T10:00:00+08:00", new Date("2026-06-30T12:00:00+08:00"), 3)).toBe(true);
  });
});
