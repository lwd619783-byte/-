import { useId } from 'react';
import type { Industry, IndustrySegment, Stock } from '../../types';
import { roboticsPrivateCompanies } from '../../data/privateCompanies';
import { industryChainTopology, industryCompanyOverlay } from '../../services/industryChain';
import type { ChainCompany } from '../../services/industryChain';
import { formatYi } from '../../utils/normalize';
import { getSymbolMapping } from '../../utils/symbol';
import { officialListingContext } from '../../services/listingIdentity';
import './industry-chain.css';

type Props = { industry: Industry; stocks: Stock[]; onOpenStock: (stock: Stock) => void; onSelectSegment: (segmentId: string) => void };
type Placement = NonNullable<ReturnType<typeof industryChainTopology>>['nodes'][number]['companies'][number];

export function IndustryChainDiagram({ industry, stocks, onOpenStock, onSelectSegment }: Props) {
  const prefix = `industry-chain-${useId().replace(/:/g, '')}`;
  const companies: ChainCompany[] = [...stocks, ...roboticsPrivateCompanies.filter(c => c.industryId === industry.id)];
  const topology = industryChainTopology(industry, companies);
  const stockById = new Map(stocks.filter(s => s.industryId === industry.id).map(s => [s.id, s]));
  const segmentNodeCount = topology?.nodes.reduce((count, node) => count + new Set(node.companies.flatMap(p => p.segment ? [p.segment.id] : [])).size, 0);
  return <section className="industry-chain" aria-label="产业链图">
    <header className="chain-heading">
      <div><p className="chain-eyebrow">INDUSTRY / STRUCTURE MAP</p><h2>{industry.name}产业链全景</h2><p>产业阶段 → 细分环节 → 代表公司与数据覆盖</p></div>
      {topology && <dl className="chain-counts"><div><dt>Stage Groups</dt><dd>{topology.nodes.length}</dd></div><div><dt>Segment Nodes</dt><dd>{segmentNodeCount}</dd></div><div><dt>研究池公司</dt><dd>{new Set(companies.filter(c => c.industryId === industry.id).map(c => c.id)).size}</dd></div></dl>}
    </header>
    {!topology ? <p role="status">结构数据 unavailable：没有可用的既有产业链，未生成图。</p> : <>
      <div className="chain-canvas" aria-label="上中下游研究结构">
        {topology.nodes.map((node, index) => {
          // Group already-positioned companies by exact segment, retaining research pool order.
          const groups = industry.segments.filter(s => s.industryId === industry.id).map(segment => ({ segment, placements: node.companies.filter(p => p.segment?.id === segment.id) })).filter(g => g.placements.length);
          const unresolvedSegment = node.companies.filter(p => !p.segment);
          return <section key={node.stage} data-chain-stage={node.stage} className="chain-stage" aria-labelledby={`${prefix}-stage-${index}`}>
            <header className="chain-stage-header"><span className="chain-stage-index">{String(index + 1).padStart(2, '0')}</span><div><p className="chain-stage-code">{{ 上游: 'UPSTREAM', 中游: 'MIDSTREAM', 下游: 'DOWNSTREAM' }[node.stage]}</p><h3 id={`${prefix}-stage-${index}`}>{node.stage}</h3><p>{groups.length} 个细分节点 · {node.companies.length} 次公司挂接</p></div>{index < topology.nodes.length - 1 && <span className="chain-flow-arrow" aria-hidden="true" />}</header>
            <div className="chain-segment-grid">{groups.map(({ segment, placements }) => <SegmentNode key={segment.id} segment={segment} placements={placements} stage={node.stage} stockById={stockById} onOpenStock={onOpenStock} onSelectSegment={onSelectSegment} />)}
            {unresolvedSegment.length > 0 && <p className="chain-empty">细分 identity unavailable：{unresolvedSegment.map(p => p.company.name).join('、')}，未生成细分节点。</p>}
            {!node.companies.length && <p className="chain-empty">该阶段暂无可从既有位置文字精确挂接的公司。</p>}
            </div>
            <div className="chain-structure-items"><p className="chain-group-kicker">原始结构条目</p><ul>{node.items.map(item => <li key={item}>{item}</li>)}</ul></div>
          </section>;
        })}
      </div>
      <div className="chain-legend"><span><i aria-hidden="true" />Structure / Research Context · 分组、节点与位置</span><span><i aria-hidden="true" />Provider Fact · 节点内独立数据覆盖</span><p>箭头只表示产业结构阅读方向；不表示直接供货、收入权重或资金流向。</p></div>
      {topology.unpositioned.length > 0 && <details className="chain-unpositioned"><summary>位置待映射 <span>{topology.unpositioned.length} 家 · UNRESOLVED RESEARCH CONTEXT</span></summary><p>未自动分配 stage。原位置文字未匹配图中条目，保留细分归属与原文。</p><div className="chain-unresolved-grid">{topology.unpositioned.map(company => <article key={company.id}><CompanyLabel company={company} stock={stockById.get(company.id)} onOpenStock={onOpenStock} /><p>{industry.segments.find(s => s.id === company.segmentId && s.industryId === industry.id)?.name ?? '细分 unknown'}</p><p>{company.chainPosition || '位置 unknown'}</p><p>研究验证：{company.verificationStatus ?? 'unknown'}</p></article>)}</div></details>}
      {topology.conflictedIds.length > 0 && <p>公司 identity conflicted：{topology.conflictedIds.join('、')}，未挂接。</p>}
    </>}
    <footer>Structure：既有 Industry.chain / company.chainPosition / segmentId；跨环节公司在相应阶段重复展示。代表公司按研究池原始顺序选取，非投资排序。覆盖分母为节点内全部公司，含缺失与未上市；有留存不等于完整、最新或已准入。刷新不改变 topology，也不提升研究资料的验证等级。</footer>
  </section>;
}

