import type { AShareFinancialData, AShareFinancialManifest, AShareFinancialManifestEntry } from "../types";

const SCHEMA_VERSION = "1.0.0";
const MANIFEST_PATH = "data/a-share-financials/manifest.generated.json";
const SAFE_DETAIL_PATH = /^data\/a-share-financials\/[A-Za-z0-9_-]+\.json$/;

export class AShareFinancialLoadError extends Error {
  constructor(message: string, public readonly code: "network" | "http" | "invalid_json" | "schema" | "identity" | "checksum" | "not_found") {
    super(message);
    this.name = "AShareFinancialLoadError";
  }
}

interface LoaderOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  cryptoImpl?: Crypto;
  retries?: number;
}

export function createAShareFinancialLoader(options: LoaderOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
  const resultCache = new Map<string, AShareFinancialData>();
  const inFlight = new Map<string, Promise<AShareFinancialData>>();
  let manifestPromise: Promise<{ manifest: AShareFinancialManifest; entries: Map<string, AShareFinancialManifestEntry> }> | null = null;

  async function getManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJsonWithRetry(resolveAssetUrl(baseUrl, MANIFEST_PATH), retries, fetchImpl)
        .then((result) => validateManifest(result.value))
        .catch((error) => {
          manifestPromise = null;
          throw error;
        });
    }
    return manifestPromise;
  }

  function load(stockId: string): Promise<AShareFinancialData> {
    const cached = resultCache.get(stockId);
    if (cached) return Promise.resolve(cached);
    const pending = inFlight.get(stockId);
    if (pending) return pending;
    const request = (async () => {
      const { entries } = await getManifest();
      const entry = entries.get(stockId);
      if (!entry) throw new AShareFinancialLoadError(`No A-share financial manifest entry for ${stockId}`, "not_found");
      const response = await fetchBytesWithRetry(resolveAssetUrl(baseUrl, entry.relativePath), retries, fetchImpl);
      if (response.bytes.byteLength !== entry.byteSize) throw new AShareFinancialLoadError(`byteSize mismatch for ${stockId}`, "checksum");
      if (cryptoImpl?.subtle) {
        const checksum = await sha256(response.bytes, cryptoImpl);
        if (checksum !== entry.checksumSha256) throw new AShareFinancialLoadError(`checksum mismatch for ${stockId}`, "checksum");
      }
      let value: unknown;
      try {
        value = JSON.parse(new TextDecoder().decode(response.bytes));
      } catch {
        throw new AShareFinancialLoadError(`Invalid financial JSON for ${stockId}`, "invalid_json");
      }
      const data = validateDetail(value, entry);
      resultCache.set(stockId, data);
      return data;
    })().finally(() => {
      inFlight.delete(stockId);
    });
    inFlight.set(stockId, request);
    return request;
  }

  return {
    load,
    clearCache() {
      resultCache.clear();
      inFlight.clear();
      manifestPromise = null;
    },
    cacheInfo() {
      return { results: resultCache.size, inFlight: inFlight.size, manifestLoaded: manifestPromise !== null };
    },
  };
}

const defaultLoader = createAShareFinancialLoader();

export function loadAShareFinancial(stockId: string) {
  return defaultLoader.load(stockId);
}

export function resolveAssetUrl(baseUrl: string, relativePath: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${relativePath.replace(/^\/+/, "")}`;
}

function validateManifest(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.items)) {
    throw new AShareFinancialLoadError("Financial manifest schemaVersion or items are invalid", "schema");
  }
  const manifest = value as unknown as AShareFinancialManifest;
  if (manifest.total !== manifest.items.length) throw new AShareFinancialLoadError("Financial manifest total mismatch", "schema");
  const entries = new Map<string, AShareFinancialManifestEntry>();
  const codes = new Set<string>();
  const paths = new Set<string>();
  for (const entry of manifest.items) {
    if (!entry || typeof entry.id !== "string" || typeof entry.stockCode !== "string" || typeof entry.relativePath !== "string") {
      throw new AShareFinancialLoadError("Financial manifest entry is invalid", "schema");
    }
    const expectedSuffix = `/${entry.id}.json`;
    if (!SAFE_DETAIL_PATH.test(entry.relativePath) || !entry.relativePath.endsWith(expectedSuffix) || entry.relativePath.includes("..")) {
      throw new AShareFinancialLoadError(`Unsafe financial detail path for ${entry.id}`, "schema");
    }
    if (entries.has(entry.id) || codes.has(entry.stockCode) || paths.has(entry.relativePath)) {
      throw new AShareFinancialLoadError("Duplicate financial manifest identity or path", "schema");
    }
    if (!Number.isInteger(entry.byteSize) || entry.byteSize <= 0 || !/^[a-f0-9]{64}$/.test(entry.checksumSha256)) {
      throw new AShareFinancialLoadError(`Invalid size/checksum for ${entry.id}`, "schema");
    }
    entries.set(entry.id, entry);
    codes.add(entry.stockCode);
    paths.add(entry.relativePath);
  }
  return { manifest, entries };
}

function validateDetail(value: unknown, entry: AShareFinancialManifestEntry): AShareFinancialData {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.reports)) {
    throw new AShareFinancialLoadError(`Financial detail schema mismatch for ${entry.id}`, "schema");
  }
  if (value.id !== entry.id || value.stockCode !== entry.stockCode) {
    throw new AShareFinancialLoadError(`Financial detail identity mismatch for ${entry.id}`, "identity");
  }
  if (value.reports[0]?.reportPeriod !== entry.latestReportPeriod) {
    throw new AShareFinancialLoadError(`Financial detail latest period mismatch for ${entry.id}`, "identity");
  }
  return value as unknown as AShareFinancialData;
}

async function fetchJsonWithRetry(url: string, retries: number, fetchImpl: typeof fetch) {
  const response = await fetchBytesWithRetry(url, retries, fetchImpl);
  try {
    return { value: JSON.parse(new TextDecoder().decode(response.bytes)) as unknown };
  } catch {
    throw new AShareFinancialLoadError(`Invalid JSON from ${url}`, "invalid_json");
  }
}

async function fetchBytesWithRetry(url: string, retries: number, fetchImpl: typeof fetch) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) continue;
        throw new AShareFinancialLoadError(`HTTP ${response.status} for ${url}`, "http");
      }
      return { bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      if (error instanceof AShareFinancialLoadError) throw error;
      lastError = error;
      if (attempt >= retries) break;
    }
  }
  throw new AShareFinancialLoadError(`Network error for ${url}: ${String(lastError)}`, "network");
}

async function sha256(bytes: Uint8Array, cryptoImpl: Crypto) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
