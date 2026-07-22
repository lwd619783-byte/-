import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationManifest, CompanyGuidanceExpectationSummaryAudit } from "../types";

export const COMPANY_GUIDANCE_SOURCE_ARTIFACT: "CNInfo A-share announcement Provider V1 committed artifacts";
export const COMPANY_GUIDANCE_AUDIT_FIELDS: readonly string[];
export function deriveCompanyGuidanceSummaryAudit(details: CompanyGuidanceExpectationDetail[]): CompanyGuidanceExpectationSummaryAudit;
export function validateCompanyGuidanceSummaryAudit(audit: unknown): string[];
export function validateCompanyGuidanceSummaryAuditManifestProjection(audit: unknown, manifest: CompanyGuidanceExpectationManifest): string[];