function SegmentNode({ segment, placements, stage, stockById, onOpenStock, onSelectSegment }: { segment: IndustrySegment; placements: Placement[]; stage: string; stockById: Map<string, Stock>; onOpenStock: Props['onOpenStock']; onSelectSegment: Props['onSelectSegment'] }) {
  // The full placement cohort is the denominator, including unavailable owners.
  const facts = placements.map(p => { const stock = stockById.get(p.company.id); return stock ? industryCompanyOverlay(stock) : null; });
  const count = (key: 'quoteUpdatedAt' | 'reportPeriod' | 'announcementDate') => facts.filter(f => f?.[key] != null).length;
  const statusCounts = (key: 'quoteStatus' | 'financialStatus' | 'announcementStatus') => [...new Set(facts.map(f => f?.[key] ?? 'unavailable'))].map(status => `${status} ${facts.filter(f => (f?.[key] ?? 'unavailable') === status).length}`).join(' / ');
  const researchStates = [...new Set(placements.map(p => p.company.verificationStatus ?? 'unknown'))].join(' / ');
  const latestPeriod = facts.flatMap(f => f?.reportPeriod ? [f.reportPeriod] : []).sort().at(-1);
  return <section className="chain-segment" data-chain-group={segment.id} data-chain-node="segment" aria-label={`${stage} · ${segment.name}`}>
    <header><p className="chain-group-kicker">{stage} / RESEARCH CONTEXT</p><h4><button type="button" data-chain-segment={segment.id} onClick={() => onSelectSegment(segment.id)}>{segment.name}<span aria-hidden="true">↗</span></button></h4><p className="chain-segment-logic">{segment.logic.split('，')[0]}</p></header>
    <div className="chain-research-coverage"><p className="chain-coverage-label">研究覆盖 {placements.length} 家 <span>{researchStates}</span></p><div className="chain-company-chips">{placements.slice(0, 3).map(({ company }) => <CompanyChip key={company.id} company={company} stock={stockById.get(company.id)} onOpenStock={onOpenStock} />)}{placements.length > 3 && <span className="chain-company-rest">+{placements.length - 3} 家见展开</span>}</div></div>
    <div className="chain-provider-summary"><p className="chain-group-kicker">PROVIDER FACT / 有留存</p><dl>
      <div><dt>行情 {count('quoteUpdatedAt')}/{placements.length}</dt><dd>{statusCounts('quoteStatus')}</dd></div>
      <div><dt>财务 {count('reportPeriod')}/{placements.length}</dt><dd>{statusCounts('financialStatus')}</dd></div>
      <div><dt>公告 {count('announcementDate')}/{placements.length}</dt><dd>{statusCounts('announcementStatus')}</dd></div>
    </dl><p className="chain-latest-period">最新报告期 <span>{latestPeriod ?? 'unknown'}</span></p></div>
    <details className="chain-segment-detail"><summary aria-label={`${stage}${segment.name}全部公司与数据`}><span>展开 {placements.length} 家公司与数据</span><span aria-hidden="true">＋</span></summary><p className="chain-full-logic">研究定位：{segment.logic}</p><div className="chain-company-list">{placements.map(({ company, matchedItems }) => <CompanyNode key={company.id} company={company} matchedItems={matchedItems} stock={stockById.get(company.id)} onOpenStock={onOpenStock} />)}</div></details>
  </section>;
}

