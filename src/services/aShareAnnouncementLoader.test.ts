import { describe, expect, it, vi } from "vitest";
import { AShareAnnouncementLoadError, assetUrl, createAShareAnnouncementLoader } from "./aShareAnnouncementLoader";

const detail = {
  schemaVersion: "1.0.0",
  stockId: "demo",
  stockCode: "300001",
  companyName: "测试公司",
  market: "A股",
  provider: "CNInfo hisAnnouncement",
  providerVersion: "2026-public-web",
  generatedAt: "2026-07-11T00:00:00Z",
  fetchedAt: "2026-07-11T00:00:00Z",
  lastSuccessfulFetchAt: "2026-07-11T00:00:00Z",
  currentFetchError: null,
  status: "success",
  dateRange: { start: "2024-07-11", end: "2026-07-11" },
  announcements: [{ announcementId: "1", title: "测试公告" }],
  quality: { source: "CNInfo", status: "real" },
};

async function fixture(overrides: Record<string, unknown> = {}) {
  const value = { ...detail, ...overrides };
  const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  const checksumSha256 = await checksumFor(bytes);
  const manifest = {
    schemaVersion: "1.0.0",
    generatedAt: "2026-07-11T00:00:00Z",
    provider: "CNInfo hisAnnouncement",
    providerVersion: "2026-public-web",
    totalCompanies: 1,
    totalAnnouncements: 1,
    dateRange: { start: "2024-07-11", end: "2026-07-11" },
    success: 1,
    partial: 0,
    error: 0,
    empty: 0,
    items: [{ stockId: "demo", stockCode: "300001", relativePath: "data/a-share-announcements/demo.json", byteSize: bytes.byteLength, checksumSha256, announcementCount: 1, latestAnnouncementDate: "2026-07-10", latestPerformanceAnnouncementDate: null, status: "success" }],
  };
  return { bytes, manifest };
}

async function checksumFor(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function byteResponse(bytes: Uint8Array, status = 200) {
  return new Response(bytes.buffer as ArrayBuffer, { status, headers: { "Content-Type": "application/json" } });
}

describe("A-share announcement lazy loader", () => {
  it("resolves manifest-approved assets under Vite BASE_URL", () => {
    expect(assetUrl("/dashboard/", "data/a-share-announcements/demo.json")).toBe("/dashboard/data/a-share-announcements/demo.json");
  });

  it("loads and validates one company detail", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(data.manifest)) : byteResponse(data.bytes));
    const loader = createAShareAnnouncementLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/app/", retries: 0 });
    await expect(loader.load("demo")).resolves.toMatchObject({ stockId: "demo", stockCode: "300001" });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual(["/app/data/a-share-announcements/manifest.generated.json", "/app/data/a-share-announcements/demo.json"]);
  });

  it("reports 404 and network failures without caching them", async () => {
    const data = await fixture();
    const missingFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(data.manifest)) : new Response("missing", { status: 404 }));
    const missingLoader = createAShareAnnouncementLoader({ fetchImpl: missingFetch as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(missingLoader.load("demo")).rejects.toMatchObject({ code: "http" });
    await expect(missingLoader.load("demo")).rejects.toMatchObject({ code: "http" });
    expect(missingLoader.cacheInfo().results).toBe(0);

    const networkFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("manifest")) return new Response(JSON.stringify(data.manifest));
      throw new TypeError("offline");
    });
    await expect(createAShareAnnouncementLoader({ fetchImpl: networkFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "network" });
  });

  it("rejects invalid JSON, schema versions, and stock identities", async () => {
    const data = await fixture();
    const invalidBytes = new TextEncoder().encode("{");
    const invalidManifest = structuredClone(data.manifest);
    invalidManifest.items[0].byteSize = invalidBytes.byteLength;
    invalidManifest.items[0].checksumSha256 = await checksumFor(invalidBytes);
    const badJsonFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(invalidManifest)) : byteResponse(invalidBytes));
    await expect(createAShareAnnouncementLoader({ fetchImpl: badJsonFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "invalid_json" });

    const badSchema = await fixture({ schemaVersion: "0.0.0" });
    const schemaFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(badSchema.manifest)) : byteResponse(badSchema.bytes));
    await expect(createAShareAnnouncementLoader({ fetchImpl: schemaFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "schema" });

    const badId = await fixture({ stockId: "other" });
    const idFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("manifest") ? new Response(JSON.stringify(badId.manifest)) : byteResponse(badId.bytes));
    await expect(createAShareAnnouncementLoader({ fetchImpl: idFetch as typeof fetch, baseUrl: "/", retries: 0 }).load("demo")).rejects.toMatchObject({ code: "identity" });
  });

  it("deduplicates concurrent loads and serves later cache hits", async () => {
    const data = await fixture();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("manifest")) return new Response(JSON.stringify(data.manifest));
      await gate;
      return byteResponse(data.bytes);
    });
    const loader = createAShareAnnouncementLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    const first = loader.load("demo");
    const second = loader.load("demo");
    expect(first).toBe(second);
    release?.();
    await Promise.all([first, second]);
    await loader.load("demo");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loader.cacheInfo().results).toBe(1);
  });

  it("rejects unknown IDs and unsafe manifest paths", async () => {
    const data = await fixture();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(data.manifest)));
    const loader = createAShareAnnouncementLoader({ fetchImpl: fetchImpl as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(loader.load("../../secret")).rejects.toBeInstanceOf(AShareAnnouncementLoadError);

    data.manifest.items[0].relativePath = "data/a-share-announcements/../secret.json";
    const unsafeLoader = createAShareAnnouncementLoader({ fetchImpl: vi.fn(async () => new Response(JSON.stringify(data.manifest))) as typeof fetch, baseUrl: "/", retries: 0 });
    await expect(unsafeLoader.load("demo")).rejects.toMatchObject({ code: "schema" });
  });
});
