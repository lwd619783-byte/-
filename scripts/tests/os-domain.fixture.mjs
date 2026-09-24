/** Synthetic transport only. Formal positive graphs live in decisionSnapshot.test.ts. */
export class DecisionTestStore {
  values = new Map();
  async get(k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; }
  async versioned(k) { const value = await this.get(k); return value ? { value, etag: JSON.stringify(value) } : null; }
  async putNew(k, v) { if (this.values.has(k)) throw Error('EXISTS'); this.values.set(k, structuredClone(v)); }
  async compareExchange(k, etag, value) { if ((this.values.has(k) ? JSON.stringify(this.values.get(k)) : null) !== etag) return false; this.values.set(k, structuredClone(value)); return true; }
}
export const domainTestEnv = { OS_DOMAIN_ENABLED: 'true', BRIDGE_ORIGIN: 'https://synthetic.example', BRIDGE_OWNER_SECRET: 'synthetic-owner-secret-only-for-tests-32', BRIDGE_SIGNING_SECRET: 'synthetic-signing-secret-only-for-tests-32', BLOB_STORE_ID: 'synthetic', BRIDGE_OAUTH_REDIRECT_URIS: 'https://chatgpt.com/connector_platform_oauth_redirect' };
export function emptyDecisionFixture(now = Date.now()) {
  const empty = () => ({ status: 'missing', blockers: [], rows: [] });
  return { schemaVersion: 'decision-snapshot.v1', snapshotId: crypto.randomUUID(), generatedAt: new Date(now).toISOString(), asOf: new Date(now).toISOString(), scope: 'synthetic', authority: 'local-formal-owners', semantics: 'current-published-state-only', claims: empty(), theses: empty(), expressions: empty(), portfolio: { status: 'unavailable', authority: 'localhost-portfolio-projection', blockers: ['PORTFOLIO_NOT_CONNECTED'], projection: null } };
}
