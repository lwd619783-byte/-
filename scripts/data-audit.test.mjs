import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  auditExitCode,
  classifyRisks,
  detectZeroFallbacks,
  detectFinancialArchitectureRisks,
  finding,
  parseRegistryEntries,
  runSelfTests,
  validateRegistryEntries,
  walkFiles,
} from "./data-audit.mjs";

let root;

function write(relative, content = "export {};\n") {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return file;
}

function entry(overrides = {}) {
  return {
    id: "demo",
    status: "partial",
    sourceType: "generated_real",
    provider: "Provider",
    storageLocation: null,
    generatedBy: null,
    isDisplayed: "false",
    frontendConsumers: [],
    coverage: null,
    block: "",
    ...overrides,
  };
}

function validate(item) {
  return validateRegistryEntries(Array.isArray(item) ? item : [item], root, { requireRequiredIds: false });
}

function ids(findings) {
  return findings.map((item) => item.id);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "data-audit-test-"));
  write("package.json", JSON.stringify({ scripts: { generate: "node scripts/generate.mjs" } }));
  write("scripts/generate.mjs");
  write("scripts/second.py", "print('ok')\n");
  write("src/components/View.tsx");
  write("src/data/value.json", "{}\n");
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("scan and zero-fallback rules", () => {
  it("runs the built-in self-test", () => expect(runSelfTests()).toBe(true));

  it("scans nested source files recursively", () => {
    write("src/nested/deep/value.ts");
    expect(walkFiles(root).some((file) => file.endsWith(path.join("nested", "deep", "value.ts")))).toBe(true);
  });

  it("excludes dependency, build, coverage, cache, and fixture directories", () => {
    for (const directory of ["node_modules", "dist", "build", "coverage", ".cache", "fixtures", "test-fixtures"]) write(`${directory}/bad.ts`);
    expect(walkFiles(root).some((file) => file.endsWith("bad.ts"))).toBe(false);
  });

  it("excludes test and spec source files from the production scan", () => {
    write("src/example.test.ts", "const revenue = row.revenue ?? 0;\n");
    write("scripts/example.spec.mjs", "const price = row.price ?? 0;\n");
    expect(walkFiles(root).some((file) => /\.(?:test|spec)\./.test(file))).toBe(false);
  });

  it("blocks financial missing-to-zero coercion", () => {
    const result = detectZeroFallbacks([write("src/revenue.ts", "const revenue = row.revenue ?? 0;\n")], root);
    expect(result.findings[0]).toMatchObject({ severity: "P0", blocking: true, category: "missing-value" });
  });

  it("keeps an unclassified numeric fallback as a non-blocking warning", () => {
    const result = detectZeroFallbacks([write("src/value.ts", "const value = row.value ?? 0;\n")], root);
    expect(result.findings[0]).toMatchObject({ severity: "P2", blocking: false });
  });

  it("allows an array-length fallback", () => {
    const result = detectZeroFallbacks([write("src/length.ts", "const size = rows.length ?? 0;\n")], root);
    expect(result.allowlisted[0].id).toBe("array-length");
  });

  it("allows a layout index fallback", () => {
    const result = detectZeroFallbacks([write("src/index.ts", "const value = rowIndex ?? 0;\n")], root);
    expect(result.allowlisted[0].id).toBe("index-count");
  });

  it("allows a reducer counter initialization", () => {
    const result = detectZeroFallbacks([write("scripts/count.mjs", "acc[item.market] = (acc[item.market] ?? 0) + 1;\n")], root);
    expect(result.allowlisted[0].id).toBe("counter-init");
  });

  it("allows Math.abs only in an explicit sort comparator", () => {
    const result = detectZeroFallbacks([write("src/sort.ts", "rows.sort((a, b) => Math.abs(a.sortValue ?? 0) - Math.abs(b.sortValue ?? 0));\n")], root);
    expect(result.allowlisted).toHaveLength(2);
    expect(result.allowlisted.every((item) => item.id === "sort-comparator")).toBe(true);
  });

  it("does not allowlist plain Math.abs", () => {
    const result = detectZeroFallbacks([write("src/math.ts", "const value = Math.abs(row.value ?? 0);\n")], root);
    expect(result.findings).toHaveLength(1);
  });

  it("does not let sort context allowlist another fallback on the same line", () => {
    const line = "const revenue = row.revenue ?? 0; rows.sort((a, b) => Math.abs(a.sortValue ?? 0));\n";
    const result = detectZeroFallbacks([write("src/mixed-sort.ts", line)], root);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ severity: "P0", blocking: true });
    expect(result.allowlisted).toHaveLength(1);
  });

  it("does not apply the audit self-test exception outside its exact file", () => {
    const line = 'fs.writeFileSync(file, "const revenue = input?.revenue ?? 0;");\n';
    const result = detectZeroFallbacks([write("scripts/other.mjs", line)], root);
    expect(result.findings[0]).toMatchObject({ severity: "P0", blocking: true });
  });

  it("blocks rendered financial Math.abs fallback", () => {
    const result = detectZeroFallbacks([write("src/render.tsx", "return <span>{Math.abs(row.price ?? 0)}</span>;\n")], root);
    expect(result.findings[0]).toMatchObject({ severity: "P0", blocking: true });
  });
});

