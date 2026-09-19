const chartNumericValue = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const orderedStates = values => [...new Set(values.map(value => value || "unknown"))].sort();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function months(start, end) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(end) || start > end) return [];
  const result = [];
  for (let cursor = start; cursor <= end && result.length < 1200;) {
    result.push(cursor);
    const [year, month] = cursor.split('-').map(Number);
    cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  return result;
}
function periods(d) {
  if (d.nativeFrequency === 'monthly') return months(d.window.start, d.window.end);
  if (d.nativeFrequency !== 'weekly') return [];
  const { start, end } = d.window;
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(start) || !valid(end) || start > end) return [];
  const step = 7 * 86400000, count = (Date.parse(end) - Date.parse(start)) / step + 1;
  if (!Number.isInteger(count) || count > 1200) return [];
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * step).toISOString().slice(0, 10));
}
function belongs(o, owner) {
  const d = owner.definition;
  return o.metricId === d.id && o.industryId === d.industryId && o.geography === d.geography && o.scope === d.scope
    && o.unit === d.unit && o.frequency === d.nativeFrequency && d.basis.includes(o.basis)
    && o.provenance.sourceId === d.sourceId && o.provenance.sourceOwner === d.sourceOwner
    && o.provenance.acquisitionAdapter === d.acquisitionAdapter
    && ((d.nativeFrequency === 'monthly' && ['monthly', 'year_to_date'].includes(o.basis)) || (d.nativeFrequency === 'weekly' && o.basis === 'week_ending'))
    && o.referencePeriod.end === o.valueDate && o.referencePeriod.start === (o.basis === 'year_to_date' ? `${o.valueDate.slice(0, 4)}-01` : o.valueDate)
    && periods(d).includes(o.valueDate);
}
/** Diagnostic display only. This never returns an F1 eligible value or a PIT vintage. */
export function industryHistory(owner, basis) {
  const rejected = owner.observations.filter(o => !belongs(o, owner));
  const idCounts = new Map();
  for (const o of owner.observations) idCounts.set(o.id, (idCounts.get(o.id) ?? 0) + 1);
  const history = periods(owner.definition).map(period => {
    const records = owner.observations.filter(o => belongs(o, owner) && o.basis === basis && o.valueDate === period)
      .sort((a, b) => compare(a.id, b.id) || compare(JSON.stringify(a), JSON.stringify(b)));
    // Unknown revision chain: retain every record; do not choose by arrival/acquisition time.
    const conflicted = rejected.length > 0 || records.length > 1 || records.some(o => idCounts.get(o.id) > 1 || o.conditions.includes('conflicted') || o.quality.status === 'conflicted');
    const value = !conflicted && records.length === 1 ? chartNumericValue(records[0].value) : null;
    const states = orderedStates([
      ...records.flatMap(o => [o.quality.status, ...o.conditions, ...(o.pit !== 'PROVEN' || o.revision.status === 'unknown' ? ['unknown'] : []),
        ...(o.dataAdmission !== 'ADMITTED' || o.productionAdmission !== 'ADMITTED' ? ['not_admitted'] : [])]),
      ...(!records.length || value === null ? ['missing'] : []), ...(conflicted ? ['conflicted'] : []),
    ]);
    return { period, value, records, states };
  });
  const available = history.filter(p => p.value !== null).length;
  const states = orderedStates([...history.flatMap(p => p.states), owner.definition.freshness,
    ...(available < history.length ? ['partial'] : []), ...(!available ? ['missing'] : []),
    ...(owner.policy.dataAdmission !== 'ADMITTED' || owner.policy.productionAdmission !== 'ADMITTED' ? ['not_admitted'] : [])]);
  const latest = history.at(-1) ?? null, previous = history.at(-2) ?? null;
  const delta = owner.definition.unit !== '%' && basis === 'monthly' && latest?.value !== null && latest?.value !== undefined && previous?.value !== null && previous?.value !== undefined
    && latest.period.slice(0, 4) === previous.period.slice(0, 4) ? latest.value - previous.value : null;
  return { history, latest, previous, delta, states, available, target: history.length, rejectedCount: rejected.length };
}
