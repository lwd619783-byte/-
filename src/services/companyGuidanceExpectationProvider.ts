import summaryJson from "../data/real/a-share-company-guidance-expectation-summaries.generated.json";
import type {
  AggregatedEarningsExpectationEvidence,
  CompanyGuidanceExpectationDetail,
  CompanyGuidanceExpectationManifest,
  CompanyGuidanceExpectationManifestEntry,
  CompanyGuidanceExpectationSummary,
  EarningsExpectationProviderSnapshot,
  EarningsExpectationSnapshot,
} from "../types";

const SCHEMA_VERSION = "1.0.0";
const PROVIDER_ID = "cninfo-company-guidance";
const MANIFEST_PATH = "data/a-share-company-guidance-expectations/manifest.generated.json";
const SAFE_PATH = /^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/;

export const companyGuidanceExpectationSummary = summaryJson as CompanyGuidanceExpectationSummary;

export class CompanyGuidanceExpectationLoadError extends Error {
  constructor(message: string, public readonly code: "network" | "http" | "invalid_json" | "schema" | "identity" | "checksum" | "not_found") {
    super(message);
    this.name = "CompanyGuidanceExpectationLoadError";
  }
}

interface LoaderOptions { fetchImpl?: typeof fetch; baseUrl?: string; cryptoImpl?: Crypto; retries?: number }

export function createCompanyGuidanceExpectationLoader(options: LoaderOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
  const cache = new Map<string, CompanyGuidanceExpectationDetail>();
  const inFlight = new Map<string, Promise<CompanyGuidanceExpectationDetail>>();
  let manifestPromise: Promise<Map<string, CompanyGuidanceExpectationManifestEntry>> | null = null;

  async function manifest() {
    if (!manifestPromise) {
      manifestPromise = fetchBytes(assetUrl(baseUrl, MANIFEST_PATH), retries, fetchImpl)
        .then(({ bytes }) => validateManifest(parseJson(bytes, "Invalid company-guidance manifest JSON")))
        .catch((error) => { manifestPromise = null; throw error; });
    }
    return manifestPromise;
  }

  function load(stockId: string): Promise<CompanyGuidanceExpectationDetail> {
    const hit = cache.get(stockId);
    if (hit) return Promise.resolve(hit);
    const pending = inFlight.get(stockId);
    if (pending) return pending;
    const request = (async () => {
      const entries = await manifest();
      const entry = entries.get(stockId);
      if (!entry) throw new CompanyGuidanceExpectationLoadError(`No company-guidance manifest entry for ${stockId}`, "not_found");
      const { bytes } = await fetchBytes(assetUrl(baseUrl, entry.relativePath), retries, fetchImpl);
      if (bytes.byteLength !== entry.byteSize) throw new CompanyGuidanceExpectationLoadError(`Company-guidance byteSize mismatch for ${stockId}`, "checksum");
      if (cryptoImpl?.subtle && await sha256(bytes, cryptoImpl) !== entry.checksumSha256) throw new CompanyGuidanceExpectationLoadError(`Company-guidance checksum mismatch for ${stockId}`, "checksum");
      const detail = validateDetail(parseJson(bytes, `Invalid company-guidance JSON for ${stockId}`), entry);
      cache.set(stockId, detail);
      return detail;
    })().finally(() => inFlight.delete(stockId));
    inFlight.set(stockId, request);
    return request;
  }

  async function loadAll(stockIds = Object.values(companyGuidanceExpectationSummary.items).filter((item) => item.snapshotCount > 0 || item.excludedAnnouncementCount > 0).map((item) => item.stockId)) {
    return Promise.all(stockIds.map((stockId) => load(stockId)));
  }

  return {
    load,
    loadAll,
    clearCache() { cache.clear(); inFlight.clear(); manifestPromise = null; },
    cacheInfo() { return { results: cache.size, inFlight: inFlight.size, manifestLoaded: manifestPromise !== null }; },
  };
}

const defaultLoader = createCompanyGuidanceExpectationLoader();
export function loadCompanyGuidanceExpectations(stockId: string) { return defaultLoader.load(stockId); }
export function loadAllCompanyGuidanceExpectations() { return defaultLoader.loadAll(); }

