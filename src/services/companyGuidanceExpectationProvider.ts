import summaryJson from "../data/real/a-share-company-guidance-expectation-summaries.generated.json";
import { selectDefaultCompanyGuidanceStockIds } from "./companyGuidanceExpectationSelection.mjs";
import type {
  AggregatedEarningsExpectationEvidence,
  CompanyGuidanceExpectationDetail,
  CompanyGuidanceExpectationLoadStatus,
  CompanyGuidanceExpectationManifest,
  CompanyGuidanceExpectationManifestEntry,
  CompanyGuidanceExpectationSummary,
  CompanyGuidanceExpectationWorkflowIndex,
  DashboardDataMode,
  EarningsExpectationProviderSnapshot,
  EarningsExpectationSnapshot,
  ProviderEvidenceRelationRecord,
  ResearchEvent,
  Stock,
} from "../types";

const SCHEMA_VERSION = "2.0.0";
const PROVIDER_ID = "cninfo-company-guidance";
const PROVIDER_VERSION = "2.0.0";
const PARSE_RULES_VERSION = "1.0.0";
const MANIFEST_PATH = "data/a-share-company-guidance-expectations/manifest.generated.json";
const SAFE_DETAIL_PATH = /^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u;
const WORKFLOW_PATH = "data/a-share-company-guidance-expectations/workflow-index.generated.json";
const FINANCIAL_RELATION_FIELDS = ["estimateShape", "value", "lowerBound", "upperBound", "currency", "unit", "accountingBasis", "sourcePublishedAt", "reportPeriod", "periodScope", "metric"] as const;
const METADATA_RELATION_FIELDS = ["sourceName", "sourceTitle", "notes", "createdBy", "sourceVerificationStatus"] as const;

export const companyGuidanceExpectationSummary = summaryJson as CompanyGuidanceExpectationSummary;
export { selectDefaultCompanyGuidanceStockIds } from "./companyGuidanceExpectationSelection.mjs";

export class CompanyGuidanceExpectationLoadError extends Error {
  constructor(message: string, public readonly code: "network" | "http" | "invalid_json" | "schema" | "identity" | "checksum" | "not_found" | "graph" | "stale") {
    super(message);
    this.name = "CompanyGuidanceExpectationLoadError";
  }
}

export interface CompanyGuidanceExpectationLoadFailure {
  stockId: string;
  code: CompanyGuidanceExpectationLoadError["code"];
  message: string;
}

export interface CompanyGuidanceExpectationLoadManyResult {
  status: Exclude<CompanyGuidanceExpectationLoadStatus, "idle" | "loading">;
  successes: Record<string, CompanyGuidanceExpectationDetail>;
  failures: CompanyGuidanceExpectationLoadFailure[];
}

interface LoaderOptions { fetchImpl?: typeof fetch; baseUrl?: string; cryptoImpl?: Crypto; retries?: number }

