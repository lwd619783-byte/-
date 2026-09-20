import type { BrowserSourceRepository, IngestionSnapshot, WikiDocumentDraft } from '../types/knowledgeIngestion';
import type { WikiRepository } from './wikiRepository';
import type { WikiOwners } from '../types/wiki';
import { contributionAdditions, contributionStatus } from './knowledgeContribution';
import { wikiRequire } from './wiki';

/** Same-origin review mutex; absence fails closed. Wiki append remains its own authority/CAS. */
export async function reviewContribution(input: {
  sources: BrowserSourceRepository; wiki: WikiRepository; owners: WikiOwners; bundleId: string; proposalId: string;
  decision: 'accept' | 'reject' | 'no_action'; note: string; edited?: WikiDocumentDraft;
  onSnapshot: (snapshot: IngestionSnapshot) => void;
}, locks: Pick<LockManager, 'request'> | undefined = globalThis.navigator?.locks): Promise<void> {
  wikiRequire(locks, '当前浏览器不支持安全审核锁，请使用新版浏览器');
  await locks!.request('knowledge-contribution-review.v1', async () => {
    const state = await input.sources.load(); input.onSnapshot(state);
    const loaded = input.wiki.load(); wikiRequire(!loaded.error, '知识库已锁定，请先处理存储错误');
    wikiRequire(input.note.trim(), '请填写审核说明');
    wikiRequire(contributionStatus(state, loaded.data, input.bundleId, input.proposalId) === 'pending', '此建议已处理，请刷新');
    if (input.decision === 'accept') {
      input.wiki.append(loaded.data, contributionAdditions(state, loaded.data, input.owners, input.bundleId, input.proposalId, input.note, new Date().toISOString(), input.edited));
    } else await input.sources.dispose(input.bundleId, input.proposalId, input.decision === 'reject' ? 'rejected' : 'no_action', input.note);
  });
}
