import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanFinancialBundleSource } from "./check-financial-bundle.mjs";

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