export function createCompanyGuidanceExpectationLoader(options: LoaderOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
  const cache = new Map<string, CompanyGuidanceExpectationDetail>();
  const inFlight = new Map<string, Promise<CompanyGuidanceExpectationDetail>>();
  let epoch = 0;
  let manifestRequest: { epoch: number; promise: Promise<{ manifest: CompanyGuidanceExpectationManifest; entries: Map<string, CompanyGuidanceExpectationManifestEntry> }> } | null = null;
  let workflowRequest: { epoch: number; promise: Promise<CompanyGuidanceExpectationWorkflowIndex> } | null = null;

  async function manifest() {
    const requestEpoch = epoch;
    if (manifestRequest?.epoch === requestEpoch) return manifestRequest.promise;
    let request!: Promise<{ manifest: CompanyGuidanceExpectationManifest; entries: Map<string, CompanyGuidanceExpectationManifestEntry> }>;
    request = fetchBytes(assetUrl(baseUrl, MANIFEST_PATH), retries, fetchImpl)
      .then(({ bytes }) => {
        if (requestEpoch !== epoch) throw staleRequestError("manifest");
        return validateManifest(parseJson(bytes, "Invalid company-guidance manifest JSON"));
      })
      .catch((error) => {
        if (manifestRequest?.promise === request) manifestRequest = null;
        throw error;
      });
    manifestRequest = { epoch: requestEpoch, promise: request };
    return request;
  }

  function loadWorkflow(): Promise<CompanyGuidanceExpectationWorkflowIndex> {
    const requestEpoch = epoch;
    if (workflowRequest?.epoch !== requestEpoch) {
      let request!: Promise<CompanyGuidanceExpectationWorkflowIndex>;
      request = (async () => {
        const { manifest: providerManifest } = await manifest();
        const { bytes } = await fetchBytes(assetUrl(baseUrl, providerManifest.workflowIndexRelativePath), retries, fetchImpl);
        await verifyArtifact(bytes, providerManifest.workflowIndexByteSize, providerManifest.workflowIndexChecksumSha256, "workflow index", cryptoImpl);
        const workflow = await validateWorkflowIndex(parseJson(bytes, "Invalid company-guidance workflow index JSON"), providerManifest, cryptoImpl);
        if (requestEpoch !== epoch) throw staleRequestError("workflow index");
        return workflow;
      })().catch((error) => {
        if (workflowRequest?.promise === request) workflowRequest = null;
        throw error;
      });
      workflowRequest = { epoch: requestEpoch, promise: request };
    }
    return workflowRequest.promise;
  }

  function load(stockId: string): Promise<CompanyGuidanceExpectationDetail> {
    const requestEpoch = epoch;
    const hit = cache.get(stockId);
    if (hit) return Promise.resolve(hit);
    const pending = inFlight.get(stockId);
    if (pending) return pending;
    const request = (async () => {
      const { entries } = await manifest();
      const entry = entries.get(stockId);
      if (!entry) throw new CompanyGuidanceExpectationLoadError(`No company-guidance manifest entry for ${stockId}`, "not_found");
      const { bytes } = await fetchBytes(assetUrl(baseUrl, entry.relativePath), retries, fetchImpl);
      await verifyArtifact(bytes, entry.byteSize, entry.checksumSha256, stockId, cryptoImpl);
      const detail = await validateDetail(parseJson(bytes, `Invalid company-guidance JSON for ${stockId}`), entry, cryptoImpl);
      if (requestEpoch !== epoch) throw staleRequestError(`detail ${stockId}`);
      cache.set(stockId, detail);
      return detail;
    })();
    let guarded!: Promise<CompanyGuidanceExpectationDetail>;
    guarded = request.finally(() => { if (inFlight.get(stockId) === guarded) inFlight.delete(stockId); });
    inFlight.set(stockId, guarded);
    return guarded;
  }

  async function loadMany(stockIds = selectDefaultCompanyGuidanceStockIds(companyGuidanceExpectationSummary.items)): Promise<CompanyGuidanceExpectationLoadManyResult> {
    const uniqueIds = [...new Set(stockIds)];
    const settled = await Promise.allSettled(uniqueIds.map((stockId) => load(stockId)));
    const successes: Record<string, CompanyGuidanceExpectationDetail> = {};
    const failures: CompanyGuidanceExpectationLoadFailure[] = [];
    settled.forEach((result, index) => {
      const stockId = uniqueIds[index];
      if (result.status === "fulfilled") successes[stockId] = result.value;
      else {
        const error = normalizeLoadError(result.reason);
        failures.push({ stockId, code: error.code, message: error.message });
      }
    });
    return { status: failures.length ? (Object.keys(successes).length ? "partial" : "error") : "success", successes, failures };
  }

  return {
    load,
    loadMany,
    loadAll: loadMany,
    loadWorkflow,
    clearCache() { epoch += 1; cache.clear(); inFlight.clear(); manifestRequest = null; workflowRequest = null; },
    cacheInfo() { return { epoch, results: cache.size, inFlight: inFlight.size, manifestLoaded: manifestRequest?.epoch === epoch, workflowLoaded: workflowRequest?.epoch === epoch }; },
  };
}

