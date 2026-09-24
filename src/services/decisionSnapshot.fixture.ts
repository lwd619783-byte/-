/** SYNTHETIC ONLY: official formal owners, frozen F2, explicit fixture confirmations. */
import { portfolioFixture } from './portfolio.fixture';
import type { ExpressionWorkspaceRuntime } from './expressionWorkspace';
export async function decisionFixture() {
  const f = await portfolioFixture();
  const runtime: ExpressionWorkspaceRuntime = { owners: f.expressionOwners, repository: f.repo, instruments: [], thesisRuntime: {
    owners: f.owners.expressions().owners.theses().owners, repository: f.thesisRepo, claimRepository: f.claimRepo, claimOwners: f.claim.owners, bindings: [f.claim.binding], identities: [], evidence: () => null,
  } };
  return { ...f, runtime };
}