function companySecurity(company: ChainCompany, stock?: Stock) {
  const mapping = stock ? getSymbolMapping(stock.id) : undefined;
  const mappedCode = mapping?.standardSymbol.split('.')[0];
  const sameCode = stock?.market === '港股' ? mappedCode?.padStart(5, '0') === stock.code.padStart(5, '0') : mappedCode === stock?.code;
  return mapping && mapping.name === company.name && mapping.market === stock?.market && sameCode ? mapping.standardSymbol : company.code ?? '证券代码 unavailable';
}

function CompanyChip({ company, stock, onOpenStock }: { company: ChainCompany; stock?: Stock; onOpenStock: Props['onOpenStock'] }) {
  const listing = officialListingContext(company);
  return <div className="chain-company-chip" data-chain-company-chip={company.id} title={`${companySecurity(company, stock)} · ${company.market}`}><CompanyLabel company={company} stock={stock} onOpenStock={onOpenStock} />{listing && <span className="chain-security">{companySecurity(company, stock)} · {company.market} / {listing.board}</span>}</div>;
}

function CompanyLabel({ company, stock, onOpenStock }: { company: ChainCompany; stock?: Stock; onOpenStock: Props['onOpenStock'] }) {
  return stock ? <button type="button" className="chain-company-name" data-stock-id={stock.id} onClick={() => onOpenStock(stock)}>{company.name}<span aria-hidden="true">↗</span></button> : <strong className="chain-company-name">{company.name}</strong>;
}

function CompanyNode({ company, stock, matchedItems, onOpenStock }: { company: ChainCompany; stock?: Stock; matchedItems: string[]; onOpenStock: Props['onOpenStock'] }) {
  const fact = stock ? industryCompanyOverlay(stock) : null;
  const listing = officialListingContext(company);
  const symbol = companySecurity(company, stock);
  const condition = (status?: string) => status && !['real', 'generated_real'].includes(status) ? ` · ${status}` : '';
  return <article className="chain-company" data-chain-company={company.id}>
    <div className="chain-node-heading"><CompanyLabel company={company} stock={stock} onOpenStock={onOpenStock} /><span className="chain-verification" title="原研究资料的验证状态，非 Provider admission">{company.verificationStatus ?? 'unknown'}</span></div>
    <p className="chain-security">{symbol} · {company.market}{listing ? ` / ${listing.board}` : ''}</p>
    <div className="chain-compact-fact"><span>市值</span><strong>{fact?.marketCap != null ? formatYi(fact.marketCap) : '暂缺'}</strong><span>{fact?.marketCap != null ? stock?.market === '港股' ? '港元' : '人民币' : ''} · {fact?.quoteStatus ?? 'unavailable'}</span></div>
    <details className="chain-node-detail"><summary aria-label={`${company.name}数据与研究位置`}><span className="chain-periods">财报 {fact?.reportPeriod?.slice(0, 7) ?? 'unknown'}{condition(fact?.financialStatus)}<br />公告 {fact?.announcementStatus ?? 'unavailable'}</span><span aria-hidden="true">＋</span></summary>
      <div className="chain-context"><p className="chain-group-kicker">RESEARCH CONTEXT</p><p>研究位置：{company.chainPosition}</p><p>挂接依据：{matchedItems.join('、') || company.chainPosition}</p></div>
      {listing && <p className="chain-listing-source">上市身份 · <a href={listing.sourceUrl} target="_blank" rel="noreferrer">{listing.sourceName}正式披露 ↗</a><br />{listing.legalName} · {listing.listingDate} 上市</p>}
      {stock ? <CompanyFacts stock={stock} /> : <p>未上市研究线索 · Provider Fact unavailable</p>}
    </details>
  </article>;
}

function CompanyFacts({ stock }: { stock: Stock }) {
  const fact = industryCompanyOverlay(stock);
  return <div className="chain-facts"><p className="chain-group-kicker">PROVIDER FACT</p><dl>
    <div><dt>行情源 as-of</dt><dd>{fact.quoteAsOf ?? 'unknown（原 Provider 未留存）'}</dd></div>
    <div><dt>行情获取 / 更新时间</dt><dd>{fact.quoteUpdatedAt ?? 'unknown'} · {fact.quoteStatus}</dd></div>
    <div><dt>市值</dt><dd>{fact.marketCap === null ? '暂缺' : `${formatYi(fact.marketCap)} ${stock.market === 'A股' ? '人民币' : stock.market === '港股' ? '港元' : '原币'}`} · {fact.quoteSource ?? 'unavailable'}</dd></div>
    <div><dt>最新留存报告期</dt><dd>{fact.reportPeriod ?? 'unknown'} · {fact.financialStatus} · {fact.financialSource ?? 'unavailable'}</dd></div>
    <div><dt>最新留存公告</dt><dd>{fact.announcementDate ?? 'unknown'} · {fact.announcementStatus} · {fact.announcementSource ?? 'unavailable'}</dd></div>
  </dl></div>;
}