const defaultLoader = createCompanyGuidanceExpectationLoader();
export function loadCompanyGuidanceExpectations(stockId: string) { return defaultLoader.load(stockId); }
export function loadAllCompanyGuidanceExpectations() { return defaultLoader.loadMany(); }

export function selectActiveCompanyGuidanceProviderRecords(dataMode: DashboardDataMode, workflowStatus: CompanyGuidanceExpectationLoadStatus, workflowIndex: CompanyGuidanceExpectationWorkflowIndex | null) {
  return dataMode !== "mock" && workflowStatus === "success" && workflowIndex ? workflowIndex.records : [];
}

export function aggregateEarningsExpectationEvidence({ providerSnapshots, localSnapshots }: { providerSnapshots: EarningsExpectationProviderSnapshot[]; localSnapshots: EarningsExpectationSnapshot[] }): AggregatedEarningsExpectationEvidence {
  const dedupedProviderRecords = [...new Map(providerSnapshots.map((record) => [record.snapshot.id, record])).values()].sort((left, right) => left.snapshot.id.localeCompare(right.snapshot.id));
  const providerSnapshotIds = new Set(dedupedProviderRecords.map((record) => record.snapshot.id));
  const providerRecordBySnapshotId = new Map(dedupedProviderRecords.map((record) => [record.snapshot.id, record]));
  const providerByEvidence = new Map<string, EarningsExpectationProviderSnapshot>();
  for (const record of dedupedProviderRecords) providerByEvidence.set(record.providerEvidenceIdentity, record);
  const duplicateOfProviderByLocalId = new Map<string, string>();
  const relationByLocalId = new Map<string, ProviderEvidenceRelationRecord>();
  for (const snapshot of localSnapshots) {
    const relation = classifyProviderEvidenceRelation(snapshot, providerByEvidence);
    relationByLocalId.set(snapshot.id, relation);
    if (relation.providerSnapshotId && (relation.relation === "exact_duplicate" || relation.relation === "metadata_difference")) duplicateOfProviderByLocalId.set(snapshot.id, relation.providerSnapshotId);
  }
  const providerValues = dedupedProviderRecords.map((record) => record.snapshot);
  return {
    snapshots: [...providerValues, ...localSnapshots],
    comparisonSnapshots: [...providerValues, ...localSnapshots.filter((snapshot) => relationByLocalId.get(snapshot.id)?.relation === "independent")],
    providerSnapshotIds,
    duplicateOfProviderByLocalId,
    relationByLocalId,
    providerRecordBySnapshotId,
  };
}

