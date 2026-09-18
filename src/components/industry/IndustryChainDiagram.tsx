import { statusDisplayLabel } from '../../utils/displayLabels';
import { useId } from 'react';
import type { Industry, IndustrySegment, Stock } from '../../types';
import { roboticsPrivateCompanies } from '../../data/privateCompanies';
import { industryChainTopology, industryCompanyOverlay } from '../../services/industryChain';
import type { ChainCompany } from '../../services/industryChain';
import { formatYi } from '../../utils/normalize';
import { getSymbolMapping } from '../../utils/symbol';
import { officialListingContext } from '../../services/listingIdentity';
import { industrySegmentResearch } from '../../data/industryChainResearch';
import { IndustrySegmentMap } from './IndustrySegmentMap';
import './industry-chain.css';

type Props = { industry: Industry; stocks: Stock[]; onOpenStock: (stock: Stock) => void; onSelectSegment: (segmentId: string) => void };
type Placement = NonNullable<ReturnType<typeof industryChainTopology>>['nodes'][number]['companies'][number];

export function IndustryChainDiagram({ industry, stocks, onOpenStock, onSelectSegment }: Props) {
  const prefix = `industry-chain-${useId().replace(/:/g, '')}`;
  const companies: ChainCompany[] = [...stocks, ...roboticsPrivateCompanies.filter(c => c.industryId === industry.id)];
  const topology = industryChainTopology(industry, companies);
  const segmentGraph = industrySegmentResearch(industry);
  const stockById = new Map(stocks.filter(s => s.industryId === industry.id).map(s => [s.id, s]));
  return <section className="industry-chain" aria-label="产业链图">
    <header className="chain-heading">
      <div><p className="chain-eyebrow">行业 / 产业结构</p><h2>{industry.name}产业链全景</h2><p>看清细分方向与阶段衔接，点击节点展开详情。</p></div>
    </header>
    {!topology || (industry.id === 'robotics' && !segmentGraph) ? <p role="status">结构数据暂不可用：结构或关系依据缺失、已变化，未生成图。</p> : <>
      {segmentGraph ? <IndustrySegmentMap graph={segmentGraph} renderSegment={(segment, stage) => {
        // Deduplicate company attachments without changing their retained research positions.
        const all = topology.nodes.flatMap(n => n.companies).filter(p => p.segment?.id === segment.id);
        const placements = all.filter((p,i) => all.findIndex(other => other.company.id === p.company.id) === i).map(p => ({ ...p, matchedItems:[...new Set(all.filter(other => other.company.id === p.company.id).flatMap(other => other.matchedItems))] }));
        return <SegmentNode segment={segment} placements={placements} stage={stage} relationLabel={segmentGraph.edges.filter(e => e.from === segment.id).map(e => e.label).join(' / ')} stockById={stockById} onOpenStock={onOpenStock} onSelectSegment={onSelectSegment} />;
      }} /> : <div className="chain-canvas" aria-label="上中下游研究结构">
        {topology.nodes.map((node, index) => {
          // Group already-positioned companies by exact segment, retaining research pool order.
          const groups = industry.segments.filter(s => s.industryId === industry.id).map(segment => ({ segment, placements: node.companies.filter(p => p.segment?.id === segment.id) })).filter(g => g.placements.length);
          const unresolvedSegment = node.companies.filter(p => !p.segment);
          return <section key={node.stage} data-chain-stage={node.stage} className="chain-stage" aria-labelledby={`${prefix}-stage-${index}`}>
            <header className="chain-stage-header"><span className="chain-stage-index">{String(index + 1).padStart(2, '0')}</span><div><p className="chain-stage-code">{{ 上游: '上游环节', 中游: '中游环节', 下游: '下游环节' }[node.stage]}</p><h3 id={`${prefix}-stage-${index}`}>{node.stage}</h3>{industry.id === 'robotics' && <p>{{ 上游: '核心零部件', 中游: '模组与系统集成', 下游: '整机与应用场景' }[node.stage]}</p>}</div></header>
            <div className="chain-segment-grid">{groups.map(({ segment, placements }) => <SegmentNode key={segment.id} segment={segment} placements={placements} stage={node.stage} stockById={stockById} onOpenStock={onOpenStock} onSelectSegment={onSelectSegment} />)}
            {unresolvedSegment.length > 0 && <p className="chain-empty">细分归属暂不可用：{unresolvedSegment.map(p => p.company.name).join('、')}，未生成细分节点。</p>}
            {!node.companies.length && <p className="chain-empty">该阶段暂无可从既有位置文字精确挂接的公司。</p>}
            </div>
            <details className="chain-structure-items"><summary>阶段构成</summary><ul>{node.items.map(item => <li key={item}>{item}</li>)}</ul></details>
          </section>;
        })}
      </div>}
      <div className="chain-legend"><p>箭头说明细分功能关系，虚线为能力迁移方向；不表示直接供货、收入权重或资金流向。</p></div>
      {topology.unpositioned.length > 0 && <details className="chain-unpositioned"><summary>位置待映射</summary><p>未自动分配阶段。原位置文字未匹配图中条目，保留细分归属与原文。</p><div className="chain-unresolved-grid">{topology.unpositioned.map(company => <article key={company.id}><CompanyLabel company={company} stock={stockById.get(company.id)} onOpenStock={onOpenStock} /><p>{industry.segments.find(s => s.id === company.segmentId && s.industryId === industry.id)?.name ?? '细分未确认'}</p><p>{company.chainPosition || '位置未确认'}</p><p>研究验证：{statusDisplayLabel(company.verificationStatus ?? 'unknown')}</p></article>)}</div></details>}
      {topology.conflictedIds.length > 0 && <p>公司身份冲突：{topology.conflictedIds.join('、')}，未挂接。</p>}
    </>}
    <footer><details><summary>图谱说明</summary><p>研究结构：既有产业链、公司位置与细分归属；细分按主要功能展示一次，公司跨环节业务保留在原研究位置中。代表公司按研究池原始顺序选取，非投资排序。覆盖分母为节点内全部公司，含缺失与未上市；有留存不等于完整、最新或已准入。刷新不改变研究结构，也不提升研究资料的验证等级。来源数据与研究结构分别呈现。</p></details></footer>
  </section>;
}

