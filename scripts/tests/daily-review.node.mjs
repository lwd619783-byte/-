import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { reviewFixture, publication, reviewTestEnv as env } from './daily-review.fixture.mjs';
import { DecisionTestStore } from './os-domain.fixture.mjs';
import { privateStoreFixture } from './private-blob.fixture.mjs';
import { DailyReviewStore } from '../../server/daily-review/store.mjs';
import { reviewConfig, reviewAuth, ownerGrant } from '../../server/daily-review/config.mjs';
import { createReviewHandler } from '../../server/daily-review/http.mjs';
import { callReviewTool, reviewTools } from '../../server/daily-review/mcp.mjs';
import { validateReview } from '../../shared/daily-review.mjs';
import { signToken, newConsent, issueCode } from '../../server/research-bridge/auth.mjs';
const config = reviewConfig(env);
function setup(store = new DecisionTestStore(), clock = Date.now) {
  const repo = new DailyReviewStore(store, { workspace: config.workspace, scope: 'synthetic', now: clock });
  const grant = { actor: 'ai', owner: config.subject, workspace: config.workspace, scope: 'synthetic', epoch: 0, expiresAt: clock() + 3600000 };
  return { repo, store, grant, owner: ownerGrant(config, 'synthetic') };
}
async function next(repo, grant, p) {
  const old = (await repo.read({}, grant)).record;
  const asOf = new Date(Date.now()).toISOString();
  return { review: { ...p.review, asOf, sources: p.review.sources.map(s=>({...s,asOf})), generatedAt: asOf, previousReviewId: old.reviewId, previousRevision: old.revision, summary: '合成测试：修订后的风险说明。' }, expectedRevision: old.revision, idempotencyKey: 'synthetic-review-key-0002' };
}
test('strict schema/version/enums/size/refs/formal fields/dates/PIT reject invalid input', () => {
  validateReview(reviewFixture());
  const mutations = [r=>{r.schemaVersion='daily-review.v2'},r=>{delete r.summary},r=>{r.status='USER_CONFIRMED'},r=>{r.summary='x'.repeat(33000)},
    r=>{r.reviewDate='2026-02-30'},r=>{r.asOf='2026-02-30T00:00:00Z'},r=>{r.asOf=new Date(Date.now()+3600000).toISOString()},
    r=>{r.sources[0].asOf=new Date(Date.now()+3600000).toISOString()},r=>{r.sources[0].availability='invented'},r=>{r.observations[0].sourceIds=['missing']},
    r=>{r.sources[0].locator='javascript:alert(1)';r.sources[0].kind='public'},r=>{r.claim={status:'VERIFIED'}},r=>{r.thesis={}},r=>{r.portfolio={}},
    r=>{r.observations[0].kind='fact'},r=>{r.previousRevision=1},r=>{r.sources[0].sourceDate='2999-01-01'}];
  for (const mutate of mutations) { const r = reviewFixture(); mutate(r); assert.throws(()=>validateReview(r)); }
  const stale = reviewFixture(); stale.sources[0].availability='stale'; stale.sources[0].sourceDate=stale.reviewDate; stale.sources[0].availableAt=stale.asOf; validateReview(stale);
});
test('create/exact/history/retry/reload/revision/superseded and withdrawn preserve bytes', async () => {
  const {repo,store,grant,owner}=setup(); const p=publication();
  const first=await repo.publish(p,grant); assert.equal(first.record.revision,1);
  assert.equal((await repo.publish(p,grant)).replay,true);
  assert.equal((await new DailyReviewStore(store,{workspace:config.workspace,scope:'synthetic'}).read({},grant)).record.content.summary,p.review.summary);
  const q=await next(repo,grant,p); await repo.publish(q,grant);
  const exact=await repo.read({reviewDate:p.review.reviewDate,revision:1},grant); assert.deepEqual(exact.record,first.record); assert.equal(exact.effectiveStatus,'SUPERSEDED');
  assert.equal((await repo.history({},grant)).items.length,2);
  const confirmed=await repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:2,action:'confirm',confirmation:'confirm-exact-review-only'},owner); assert.equal(confirmed.record.status,'USER_CONFIRMED');
  await repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:3,action:'withdraw',confirmation:'confirm-exact-review-only'},owner);
  assert.equal((await repo.read({},grant)).record.status,'WITHDRAWN');
  assert.deepEqual((await repo.read({reviewDate:p.review.reviewDate,revision:1},grant)).record,first.record);
});
test('idempotency conflict, stale CAS, concurrent create never silently overwrites', async () => {
  const {repo,grant}=setup(); const p=publication();
  const results=await Promise.allSettled([repo.publish(p,grant),repo.publish({...p,idempotencyKey:'synthetic-review-key-race'},grant)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const committed=(await repo.read({},grant)).record; assert.equal(committed.revision,1);
  const winning=results[0].status==='fulfilled'?p:{...p,idempotencyKey:'synthetic-review-key-race'};
  assert.equal((await repo.publish(winning,grant)).replay,true);
  await assert.rejects(repo.publish({...winning,review:{...winning.review,summary:'changed'}},grant),/IDEMPOTENCY_CONFLICT/);
  assert.equal((await repo.publish({...p,idempotencyKey:'synthetic-review-key-copy'},grant)).record.revision,1);
  await assert.rejects(repo.publish({...p,review:{...p.review,summary:'stale change'},idempotencyKey:'synthetic-review-key-stale'},grant),/CAS_CONFLICT/);
});
test('owner/workspace/scope/expiry/revocation and in-flight revocation fail closed', async () => {
  const {repo,store,grant,owner}=setup();
  for(const override of [{owner:'other'},{workspace:'other'},{scope:'real'},{expiresAt:0},{epoch:2},{actor:'writer'}]) await assert.rejects(repo.publish(publication(),{...grant,...override}));
  await assert.rejects(repo.ownerTransition({reviewDate:publication().review.reviewDate,expectedRevision:1,action:'confirm',confirmation:'confirm-exact-review-only'},grant));
  const put=store.putNew.bind(store); store.putNew=async(k,v)=>{await put(k,v);if(k.includes('/revisions/'))await repo.revoke(owner)};
  await assert.rejects(repo.publish(publication(),grant),/CAS_CONFLICT/);
  await assert.rejects(repo.read({},grant)); assert.equal((await repo.read({},owner)).record,null);
});
test('future publication cannot enter historical context and missing previous exact ref rejected', async () => {
  let at=Date.now(); const {repo,grant}=setup(undefined,()=>at);const p=publication(at); await repo.publish(p,grant);
  assert.equal((await repo.read({asOf:new Date(at-1).toISOString()},grant)).record,null);
  const q={...p,idempotencyKey:'synthetic-next-00002',expectedRevision:1,review:{...p.review,summary:'update',previousReviewId:'industry:oil-shipping:2000-01-01',previousRevision:1}};
  await assert.rejects(repo.publish(q,grant));
});
test('private production adapter preserves immutable objects, CAS, integrity and persistent reload', async () => {
  const {store,objects}=privateStoreFixture(),{repo,grant}=setup(store); const p=publication();await repo.publish(p,grant);
  const reload=setup(store);assert.equal((await reload.repo.read({},grant)).record.revision,1);
  const immutable=[...objects.keys()].find(k=>k.includes('/revisions/'));assert.ok(immutable);
  const result=await Promise.allSettled([repo.publish(await next(repo,grant,p),grant),reload.repo.publish(await next(repo,grant,p),grant)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await repo.history({},grant)).items.length,2);
});
test('unknown tools, forbidden root arguments and scope config fail closed', async () => {
  const {repo,grant}=setup();
  await assert.rejects(callReviewTool(repo,grant,'write_thesis',{}));
  await assert.rejects(callReviewTool(repo,grant,'publish_daily_review',{...publication(),sql:'DELETE'}));
  assert.throws(()=>reviewConfig({...env,DAILY_REVIEW_ENABLED:'false'}));
  assert.throws(()=>reviewConfig({...env,DAILY_REVIEW_WORKSPACE:''}));
  assert.equal(Object.keys(reviewTools).length,5);
});
test('OS blocked state cannot be upgraded; context pins stock metadata without invented prices', async () => {
  const {repo,grant}=setup(),p=publication();
  const context=await callReviewTool(repo,grant,'get_daily_review_context',{asOf:p.review.asOf});
  assert.equal(context.freight,'blocked');assert.equal(context.relationship,'unavailable');assert.equal(context.stocks.length,3);
  assert.ok(context.stocks.every(s=>!Object.hasOwn(s,'price')));
  for(const override of [{availability:'available',sourceDate:p.review.reviewDate,availableAt:p.review.asOf},{revision:'invented'},{locator:'os:Claim:fake'}]){
    const q=structuredClone(p);Object.assign(q.review.sources[0],override);await assert.rejects(repo.publish(q,grant),/REVIEW_/);
  }
});
test('confirmed state cannot be demoted by an old no-op request; invalid owner transition is rejected',async()=>{
  const {repo,grant,owner}=setup(),p=publication();await repo.publish(p,grant);
  await assert.rejects(repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:2,action:'confirm',confirmation:'confirm-exact-review-only'},owner),/CAS/);
  await repo.ownerTransition({reviewDate:p.review.reviewDate,expectedRevision:1,action:'confirm',confirmation:'confirm-exact-review-only'},owner);
  await assert.rejects(repo.publish({...p,idempotencyKey:'synthetic-old-noop-key'},grant),/CAS/);
  assert.equal((await repo.read({},grant)).record.status,'USER_CONFIRMED');
});
test('corruption fails closed and daily quota does not erase existing history',async()=>{
  const {repo,store,grant}=setup(),p=publication();await repo.publish(p,grant);
  const state=await repo.state(),key=`${repo.prefix}revisions/${state.value.entries[0].object}.json`;
  const saved=await store.get(key);store.values.set(key,{...saved,content:{...saved.content,summary:'corrupt'}});await assert.rejects(repo.read({},grant),/INTEGRITY/);store.values.set(key,saved);
  const manifest=await repo.state();manifest.value.entries=Array.from({length:24},()=>manifest.value.entries[0]);store.values.set(repo.key,manifest.value);
  await assert.rejects(repo.publish(await next(repo,grant,p),grant),/DAILY_LIMIT/);
  assert.equal((await repo.read({reviewDate:p.review.reviewDate,revision:1},grant)).record.revision,1);
});
test('SDK HTTP + OAuth PKCE create/read/retry/revise/revoke, read-only tokens rejected', async t => {
  const store=new DecisionTestStore(), server=createServer(createReviewHandler({env,store,scope:'synthetic'}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close()); const base=`http://127.0.0.1:${server.address().port}`;
  const params={client_id:config.clientId,redirect_uri:config.redirects[0],response_type:'code',code_challenge_method:'S256',code_challenge:createHash('sha256').update('v'.repeat(43)).digest('base64url'),state:'test',resource:config.resource,scope:config.scope};
  const consent=newConsent(params,config);const url=new URL(await issueCode(consent.ticket,consent.nonce,config.ownerSecret,config,store));
  const result=await reviewAuth('synthetic').exchange(new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,code:url.searchParams.get('code'),redirect_uri:config.redirects[0],resource:config.resource,code_verifier:'v'.repeat(43)}),config,store);
  const access=result.access_token;
  const payload={kind:'access',iss:config.issuer,aud:config.resource,sub:config.subject,scope:config.scope,client_id:config.clientId,exp:Math.floor(Date.now()/1000)+3600,reviewEpoch:0,workspace:config.workspace,dataScope:'synthetic'};
  for(const token of [null,'bad',signToken({...payload,scope:'os:read'},config),signToken({...payload,exp:1},config),signToken({...payload,workspace:'wrong'},config),signToken({...payload,sub:'wrong'},config)]) {
    const res=await fetch(base+'/api/review-mcp',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:'{}'});assert.equal(res.status,401);
  }
  const client=new Client({name:'synthetic-review-client',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/review-mcp'),{requestInit:{headers:{Authorization:`Bearer ${access}`}}}));t.after(()=>client.close());
  const tools=(await client.listTools()).tools;assert.equal(tools.find(x=>x.name==='publish_daily_review').annotations.readOnlyHint,false);
  const p=publication();const call=async(name,args)=>client.callTool({name,arguments:args});
  assert.equal((await call('prepare_daily_review',p)).isError,undefined);
  const first=await call('publish_daily_review',p);assert.equal(first.structuredContent.result.record.revision,1);
  assert.equal((await call('publish_daily_review',p)).structuredContent.result.replay,true);
  assert.deepEqual((await call('get_daily_review',{})).structuredContent.result.record.content,p.review);
  assert.equal((await call('publish_daily_review',{...p,review:{...p.review,portfolio:{}}})).isError,true);
  assert.equal((await call('publish_daily_review',{...p,sql:'UPDATE portfolio'})).isError,true);
  const {repo,grant}=setup(store);const q=await next(repo,grant,p);assert.equal((await call('publish_daily_review',q)).structuredContent.result.record.revision,2);
  const ownerRead=await fetch(base+'/api/daily-review/current',{headers:{'X-Bridge-Owner-Secret':config.ownerSecret}});assert.equal((await ownerRead.json()).record.revision,2);
  const revoke=await fetch(base+'/api/daily-review/revoke',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json','X-Bridge-Owner-Secret':config.ownerSecret},body:'{}'});assert.equal(revoke.status,200);
  const denied=await fetch(base+'/api/review-mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${access}`},body:'{}'});assert.equal(denied.status,401);
  const html=await(await fetch(base+'/api/daily-review/authorize?'+new URLSearchParams(params))).text();assert.match(html,/授权读取与发布 AI 复盘/);assert.doesNotMatch(html,/确认授予只读访问/);
});