export function buildProviderContentConflictEvents(aggregated: AggregatedEarningsExpectationEvidence, localSnapshots: EarningsExpectationSnapshot[], stocks: Stock[]): ResearchEvent[] {
  const localById = new Map(localSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  return [...aggregated.relationByLocalId.values()].filter((relation) => relation.relation === "content_conflict" && relation.providerSnapshotId).flatMap((relation) => {
    const snapshot = localById.get(relation.localSnapshotId);
    const provider = relation.providerSnapshotId ? aggregated.providerRecordBySnapshotId.get(relation.providerSnapshotId) : undefined;
    const stock = snapshot ? stocks.find((item) => item.id === snapshot.stockId) : undefined;
    if (!snapshot || !provider || !stock) return [];
    const announcementId = provider.sourceAnnouncementId;
    return [{
      id: `provider-content-conflict:${snapshot.id}:${provider.providerSnapshotVersionId}`,
      stockId: stock.id, stockName: stock.name, stockCode: stock.code, industryId: stock.industryId, market: stock.market,
      eventType: "data_warning" as const, eventDate: snapshot.sourcePublishedAt, publishedAt: null, eventOccurredAt: null,
      eventBusinessDate: snapshot.sourcePublishedAt, detectedAt: snapshot.createdAt, stateActivatedAt: snapshot.createdAt, recordedAt: snapshot.createdAt,
      warningEpisodeKey: `provider-content-conflict:${provider.providerEvidenceIdentity}`,
      reportPeriod: snapshot.reportPeriod,
      title: "公司指引证据内容冲突",
      summary: `本地快照与已验证 Provider 指向同一巨潮公告，但财务字段不一致：${relation.conflictingFields.join("、")}。正式链路只使用 Provider 版本，本地记录保留审计。`,
      sourceType: "provider_status" as const, sourceName: PROVIDER_ID, sourceUrl: provider.officialSourceUrl, pdfUrl: provider.officialPdfUrl,
      verificationStatus: "error" as const, parseStatus: "error" as const, materiality: "medium" as const, metrics: [],
      relatedAnnouncementIds: [announcementId], relatedFinancialPeriod: snapshot.reportPeriod, reviewStatus: "pending" as const,
      reviewReasons: [`关系=content_conflict`, `冲突字段=${relation.conflictingFields.join(",")}`, `local=${snapshot.id}`, `provider=${provider.providerSnapshotVersionId}`],
      isRestated: null, updatedAt: snapshot.createdAt,
    }];
  });
}

export function classifyProviderEvidenceRelation(snapshot: EarningsExpectationSnapshot, providerByEvidence: Map<string, EarningsExpectationProviderSnapshot>): ProviderEvidenceRelationRecord {
  const independent = { localSnapshotId: snapshot.id, providerSnapshotId: null, relation: "independent" as const, conflictingFields: [] };
  if (snapshot.sourceCategory !== "company_guidance") return independent;
  const source = parseOfficialCninfoAnnouncementUrl(snapshot.sourceUrl);
  if (!source) return independent;
  const identity = providerEvidenceIdentityForSnapshot(snapshot, source.announcementId);
  const provider = providerByEvidence.get(identity);
  if (!provider) return independent;
  const conflictingFields = FINANCIAL_RELATION_FIELDS.filter((field) => canonicalJson(snapshot[field]) !== canonicalJson(provider.snapshot[field]));
  if (conflictingFields.length) return { localSnapshotId: snapshot.id, providerSnapshotId: provider.snapshot.id, relation: "content_conflict", conflictingFields };
  const metadataFields = METADATA_RELATION_FIELDS.filter((field) => canonicalJson(snapshot[field]) !== canonicalJson(provider.snapshot[field]));
  return { localSnapshotId: snapshot.id, providerSnapshotId: provider.snapshot.id, relation: metadataFields.length ? "metadata_difference" : "exact_duplicate", conflictingFields: metadataFields };
}

export function parseOfficialCninfoAnnouncementUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const entries = [...url.searchParams.entries()];
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (url.hostname !== "www.cninfo.com.cn" || url.pathname !== "/new/disclosure/detail") return null;
    if (entries.length !== 1 || entries[0][0] !== "annoId" || !/^\d+$/u.test(entries[0][1])) return null;
    return { announcementId: entries[0][1], canonicalUrl: `https://www.cninfo.com.cn/new/disclosure/detail?annoId=${entries[0][1]}` };
  } catch { return null; }
}

export function parseOfficialCninfoPdfUrl(value: string | null | undefined, expectedAnnouncementId: string | null = null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.hostname !== "static.cninfo.com.cn") return null;
    const match = url.pathname.match(/^\/finalpage\/(\d{4}-\d{2}-\d{2})\/(\d+)\.PDF$/u);
    if (!match || (expectedAnnouncementId && match[2] !== expectedAnnouncementId)) return null;
    return { sourceDate: match[1], announcementId: match[2], canonicalUrl: `https://static.cninfo.com.cn${url.pathname}` };
  } catch { return null; }
}