describe("financial architecture gates", () => {
  it("blocks production static imports of the financial monolith", () => {
    const file = write("src/provider.ts", 'import financials from "./a-share-financials.generated.json";\n');
    expect(ids(detectFinancialArchitectureRisks([file], root))).toContain("financial-history-static-import");
  });
});

describe("registry parser and structural gates", () => {
  it("parses registry fields and numeric coverage", () => {
    const [parsed] = parseRegistryEntries('entry({ id: "demo", status: "partial", sourceType: "generated_real", provider: "P", storageLocation: null, generatedBy: null, coverage: { numerator: 1, denominator: 2, note: "partial" }, isDisplayed: false, frontendConsumers: [] }),');
    expect(parsed).toMatchObject({ id: "demo", provider: "P", coverage: { numerator: 1, denominator: 2, note: "partial" } });
  });

  it("blocks missing required registry fields", () => expect(ids(validate(entry({ id: null })))).toContain("registry-shape"));

  it("blocks invalid status values", () => expect(ids(validate(entry({ status: "invented" })))).toContain("invalid-status"));

  it("blocks duplicate ids", () => expect(ids(validate([entry(), entry()]))).toContain("duplicate-id"));

  it("blocks a missing storage path", () => expect(ids(validate(entry({ storageLocation: 'source("data/missing.json")' })))).toContain("storage-invalid"));

  it("blocks materialized data without storageLocation", () => expect(ids(validate(entry()))).toContain("storage-missing"));

  it("blocks a build-artifact storage path", () => {
    write("dist/value.json", "{}\n");
    expect(ids(validate(entry({ storageLocation: '"dist/value.json"' })))).toContain("storage-invalid");
  });

  it("accepts an existing source storage path", () => expect(ids(validate(entry({ storageLocation: 'source("data/value.json")' })))).not.toContain("storage-invalid"));

  it("blocks generated_real without generatedBy", () => expect(ids(validate(entry({ status: "generated_real" })))).toContain("generator-missing"));

  it("accepts multiple existing generatedBy paths", () => {
    const findings = validate(entry({ status: "generated_real", generatedBy: "scripts/generate.mjs / scripts/second.py" }));
    expect(ids(findings)).not.toContain("generator-path-invalid");
  });

  it("accepts an existing package script as generatedBy", () => {
    const findings = validate(entry({ status: "generated_real", generatedBy: "npm run generate" }));
    expect(ids(findings)).not.toContain("generator-script-missing");
  });

  it("blocks a missing package script", () => expect(ids(validate(entry({ status: "generated_real", generatedBy: "npm run absent" })))).toContain("generator-script-missing"));

  it("blocks an existing package script whose generator target is missing", () => {
    write("package.json", JSON.stringify({ scripts: { broken: "node scripts/missing.mjs" } }));
    expect(ids(validate(entry({ status: "generated_real", generatedBy: "npm run broken" })))).toContain("generator-script-target-invalid");
  });

  it("blocks placeholder or glob generatedBy values", () => expect(ids(validate(entry({ generatedBy: "scripts/*.py" })))).toContain("generator-path-invalid"));

  it("blocks displayed entries without consumers", () => expect(ids(validate(entry({ isDisplayed: "true" })))).toContain("consumer-missing"));

  it("blocks a test-only frontend consumer", () => {
    write("src/components/View.test.tsx");
    expect(ids(validate(entry({ frontendConsumers: ["src/components/View.test.tsx"] })))).toContain("consumer-path-invalid");
  });

  it("accepts a production frontend glob with at least one match", () => expect(ids(validate(entry({ frontendConsumers: ["src/components/*"] })))).not.toContain("consumer-path-invalid"));

  it("warns about duplicate consumers without blocking", () => {
    const risk = validate(entry({ frontendConsumers: ["src/components/View.tsx", "src/components/View.tsx"] })).find((item) => item.id === "consumer-duplicate");
    expect(risk).toMatchObject({ severity: "P2", blocking: false });
  });

  it("blocks real data without a provider", () => expect(ids(validate(entry({ status: "real", sourceType: "real", provider: null })))).toContain("provider-missing"));

  it("blocks real provenance that points to mock data", () => expect(ids(validate(entry({ status: "real", sourceType: "real", provider: "mock provider" })))).toContain("real-from-mock"));

  it("blocks mock data on a production route", () => expect(ids(validate(entry({ status: "mock", sourceType: "mock", frontendConsumers: ["src/components/View.tsx"] })))).toContain("mock-production-route"));

  it("blocks not_implemented entries described as available", () => expect(ids(validate(entry({ status: "not_implemented", sourceType: "not_implemented", block: "available" })))).toContain("not-implemented-available"));
});