function SegmentNode({ segment, placements, stage, relationLabel, stockById, onOpenStock, onSelectSegment }: { segment: IndustrySegment; placements: Placement[]; stage: string; relationLabel?: string; stockById: Map<string, Stock>; onOpenStock: Props['onOpenStock']; onSelectSegment: Props['onSelectSegment'] }) {
  // The full placement cohort is the denominator, including unavailable owners.
  const facts = placements.map(p => { const stock = stockById.get(p.company.id); return stock ? industryCompanyOverlay(stock) : null; });
  const count = (key: 'quoteUpdatedAt' | 'reportPeriod' | 'announcementDate') => facts.filter(f => f?.[key] != null).length;
  const statusCounts = (key: 'quoteStatus' | 'financialStatus' | 'announcementStatus') => [...new Set(facts.map(f => f?.[key] ?? 'unavailable'))].map(status => `${statusDisplayLabel(status)} ${facts.filter(f => (f?.[key] ?? 'unavailable') === status).length}`).join(' / ');
  const researchStates = [...new Set(placements.map(p => p.company.verificationStatus ?? 'unknown'))].map(statusDisplayLabel).join(' / ');
  const latestPeriod = facts.flatMap(f => f?.reportPeriod ? [f.reportPeriod] : []).sort().at(-1);
  return <section className="chain-segment" data-chain-group={segment.id} data-chain-node="segment" aria-label={`${stage} · ${segment.name}`}>
    <details className="chain-segment-detail"><summary aria-label={`${stage}${segment.name}展开详情`}><span><h4>{segment.name}</h4>{relationLabel && <span className="chain-node-relation-label">{relationLabel}</span>}</span><span className="chain-expand-icon" aria-hidden="true">⌄</span></summary>
    <div className="chain-research-coverage"><p className="chain-group-kicker">研究背景</p><p className="chain-full-logic">{segment.logic}</p><button type="button" className="chain-segment-link" data-chain-segment={segment.id} onClick={() => onSelectSegment(segment.id)}>进入细分研究 ↗</button><p className="chain-coverage-label">研究覆盖 {placements.length} 家 <span>{researchStates}</span></p></div>
    <div className="chain-provider-summary"><p className="chain-group-kicker">来源数据 / 有留存</p><dl>
      <div><dt>行情 {count('quoteUpdatedAt')}/{placements.length}</dt><dd>{statusCounts('quoteStatus')}</dd></div>
      <div><dt>财务 {count('reportPeriod')}/{placements.length}</dt><dd>{statusCounts('financialStatus')}</dd></div>
      <div><dt>公告 {count('announcementDate')}/{placements.length}</dt><dd>{statusCounts('announcementStatus')}</dd></div>
    </dl><p className="chain-latest-period">最新报告期 <span>{latestPeriod ?? '未确认'}</span></p></div>
    <div className="chain-company-list">{placements.map(({ company, matchedItems }) => <CompanyNode key={company.id} company={company} matchedItems={matchedItems} stock={stockById.get(company.id)} onOpenStock={onOpenStock} />)}</div></details>
  </section>;
}