export function sourceAnnouncementId(url: string | null | undefined) { return parseOfficialCninfoAnnouncementUrl(url)?.announcementId ?? null; }
export function assetUrl(baseUrl: string, relative: string) { return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${relative.replace(/^\/+/, "")}`; }

function providerEvidenceIdentityForSnapshot(snapshot: EarningsExpectationSnapshot, announcementId: string) {
  return [PROVIDER_ID, announcementId, snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric].join("|");
}

function validateManifest(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || value.providerVersion !== PROVIDER_VERSION || !Array.isArray(value.items) || value.totalCompanies !== value.items.length) throw new CompanyGuidanceExpectationLoadError("Company-guidance manifest schema mismatch", "schema");
  const providerManifest = value as unknown as CompanyGuidanceExpectationManifest;
  if (providerManifest.workflowIndexRelativePath !== WORKFLOW_PATH || !Number.isInteger(providerManifest.workflowIndexByteSize) || providerManifest.workflowIndexByteSize <= 0 || !isSha(providerManifest.workflowIndexChecksumSha256)) throw new CompanyGuidanceExpectationLoadError("Invalid company-guidance workflow index manifest entry", "schema");
  const entries = new Map<string, CompanyGuidanceExpectationManifestEntry>();
  const codes = new Set<string>(); const paths = new Set<string>();
  for (const entry of providerManifest.items) {
    if (!entry || !SAFE_DETAIL_PATH.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new CompanyGuidanceExpectationLoadError("Unsafe company-guidance manifest path", "schema");
    if (entries.has(entry.stockId) || codes.has(entry.stockCode) || paths.has(entry.relativePath)) throw new CompanyGuidanceExpectationLoadError("Duplicate company-guidance manifest identity/path", "schema");
    if (!Number.isInteger(entry.byteSize) || entry.byteSize <= 0 || !isSha(entry.checksumSha256) || !Number.isInteger(entry.historicalVersionCount) || entry.historicalVersionCount < 0) throw new CompanyGuidanceExpectationLoadError("Invalid company-guidance manifest checksum/count", "schema");
    entries.set(entry.stockId, entry); codes.add(entry.stockCode); paths.add(entry.relativePath);
  }
  if (providerManifest.totalSnapshots !== providerManifest.items.reduce((sum, entry) => sum + entry.snapshotCount, 0) || providerManifest.totalHistoricalVersions !== providerManifest.items.reduce((sum, entry) => sum + entry.historicalVersionCount, 0)) throw new CompanyGuidanceExpectationLoadError("Company-guidance manifest aggregate mismatch", "identity");
  return { manifest: providerManifest, entries };
}

async function validateWorkflowIndex(value: unknown, providerManifest: CompanyGuidanceExpectationManifest, cryptoImpl: Crypto) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || value.providerVersion !== PROVIDER_VERSION || !Array.isArray(value.records) || !Array.isArray(value.warnings) || value.currentSnapshotCount !== value.records.length || value.currentSnapshotCount !== providerManifest.totalSnapshots) throw new CompanyGuidanceExpectationLoadError("Company-guidance workflow index schema/count mismatch", "schema");
  const workflow = value as unknown as CompanyGuidanceExpectationWorkflowIndex;
  const errors = await validateRecords(workflow.records, true, cryptoImpl);
  errors.push(...validateVersionGraph(workflow.records, true), ...validateBusinessRevisionGraph(workflow.records));
  if (errors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance workflow validation failed: ${errors.join("; ")}`, errors.some((error) => error.includes("graph")) ? "graph" : "identity");
  return workflow;
}

