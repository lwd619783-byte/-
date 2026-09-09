import { describe, expect, it } from "vitest";
import { robotStock, stocks } from "./stocks";
import type { EvidenceItem } from "../types";

const seed = {
  id: "synthetic-robot", name: "合成测试公司", code: "000000", segmentId: "fixture-segment", chainPosition: "测试环节",
  candidateType: "核心池" as const, evidenceLevel: "高" as const, verificationStatus: "已验证" as const, themeTags: ["测试线索"],
};

const sourcedEvidence: EvidenceItem = {
  id: "synthetic-source", claim: "合成 fixture 来源内容", sourceType: "年报", sourceName: "合成年报 fixture",
  url: "https://example.com/synthetic-report.pdf", sourceDate: "2026-01-01", confidence: "高", verificationStatus: "已验证",
};

describe("robotics seed evidence governance", () => {
  it("does not verify a high-level seed without a locatable source", () => {
    const stock = robotStock(seed);
    expect(stock.evidenceItems?.[0]).toMatchObject({ verificationStatus: "待验证", sourceType: "其他", confidence: "低" });
    expect(stock.verificationStatus).toBe("待验证");
    expect(stock.evidenceLevel).toBe("低");
    expect(stock.evidenceItems?.[0].claim).toContain("研究线索");
  });

  it("keeps observation-pool seeds as unverified research leads", () => {
    const stock = robotStock({ ...seed, candidateType: "观察池" });
    expect(stock.candidateType).toBe("观察池");
    expect(stock.evidenceItems?.[0]).toMatchObject({ verificationStatus: "待验证", sourceType: "其他", confidence: "低" });
    expect(stock.evidenceItems?.[0].claim).toContain("观察线索");
  });

  it("preserves explicitly supplied locatable verified evidence", () => {
    const stock = robotStock({ ...seed, evidenceItems: [sourcedEvidence] });
    expect(stock.evidenceItems?.[0]).toBe(sourcedEvidence);
    expect(stock.verificationStatus).toBe("已验证");
    expect(stock.evidenceLevel).toBe("高");
  });

  it("does not upgrade explicit entries missing a source date or link", () => {
    for (const evidence of [{ ...sourcedEvidence, url: undefined }, { ...sourcedEvidence, sourceDate: undefined }]) {
      const stock = robotStock({ ...seed, evidenceItems: [evidence] });
      expect(stock.evidenceItems?.[0].verificationStatus).toBe("待验证");
      expect(stock.verificationStatus).toBe("待验证");
    }
  });

  it("rejects unsafe or invalid source URLs and invalid calendar dates", () => {
    for (const url of ["javascript:alert(1)", "not a URL", "https://user:password@example.com/report", "https://example.com/\nreport"]) {
      const stock = robotStock({ ...seed, evidenceItems: [{ ...sourcedEvidence, url }] });
      expect(stock.verificationStatus).toBe("待验证");
      expect(stock.evidenceItems?.[0].url).toBeUndefined();
    }
    for (const sourceDate of ["invalid", "2026-02-30", "2026-01-01T25:00:00Z"]) {
      const stock = robotStock({ ...seed, evidenceItems: [{ ...sourcedEvidence, sourceDate }] });
      expect(stock.verificationStatus).toBe("待验证");
    }
  });

  it("preserves a valid HTTP source with a precise publication timestamp", () => {
    const evidence = { ...sourcedEvidence, url: "http://example.com/report", sourceDate: "2026-01-01T12:00:00+08:00" };
    expect(robotStock({ ...seed, evidenceItems: [evidence] }).evidenceItems?.[0]).toBe(evidence);
  });

  it("does not leave source-free verified badges in the actual robotics pool", () => {
    for (const stock of stocks.filter((item) => item.industryId === "robotics" && item.evidenceItems?.length)) {
      if (stock.evidenceItems?.every((item) => !item.url || !item.sourceDate)) {
        expect(stock.verificationStatus).toBe("待验证");
        expect(stock.evidenceItems.every((item) => item.verificationStatus === "待验证")).toBe(true);
      }
    }
  });
});
