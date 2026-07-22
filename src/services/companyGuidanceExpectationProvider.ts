import summaryJson from "../data/real/a-share-company-guidance-expectation-summaries.generated.json";
import {
  classifyCompanyGuidanceDetailContractErrors,
  deriveCompanyGuidanceManifestMetadata,
  deriveCompanyGuidanceSummaryStatusFromStatuses,
  selectDefaultCompanyGuidanceStockIds,
  validateCompanyGuidanceDetailContract,
} from "./companyGuidanceExpectationSelection.mjs";
import {
  COMPANY_GUIDANCE_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION,
  classifyCompanyGuidanceProviderRecordErrors,
  parseOfficialCninfoAnnouncementUrl as parseOfficialAnnouncementUrl,
  parseOfficialCninfoPdfUrl as parseOfficialPdfUrl,
  providerContentProjection,
  validateCompanyGuidanceBusinessRevisionSemantics,
  validateCompanyGuidanceCorrectionGraph,
  validateCompanyGuidanceProviderRecordContract,
  validateCompanyGuidanceWorkflowCorrectionProofShape,
} from "./companyGuidanceExpectationRecordContract.mjs";
import {
  COMPANY_GUIDANCE_SOURCE_ARTIFACT,
  validateCompanyGuidanceSummaryAuditManifestProjection,
} from "./companyGuidanceExpectationAudit.mjs";
import { isStrictCalendarDate, isStrictPreciseInstant } from "../utils/strictDateTime.mjs";
import type {
  AggregatedEarningsExpectationEvidence,
  CompanyGuidanceExpectationDetail,
  CompanyGuidanceExpectationCorrectionProof,
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
const PROVIDER_ID = COMPANY_GUIDANCE_PROVIDER_ID;
const PROVIDER_VERSION = COMPANY_GUIDANCE_PROVIDER_VERSION;
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

interface LoaderOptions { fetchImpl?: typeof fetch; baseUrl?: string; cryptoImpl?: Crypto; retries?: number; summary?: CompanyGuidanceExpectationSummary }

export function createCompanyGuidanceExpectationLoader(options: LoaderOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const runtimeSummary = options.summary ?? companyGuidanceExpectationSummary;
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
        return validateManifest(parseJson(bytes, "Invalid company-guidance manifest JSON"), runtimeSummary);
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
      const { manifest: providerManifest, entries } = await manifest();
      const entry = entries.get(stockId);
      if (!entry) throw new CompanyGuidanceExpectationLoadError(`No company-guidance manifest entry for ${stockId}`, "not_found");
      const { bytes } = await fetchBytes(assetUrl(baseUrl, entry.relativePath), retries, fetchImpl);
      await verifyArtifact(bytes, entry.byteSize, entry.checksumSha256, stockId, cryptoImpl);
      const detail = await validateDetail(parseJson(bytes, `Invalid company-guidance JSON for ${stockId}`), entry, providerManifest.generatedAt, cryptoImpl);
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
  return parseOfficialAnnouncementUrl(value);
}

export function parseOfficialCninfoPdfUrl(value: string | null | undefined, expectedAnnouncementId: string | null = null) {
  return parseOfficialPdfUrl(value, expectedAnnouncementId);
}

export function sourceAnnouncementId(url: string | null | undefined) { return parseOfficialCninfoAnnouncementUrl(url)?.announcementId ?? null; }
export function assetUrl(baseUrl: string, relative: string) { return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${relative.replace(/^\/+/, "")}`; }

function providerEvidenceIdentityForSnapshot(snapshot: EarningsExpectationSnapshot, announcementId: string) {
  return [PROVIDER_ID, announcementId, snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric].join("|");
}

function validateManifest(value: unknown, runtimeSummary: CompanyGuidanceExpectationSummary) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || value.providerVersion !== PROVIDER_VERSION
    || !isStrictPreciseInstant(value.generatedAt) || !Array.isArray(value.items) || value.totalCompanies !== value.items.length
    || !isPositiveInteger(value.totalCompanies) || !isNonNegativeInteger(value.companiesWithSnapshots)
    || !isNonNegativeInteger(value.totalSnapshots) || !isNonNegativeInteger(value.totalHistoricalVersions)) throw new CompanyGuidanceExpectationLoadError("Company-guidance manifest schema mismatch", "schema");
  const providerManifest = value as unknown as CompanyGuidanceExpectationManifest;
  if (providerManifest.workflowIndexRelativePath !== WORKFLOW_PATH || !Number.isInteger(providerManifest.workflowIndexByteSize) || providerManifest.workflowIndexByteSize <= 0 || !isSha(providerManifest.workflowIndexChecksumSha256)) throw new CompanyGuidanceExpectationLoadError("Invalid company-guidance workflow index manifest entry", "schema");
  const entries = new Map<string, CompanyGuidanceExpectationManifestEntry>();
  const codes = new Set<string>(); const paths = new Set<string>();
  for (const entry of providerManifest.items) {
    if (!entry || typeof entry.stockId !== "string" || typeof entry.stockCode !== "string" || typeof entry.companyName !== "string" || !SAFE_DETAIL_PATH.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new CompanyGuidanceExpectationLoadError("Unsafe company-guidance manifest identity/path", "schema");
    if (entries.has(entry.stockId) || codes.has(entry.stockCode) || paths.has(entry.relativePath)) throw new CompanyGuidanceExpectationLoadError("Duplicate company-guidance manifest identity/path", "schema");
    if (!Number.isInteger(entry.byteSize) || entry.byteSize <= 0 || !isSha(entry.checksumSha256)
      || !Number.isInteger(entry.snapshotCount) || entry.snapshotCount < 0 || !Number.isInteger(entry.historicalVersionCount) || entry.historicalVersionCount < 0
      || !Number.isInteger(entry.excludedAnnouncementCount) || entry.excludedAnnouncementCount < 0
      || (entry.latestReportPeriod !== null && !isStrictCalendarDate(entry.latestReportPeriod))
      || (entry.latestSourceDate !== null && !isStrictCalendarDate(entry.latestSourceDate))
      || !["generated_real", "partial", "missing"].includes(entry.status)) throw new CompanyGuidanceExpectationLoadError("Invalid company-guidance manifest checksum/count/projection", "schema");
    entries.set(entry.stockId, entry); codes.add(entry.stockCode); paths.add(entry.relativePath);
  }
  if (providerManifest.totalSnapshots !== providerManifest.items.reduce((sum, entry) => sum + entry.snapshotCount, 0)
    || providerManifest.totalHistoricalVersions !== providerManifest.items.reduce((sum, entry) => sum + entry.historicalVersionCount, 0)
    || providerManifest.companiesWithSnapshots !== providerManifest.items.filter((entry) => entry.snapshotCount > 0).length) throw new CompanyGuidanceExpectationLoadError("Company-guidance manifest aggregate mismatch", "identity");
  validateSummaryMirror(runtimeSummary, providerManifest);
  return { manifest: providerManifest, entries };
}

function validateSummaryMirror(summary: CompanyGuidanceExpectationSummary, manifest: CompanyGuidanceExpectationManifest) {
  if (!isObject(summary) || summary.schemaVersion !== SCHEMA_VERSION || summary.providerId !== PROVIDER_ID || summary.providerVersion !== PROVIDER_VERSION
    || !isStrictPreciseInstant(summary.generatedAt) || !isStrictPreciseInstant(summary.sourceGeneratedAt) || summary.generatedAt !== manifest.generatedAt
    || summary.sourceGeneratedAt !== manifest.generatedAt || summary.sourceArtifact !== COMPANY_GUIDANCE_SOURCE_ARTIFACT
    || !isObject(summary.items) || !isObject(summary.workflowIndex)) throw new CompanyGuidanceExpectationLoadError("Company-guidance summary generation contract mismatch", "schema");
  const auditErrors = validateCompanyGuidanceSummaryAuditManifestProjection(summary.audit, manifest);
  if (auditErrors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance summary audit projection mismatch: ${auditErrors.join("; ")}`, auditErrors.includes("summary_audit_manifest_projection") ? "identity" : "schema");
  const summaryIds = Object.keys(summary.items).sort();
  const manifestIds = manifest.items.map((entry) => entry.stockId).sort();
  if (canonicalJson(summaryIds) !== canonicalJson(manifestIds)) throw new CompanyGuidanceExpectationLoadError("Company-guidance summary/manifest company set mismatch", "identity");
  for (const entry of manifest.items) {
    const item = summary.items[entry.stockId];
    const expected = {
      stockId: entry.stockId, stockCode: entry.stockCode, companyName: entry.companyName, status: entry.status,
      snapshotCount: entry.snapshotCount, excludedAnnouncementCount: entry.excludedAnnouncementCount,
      latestReportPeriod: entry.latestReportPeriod, latestSourceDate: entry.latestSourceDate, detailPath: entry.relativePath,
    };
    if (!item || Object.keys(expected).some((field) => !Object.is(item[field as keyof typeof item], expected[field as keyof typeof expected]))) throw new CompanyGuidanceExpectationLoadError(`Company-guidance summary projection mismatch for ${entry.stockId}`, "identity");
  }
  if (summary.status !== deriveCompanyGuidanceSummaryStatusFromStatuses(manifest.items.map((entry) => entry.status))
    || summary.workflowIndex.relativePath !== manifest.workflowIndexRelativePath || summary.workflowIndex.byteSize !== manifest.workflowIndexByteSize
    || summary.workflowIndex.checksumSha256 !== manifest.workflowIndexChecksumSha256 || summary.workflowIndex.currentSnapshotCount !== manifest.totalSnapshots) throw new CompanyGuidanceExpectationLoadError("Company-guidance summary global projection mismatch", "identity");
}