async function validateDetail(value: unknown, entry: CompanyGuidanceExpectationManifestEntry, cryptoImpl: Crypto) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || value.providerVersion !== PROVIDER_VERSION || !Array.isArray(value.providerSnapshots) || !Array.isArray(value.historicalProviderVersions) || !Array.isArray(value.exclusions) || !Array.isArray(value.warnings)) throw new CompanyGuidanceExpectationLoadError("Company-guidance detail schema mismatch", "schema");
  const detail = value as unknown as CompanyGuidanceExpectationDetail;
  if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode || detail.providerSnapshots.length !== entry.snapshotCount || detail.historicalProviderVersions.length !== entry.historicalVersionCount) throw new CompanyGuidanceExpectationLoadError("Company-guidance detail identity/count mismatch", "identity");
  const errors = [...await validateRecords(detail.providerSnapshots, true, cryptoImpl, entry.stockId), ...await validateRecords(detail.historicalProviderVersions, false, cryptoImpl, entry.stockId)];
  errors.push(...validateVersionGraph([...detail.providerSnapshots, ...detail.historicalProviderVersions]), ...validateBusinessRevisionGraph(detail.providerSnapshots));
  if (errors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance detail validation failed for ${entry.stockId}: ${errors.join("; ")}`, errors.some((error) => error.includes("graph")) ? "graph" : "identity");
  return detail;
}

async function validateRecords(records: EarningsExpectationProviderSnapshot[], current: boolean, cryptoImpl: Crypto, stockId?: string) {
  const errors: string[] = [];
  for (const record of records) {
    const snapshot = record.snapshot;
    const source = parseOfficialCninfoAnnouncementUrl(record.officialSourceUrl);
    const pdf = parseOfficialCninfoPdfUrl(record.officialPdfUrl, record.sourceAnnouncementId);
    if (!source || source.announcementId !== record.sourceAnnouncementId || source.canonicalUrl !== record.officialSourceUrl || !pdf || pdf.canonicalUrl !== record.officialPdfUrl || pdf.sourceDate !== record.sourceDate) errors.push(`${record.sourceAnnouncementId}:official_url`);
    if ((stockId && snapshot.stockId !== stockId) || snapshot.sourceUrl !== record.officialSourceUrl || snapshot.officialPdfUrl !== record.officialPdfUrl) errors.push(`${record.sourceAnnouncementId}:source_identity`);
    if (record.providerId !== PROVIDER_ID || record.providerVersion !== PROVIDER_VERSION || snapshot.ingestionMethod !== "provider" || snapshot.sourceCategory !== "company_guidance" || snapshot.sourceVerificationStatus !== "verified") errors.push(`${record.sourceAnnouncementId}:provider_boundary`);
    if (snapshot.formationTimeBasis !== "public_disclosure_proxy" || snapshot.formedAt !== null || snapshot.sourcePublishedAt !== record.sourceDate) errors.push(`${record.sourceAnnouncementId}:time_contract`);
    if (!isPreciseInstant(snapshot.createdAt) || !isPreciseInstant(record.generatedAt) || snapshot.asOfDate !== record.sourceDate || snapshot.sourcePublishedAtCalendarDate !== record.sourceDate) errors.push(`${record.sourceAnnouncementId}:instant_contract`);
    if (snapshot.estimateShape === "range" && (!Number.isFinite(snapshot.lowerBound) || !Number.isFinite(snapshot.upperBound) || snapshot.lowerBound! > snapshot.upperBound! || snapshot.value !== null)) errors.push(`${record.sourceAnnouncementId}:range_contract`);
    const evidenceIdentity = providerEvidenceIdentityForSnapshot(snapshot, record.sourceAnnouncementId);
    if (record.providerEvidenceIdentity !== evidenceIdentity || snapshot.providerEvidenceIdentity !== evidenceIdentity) errors.push(`${record.sourceAnnouncementId}:evidence_identity`);
    if (!isSha(record.sourceTextEvidenceHash) || (record.sourceTextEvidence !== undefined && await sha256Text(record.sourceTextEvidence, cryptoImpl) !== record.sourceTextEvidenceHash)) errors.push(`${record.sourceAnnouncementId}:source_text_hash`);
    const checksum = await providerContentChecksum(record, cryptoImpl);
    const versionId = await expectedProviderVersionId(record, checksum, cryptoImpl);
    if (record.providerContentChecksum !== checksum || snapshot.providerContentChecksum !== checksum || record.artifactChecksum !== checksum) errors.push(`${record.sourceAnnouncementId}:content_checksum`);
    if (record.providerSnapshotVersionId !== versionId || snapshot.providerSnapshotVersionId !== versionId || snapshot.id !== versionId) errors.push(`${record.sourceAnnouncementId}:version_identity`);
    if (record.providerParseRulesVersion !== PARSE_RULES_VERSION || snapshot.providerParseRulesVersion !== PARSE_RULES_VERSION || record.isCurrentVersion !== current || snapshot.isCurrentProviderVersion !== current) errors.push(`${record.sourceAnnouncementId}:version_contract`);
    const mirrorsMatch = snapshot.providerCorrectsVersionId === record.providerCorrectsVersionId
      && snapshot.providerCorrectionType === record.providerCorrectionType
      && snapshot.providerCorrectedAt === record.providerCorrectedAt
      && canonicalJson(snapshot.providerCorrectionChangedFields) === canonicalJson(record.providerCorrectionChangedFields);
    const initialContract = record.providerCorrectionType === "initial" && record.providerCorrectsVersionId === null && record.providerCorrectedAt === null && (record.providerCorrectionChangedFields ?? []).length === 0;
    const correctionContract = record.providerCorrectionType === "extraction_correction" && typeof record.providerCorrectsVersionId === "string" && isPreciseInstant(record.providerCorrectedAt) && (record.providerCorrectionChangedFields ?? []).length > 0;
    if (snapshot.correctsSnapshotId !== null || !mirrorsMatch || (!initialContract && !correctionContract)) errors.push(`${record.sourceAnnouncementId}:correction_contract`);
  }
  return errors;
}

function validateVersionGraph(records: EarningsExpectationProviderSnapshot[], allowExternalPredecessors = false) {
  const errors: string[] = []; const byId = new Map<string, EarningsExpectationProviderSnapshot>(); const current = new Set<string>(); const successorByPredecessor = new Set<string>();
  for (const record of records) { if (byId.has(record.providerSnapshotVersionId)) errors.push(`graph_duplicate_version:${record.providerSnapshotVersionId}`); byId.set(record.providerSnapshotVersionId, record); if (record.isCurrentVersion) { if (current.has(record.providerEvidenceIdentity)) errors.push(`graph_multiple_current:${record.providerEvidenceIdentity}`); current.add(record.providerEvidenceIdentity); } }
  for (const record of records) if (record.providerCorrectsVersionId) {
    if ((!allowExternalPredecessors && !byId.has(record.providerCorrectsVersionId)) || (byId.has(record.providerCorrectsVersionId) && byId.get(record.providerCorrectsVersionId)?.providerEvidenceIdentity !== record.providerEvidenceIdentity)) errors.push(`graph_invalid_version_predecessor:${record.providerSnapshotVersionId}`);
    if (successorByPredecessor.has(record.providerCorrectsVersionId)) errors.push(`graph_multiple_version_successors:${record.providerCorrectsVersionId}`);
    successorByPredecessor.add(record.providerCorrectsVersionId);
  }
  for (const record of records) { const seen = new Set<string>(); let cursor: EarningsExpectationProviderSnapshot | undefined = record; while (cursor?.providerCorrectsVersionId) { if (seen.has(cursor.providerCorrectsVersionId)) { errors.push(`graph_version_cycle:${record.providerSnapshotVersionId}`); break; } seen.add(cursor.providerCorrectsVersionId); cursor = byId.get(cursor.providerCorrectsVersionId); } }
  return errors;
}

function validateBusinessRevisionGraph(records: EarningsExpectationProviderSnapshot[]) {
  const errors: string[] = []; const byId = new Map(records.map((record) => [record.snapshot.id, record]));
  for (const record of records) { const id = record.providerBusinessRevisionPredecessorSnapshotId; if (!id) continue; const previous = byId.get(id); if (!previous || record.sourceAnnouncementType !== "earnings_preview_revision") { errors.push(`graph_invalid_business_predecessor:${record.snapshot.id}`); continue; } const key = (value: EarningsExpectationProviderSnapshot) => [value.snapshot.stockId, value.snapshot.reportPeriod, value.snapshot.periodScope, value.snapshot.metric].join("|"); if (key(previous) !== key(record) || previous.sourceDate >= record.sourceDate) errors.push(`graph_incompatible_business_predecessor:${record.snapshot.id}`); }
  return errors;
}

async function providerContentChecksum(record: EarningsExpectationProviderSnapshot, cryptoImpl: Crypto) {
  return sha256Text(canonicalJson({
    providerEvidenceIdentity: record.providerEvidenceIdentity, estimateShape: record.snapshot.estimateShape, value: record.snapshot.value,
    lowerBound: record.snapshot.lowerBound, upperBound: record.snapshot.upperBound, currency: record.snapshot.currency, unit: record.snapshot.unit,
    accountingBasis: record.snapshot.accountingBasis, sourcePublishedAt: record.snapshot.sourcePublishedAt,
    sourceTextEvidenceHash: record.sourceTextEvidenceHash, providerParseRulesVersion: record.providerParseRulesVersion,
  }), cryptoImpl);
}

async function expectedProviderVersionId(record: EarningsExpectationProviderSnapshot, checksum: string, cryptoImpl: Crypto) {
  if (!record.providerCorrectsVersionId) return `company-guidance-version-${checksum}`;
  const eventChecksum = await sha256Text(canonicalJson({
    providerEvidenceIdentity: record.providerEvidenceIdentity,
    providerCorrectsVersionId: record.providerCorrectsVersionId,
    providerContentChecksum: checksum,
  }), cryptoImpl);
  return `company-guidance-version-${eventChecksum}`;
}

function parseJson(bytes: Uint8Array, message: string) { try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { throw new CompanyGuidanceExpectationLoadError(message, "invalid_json"); } }
async function verifyArtifact(bytes: Uint8Array, byteSize: number, checksum: string, label: string, cryptoImpl: Crypto) { if (bytes.byteLength !== byteSize) throw new CompanyGuidanceExpectationLoadError(`Company-guidance byteSize mismatch for ${label}`, "checksum"); if (!cryptoImpl?.subtle) throw new CompanyGuidanceExpectationLoadError("Web Crypto is required for provider verification", "checksum"); if (await sha256(bytes, cryptoImpl) !== checksum) throw new CompanyGuidanceExpectationLoadError(`Company-guidance checksum mismatch for ${label}`, "checksum"); }
async function fetchBytes(url: string, retries: number, fetchImpl: typeof fetch) { let last: unknown; for (let attempt = 0; attempt <= retries; attempt += 1) { try { const response = await fetchImpl(url, { headers: { Accept: "application/json" } }); if (!response.ok) { if (response.status >= 500 && attempt < retries) continue; throw new CompanyGuidanceExpectationLoadError(`HTTP ${response.status} for ${url}`, "http"); } return { bytes: new Uint8Array(await response.arrayBuffer()) }; } catch (error) { if (error instanceof CompanyGuidanceExpectationLoadError) throw error; last = error; if (attempt >= retries) break; } } throw new CompanyGuidanceExpectationLoadError(`Network error for ${url}: ${String(last)}`, "network"); }
async function sha256(bytes: Uint8Array, cryptoImpl: Crypto) { const digest = await cryptoImpl.subtle.digest("SHA-256", bytes as BufferSource); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function sha256Text(value: string, cryptoImpl: Crypto) { return sha256(new TextEncoder().encode(value), cryptoImpl); }
function normalizeLoadError(error: unknown) { return error instanceof CompanyGuidanceExpectationLoadError ? error : new CompanyGuidanceExpectationLoadError(String(error), "network"); }
function staleRequestError(label: string) { return new CompanyGuidanceExpectationLoadError(`Ignored stale company-guidance ${label} request after clearCache`, "stale"); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isSha(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function isPreciseInstant(value: unknown): value is string { return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value)); }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; } return JSON.stringify(value); }
