import { useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Stock } from '../../types';
import type { IndustryMetricDataset } from '../../types/industryMetric';
import { freightCandidate, freightObservation, normalizeObservationSeries, observationChange, observationRelationship, observationStateLabels, observationStreak, observationWindow, observedCompanyCount, samplePerformance, shanghaiToday, stockObservation } from '../../services/industryObservation';
import { priceChartAudit, type ChartAuditView } from '../../services/chartAudit';
import { industryChartAudit } from '../../services/industryMetricProvider';
import { ChartAuditPanel } from '../charts/ChartAuditPanel';
import { chartColors, chartTickStyle, chartTooltipStyle } from '../charts/theme';
import { EvidenceDrawer } from '../research/EvidenceDrawer';
import './oil-observation.css';

const display = (n: number | null | undefined, suffix = '') => n == null ? '—' : `${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${suffix}`;
const percent = (n: number | null | undefined) => n == null ? '—' : `${n > 0 ? '+' : ''}${display(n)}%`;
const stateText = (states: string[]) => states.map(s => observationStateLabels[s] ?? s).join(' · ');
const colors = [chartColors.primary, chartColors.up, chartColors.secondary];
interface Props { stocks: Stock[]; onOpenStock: (stock: Stock) => void; onOpenMetrics: () => void }

/** Runtime has no authorized freight owner. Never substitute EIA or demo data. */
export function OilShippingObservation(props: Props) { return <OilShippingObservationContent {...props} asOf={shanghaiToday()} freightOwner={null} />; }

