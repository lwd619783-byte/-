import { describe, expect, it, vi } from 'vitest';
import { candidates, createSimulation, defaultRules, fillBlock, projectRound, sessions, syntheticQuote, tradingDaysElapsed, type Rules } from './simulation';
const ids = candidates.slice(0, 20).map(c => c.id);
function locked(rules: Rules = defaultRules) {
  const store = createSimulation(), round = store.create(); store.lock(round.id, ids, rules);
  return { store, id: round.id, view: () => projectRound(store.list()[0]) };
}
function advanceTo(store: ReturnType<typeof createSimulation>, id: string, end: number) {
  for (let i = projectRound(store.list()[0]).cursor; i < end; i++) store.advance(id, i);
}
describe('synthetic round contract and immutable snapshots', () => {
  it.each([[], ids.slice(0, 19), [...ids, 'SYN-21'], [...ids.slice(0, 19), ids[0]], [...ids.slice(0, 19), '600000']].map(selected => ({ selected })))('rejects invalid selection %#', ({ selected }) => {
    const store = createSimulation(), round = store.create(); expect(() => store.lock(round.id, selected, defaultRules)).toThrow(); expect(store.list()[0].events).toHaveLength(0);
  });
  it('locks exactly twenty unique allocations totaling 100%, copies all inputs and freezes exposed snapshots', () => {
    const rules = { ...defaultRules }, selected = [...ids], store = createSimulation(), round = store.create(); store.lock(round.id, selected, rules);
    rules.costBps = 100; selected[0] = 'SYN-24'; round.candidates[0].name = 'mutated';
    const result = store.list()[0], view = projectRound(result);
    expect(view.lock?.allocation).toHaveLength(20); expect(view.lock?.allocation.reduce((sum, a) => sum + a.weightBps, 0)).toBe(10000);
    expect(view.lock?.rules.costBps).toBe(10); expect(result.candidates).toEqual(candidates);
    expect(() => { result.candidates[0].name = 'overwrite'; }).toThrow();
    expect(() => store.lock(round.id, ids, defaultRules)).toThrow();
    expect(() => store.skip(round.id)).toThrow();
    expect(() => store.create()).toThrow();
  });
  it('allows no opportunity without inventing fills and retains every candidate in history', () => {
    const store = createSimulation(), round = store.create(); store.skip(round.id);
    expect(projectRound(store.list()[0]).status).toBe('skipped'); expect(store.list()[0].candidates).toHaveLength(24);
    expect(() => store.skip(round.id)).toThrow(); expect(() => store.lock(round.id, ids, defaultRules)).toThrow();
    expect(store.create().id).not.toBe(round.id); expect(store.list()).toHaveLength(2);
  });
  it.each([-1, 1001, 0.5, NaN])('rejects invalid transaction cost %s', costBps => {
    expect(() => locked({ ...defaultRules, costBps })).toThrow();
  });
});
describe('daily snapshot constraints and synthetic session counting (not intraday execution)', () => {
  it('counts explicit sessions, excludes weekends and synthetic holiday; entry day convention is configurable', () => {
    expect(sessions).not.toContain('2026-01-10'); expect(sessions).not.toContain('2026-01-19');
    expect(sessions[10]).toBe('2026-01-20');
    expect(tradingDaysElapsed(1, defaultRules)).toBe(1);
    expect(tradingDaysElapsed(1, { ...defaultRules, dayCount: 'exclude-entry' })).toBe(0);
    for (const dayCount of ['include-entry', 'exclude-entry'] as const) {
      const { store, id, view } = locked({ ...defaultRules, dayCount }); const dueIndex = dayCount === 'include-entry' ? 20 : 21;
      advanceTo(store, id, dueIndex - 1); expect(view().due).toBe(false);
      store.advance(id, dueIndex - 1); expect(view().due).toBe(true); expect(view().elapsed).toBe(20);
    }
  });
  it('does not fill on lock, and unavailable/suspended/limit/missing quotes remain unfilled without replacement', () => {
    const { store, id, view } = locked(); expect(view().positions.every(p => p.status === 'awaiting-entry')).toBe(true);
    store.advance(id, 0); expect(view().unfilled).toBe(5);
    expect(view().positions.slice(1, 6).map(p => p.reason)).toEqual(['停牌', '涨停 · 无成交证明', '跌停 · 无成交证明', '缺失行情 · 未知', '当时不可得行情 · 禁止回填']);
    const first = view().positions; advanceTo(store, id, 19);
    expect(view().positions.filter(p => p.status === 'not-filled').every(p => p.entryPrice === null && p.finalValue === 500)).toBe(true);
    expect(view().positions.map(p => p.shares)).toEqual(first.map(p => p.shares));
    expect(view().lock?.allocation.map(a => a.id)).toEqual(ids);
  });
  it('rejects future, mismatched, invalid price and missing quotes even if supplied', () => {
    const quote = syntheticQuote('SYN-01', 1)!;
    expect(fillBlock(quote, quote.id, quote.session, '2026-01-05T16:00:00Z')).toContain('禁止回填');
    expect(fillBlock({ ...quote, availableAt: 'bad' }, quote.id, quote.session, quote.availableAt)).toBeTruthy();
    expect(fillBlock(quote, 'SYN-02', quote.session, quote.availableAt)).toBeTruthy();
    expect(fillBlock(quote, quote.id, sessions[2], quote.availableAt)).toBeTruthy();
    expect(fillBlock({ ...quote, close: NaN }, quote.id, quote.session, quote.availableAt)).toContain('未知');
    expect(fillBlock(null, quote.id, quote.session, quote.availableAt)).toContain('未知');
  });
  it('records blocked maturity exits and unknown return; resolves later without backdating', () => {
    const { store, id, view } = locked(); advanceTo(store, id, 20);
    expect(view().pendingExit).toBe(4); expect(view().finalLiquidationReturnPct).toBeNull(); expect(view().status).toBe('pending-exit');
    expect(view().positions.find(p => p.id === 'SYN-09')?.exitPrice).toBeNull();
    advanceTo(store, id, 22); expect(view().complete).toBe(true); expect(view().finalLiquidationReturnPct).not.toBeNull();
    expect(view().positions.find(p => p.id === 'SYN-09')?.exitSession).toBe(sessions[22]);
    expect(view().positions.find(p => p.id === 'SYN-10')?.exitSession).toBe(sessions[20]);
    expect(() => store.advance(id, 22)).toThrow();
    expect(store.list()[0].events).toHaveLength(23);
  });
  it('uses configured entry price and bilateral costs, includes unfilled cash in denominator', () => {
    const noCost = locked({ ...defaultRules, costBps: 0 }), withCost = locked({ ...defaultRules, entryPrice: 'close', costBps: 20 });
    advanceTo(noCost.store, noCost.id, 22); advanceTo(withCost.store, withCost.id, 22);
    const p = withCost.view().positions[0];
    expect(p.entryPrice).toBeCloseTo(syntheticQuote(p.id, 1)!.close);
    expect(p.finalValue).toBeCloseTo(500 / (p.entryPrice! * 1.002) * p.exitPrice! * .998);
    expect(withCost.view().finalLiquidationReturnPct!).toBeLessThan(noCost.view().finalLiquidationReturnPct!);
    expect(withCost.view().finalLiquidationReturnPct).toBeCloseTo((withCost.view().positions.reduce((sum, p) => sum + p.finalValue!, 0) / 10000 - 1) * 100);
  });
  it('duplicate advancing from the same cursor is idempotent and future cursor is rejected', () => {
    const { store, id, view } = locked(); store.advance(id, 0); const before = store.export(); store.advance(id, 0);
    expect(store.export()).toBe(before); expect(view().cursor).toBe(1); expect(() => store.advance(id, 5)).toThrow();
  });
});
describe('strict backup replay and separation', () => {
  it('preview/cancel does not write; roundtrip retains snapshots and repeated imports are no-ops', () => {
    const { store, id } = locked(); advanceTo(store, id, 20); const text = store.export(), other = createSimulation();
    expect(other.previewImport(text).additions).toBe(1); expect(other.list()).toHaveLength(0);
    expect(other.import(text)).toBe(1); expect(other.export()).toBe(text); expect(other.import(text)).toBe(0);
    expect(other.list()).toEqual(store.list());
  });
  it('conflicting imports cannot rewrite locked rules or history and cannot partially import', () => {
    const { store } = locked(); const text = JSON.parse(store.export()); text.rounds[0].events[0].rules.costBps = 50;
    text.rounds.unshift({ ...text.rounds[0], id: 'SYN-ROUND-002' });
    const before = store.export(); expect(() => store.import(JSON.stringify(text))).toThrow(); expect(store.export()).toBe(before);
  });
  it.each(['scope', 'candidate', 'weight', 'duplicate', 'future-event', 'extra-price', 'rule-version', 'unconfirmed', 'date', 'duplicate-round', 'unsafe-key'])('rejects malformed %s backup without mutation', kind => {
    const { store } = locked(); const raw = JSON.parse(store.export()); const round = raw.rounds[0], event = round.events[0];
    if (kind === 'scope') raw.scope = 'formal';
    if (kind === 'candidate') round.candidates[0].id = 'REAL';
    if (kind === 'weight') event.allocation[0].weightBps = 1000;
    if (kind === 'duplicate') event.allocation[1].id = event.allocation[0].id;
    if (kind === 'future-event') round.events.push({ type: 'advance', sessionIndex: 20 });
    if (kind === 'extra-price') event.price = 99;
    if (kind === 'rule-version') event.rules.version = 'v2';
    if (kind === 'unconfirmed') event.rules.parametersConfirmed = false;
    if (kind === 'date') event.asOf = '2026-02-01T16:00:00Z';
    if (kind === 'duplicate-round') raw.rounds.push(round);
    if (kind === 'unsafe-key') Object.defineProperty(round, '__proto__', { value: { private: true }, enumerable: true });
    const destination = createSimulation(); expect(() => destination.import(JSON.stringify(raw))).toThrow(); expect(destination.list()).toHaveLength(0);
  });
  it('rejects oversized input and non-JSON; never accesses persistence or network', () => {
    const fetch = vi.fn(() => { throw Error('network prohibited'); }); vi.stubGlobal('fetch', fetch);
    const { store } = locked(); expect(() => store.import('x'.repeat(1000001))).toThrow(); expect(() => store.import('not json')).toThrow();
    expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
});

describe('audit remediation: global import invariant and daily model limits', () => {
  it('rejects two imported drafts into an empty store atomically, including preview', () => {
    const source = createSimulation(); source.create(); const raw = JSON.parse(source.export());
    raw.rounds.push({ ...raw.rounds[0], id: 'SYN-ROUND-002' });
    const target = createSimulation(), before = target.export();
    expect(() => target.previewImport(JSON.stringify(raw))).toThrow('最多一个未完成');
    expect(() => target.import(JSON.stringify(raw))).toThrow('最多一个未完成');
    expect(target.export()).toBe(before);
  });
  it.each(['draft', 'locked', 'pending-exit'])('rejects another active round alongside existing %s, with no partial skipped-round import', status => {
    const target = createSimulation(), round = target.create();
    if (status !== 'draft') target.lock(round.id, ids, defaultRules);
    if (status === 'pending-exit') advanceTo(target, round.id, 20);
    const source = createSimulation(); source.create(); const raw = JSON.parse(source.export());
    raw.rounds[0].id = 'SYN-ROUND-002'; raw.rounds.unshift({ ...raw.rounds[0], id: 'SYN-ROUND-003', events: [{ type: 'skip', reason: 'no-opportunity' }] });
    const before = target.export(); expect(() => target.import(JSON.stringify(raw))).toThrow('最多一个未完成'); expect(target.export()).toBe(before);
  });
  it('rechecks global invariant on commit after a successful preview becomes stale', () => {
    const source = createSimulation(); source.create(); const raw = JSON.parse(source.export()); raw.rounds[0].id = 'SYN-ROUND-002';
    const target = createSimulation(), text = JSON.stringify(raw); expect(target.previewImport(text).additions).toBe(1);
    target.create(); const before = target.export(); expect(() => target.import(text)).toThrow(); expect(target.export()).toBe(before);
  });
  it('permits terminal history plus one active round and duplicate imports', () => {
    const source = createSimulation(); const first = source.create(); source.skip(first.id); source.create();
    const target = createSimulation(); expect(target.import(source.export())).toBe(2); expect(target.import(source.export())).toBe(0);
  });
  it('distinguishes planned day20 from final liquidation on day22 without inventing a day20 return', () => {
    const { store, id, view } = locked(); advanceTo(store, id, 20);
    const day20 = store.list()[0]; expect(view().finalLiquidationReturnPct).toBeNull(); expect(view().finalExitSession).toBeNull(); expect(view().delaySessions).toBe(0);
    advanceTo(store, id, 22); expect(view().plannedExitSession).toBe(sessions[20]); expect(view().finalExitSession).toBe(sessions[22]); expect(view().delaySessions).toBe(2);
    expect(projectRound(day20).finalLiquidationReturnPct).toBeNull();
  });
  it('daily gate rejects same-day morning and only accepts daily bar at16:00; acceptance is not opening execution evidence', () => {
    const quote = syntheticQuote('SYN-01', 1)!;
    expect(fillBlock(quote, quote.id, quote.session, `${quote.session}T09:30:00Z`)).toBeTruthy();
    expect(fillBlock(quote, quote.id, quote.session, `${quote.session}T15:59:59Z`)).toBeTruthy();
    expect(fillBlock(quote, quote.id, quote.session, `${quote.session}T16:00:00Z`)).toBeNull();
    expect(fillBlock({ ...quote, close: NaN }, quote.id, quote.session, `${quote.session}T16:00:00Z`)).toBeTruthy();
  });
});