describe("coverage gates", () => {
  it("blocks non-numeric coverage", () => expect(ids(validate(entry({ coverage: { numerator: Number.NaN, denominator: 2 } })))).toContain("coverage-invalid-number"));
  it("blocks negative coverage", () => expect(ids(validate(entry({ coverage: { numerator: -1, denominator: 2 } })))).toContain("coverage-invalid-number"));
  it("requires a denominator with a numerator", () => expect(ids(validate(entry({ coverage: { numerator: 1, denominator: null } })))).toContain("coverage-denominator-missing"));
  it("blocks numerator greater than denominator", () => expect(ids(validate(entry({ coverage: { numerator: 3, denominator: 2 } })))).toContain("coverage-overflow"));
  it("allows zero denominator only with zero or null numerator", () => {
    expect(ids(validate(entry({ coverage: { numerator: 1, denominator: 0 } })))).toContain("coverage-zero-denominator");
    expect(ids(validate(entry({ coverage: { numerator: 0, denominator: 0 } })))).not.toContain("coverage-zero-denominator");
  });
  it("blocks positive coverage for not_implemented", () => expect(ids(validate(entry({ status: "not_implemented", sourceType: "not_implemented", coverage: { numerator: 1, denominator: 2 } })))).toContain("not-implemented-coverage"));
  it("blocks incomplete coverage claimed as real", () => expect(ids(validate(entry({ status: "real", sourceType: "real", coverage: { numerator: 1, denominator: 2 } })))).toContain("real-coverage-incomplete"));
  it("warns when partial reports full coverage", () => {
    const risk = validate(entry({ coverage: { numerator: 2, denominator: 2 } })).find((item) => item.id === "partial-full-coverage");
    expect(risk).toMatchObject({ blocking: false, severity: "P1" });
  });
  it("blocks text that claims full coverage when counts disagree", () => expect(ids(validate(entry({ coverage: { numerator: 1, denominator: 2, note: "full" } })))).toContain("coverage-text-conflict"));
  it("requires null coverage for unknown status", () => expect(ids(validate(entry({ status: "unknown", sourceType: "unknown", coverage: { numerator: 0, denominator: 0 } })))).toContain("unknown-coverage-known"));
});

describe("blocking classification and exit code", () => {
  it("treats every unresolved P0 as blocking and returns exit 1", () => {
    const result = classifyRisks([finding({ severity: "P0", blocking: false, category: "test", id: "p0", title: "bad", recommendation: "fix" })]);
    expect(result.errors).toHaveLength(1);
    expect(auditExitCode(result)).toBe(1);
  });

  it("returns exit 0 for warnings only", () => {
    const result = classifyRisks([finding({ severity: "P1", blocking: false, category: "test", id: "warning", title: "known", recommendation: "review" })]);
    expect(result.warnings).toHaveLength(1);
    expect(auditExitCode(result)).toBe(0);
  });

  it("does not block on a resolved P0", () => {
    const result = classifyRisks([finding({ severity: "P0", category: "test", id: "resolved", title: "fixed", recommendation: "none", resolved: true })]);
    expect(result.errors).toHaveLength(0);
  });
});
