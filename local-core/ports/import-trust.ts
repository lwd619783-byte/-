import type { ImportApproval, ResolvedImportEvidence } from '../domain/asset-types.js';

// Synchronous read-only ports supplied by a trusted local host, independently
// of untrusted import input. No network, raw SQL, AI approval or default trust.
export interface ImportTrust {
  resolveEvidence(refId: string): ResolvedImportEvidence | undefined;
  resolveApproval(userApprovalRef: string): ImportApproval | undefined;
}
export const unavailableImportTrust: ImportTrust = {
  resolveEvidence: () => undefined,
  resolveApproval: () => undefined,
};
