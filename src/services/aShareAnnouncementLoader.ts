import type { AShareAnnouncementData, AShareAnnouncementManifest, AShareAnnouncementManifestEntry } from "../types";

const SCHEMA_VERSION = "1.0.0";
const MANIFEST_PATH = "data/a-share-announcements/manifest.generated.json";
const SAFE_PATH = /^data\/a-share-announcements\/[A-Za-z0-9_-]+\.json$/;

export class AShareAnnouncementLoadError extends Error {
  constructor(message: string, public readonly code: "network" | "http" | "invalid_json" | "schema" | "identity" | "checksum" | "not_found") {
    super(message);
    this.name = "AShareAnnouncementLoadError";
  }
}

interface Options { fetchImpl?: typeof fetch; baseUrl?: string; cryptoImpl?: Crypto; retries?: number }

export function createAShareAnnouncementLoader(options: Options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
  const cache = new Map<string, AShareAnnouncementData>();
  const inFlight = new Map<string, Promise<AShareAnnouncementData>>();
  let manifestPromise: Promise<Map<string, AShareAnnouncementManifestEntry>> | null = null;

  async function manifest() {
    if (!manifestPromise) {
      manifestPromise = fetchBytes(assetUrl(baseUrl, MANIFEST_PATH), retries, fetchImpl).then(({ bytes }) => {
        let value: unknown;
        try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AShareAnnouncementLoadError("Invalid announcement manifest JSON", "invalid_json"); }
        return validateManifest(value);
      }).catch((error) => { manifestPromise = null; throw error; });
    }
    return manifestPromise;
  }

  function load(stockId: string): Promise<AShareAnnouncementData> {
    const hit = cache.get(stockId);
    if (hit) return Promise.resolve(hit);
    const pending = inFlight.get(stockId);
    if (pending) return pending;
    const request = (async () => {
      const entries = await manifest();
      const entry = entries.get(stockId);
      if (!entry) throw new AShareAnnouncementLoadError(`No announcement manifest entry for ${stockId}`, "not_found");
      const { bytes } = await fetchBytes(assetUrl(baseUrl, entry.relativePath), retries, fetchImpl);
      if (bytes.byteLength !== entry.byteSize) throw new AShareAnnouncementLoadError(`Announcement byteSize mismatch for ${stockId}`, "checksum");
      if (cryptoImpl?.subtle && await sha256(bytes, cryptoImpl) !== entry.checksumSha256) throw new AShareAnnouncementLoadError(`Announcement checksum mismatch for ${stockId}`, "checksum");
      let value: unknown;
      try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AShareAnnouncementLoadError(`Invalid announcement JSON for ${stockId}`, "invalid_json"); }
      const data = validateDetail(value, entry);
      cache.set(stockId, data);
      return data;
    })().finally(() => inFlight.delete(stockId));
    inFlight.set(stockId, request);
    return request;
  }

  return { load, clearCache() { cache.clear(); inFlight.clear(); manifestPromise = null; }, cacheInfo() { return { results: cache.size, inFlight: inFlight.size, manifestLoaded: manifestPromise !== null }; } };
}

const defaultLoader = createAShareAnnouncementLoader();
export function loadAShareAnnouncements(stockId: string) { return defaultLoader.load(stockId); }
export function assetUrl(baseUrl: string, relative: string) { return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${relative.replace(/^\/+/, "")}`; }

function validateManifest(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.items) || value.totalCompanies !== value.items.length) throw new AShareAnnouncementLoadError("Announcement manifest schema mismatch", "schema");
  const entries = new Map<string, AShareAnnouncementManifestEntry>(); const codes = new Set<string>(); const paths = new Set<string>();
  for (const entry of (value as unknown as AShareAnnouncementManifest).items) {
    if (!entry || !SAFE_PATH.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new AShareAnnouncementLoadError("Unsafe announcement manifest path", "schema");
    if (entries.has(entry.stockId) || codes.has(entry.stockCode) || paths.has(entry.relativePath)) throw new AShareAnnouncementLoadError("Duplicate announcement manifest identity/path", "schema");
    if (!Number.isInteger(entry.byteSize) || entry.byteSize <= 0 || !/^[a-f0-9]{64}$/.test(entry.checksumSha256)) throw new AShareAnnouncementLoadError("Invalid announcement manifest checksum", "schema");
    entries.set(entry.stockId, entry); codes.add(entry.stockCode); paths.add(entry.relativePath);
  }
  return entries;
}

function validateDetail(value: unknown, entry: AShareAnnouncementManifestEntry) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.announcements)) throw new AShareAnnouncementLoadError("Announcement detail schema mismatch", "schema");
  if (value.stockId !== entry.stockId || value.stockCode !== entry.stockCode || value.announcements.length !== entry.announcementCount) throw new AShareAnnouncementLoadError("Announcement detail identity/count mismatch", "identity");
  return value as unknown as AShareAnnouncementData;
}

async function fetchBytes(url: string, retries: number, fetchImpl: typeof fetch) {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
      if (!response.ok) { if (response.status >= 500 && attempt < retries) continue; throw new AShareAnnouncementLoadError(`HTTP ${response.status} for ${url}`, "http"); }
      return { bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      if (error instanceof AShareAnnouncementLoadError) throw error;
      last = error; if (attempt >= retries) break;
    }
  }
  throw new AShareAnnouncementLoadError(`Network error for ${url}: ${String(last)}`, "network");
}

async function sha256(bytes: Uint8Array, cryptoImpl: Crypto) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function isObject(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null; }
