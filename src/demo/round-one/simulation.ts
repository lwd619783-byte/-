import { z } from 'zod';
import { canonicalJson as canonical } from '../../../shared/canonical-json.mjs';

// Demo-only contract. All imported data is replayed against this finite synthetic universe.
// No account, market-data provider, browser persistence or formal-domain write dependency.
export const RULE_VERSION = 'synthetic-oversold-v1' as const;
export const candidates = Array.from({ length: 24 }, (_, i) => ({
  id: `SYN-${String(i + 1).padStart(2, '0')}`, name: `合成候选 ${String(i + 1).padStart(2, '0')}`,
  source: 'synthetic-only' as const, observedAt: '2026-01-05', reason: '人为构造的超跌观察样例，非真实推荐',
}));
export const sessions: string[] = [];
for (let date = new Date('2026-01-05T00:00:00Z'); sessions.length < 28; date.setUTCDate(date.getUTCDate() + 1)) {
  const day = date.toISOString().slice(0, 10);
  // Explicit synthetic exchange closure, not a certified real exchange calendar.
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && day !== '2026-01-19') sessions.push(day);
}
Object.freeze(sessions);
const rulesSchema = z.object({
  version: z.literal(RULE_VERSION), calendarVersion: z.literal('synthetic-sessions-v1'),
  entryPrice: z.enum(['open', 'close']), costBps: z.number().int().min(0).max(1000),
  dayCount: z.enum(['include-entry', 'exclude-entry']), holdingSessions: z.literal(20),
  parametersConfirmed: z.literal(true),
}).strict();
export type Rules = z.infer<typeof rulesSchema>;
export const defaultRules: Rules = { version: RULE_VERSION, calendarVersion: 'synthetic-sessions-v1', entryPrice: 'open', costBps: 10, dayCount: 'include-entry', holdingSessions: 20, parametersConfirmed: true };
const allocationSchema = z.object({ id: z.string().regex(/^SYN-\d{2}$/), weightBps: z.literal(500) }).strict();
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lock'), asOf: z.literal('2026-01-05T16:00:00Z'), rules: rulesSchema, allocation: z.array(allocationSchema).length(20) }).strict(),
  z.object({ type: z.literal('advance'), sessionIndex: z.number().int().min(1).max(sessions.length - 1) }).strict(),
  z.object({ type: z.literal('skip'), reason: z.literal('no-opportunity') }).strict(),
]);
const candidateSchema = z.object({ id: z.string(), name: z.string(), source: z.literal('synthetic-only'), observedAt: z.string(), reason: z.string() }).strict();
const roundSchema = z.object({ id: z.string().regex(/^SYN-ROUND-\d{3}$/), candidates: z.array(candidateSchema).length(24), events: z.array(eventSchema).max(28) }).strict();
const backupSchema = z.object({ schema: z.literal('synthetic-oversold-backup-v1'), scope: z.literal('synthetic-only'), rounds: z.array(roundSchema).max(50) }).strict();
export type Round = z.infer<typeof roundSchema>;
type Lock = Extract<Round['events'][number], { type: 'lock' }>;
export type Quote = { id: string; session: string; availableAt: string; open: number; close: number; status: 'tradable' | 'suspended' | 'limit-up' | 'limit-down' };
export type Position = { id: string; weightBps: 500; status: 'awaiting-entry' | 'not-filled' | 'holding' | 'pending-exit' | 'exited'; reason: string; entryPrice: number | null; exitPrice: number | null; shares: number | null; entrySession: string | null; exitSession: string | null; finalValue: number | null };
export const statusLabels: Record<Position['status'], string> = { 'awaiting-entry': '等待入场', 'not-filled': '未成交', holding: '模拟持有', 'pending-exit': '待退出', exited: '已模拟退出' };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
freeze(candidates); freeze(defaultRules);
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function requireCondition(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
export function syntheticQuote(id: string, index: number): Quote | null {
  requireCondition(candidates.some(c => c.id === id) && Number.isInteger(index) && index > 0 && index < sessions.length, '合成行情请求越界');
  if ((index === 1 && id === 'SYN-05') || ([20, 21].includes(index) && id === 'SYN-09')) return null;
  let status: Quote['status'] = 'tradable';
  if (index === 1) status = ({ 'SYN-02': 'suspended', 'SYN-03': 'limit-up', 'SYN-04': 'limit-down' } as Record<string, Quote['status']>)[id] ?? status;
  if ([20, 21].includes(index)) status = ({ 'SYN-01': 'suspended', 'SYN-07': 'limit-up', 'SYN-08': 'limit-down' } as Record<string, Quote['status']>)[id] ?? status;
  const open = 10 + Number(id.slice(4)) + index / 10;
  return { id, session: sessions[index], availableAt: `${sessions[index === 1 && id === 'SYN-06' ? 2 : index]}T16:00:00Z`, open, close: open + .2, status };
}
export function fillBlock(quote: Quote | null, id: string, session: string, asOf: string): string | null {
  if (!quote) return '缺失行情 · 未知';
  if (quote.id !== id || quote.session !== session || !Number.isFinite(Date.parse(quote.availableAt)) || !Number.isFinite(Date.parse(asOf)) || Date.parse(quote.availableAt) > Date.parse(asOf)) return '当时不可得行情 · 禁止回填';
  if (!Number.isFinite(quote.open) || quote.open <= 0 || !Number.isFinite(quote.close) || quote.close <= 0) return '无效价格 · 未知';
  return quote.status === 'tradable' ? null : ({ suspended: '停牌', 'limit-up': '涨停 · 无成交证明', 'limit-down': '跌停 · 无成交证明' })[quote.status];
}
export function tradingDaysElapsed(index: number, rules: Rules) { return Math.max(0, index - (rules.dayCount === 'exclude-entry' ? 1 : 0)); }
export function projectRound(round: Round) {
  const lock = round.events.find((event): event is Lock => event.type === 'lock');
  const skipped = round.events.some(event => event.type === 'skip');
  const advances = round.events.filter(event => event.type === 'advance');
  const cursor = advances.length;
  const positions: Position[] = (lock?.allocation ?? []).map(allocation => ({ ...allocation, status: 'awaiting-entry', reason: '锁定不是成交；下一合成交易日尝试一次', entryPrice: null, exitPrice: null, shares: null, entrySession: null, exitSession: null, finalValue: null }));
  if (lock) for (const event of advances) {
    const i = event.sessionIndex, session = sessions[i], asOf = `${session}T16:00:00Z`, cost = lock.rules.costBps / 10000;
    for (const position of positions) {
      const quote = syntheticQuote(position.id, i), blocked = fillBlock(quote, position.id, session, asOf);
      if (i === 1) {
        if (blocked) { position.status = 'not-filled'; position.reason = blocked; position.finalValue = 500; continue; }
        position.entryPrice = quote![lock.rules.entryPrice];
        position.shares = 500 / (position.entryPrice * (1 + cost));
        position.entrySession = session; position.status = 'holding'; position.reason = '合成成交假设 · 非真实成交';
      }
      if (tradingDaysElapsed(i, lock.rules) >= 20 && ['holding', 'pending-exit'].includes(position.status)) {
        if (blocked) { position.status = 'pending-exit'; position.reason = blocked; continue; }
        position.exitPrice = quote!.close; position.exitSession = session;
        position.finalValue = position.shares! * position.exitPrice * (1 - cost);
        position.status = 'exited'; position.reason = '合成到期退出 · 已计双边成本';
      }
    }
  }
  const elapsed = lock ? tradingDaysElapsed(cursor, lock.rules) : 0;
  const due = elapsed >= 20;
  const complete = due && positions.every(p => ['exited', 'not-filled'].includes(p.status));
  return { lock, cursor, asOf: sessions[cursor], elapsed, due, complete, positions,
    status: skipped ? 'skipped' : !lock ? 'draft' : complete ? 'completed' : due ? 'pending-exit' : 'locked',
    // Unfilled allocations remain cash, never redistributed. Until exits resolve, return is unknown.
    netReturnPct: complete ? (positions.reduce((sum, p) => sum + p.finalValue!, 0) / 10000 - 1) * 100 : null,
    pendingExit: positions.filter(p => p.status === 'pending-exit').length,
    unfilled: positions.filter(p => p.status === 'not-filled').length };
}
function validateRound(raw: unknown): Round {
  const round = roundSchema.parse(raw);
  requireCondition(canonical(round.candidates) === canonical(candidates), '只接受完整的固定合成候选快照');
  let locked = false, skipped = false, cursor = 0;
  for (const event of round.events) {
    if (event.type === 'lock') {
      requireCondition(!locked && !skipped && cursor === 0, '锁定快照不可回改或重复');
      requireCondition(new Set(event.allocation.map(a => a.id)).size === 20 && event.allocation.every(a => candidates.some(c => c.id === a.id)), '必须是20只唯一合成候选');
      requireCondition(event.allocation.reduce((sum, a) => sum + a.weightBps, 0) === 10000, '权重必须100%');
      locked = true;
    } else if (event.type === 'skip') {
      requireCondition(!locked && !skipped && cursor === 0, '仅未锁定轮次可记录无机会'); skipped = true;
    } else {
      requireCondition(locked && !skipped && event.sessionIndex === cursor + 1, '交易日必须逐日追加，禁止回填或跳日');
      requireCondition(!projectRound({ ...round, events: round.events.slice(0, cursor + 1) }).complete, '已完成轮次不能继续执行');
      cursor++;
    }
  }
  return freeze(round);
}
export function createSimulation() {
  let rounds: Round[] = [];
  const get = (id: string) => { const round = rounds.find(r => r.id === id); requireCondition(round, '轮次不存在'); return round; };
  const append = (id: string, event: Round['events'][number]) => {
    const next = validateRound({ ...get(id), events: [...get(id).events, event] });
    rounds = rounds.map(round => round.id === id ? next : round); return clone(next);
  };
  function prepareImport(text: string) {
    requireCondition(text.length <= 1000000, '备份过大');
    const parsed = backupSchema.parse(JSON.parse(text));
    const incoming = parsed.rounds.map(validateRound);
    requireCondition(new Set(incoming.map(r => r.id)).size === incoming.length, '备份轮次重复');
    const additions = incoming.filter(round => {
      const existing = rounds.find(r => r.id === round.id);
      if (!existing) return true;
      requireCondition(canonical(existing) === canonical(round), '同名轮次存在差异，禁止覆盖历史或锁定'); return false;
    });
    requireCondition(rounds.length + additions.length <= 50, '最多50轮合成演练');
    return { parsed, additions };
  }
  return {
    list: () => freeze(clone(rounds)),
    create() {
      requireCondition(rounds.every(r => ['completed', 'skipped'].includes(projectRound(r).status)), '请先完成或跳过当前轮次');
      requireCondition(rounds.length < 50, '最多50轮合成演练');
      let ordinal = 1; while (rounds.some(r => r.id === `SYN-ROUND-${String(ordinal).padStart(3, '0')}`)) ordinal++;
      const round = validateRound({ id: `SYN-ROUND-${String(ordinal).padStart(3, '0')}`, candidates: clone(candidates), events: [] });
      rounds = [...rounds, round]; return clone(round);
    },
    lock(id: string, ids: string[], rules: Rules) {
      return append(id, { type: 'lock', asOf: '2026-01-05T16:00:00Z', rules, allocation: ids.map(id => ({ id, weightBps: 500 })) });
    },
    skip(id: string) { return append(id, { type: 'skip', reason: 'no-opportunity' }); },
    advance(id: string, expectedCursor: number) {
      const round = get(id), view = projectRound(round);
      // Stale UI retries do not append another day.
      if (view.cursor > expectedCursor) return clone(round);
      requireCondition(view.cursor === expectedCursor && view.lock && !view.complete, '当前轮次不可推进');
      return append(id, { type: 'advance', sessionIndex: expectedCursor + 1 });
    },
    export() { return JSON.stringify({ schema: 'synthetic-oversold-backup-v1', scope: 'synthetic-only', rounds }, null, 2); },
    previewImport(text: string) { const { parsed, additions } = prepareImport(text); return { total: parsed.rounds.length, additions: additions.length, duplicates: parsed.rounds.length - additions.length }; },
    import(text: string) { const { additions } = prepareImport(text); rounds = [...rounds, ...additions]; return additions.length; },
  };
}
