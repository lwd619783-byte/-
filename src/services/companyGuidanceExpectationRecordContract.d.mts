import type { CompanyGuidanceExpectationWarning, EarningsExpectationProviderSnapshot } from "../types";

export const COMPANY_GUIDANCE_PROVIDER_ID: "cninfo-company-guidance";
export const COMPANY_GUIDANCE_PROVIDER_VERSION: "2.0.0";
export const COMPANY_GUIDANCE_PARSE_RULES_VERSION: "1.0.0";
export const COMPANY_GUIDANCE_TIME_NOTE: "公司内部形成时间未知，以公开披露时间作为可用时间";
export const COMPANY_GUIDANCE_RECORD_MODES: readonly ["detail_current", "detail_historical", "workflow_current"];
export const COMPANY_GUIDANCE_CONTENT_FIELDS: readonly string[];
export function parseOfficialCninfoAnnouncementUrl(value: unknown): { announcementId: string; canonicalUrl: string } | null;
export function parseOfficialCninfoPdfUrl(value: unknown, expectedAnnouncementId?: string | null): { sourceDate: string; announcementId: string; canonicalUrl: string } | null;
export function providerContentProjection(record: unknown): Record<string, unknown>;
export function providerContentChangedFields(previous: unknown, current: unknown): string[];
export function validateCompanyGuidanceProviderRecordContract(record: unknown, options?: { mode?: "detail_current" | "detail_historical" | "workflow_current"; stockId?: string | null; companyName?: string | null; expectedGenerationEpoch?: string | null }): string[];
export function validateCompanyGuidanceCorrectionGraph(records: EarningsExpectationProviderSnapshot[], options?: { generationEpoch?: string | null }): string[];
export function validateCompanyGuidanceBusinessRevisionSemantics(records: EarningsExpectationProviderSnapshot[], warnings?: CompanyGuidanceExpectationWarning[]): string[];
export function classifyCompanyGuidanceProviderRecordErrors(errors: string[]): "schema" | "identity" | "graph";