/** Explicit owner seam for isolated synthetic rendering; never an app import / URL override. */
export function OilShippingObservationContent({ stocks, onOpenStock, onOpenMetrics, asOf, freightOwner }: Props & { asOf: string; freightOwner: IndustryMetricDataset | null }) {
  const [days, setDays] = useState(90);
  const [selected, setSelected] = useState(() => stocks.slice(0, 3).map(s => s.id));
  const [sort, setSort] = useState<{ field: 'name' | 'one' | 'five' | 'twenty'; descending: boolean }>({ field: 'name', descending: false });
  const [evidence, setEvidence] = useState<ChartAuditView | null>(null);
  const window = observationWindow(asOf, days);
  const rows = stocks.map(stock => {
    const series = stockObservation(stock, asOf);
    const latest = series.points.filter(p => p.value !== null).at(-1);
    return { stock, series, latest, one: observationChange(series.points, 1), five: observationChange(series.points, 5), twenty: observationChange(series.points, 20) };
  });
  const chosen = rows.filter(row => selected.includes(row.stock.id));
  const companyCount = observedCompanyCount(chosen.map(row => row.stock));
  const freight = freightObservation(freightOwner, freightOwner?.definition.basis[0] ?? '', asOf);
  const freightPoints = freight.points.filter(p => p.date >= window.start && p.date <= window.end);
  const freightLatest = freight.points.filter(p => p.value !== null).at(-1);
  const normalized = normalizeObservationSeries(chosen.map(row => row.series), window.start, window.end);
  const chartRows = normalized.rows.map(row => ({ date: row.date, ...Object.fromEntries(row.values.map((value, i) => [`s${i}`, value])) }));
  const performance = [1, 5, 20].map(period => samplePerformance(chosen.map(row => row.series), period));
  const relationship = observationRelationship(freight, chosen.map(row => row.series), window.start, window.end);
  const streak = observationStreak(freight.points);
  const notices: string[] = [];
  if (!freightOwner) notices.push('核心运价尚未接入，关系判断受阻。');
  else if (freight.states.some(s => s !== 'real')) notices.push(`运价：${stateText(freight.states)}`);
  if (chosen.some(row => row.series.states.includes('stale'))) notices.push('股票留存数据超过 7 个自然日，请复核更新。');
  if (chosen.some(row => row.series.states.includes('conflicted'))) notices.push('股票存在同日冲突记录，冲突点不参与绘图。');
  if (!chosen.length || chosen.some(row => !row.latest)) notices.push('所选股票缺少可用历史。');
  else if (chosen.some(row => row.twenty === null)) notices.push('部分股票不足 21 个无缺口观测，20 期变化不可计算。');
  if (relationship.includes('偏弱')) notices.push('窗口内方向背离；仅为观察线索。');
  const blockedAudit: ChartAuditView = { title: 'CT1 运价 · 未接入', scope: freightCandidate.scope, quality: ['blocked'], records: [], linkage: null,
    rows: [{ label: '来源身份', value: '上海航运交易所 CTFI（候选，未接入）' }, { label: '官方来源', value: 'CTFI 公开查询', href: freightCandidate.sourceUrl }, { label: '使用边界', value: freightCandidate.reason }, { label: '单位 / 原生频率 / 口径', value: 'WS / 指数发布日 / 单一路线；具体版本待准入' }, { label: '数据准入', value: 'NOT_ADMITTED' }, { label: '生产准入', value: 'NOT_ADMITTED' }] };
  const freightAudit = freightOwner ? industryChartAudit(freightOwner, freightOwner.definition.basis[0]) : blockedAudit;
  const freightName = freightOwner?.definition.canonicalName ?? freightCandidate.name;
  const unit = freightOwner?.definition.unit ?? 'WS';
  const sorted = [...rows].sort((a, b) => {
    if (sort.field === 'name') return a.stock.name.localeCompare(b.stock.name, 'zh-CN') * (sort.descending ? -1 : 1);
    const av = a[sort.field], bv = b[sort.field];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return (av - bv) * (sort.descending ? -1 : 1);
  });
  const latestDates = [...new Set(chosen.flatMap(r => r.latest ? [r.latest.date] : []))].sort();
  const sortHeader = (field: typeof sort.field, label: string) => <th aria-sort={sort.field === field ? sort.descending ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => setSort({ field, descending: sort.field === field ? !sort.descending : true })}>{label} {sort.field === field ? sort.descending ? '↓' : '↑' : '↕'}</button></th>;
  return <section className="oil-observation" aria-label="油运动态观察">
    <div className="oil-scope">
      <div><h2 className="text-lg font-semibold text-textStrong">油运 · 动态观察</h2><p>{freightName} · {freightOwner?.definition.scope ?? freightCandidate.scope}</p></div>
      <label>比较窗口<select aria-label="动态观察时间窗口" value={days} onChange={e => setDays(Number(e.target.value))}>{[30, 90, 180].map(n => <option key={n} value={n}>近 {n} 个自然日</option>)}</select></label>
      <p className="oil-scope-detail">{window.start} — {window.end} · 股票范围：当前油运研究样本（{[...new Set(stocks.map(s => s.market))].join(' / ') || '暂无证券'}）<br />
        运价截至：{freightLatest?.date ?? '不可用'} · 股票截至：{latestDates.join(' / ') || '不可用'} · 数据状态：{!freightOwner ? '部分缺失 · 运价不可用' : stateText(freight.states)}{chosen.some(r => r.series.states.includes('stale')) ? ' · 股票过期' : ''}</p>
    </div>
    <div className="oil-summary-grid">
      <Summary title="运价变化" value={freightLatest ? `${display(freightLatest.value)} ${unit}` : '运价不可用'}>
        <p>{freightName} · 最新一期 {percent(observationChange(freight.points, 1))}</p>
        <p>5 / 20 有效观测期：{percent(observationChange(freight.points, 5))} / {percent(observationChange(freight.points, 20))}</p>
        <p>{freightLatest ? `连续${streak.direction > 0 ? '上涨' : streak.direction < 0 ? '下跌' : '无方向'} ${streak.count} 次有效观测` : '有效历史未接入；不生成趋势'}</p>
        <p>数据 {freightLatest?.date ?? '—'} · 发布 {freight.publication ?? '未知'}</p>
      </Summary>
      <Summary title="相关股票表现" value={`${companyCount === null ? '公司数待核对' : `${companyCount} 家公司`} · ${chosen.length} 个证券`}>
        <p>上涨 {display(performance[0].up)} / 下跌 {display(performance[0].down)} / 持平 {display(performance[0].flat)}（证券）</p>
        <p>1 / 5 / 20 期：{performance.map(p => percent(p.mean)).join(' / ')}</p>
        <p>同日起止样本等权变化 · 相对基准 —</p>
        <p>有效已收盘观测；基准未接入</p>
      </Summary>
      <Summary title="运价—股价关系" value={relationship}>
        <p>近 {days} 自然日 · 同一起止日比较</p><p>数据缺失、过期、口径未知时不判断</p><p>同向只表示窗口同步，不证明因果或基本面确认。</p>
      </Summary>
      <Summary title="当前需要关注" value={notices.length ? `${notices.length} 项待关注` : '暂无新增触发'}>
        {notices.slice(0, 3).map(note => <p key={note}>{note}</p>)}<p>当前状态提示，未建立新增触发追踪。</p>
      </Summary>
    </div>
    <p className="oil-data-notice">价格为原来源 close 留存值，复权口径未确认；不作为总回报。1 / 5 / 20 期需要 2 / 6 / 21 个有效已收盘观测，交易日连续覆盖未证明。跨市场缺日不插值；本版海外市场未接入。所有数值均非实时。</p>
    <div className="oil-chart-grid">
      <ObservationChart title="运价趋势" description={`${freightName} · ${unit}`} audit={freightAudit} onEvidence={() => setEvidence(freightAudit)}
        table={<table><thead><tr><th>观测日期</th><th>{unit}</th></tr></thead><tbody>{freightPoints.map(p => <tr key={p.date}><td>{p.date}</td><td>{display(p.value)}</td></tr>)}</tbody></table>}>
        {freightPoints.some(p => p.value !== null) ? <Trend data={freightPoints} lines={[{ key: 'value', name: freightName, color: colors[0] }]} unit={unit} /> : <div className="oil-chart-empty"><strong>运价来源待接入</strong><p>{freightCandidate.reason}</p><a href={freightCandidate.sourceUrl} target="_blank" rel="noreferrer">查看官方运价</a><a href={freightCandidate.licenseUrl} target="_blank" rel="noreferrer">查看使用授权说明</a></div>}
      </ObservationChart>
      <ObservationChart title="相关股票表现 · 基期 100" description={normalized.base ? `共同基日 ${normalized.base} · 原价格口径未确认` : '共同基日不足，无法归一'}
        audit={null} onEvidence={null} table={<table><caption>归一值 / 原 close；原价格复权口径未确认</caption><thead><tr><th>日期</th>{chosen.map(r => <th key={r.stock.id}>{r.stock.name} · 100 / close</th>)}</tr></thead><tbody>{normalized.rows.map(r => <tr key={r.date}><td>{r.date}</td>{r.values.map((v, i) => <td key={i}>{display(v)} / {display(chosen[i].series.points.find(p => p.date === r.date)?.value)}</td>)}</tr>)}</tbody></table>}>
        {normalized.rows.length > 1 ? <Trend data={chartRows} lines={chosen.map((r, i) => ({ key: `s${i}`, name: `${r.stock.name} ${r.stock.code}`, color: colors[i % colors.length] }))} unit="（基期100）" /> : <div className="oil-chart-empty"><strong>股票历史不足</strong><p>请在下方选择有共同基日的证券；缺失日期不填充。</p></div>}
        <div className="oil-chart-legend">{chosen.map((r, i) => <span key={r.stock.id} style={{ color: colors[i % colors.length] }}>{r.stock.name}</span>)}<span>比较基准：未接入</span></div>
      </ObservationChart>
    </div>
    <section className="oil-table-panel" aria-label="油运公司比较表">
      <h3 className="font-semibold text-textStrong">公司比较 <span className="text-xs font-normal text-textMuted">勾选证券对照走势 · 点击公司进入详情</span></h3>
      <div className="oil-table-scroll" role="region" aria-label="公司表可横向滚动" tabIndex={0}><table><thead><tr><th>图表</th>{sortHeader('name', '公司 / 代码')}<th>业务关联</th><th>最新有效收盘价</th>{sortHeader('one', '1期')}{sortHeader('five', '5期')}{sortHeader('twenty', '20期')}<th>相对基准</th><th>数据时点 / 状态</th><th>来源</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.stock.id}><td><input type="checkbox" aria-label={`对照${row.stock.name}`} checked={selected.includes(row.stock.id)} onChange={e => setSelected(current => e.target.checked ? [...current, row.stock.id] : current.filter(id => id !== row.stock.id))} /></td>
          <td><button className="text-accent" type="button" onClick={() => onOpenStock(row.stock)}>{row.stock.name}</button><small>{row.stock.code} · {row.stock.market}</small></td><td className="oil-business">{row.stock.chainPosition}<small>研究池关联，非纯油运收入占比</small></td><td>{display(row.latest?.value)}<small>{row.stock.market === 'A股' ? '元 · 复权未确认' : '口径未接入'}</small></td>
          <td>{percent(row.one)}</td><td>{percent(row.five)}</td><td>{percent(row.twenty)}</td><td>—<small>基准未接入</small></td><td>{row.latest?.date ?? '—'}<small>{stateText(row.series.states)}</small></td><td><button className="text-accent" type="button" onClick={() => setEvidence(priceChartAudit(row.stock, row.stock.priceHistory ?? []))}>来源与证据</button></td></tr>)}
        {!rows.length ? <tr><td colSpan={10}>当前研究池暂无证券</td></tr> : null}
      </tbody></table></div>
      <details className="mt-2 text-xs"><summary className="cursor-pointer text-accent">股票图表来源与计算口径</summary><p className="mt-2">归一值 = 原 close / 共同基日 close × 100；各日期并集缺值断线。盘中采集当日及之后记录排除。表格收益以每只证券最新留存日期计算，图表使用所选自然日期窗口；最新日期不同不聚合均值。暂无宽基 owner，相对基准不计算。</p>{chosen.map(row => <ChartAuditPanel key={row.stock.id} audit={priceChartAudit(row.stock, row.stock.priceHistory ?? [])} />)}</details>
    </section>
    <div className="oil-secondary"><div><h3 className="font-semibold">辅助基本面与研究复核</h3><p>EIA 库存、产量、出口、炼厂投入为周频辅助变量，不是油运运价。事件、信号、Claim 与证据沿用原入口。</p></div><button type="button" className="inbox-action" onClick={onOpenMetrics}>查看指标、事件与证据</button></div>
    {evidence ? <EvidenceDrawer audit={evidence} onClose={() => setEvidence(null)} /> : null}
  </section>;
}
function Summary({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return <article className="oil-summary"><h3>{title}</h3><strong>{value}</strong><div>{children}</div></article>;
}
function ObservationChart({ title, description, children, audit, onEvidence, table }: { title: string; description: string; children: ReactNode; audit: ChartAuditView | null; onEvidence: (() => void) | null; table: ReactNode }) {
  return <section className="oil-chart-panel" aria-label={title}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-textStrong">{title}</h3>{onEvidence ? <button className="text-xs text-accent" type="button" onClick={onEvidence}>来源与证据</button> : null}</div><p className="mb-2 mt-1 text-xs text-textMuted">{description}</p>{children}
    <details className="mt-2 text-xs"><summary className="cursor-pointer text-accent">查看原始数据表</summary><div className="oil-table-scroll max-h-64">{table}</div></details>{audit ? <ChartAuditPanel audit={audit} /> : null}</section>;
}
function Trend({ data, lines, unit }: { data: Array<{ date: string }>; lines: { key: string; name: string; color: string }[]; unit: string }) {
  return <div className="oil-trend" role="img" aria-label={`时间序列折线图，单位${unit}，缺失不连接`}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} syncId="oil-observation" syncMethod="value" margin={{ top: 12, right: 12, left: -14, bottom: 0 }}><CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" /><XAxis dataKey="date" tick={chartTickStyle} minTickGap={30} tickFormatter={date => String(date).slice(5)} /><YAxis tick={chartTickStyle} width={60} domain={['auto', 'auto']} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number, name: string) => [`${display(value)} ${unit}`, name]} />{lines.map(line => <Line key={line.key} dataKey={line.key} name={line.name} stroke={line.color} type="linear" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div>;
}
