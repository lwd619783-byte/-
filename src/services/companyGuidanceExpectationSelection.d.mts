import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationManifestEntry, CompanyGuidanceExpectationProviderStatus, CompanyGuidanceExpectationSummary } from "../types";

export function selectDefaultCompanyGuidanceStockIds(items: CompanyGuidanceExpectationSummary["items"]): string[];
export function deriveCompanyGuidanceDetailStatus(detail: Partial<CompanyGuidanceExpectationDetail>): CompanyGuidanceExpectationProviderStatus;
export function analyzeCompanyGuidanceDetailRelations(detail: Partial<CompanyGuidanceExpectationDetail>): { errors: string[]; status: CompanyGuidanceExpectationProviderStatus | null };
export function validateCompanyGuidanceDetailContract(detail: unknown, options?: { expectedGenerationEpoch?: string | null }): string[];
export function deriveCompanyGuidanceManifestMetadata(detail: Partial<CompanyGuidanceExpectationDetail>): Pick<CompanyGuidanceExpectationManifestEntry, "stockId" | "stockCode" | "companyName" | "relativePath" | "snapshotCount" | "historicalVersionCount" | "excludedAnnouncementCount" | "latestReportPeriod" | "latestSourceDate" | "status">;
export function deriveCompanyGuidanceSummaryStatusFromStatuses(statuses: CompanyGuidanceExpectationProviderStatus[]): CompanyGuidanceExpectationProviderStatus;
export function classifyCompanyGuidanceDetailContractErrors(errors: string[]): "schema" | "identity";