export function aggregateEarningsExpectationEvidence({ providerSnapshots, localSnapshots }: { providerSnapshots: EarningsExpectationProviderSnapshot[]; localSnapshots: EarningsExpectationSnapshot[] }): AggregatedEarningsExpectationEvidence {
  const dedupedProviderRecords = [...new Map(providerSnapshots.map((record) => [record.snapshot.id, record])).values()]
    .sort((left, right) => left.snapshot.id.localeCompare(right.snapshot.id));
  const providerSnapshotIds = new Set(dedupedProviderRecords.map((record) => record.snapshot.id));
  const providerRecordBySnapshotId = new Map(dedupedProviderRecords.map((record) => [record.snapshot.id, record]));
  const providerByEvidence = new Map<string, EarningsExpectationProviderSnapshot>();
  for (const record of dedupedProviderRecords) providerByEvidence.set(providerEvidenceKey(record), record);
  const duplicateOfProviderByLocalId = new Map<string, string>();
  for (const snapshot of localSnapshots) {
    if (snapshot.sourceCategory !== "company_guidance") continue;
    const announcementId = sourceAnnouncementId(snapshot.sourceUrl);
    if (!announcementId) continue;
    const provider = providerByEvidence.get(snapshotEvidenceKey(snapshot, announcementId));
    if (provider) duplicateOfProviderByLocalId.set(snapshot.id, provider.snapshot.id);
  }
  const providerValues = dedupedProviderRecords.map((record) => record.snapshot);
  return {
    snapshots: [...providerValues, ...localSnapshots],
    comparisonSnapshots: [...providerValues, ...localSnapshots.filter((snapshot) => !duplicateOfProviderByLocalId.has(snapshot.id))],
    providerSnapshotIds,
    duplicateOfProviderByLocalId,
    providerRecordBySnapshotId,
  };
}

export function sourceAnnouncementId(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("annoId");
    return id && /^\d+$/u.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function assetUrl(baseUrl: string, relative: string) { return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${relative.replace(/^\/+/, "")}`; }

function providerEvidenceKey(record: EarningsExpectationProviderSnapshot) {
  return snapshotEvidenceKey(record.snapshot, record.sourceAnnouncementId);
}

function snapshotEvidenceKey(snapshot: EarningsExpectationSnapshot, announcementId: string) {
  return [announcementId, snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric].join("|");
}

function validateManifest(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || !Array.isArray(value.items) || value.totalCompanies !== value.items.length) throw new CompanyGuidanceExpectationLoadError("Company-guidance manifest schema mismatch", "schema");
  const manifest = value as unknown as CompanyGuidanceExpectationManifest;
  const entries = new Map<string, CompanyGuidanceExpectationManifestEntry>();
  const codes = new Set<string>();
  const paths = new Set<string>();
  for (const entry of manifest.items) {
    if (!entry || !SAFE_PATH.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new CompanyGuidanceExpectationLoadError("Unsafe company-guidance manifest path", "schema");
    if (entries.has(entry.stockId) || codes.has(entry.stockCode) || paths.has(entry.relativePath)) throw new CompanyGuidanceExpectationLoadError("Duplicate company-guidance manifest identity/path", "schema");
    if (!Number.isInteger(entry.byteSize) || entry.byteSize <= 0 || !/^[a-f0-9]{64}$/u.test(entry.checksumSha256)) throw new CompanyGuidanceExpectationLoadError("Invalid company-guidance manifest checksum", "schema");
    entries.set(entry.stockId, entry); codes.add(entry.stockCode); paths.add(entry.relativePath);
  }
  return entries;
}

function validateDetail(value: unknown, entry: CompanyGuidanceExpectationManifestEntry) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || !Array.isArray(value.providerSnapshots) || !Array.isArray(value.exclusions) || !Array.isArray(value.warnings)) throw new CompanyGuidanceExpectationLoadError("Company-guidance detail schema mismatch", "schema");
  const detail = value as unknown as CompanyGuidanceExpectationDetail;
  if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode || detail.providerSnapshots.length !== entry.snapshotCount) throw new CompanyGuidanceExpectationLoadError("Company-guidance detail identity/count mismatch", "identity");
  for (const record of detail.providerSnapshots) {
    if (record.snapshot.stockId !== entry.stockId || record.snapshot.ingestionMethod !== "provider" || record.snapshot.sourceCategory !== "company_guidance" || record.snapshot.sourceVerificationStatus !== "verified") throw new CompanyGuidanceExpectationLoadError("Company-guidance provider boundary mismatch", "schema");
    if (record.snapshot.formationTimeBasis !== "public_disclosure_proxy" || record.snapshot.formedAt !== null || record.snapshot.sourcePublishedAt !== record.sourceDate) throw new CompanyGuidanceExpectationLoadError("Company-guidance time contract mismatch", "schema");
    if (record.officialSourceUrl !== record.snapshot.sourceUrl || sourceAnnouncementId(record.officialSourceUrl) !== record.sourceAnnouncementId) throw new CompanyGuidanceExpectationLoadError("Company-guidance source identity mismatch", "identity");
  }
  return detail;
}

function parseJson(bytes: Uint8Array, message: string) {
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new CompanyGuidanceExpectationLoadError(message, "invalid_json"); }
}

async function fetchBytes(url: string, retries: number, fetchImpl: typeof fetch) {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
      if (!response.ok) { if (response.status >= 500 && attempt < retries) continue; throw new CompanyGuidanceExpectationLoadError(`HTTP ${response.status} for ${url}`, "http"); }
      return { bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      if (error instanceof CompanyGuidanceExpectationLoadError) throw error;
      last = error;
      if (attempt >= retries) break;
    }
  }
  throw new CompanyGuidanceExpectationLoadError(`Network error for ${url}: ${String(last)}`, "network");
}

async function sha256(bytes: Uint8Array, cryptoImpl: Crypto) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
