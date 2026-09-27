/** Opt-in synthetic acceptance in the EXISTING private Blob. No production config changes.
 * Credentials are loaded from an ignored env file; never printed or put in fixtures.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { PrivateBlobStore } from '../server/research-bridge/store.mjs';
import { DailyReviewStore } from '../server/daily-review/store.mjs';
import { publication } from './tests/daily-review.fixture.mjs';
if (process.env.REVIEW_LIVE_BLOB !== '1') throw Error('Explicit REVIEW_LIVE_BLOB=1 required');
process.loadEnvFile('data-cache/daily-review/preview.env');
const workspace = `acceptance-${randomUUID()}`, store = new PrivateBlobStore();
const repo = new DailyReviewStore(store, { workspace, scope: 'synthetic' });
const grant = { actor:'ai',owner:'personal-owner',workspace,scope:'synthetic',epoch:0,expiresAt:Date.now()+3600000 };
const owner = { ...grant,actor:'owner' }, report={scope:'SYNTHETIC_EXISTING_PRIVATE_BLOB',workspace,checks:[]};
const check=(ok,name)=>{assert.ok(ok,name);report.checks.push(name)};
try {
  const p=publication(); const first=await repo.publish(p,grant);check(first.record.revision===1,'durable create');
  check((await repo.publish(p,grant)).replay,'idempotent retry');
  const reload=new DailyReviewStore(new PrivateBlobStore(),{workspace,scope:'synthetic'});
  check((await reload.read({},grant)).record.content.summary===p.review.summary,'fresh adapter exact readback');
  const asOf=new Date().toISOString();const q={...p,expectedRevision:1,idempotencyKey:'synthetic-live-revision-0002',review:{...p.review,asOf,generatedAt:asOf,sources:p.review.sources.map(s=>({...s,asOf})),previousReviewId:first.record.reviewId,previousRevision:1,summary:'合成测试修订：运价缺口仍在，关系无法确认。'}};
  check((await repo.publish(q,grant)).record.revision===2,'durable revision');
  check((await reload.read({reviewDate:p.review.reviewDate,revision:1},grant)).record.content.summary===p.review.summary,'immutable old revision');
  check((await reload.history({},grant)).items.length===2,'durable history');
  await repo.revoke(owner);await assert.rejects(repo.publish(q,grant));check(true,'revoked writer denied');
  await repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:2,action:'withdraw',confirmation:'confirm-exact-review-only'},owner);
  check((await reload.read({},owner)).record.status==='WITHDRAWN','synthetic withdrawn without deletion');
} finally { await mkdir('data-cache/daily-review',{recursive:true});await writeFile('data-cache/daily-review/live-report.json',JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify(report));
