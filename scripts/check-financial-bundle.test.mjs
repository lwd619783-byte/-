import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanAnnouncementBundleSource, scanCompanyGuidanceBundleSource, scanFinancialBundleSource } from "./check-financial-bundle.mjs";

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function fixture(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "financial-bundle-test-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "provider.ts"), source);
  return root;
}

describe("financial bundle source gate", () => {
  it("detects a legacy monolith static import", () => {
    expect(scanFinancialBundleSource(fixture('import data from "./data/a-share-financials.generated.json";'))).toHaveLength(1);
  });

  it("allows the small synchronous summary import", () => {
    expect(scanFinancialBundleSource(fixture('import data from "./data/a-share-financial-summaries.generated.json";'))).toEqual([]);
  });
});

describe("announcement bundle source gate", () => {
  it("detects legacy and per-company history imports", () => {
    expect(scanAnnouncementBundleSource(fixture('import data from "./data/announcements.generated.json";'))).toHaveLength(1);
    expect(scanAnnouncementBundleSource(fixture('import data from "../public/data/a-share-announcements/demo.json";')).length).toBeGreaterThan(0);
  });

  it("allows the small synchronous announcement summary import", () => {
    expect(scanAnnouncementBundleSource(fixture('import data from "./data/a-share-announcement-summaries.generated.json";'))).toEqual([]);
  });
});

describe("company guidance bundle source gate", () => {
  it("detects a per-company Provider detail static import", () => {
    expect(scanCompanyGuidanceBundleSource(fixture('import data from "../public/data/a-share-company-guidance-expectations/demo.json";')).length).toBeGreaterThan(0);
  });

  it("allows the small synchronous Provider summary import", () => {
    expect(scanCompanyGuidanceBundleSource(fixture('import data from "./data/a-share-company-guidance-expectation-summaries.generated.json";'))).toEqual([]);
  });
});