function companySecurity(company: ChainCompany, stock?: Stock) {
  const mapping = stock ? getSymbolMapping(stock.id) : undefined;
  const mappedCode = mapping?.standardSymbol.split('.')[0];
  const sameCode = stock?.market === '港股' ? mappedCode?.padStart(5, '0') === stock.code.padStart(5, '0') : mappedCode === stock?.code;
  return mapping && mapping.name === company.name && mapping.market === stock?.market && sameCode ? mapping.standardSymbol : company.code ?? '证券代码暂不可用';
}

function CompanyLabel({ company, stock, onOpenStock }: { company: ChainCompany; stock?: Stock; onOpenStock: Props['onOpenStock'] }) {
  return stock ? <button type="button" className="chain-company-name" data-stock-id={stock.id} onClick={() => onOpenStock(stock)}>{company.name}<span aria-hidden="true">↗</span></button> : <strong className="chain-company-name">{company.name}</strong>;
}

function CompanyNode({ company, stock, matchedItems, onOpenStock }: { company: ChainCompany; stock?: Stock; matchedItems: string[]; onOpenStock: Props['onOpenStock'] }) {
  const fact = stock ? industryCompanyOverlay(stock) : null;
  const listing = officialListingContext(company);
  const symbol = companySecurity(company, stock);
  const condition = (status?: string) => status && !['real', 'generated_real'].includes(status) ? ` · ${statusDisplayLabel(status)}` : '';
  return <article className="chain-company" data-chain-company={company.id}>
    <div className="chain-node-heading"><CompanyLabel company={company} stock={stock} onOpenStock={onOpenStock} /><span className="chain-verification" title="原研究资料的验证状态，非 Provider admission">{statusDisplayLabel(company.verificationStatus ?? 'unknown')}</span></div>
    <p className="chain-security">{symbol} · {company.market}{listing ? ` / ${listing.board}` : ''}</p>
    <div className="chain-compact-fact"><span>市值</span><strong>{fact?.marketCap != null ? formatYi(fact.marketCap) : '暂缺'}</strong><span>{fact?.marketCap != null ? stock?.market === '港股' ? '港元' : '人民币' : ''} · {statusDisplayLabel(fact?.quoteStatus ?? 'unavailable')}</span></div>
    <details className="chain-node-detail"><summary aria-label={`${company.name}数据与研究位置`}><span className="chain-periods">财报 {fact?.reportPeriod?.slice(0, 7) ?? '未确认'}{condition(fact?.financialStatus)}<br />公告 {statusDisplayLabel(fact?.announcementStatus ?? 'unavailable')}</span><span aria-hidden="true">＋</span></summary>
      <div className="chain-context"><p className="chain-group-kicker">研究背景</p><p>研究位置：{company.chainPosition}</p><p>挂接依据：{matchedItems.join('、') || company.chainPosition}</p></div>
      {listing && <p className="chain-listing-source">上市身份 · <a href={listing.sourceUrl} target="_blank" rel="noreferrer">{listing.sourceName}正式披露 ↗</a><br />{listing.legalName} · {listing.listingDate} 上市</p>}
      {stock ? <CompanyFacts stock={stock} /> : <p>未上市研究线索 · 来源数据暂不可用</p>}
    </details>
  </article>;
}

function CompanyFacts({ stock }: { stock: Stock }) {
  const fact = industryCompanyOverlay(stock);
  return <div className="chain-facts"><p className="chain-group-kicker">来源数据</p><dl>
    <div><dt>行情来源标注时点</dt><dd>{fact.quoteAsOf ?? '未确认（原数据源未留存）'}</dd></div>
    <div><dt>行情获取 / 更新时间</dt><dd>{fact.quoteUpdatedAt ?? '未确认'} · {statusDisplayLabel(fact.quoteStatus)}</dd></div>
    <div><dt>市值</dt><dd>{fact.marketCap === null ? '暂缺' : `${formatYi(fact.marketCap)} ${stock.market === 'A股' ? '人民币' : stock.market === '港股' ? '港元' : '原币'}`} · {fact.quoteSource ?? '暂不可用'}</dd></div>
    <div><dt>最新留存报告期</dt><dd>{fact.reportPeriod ?? '未确认'} · {statusDisplayLabel(fact.financialStatus)} · {fact.financialSource ?? '暂不可用'}</dd></div>
    <div><dt>最新留存公告</dt><dd>{fact.announcementDate ?? '未确认'} · {statusDisplayLabel(fact.announcementStatus)} · {fact.announcementSource ?? '暂不可用'}</dd></div>
  </dl></div>;
}
