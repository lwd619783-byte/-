import { test } from 'node:test';
import assert from 'node:assert/strict';
import retained from '../../src/data/real/priceHistory.generated.json' with { type: 'json' };
import { oilShippingPilot } from '../../shared/oil-shipping-scope.mjs';
import { stockObservation, observationChange, samplePerformance } from '../../shared/oil-shipping-observation.mjs';
import { reviewContext, validateOSReferences } from '../../server/daily-review/context.mjs';
import { validateReview } from '../../shared/daily-review.mjs';
import { reviewFixture } from './daily-review.fixture.mjs';

const asOf = '2026-09-26T08:00:00.000Z', now = Date.parse('2026-10-11T00:00:00Z');
function snapshot() {
  return { items: Object.fromEntries(oilShippingPilot.map((s,j) => [s.id, { id:s.id,
    quality: { source:'SYNTHETIC retained source', sourceUrl:'https://example.invalid/synthetic', status:'real', updatedAt:'2026-09-26T00:00:00Z' },
    points: Array.from({length:25},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,close:100+i*(j===1?-1:1),amount:null,pctChange:null})) }])) };
}
test('three exact pilot identities, latest and 1/5/20 use the same UI primitives and actual endpoints', () => {
  for (const input of [snapshot(),retained]) {
    const context=reviewContext(asOf,now,input);
    assert.equal(context.schemaVersion,'oil-shipping-observation-context.v1');
    assert.equal(context.selectedSample.securityCount,3);assert.equal(context.selectedSample.companyCount,3);
    const series=oilShippingPilot.map(s=>stockObservation({...s,dataMode:'real',priceHistory:input.items[s.id].points,priceHistorySource:input.items[s.id]},'2026-09-26'));
    context.stocks.forEach((s,i)=>{
      const latest=series[i].points.filter(p=>p.value!==null).at(-1);
      assert.equal(s.stockId,oilShippingPilot[i].id);assert.equal(s.code,oilShippingPilot[i].code);
      assert.equal(s.latestRetainedClose,latest?.value??null);assert.equal(s.latestValidDate,latest?.date??null);
      assert.deepEqual(s.states,series[i].states);assert.equal(s.adjustmentBasis,'unknown');
      assert.ok(s.states.includes('unknown_basis'));assert.ok(s.states.includes('calendar_unproven'));
      [s.onePeriodChange,s.fivePeriodChange,s.twentyPeriodChange].forEach((change,j)=>{
        const periods=[1,5,20][j];assert.equal(change.value,observationChange(series[i].points,periods));
        assert.deepEqual(change.endpoints,{start:series[i].points.at(-(periods+1)).date,end:series[i].points.at(-1).date});
        assert.match(change.calculationDigest,/^[a-f0-9]{64}$/);assert.ok(context.sourceReferences.some(r=>r.locator===change.locator&&r.revision===change.calculationDigest));
      });
    });
    [context.selectedSample.onePeriod,context.selectedSample.fivePeriod,context.selectedSample.twentyPeriod].forEach((s,i)=>{
      const expected=samplePerformance(series,[1,5,20][i]);assert.equal(s.value,expected.mean);assert.equal(s.up,expected.up);assert.equal(s.down,expected.down);assert.equal(s.flat,expected.flat);assert.deepEqual(s.endpoints,expected.endpoints);
    });
    assert.equal(context.freight.value,null);assert.equal(context.freight.availability,'blocked');assert.equal(context.freight.formalAdmission,'NOT_ADMITTED');
    assert.equal(context.relationship.state,'unavailable');assert.equal(context.relationship.label,'数据不足');
  }
});
test('sample equal weight/counts are frozen, use all securities, and reject stale/partial/unknown basis/endpoints',()=>{
  const series=[110,90,100].map(value=>({points:[{date:'2026-09-01',value:100},{date:'2026-09-02',value}],states:['real'],publication:null}));
  const result=samplePerformance(series,1);assert.ok(Math.abs(result.mean)<1e-12);assert.deepEqual([result.up,result.down,result.flat],[1,1,1]);
  for(const state of ['stale','partial','conflicted','unknown_basis','missing','calendar_unproven']) {
    const copy=structuredClone(series);copy[1].states=[state];const r=samplePerformance(copy,1);assert.equal(r.mean,null);assert.equal(r.up,null);assert.equal(r.down,null);assert.equal(r.flat,null);assert.ok(r.states.includes(state));
  }
  const copy=structuredClone(series);copy[1].points[0].date='2026-08-31';assert.equal(samplePerformance(copy,1).mean,null);
});
test('missing/null, partial/conflicted and stale cannot be upgraded or drop the selected denominator',()=>{
  const input=snapshot();delete input.items['cm-energy'];input.items['cm-nanjing'].points[24].close=null;
  const c=reviewContext(asOf,now,input);assert.equal(c.stocks[1].latestRetainedClose,null);assert.equal(c.stocks[1].onePeriodChange.value,null);
  assert.ok(c.stocks[2].states.includes('partial'));assert.equal(c.stocks[2].onePeriodChange.value,null);assert.equal(c.selectedSample.securityCount,3);assert.equal(c.selectedSample.onePeriod.value,null);
  const conflict=snapshot();conflict.items['cosco-energy'].points.push(conflict.items['cosco-energy'].points[24]);assert.ok(reviewContext(asOf,now,conflict).stocks[0].states.includes('conflicted'));
  const stale=reviewContext('2026-10-10T00:00:00Z',now,snapshot());assert.ok(stale.stocks.every(s=>s.states.includes('stale')));assert.equal(stale.selectedSample.onePeriod.value,null);
});
test('PIT denies future acquired owner, partial history is not filled from future snapshots, future pins stay invisible',()=>{
  const past='2026-09-10T08:00:00Z', later=snapshot();
  const missing=reviewContext(past,now,{items:{}}), hidden=reviewContext(past,now,later);assert.deepEqual(hidden,missing);
  later.items['cosco-energy'].points[0].close=999999;later.items['cosco-energy'].quality.source='future corrected source';assert.deepEqual(reviewContext(past,now,later),missing);
  const partial=snapshot();for(const owner of Object.values(partial.items)){owner.quality.updatedAt='2026-09-10T00:00:00Z';owner.points=owner.points.slice(0,9)}
  const before=reviewContext(past,now,partial), bytes=JSON.stringify(before);
  assert.equal(before.stocks[0].latestRetainedClose,108);assert.equal(before.stocks[0].twentyPeriodChange.value,null);
  const after=reviewContext(past,now,later);assert.equal(after.stocks[0].latestRetainedClose,null);assert.equal(after.stocks[0].fivePeriodChange.value,null);assert.equal(after.stocks[0].sourceAvailableAt,null);assert.equal(JSON.stringify(before),bytes);
  assert.throws(()=>reviewContext('2026-10-12T00:00:00Z',now),/FUTURE_CONTEXT/);
});
test('deterministic reference pin required: raw source/public/fake locator/wrong digest cannot masquerade as OS derived',()=>{
  const input=snapshot(),context=reviewContext(asOf,now,input),r=reviewFixture(Date.parse(asOf)+2000);
  const source=context.sourceReferences.find(s=>s.id==='cosco-energy-return-5p');r.sources=[context.sourceReferences[0],source];r.observations=[{kind:'derived',text:'AI 引用 OS 结果，文字本身不晋升为确定性事实。',sourceIds:[source.id]}];
  validateReview(r,now);validateOSReferences(r,now,input);
  const forged=structuredClone(r);forged.sources[1].locator+=':invented';assert.throws(()=>validateOSReferences(forged,now,input),/REFERENCE_MISMATCH/);
  const wrong=structuredClone(r);wrong.sources[1].revision='0'.repeat(64);assert.throws(()=>validateOSReferences(wrong,now,input),/REFERENCE_MISMATCH/);
  const raw=structuredClone(r);raw.sources[1]=context.sourceReferences.find(s=>s.id==='cosco-energy');raw.observations[0].sourceIds=[raw.sources[1].id];assert.throws(()=>validateOSReferences(raw,now,input),/DETERMINISTIC_REF_REQUIRED/);
  const external=structuredClone(r);Object.assign(external.sources[1],{kind:'public',locator:'https://example.invalid/research',relationToOS:'external_unverified'});assert.throws(()=>validateOSReferences(external,now,input),/DETERMINISTIC_REF_REQUIRED/);
});
test('context bytes are bounded independently of history length and no full series is exposed',()=>{
  const input=snapshot(),before=reviewContext(asOf,now,input);
  for(const owner of Object.values(input.items)) owner.points.unshift(...Array.from({length:5000},(_,i)=>({date:new Date(Date.UTC(2000,0,1+i)).toISOString().slice(0,10),close:1})));
  const after=reviewContext(asOf,now,input);assert.ok(Buffer.byteLength(JSON.stringify(after))<32768);assert.equal(JSON.stringify(before).length,JSON.stringify(after).length);
  assert.equal(JSON.stringify(after).includes('"points"'),false);assert.equal(after.sourceReferences.length,17);
});
