import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationProviderStatus, CompanyGuidanceExpectationSummary } from "../types";

export function selectDefaultCompanyGuidanceStockIds(items: CompanyGuidanceExpectationSummary["items"]): string[];
export function deriveCompanyGuidanceDetailStatus(detail: Pick<CompanyGuidanceExpectationDetail, "providerSnapshots" | "exclusions" | "targetAnnouncements">): CompanyGuidanceExpectationProviderStatus;
