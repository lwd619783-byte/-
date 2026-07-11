import { describe, expect, it, vi } from "vitest";
import { AShareFinancialLoadError, createAShareFinancialLoader, resolveAssetUrl } from "./aShareFinancialLoader";

const detail = {
  schemaVersion: "1.0.0",
  id: "demo",
  stockCode: "300001",
  companyName: "测试公司",
  market: "SZ",
  industryType: "general",
  status: "success",
  errorCode: null,
  errorMessage: null,
  provider: "Sina CompanyFinanceService",
  providerVersion: "2022-openapi",
  fetchedAt: "2026-07-10T00:00:00Z",
  generatedAt: "2026-07-10T00:00:00Z",
  lastSuccessfulFetchAt: "2026-07-10T00:00:00Z",
  currentFetchError: null,
  reports: [{ reportPeriod: "2026-03-31" }],
  quality: { source: "Sina CompanyFinanceService", status: "real" },
};

async function fixture(overrides: Record<string, unknown> = {}) {
  const value = { ...detail, ...overrides };
  const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  const checksum = await checksumFor(bytes);
  const manifest = {
    schemaVersion: "1.0.0",
    generatedAt: "2026-07-10T00:00:00Z",
    provider: "Sina CompanyFinanceService",
    providerVersion: "2022-openapi",
    total: 1,
    success: 1,
    partial: 0,
    error: 0,
    items: [{ id: "demo", stockCode: "300001", relativePath: "data/a-share-financials/demo.json", byteSize: bytes.byteLength, checksumSha256: checksum, latestReportPeriod: "2026-03-31", status: "success" }],
  };
  return { value, bytes, manifest };
}

async function checksumFor(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function responseFromBytes(bytes: Uint8Array, status = 200) {
  return new Response(bytes.buffer as ArrayBuffer, { status, headers: { "Content-Type": "application/json" } });
}

describe("A-share financial lazy loader", () => {
  it("resolves manifest paths under Vite BASE_URL", () => {
    expect(resolveAssetUrl("/dashboard/", "data/a-share-financials/demo.json")).toBe("/dashboard/data/a-share-financials/demo.json");
  });

  it("loads one validated company detail through the manifest", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest")
      ? new Response(JSON.stringify(data.manifest))
      : responseFromBytes(data.bytes));
    const loader = createAShareFinancialLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/app/", retries: 0 });
    await expect(loader.load("demo")).resolves.toMatchObject({ id: "demo", stockCode: "300001" });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "/app/data/a-share-financials/manifest.generated.json",
      "/app/data/a-share-financials/demo.json",
    ]);
  });

  it("reports HTTP 404 without caching an error", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest")
      ? new Response(JSON.stringify(data.manifest))
      : new Response("missing", { status: 404 }));
    const loader = createAShareFinancialLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(loader.load("demo")).rejects.toMatchObject({ code: "http" });
    await expect(loader.load("demo")).rejects.toMatchObject({ code: "http" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("reports a network failure without creating a successful cache entry", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("manifest")) return new Response(JSON.stringify(data.manifest));
      throw new TypeError("offline");
    });
    const loader = createAShareFinancialLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(loader.load("demo")).rejects.toMatchObject({ code: "network" });
    expect(loader.cacheInfo().results).toBe(0);
  });

  it("rejects invalid JSON, schema versions, and stock identities", async () => {
    const data = await fixture();
    const invalidBytes = new TextEncoder().encode("{");
    const invalidManifest = structuredClone(data.manifest);
    invalidManifest.items[0].byteSize = invalidBytes.byteLength;
    invalidManifest.items[0].checksumSha256 = await checksumFor(invalidBytes);
    const badJsonFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(invalidManifest)) : responseFromBytes(invalidBytes));
    await expect(createAShareFinancialLoader({ fetchImpl: badJsonFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "invalid_json" });

    const badSchema = await fixture({ schemaVersion: "0.0.0" });
    const schemaFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(badSchema.manifest)) : responseFromBytes(badSchema.bytes));
    await expect(createAShareFinancialLoader({ fetchImpl: schemaFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "schema" });

    const badId = await fixture({ id: "other" });
    const idFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(badId.manifest)) : responseFromBytes(badId.bytes));
    await expect(createAShareFinancialLoader({ fetchImpl: idFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "identity" });
  });

  it("deduplicates concurrent requests and serves later cache hits", async () => {
    const data = await fixture();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("manifest")) return new Response(JSON.stringify(data.manifest));
      await gate;
      return responseFromBytes(data.bytes);
    });
    const loader = createAShareFinancialLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    const first = loader.load("demo");
    const second = loader.load("demo");
    expect(first).toBe(second);
    release?.();
    await Promise.all([first, second]);
    await loader.load("demo");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loader.cacheInfo().results).toBe(1);
  });

  it("rejects unknown IDs before constructing a user-controlled path", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(data.manifest)));
    const loader = createAShareFinancialLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(loader.load("../../secret")).rejects.toBeInstanceOf(AShareFinancialLoadError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