async function validateWorkflowIndex(value: unknown, providerManifest: CompanyGuidanceExpectationManifest, cryptoImpl: Crypto) {
  if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || value.providerId !== PROVIDER_ID || value.providerVersion !== PROVIDER_VERSION || !Array.isArray(value.records) || !Array.isArray(value.correctionProofs) || !Array.isArray(value.warnings) || value.currentSnapshotCount !== value.records.length || value.currentSnapshotCount !== providerManifest.totalSnapshots) throw new CompanyGuidanceExpectationLoadError("Company-guidance workflow index schema/count mismatch", "schema");
  const workflow = value as unknown as CompanyGuidanceExpectationWorkflowIndex;
  const companyNames = new Map(providerManifest.items.map((entry) => [entry.stockId, entry.companyName]));
  const errors = await validateRecords(workflow.records, "workflow_current", cryptoImpl, undefined, companyNames, providerManifest.generatedAt);
  if (!isStrictPreciseInstant(workflow.generatedAt) || workflow.generatedAt !== providerManifest.generatedAt
    || workflow.records.some((record) => record.generatedAt !== workflow.generatedAt || record.snapshot?.providerGeneratedAt !== workflow.generatedAt)) errors.push("workflow_generation_epoch");
  errors.push(...await validateWorkflowCorrectionProofs(workflow.records, workflow.correctionProofs, cryptoImpl));
  errors.push(...validateWorkflowWarnings(workflow.warnings), ...validateVersionGraph(workflow.records, true),
    ...validateBusinessRevisionGraph(workflow.records), ...validateCompanyGuidanceBusinessRevisionSemantics(workflow.records, workflow.warnings));
  if (errors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance workflow validation failed: ${errors.join("; ")}`, classifyRuntimeRecordErrors(errors));
  return workflow;
}

async function validateWorkflowCorrectionProofs(records: EarningsExpectationProviderSnapshot[], proofs: CompanyGuidanceExpectationCorrectionProof[], cryptoImpl: Crypto) {
  const errors = [...validateCompanyGuidanceWorkflowCorrectionProofShape(records, proofs)];
  for (const proof of proofs) {
    if (!isObject(proof) || !isObject(proof.predecessorContentProjection)) continue;
    const checksum = await sha256Text(canonicalJson(proof.predecessorContentProjection), cryptoImpl);
    if (checksum !== proof.predecessorProviderContentChecksum) errors.push("provider_correction_proof_checksum");
    const predecessorVersionId = await providerVersionId(
      proof.providerEvidenceIdentity,
      proof.predecessorProviderCorrectsVersionId,
      checksum,
      cryptoImpl,
    );
    if (predecessorVersionId !== proof.predecessorProviderSnapshotVersionId) errors.push("provider_correction_proof_predecessor_version");
  }
  return [...new Set(errors)];
}

async function validateDetail(value: unknown, entry: CompanyGuidanceExpectationManifestEntry, generationEpoch: string, cryptoImpl: Crypto) {
  const detailContractErrors = validateCompanyGuidanceDetailContract(value, { expectedGenerationEpoch: generationEpoch });
  if (detailContractErrors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance detail contract validation failed for ${entry.stockId}: ${detailContractErrors.join("; ")}`, classifyCompanyGuidanceDetailContractErrors(detailContractErrors));
  const detail = value as CompanyGuidanceExpectationDetail;
  const expectedMetadata = deriveCompanyGuidanceManifestMetadata(detail);
  const manifestProjectionErrors = ["stockId", "stockCode", "companyName", "relativePath", "status", "snapshotCount", "historicalVersionCount", "excludedAnnouncementCount", "latestReportPeriod", "latestSourceDate"]
    .filter((field) => !Object.is(entry[field as keyof CompanyGuidanceExpectationManifestEntry], expectedMetadata[field as keyof typeof expectedMetadata]))
    .map((field) => `manifest_${field}`);
  if (manifestProjectionErrors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance detail/manifest projection mismatch for ${entry.stockId}: ${manifestProjectionErrors.join("; ")}`, "identity");
  const allRecords = [...detail.providerSnapshots, ...detail.historicalProviderVersions];
  const errors = [...await validateRecords(detail.providerSnapshots, "detail_current", cryptoImpl, entry.stockId, undefined, generationEpoch, entry.companyName),
    ...await validateRecords(detail.historicalProviderVersions, "detail_historical", cryptoImpl, entry.stockId, undefined, generationEpoch, entry.companyName)];
  errors.push(...validateVersionGraph(allRecords), ...validateBusinessRevisionGraph(detail.providerSnapshots),
    ...validateCompanyGuidanceCorrectionGraph(allRecords, { generationEpoch }),
    ...validateCompanyGuidanceBusinessRevisionSemantics(detail.providerSnapshots, detail.warnings));
  if (errors.length) throw new CompanyGuidanceExpectationLoadError(`Company-guidance detail validation failed for ${entry.stockId}: ${errors.join("; ")}`, classifyRuntimeRecordErrors(errors));
  return detail;
}

async function validateRecords(
  records: EarningsExpectationProviderSnapshot[],
  mode: "detail_current" | "detail_historical" | "workflow_current",
  cryptoImpl: Crypto,
  stockId?: string,
  companyNames?: Map<string, string>,
  generationEpoch?: string,
  companyName?: string,
) {
  const errors: string[] = [];
  for (const record of records) {
    if (!isObject(record) || !isObject(record.snapshot)) { errors.push("<invalid>:record_shape"); continue; }
    const snapshot = record.snapshot;
    const expectedCompanyName = companyName ?? companyNames?.get(snapshot.stockId) ?? null;
    errors.push(...validateCompanyGuidanceProviderRecordContract(record, {
      mode, stockId: stockId ?? null, companyName: expectedCompanyName, expectedGenerationEpoch: generationEpoch ?? null,
    }).map((error) => `${record.sourceAnnouncementId}:${error}`));
    const evidenceIdentity = providerEvidenceIdentityForSnapshot(snapshot, record.sourceAnnouncementId);
    if (record.providerEvidenceIdentity !== evidenceIdentity || snapshot.providerEvidenceIdentity !== evidenceIdentity) errors.push(`${record.sourceAnnouncementId}:evidence_identity`);
    if (!isSha(record.sourceTextEvidenceHash) || (mode !== "workflow_current" && await sha256Text(record.sourceTextEvidence ?? "", cryptoImpl) !== record.sourceTextEvidenceHash)) errors.push(`${record.sourceAnnouncementId}:provider_snapshot_evidence_contract`);
    const checksum = await providerContentChecksum(record, cryptoImpl);
    const versionId = await expectedProviderVersionId(record, checksum, cryptoImpl);
    if (record.providerContentChecksum !== checksum || snapshot.providerContentChecksum !== checksum || record.artifactChecksum !== checksum) errors.push(`${record.sourceAnnouncementId}:content_checksum`);
    if (record.providerSnapshotVersionId !== versionId || snapshot.providerSnapshotVersionId !== versionId || snapshot.id !== versionId) errors.push(`${record.sourceAnnouncementId}:version_identity`);
  }
  return errors;
}

function validateWorkflowWarnings(warnings: CompanyGuidanceExpectationWorkflowIndex["warnings"]) {
  const supported = new Set(["revision_without_reliable_range", "revision_predecessor_ambiguous", "revision_predecessor_missing"]);
  return warnings.every((warning) => isObject(warning) && supported.has(warning.code)
    && /^\d+$/u.test(warning.sourceAnnouncementId) && Array.isArray(warning.candidateAnnouncementIds)
    && warning.candidateAnnouncementIds.every((id) => typeof id === "string" && /^\d+$/u.test(id))
    && new Set(warning.candidateAnnouncementIds).size === warning.candidateAnnouncementIds.length
    && typeof warning.message === "string" && Boolean(warning.message.trim())) ? [] : ["provider_structured_warning_contract"];
}

function classifyRuntimeRecordErrors(errors: string[]): CompanyGuidanceExpectationLoadError["code"] {
  if (errors.includes("workflow_generation_epoch")) return "identity";
  if (errors.some((error) => ["content_checksum", "version_identity", "evidence_identity"].some((code) => error.endsWith(`:${code}`)))) return "identity";
  const shared = classifyCompanyGuidanceProviderRecordErrors(errors.map((error) => { const parts = error.split(":"); return parts[parts.length - 1] ?? error; }));
  if (shared === "graph" || errors.some((error) => error.includes("graph"))) return "graph";
  if (shared === "schema") return "schema";
  return "identity";
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
  return sha256Text(canonicalJson(providerContentProjection(record)), cryptoImpl);
}

async function expectedProviderVersionId(record: EarningsExpectationProviderSnapshot, checksum: string, cryptoImpl: Crypto) {
  return providerVersionId(record.providerEvidenceIdentity, record.providerCorrectsVersionId, checksum, cryptoImpl);
}

async function providerVersionId(providerEvidenceIdentity: string, providerCorrectsVersionId: string | null, checksum: string, cryptoImpl: Crypto) {
  if (!providerCorrectsVersionId) return `company-guidance-version-${checksum}`;
  const eventChecksum = await sha256Text(canonicalJson({
    providerEvidenceIdentity,
    providerCorrectsVersionId,
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
function isNonNegativeInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function isPositiveInteger(value: unknown): value is number { return isNonNegativeInteger(value) && value > 0; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; } return JSON.stringify(value); }
