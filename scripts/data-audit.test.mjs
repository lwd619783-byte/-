import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectZeroFallbacks, parseRegistryEntries, runSelfTests } from "./data-audit.mjs";

describe("data audit rules", () => {
  it("runs its built-in self-test without changing production data", () => {
    expect(runSelfTests()).toBe(true);
  });

  it("classifies financial zero coercion as P0 and allows only narrow safe cases", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-audit-test-"));
    const file = path.join(root, "example.ts");
    fs.writeFileSync(file, "const revenue = row.revenue ?? 0;\nconst sorted = Math.abs(row.pctChange ?? 0);\nconst index = rowIndex ?? 0;", "utf8");
    const result = detectZeroFallbacks([file], root);
    fs.rmSync(root, { recursive: true, force: true });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("P0");
    expect(result.allowlisted).toHaveLength(2);
  });

  it("parses the registry entries structurally", () => {
    const entries = parseRegistryEntries('entry({ id: "demo", status: "partial", sourceType: "generated_real", provider: "AKShare", storageLocation: null, generatedBy: null, isDisplayed: false, frontendConsumers: [] }),');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "demo", status: "partial", sourceType: "generated_real" });
  });
});
