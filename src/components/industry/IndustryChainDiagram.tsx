import { useId } from 'react';
import type { Industry, Stock } from '../../types';
import { roboticsPrivateCompanies } from '../../data/privateCompanies';
import { industryChainTopology, industryCompanyOverlay } from '../../services/industryChain';
import type { ChainCompany } from '../../services/industryChain';
import { formatYi } from '../../utils/normalize';
import './industry-chain.css';

type Props = { industry: Industry; stocks: Stock[]; onOpenStock: (stock: Stock) => void; onSelectSegment: (segmentId: string) => void };
export function IndustryChainDiagram({ industry, stocks, onOpenStock, onSelectSegment }: Props) {
  const prefix = `industry-chain-${useId().replace(/:/g, '')}`;
  const companies: ChainCompany[] = [...stocks, ...roboticsPrivateCompanies.filter(c => c.industryId === industry.id)];
  const topology = industryChainTopology(industry, companies);
  return <section className="industry-chain" aria-label="产业链图">
    <header><p className="chain-eyebrow">STRUCTURE / RESEARCH CONTEXT</p><h2>产业链图 · {industry.name}</h2>
      <p>既有研究结构；位置不表示收入权重或资金流向，也不代表直接供货关系。动态行情不会改变节点位置。</p></header>
    {!topology ? <p role="status">结构数据 unavailable：没有可用的既有产业链，未生成图。</p> : <>
      {(['wide', 'narrow'] as const).map(variant => {
        const vertical = variant === 'narrow', width = vertical ? 256 : topology.nodes.length * 320;
        const height = vertical ? topology.nodes.length * 304 : 304;
        return <svg key={variant} className={`chain-svg chain-svg-${variant}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${prefix}-${variant}-title ${prefix}-${variant}-desc`}>
          <title id={`${prefix}-${variant}-title`}>{industry.name}上中下游产业链</title>
          <desc id={`${prefix}-${variant}-desc`}>来自既有 Industry.chain 的结构条目；节点明细中的公司位置保留研究资料等级，行情仅作覆盖信息。</desc>
          <defs>{['arrow', 'arrow-accent', 'arrow-link'].map((name, i) => <marker key={name} id={`${prefix}-${variant}-${name}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill={i === 1 ? '#eb6c36' : i === 2 ? '#2e5aa8' : '#4f5d75'} /></marker>)}</defs>
          {topology.nodes.slice(1).map((node, index) => <line key={node.stage} x1={vertical ? 128 : index * 320 + 288} y1={vertical ? index * 304 + 280 : 144} x2={vertical ? 128 : (index + 1) * 320 + 16} y2={vertical ? (index + 1) * 304 + 16 : 144} stroke="#4f5d75" markerEnd={`url(#${prefix}-${variant}-arrow)`} />)}
          {topology.nodes.map((node, index) => <g key={node.stage} transform={`translate(${vertical ? 8 : index * 320 + 16},${vertical ? index * 304 + 16 : 16})`}>
            <rect width={vertical ? 240 : 272} height="264" rx="8" fill={index === 1 ? '#f9ece5' : '#f5f5f5'} stroke={index === 1 ? '#eb6c36' : '#bfc0c0'} />
            <text x="16" y="32" fontSize="20" fontWeight="600">{node.stage}</text>
            {node.items.map((item, i) => <text key={item} x="16" y={56 + i * 16} fontSize="12">{item}</text>)}
            <text x="16" y="244" fontSize="12" fill="#4f5d75">{node.companies.length} 家研究池公司 · 下方展开</text>
          </g>)}
        </svg>;
      })}
      <p className="chain-legend">箭头：上中下游研究关系　｜　公司挂接：位置文字含原条目；跨环节完整保留</p>
      <div className="chain-stage-details">{topology.nodes.map(node => <details key={node.stage} data-chain-stage={node.stage}>
        <summary>{node.stage} · 公司与数据覆盖 <span>{node.companies.length} 家</span></summary>
        <div className="chain-company-list">{node.companies.length ? node.companies.map(({ company, matchedItems, segment }) => <article key={company.id} data-chain-company={company.id}>
          <CompanyLabel company={company} stock={stocks.find(s => s.id === company.id && s.industryId === industry.id)} onOpenStock={onOpenStock} />
          <p>研究位置：{company.chainPosition} · {company.verificationStatus ?? '未标注 / unknown'}</p>
          <p>挂接依据：{matchedItems.join('、') || node.stage}</p>
          {segment ? <button type="button" className="chain-link" data-chain-segment={segment.id} onClick={() => onSelectSegment(segment.id)}>细分：{segment.name} →</button> : <p>细分 identity unavailable</p>}
          {stocks.find(s => s.id === company.id && s.industryId === industry.id) ? <CompanyFacts stock={stocks.find(s => s.id === company.id && s.industryId === industry.id)!} /> : <p>未上市研究线索 · Provider Fact unavailable</p>}
        </article>) : <p>该环节暂无可从既有位置文字精确挂接的公司。</p>}</div>
      </details>)}</div>
      {topology.unpositioned.length ? <details className="chain-unpositioned"><summary>位置待映射 · {topology.unpositioned.length} 家</summary><p>原位置文字未匹配图中条目，保留原文，不分配默认环节。</p>{topology.unpositioned.map(company => <p key={company.id}><CompanyLabel company={company} stock={stocks.find(s => s.id === company.id && s.industryId === industry.id)} onOpenStock={onOpenStock} /> · {company.chainPosition || 'unknown'}</p>)}</details> : null}
      {topology.conflictedIds.length ? <p>公司 identity conflicted：{topology.conflictedIds.join('、')}，未挂接。</p> : null}
    </>}
    <footer>Structure：既有 Industry.chain / company.chainPosition / segmentId。Provider Fact：下方行情、报告期和公告日期，按原始状态展示。研究位置与上市分类未因刷新获得新的验证。</footer>
  </section>;
}
function CompanyLabel({ company, stock, onOpenStock }: { company: ChainCompany; stock?: Stock; onOpenStock: Props['onOpenStock'] }) {
  return stock ? <button type="button" className="chain-link chain-company-name" data-stock-id={stock.id} onClick={() => onOpenStock(stock)}>{company.name} · {company.code} · {company.market}</button> : <strong>{company.name} · {company.market}</strong>;
}
function CompanyFacts({ stock }: { stock: Stock }) {
  const fact = industryCompanyOverlay(stock);
  return <div className="chain-facts"><p className="chain-eyebrow">PROVIDER FACT</p><dl>
    <div><dt>行情源 as-of</dt><dd>{fact.quoteAsOf ?? 'unknown（原 Provider 未留存）'}</dd></div>
    <div><dt>行情获取 / 更新时间</dt><dd>{fact.quoteUpdatedAt ?? 'unknown'} · {fact.quoteStatus}</dd></div>
    <div><dt>市值</dt><dd>{fact.marketCap === null ? '暂缺' : `${formatYi(fact.marketCap)} ${stock.market === 'A股' ? '人民币' : stock.market === '港股' ? '港元' : '原币'}`} · {fact.quoteSource ?? 'unavailable'}</dd></div>
    <div><dt>最新留存报告期</dt><dd>{fact.reportPeriod ?? 'unknown'} · {fact.financialStatus} · {fact.financialSource ?? 'unavailable'}</dd></div>
    <div><dt>最新留存公告</dt><dd>{fact.announcementDate ?? 'unknown'} · {fact.announcementStatus} · {fact.announcementSource ?? 'unavailable'}</dd></div>
  </dl></div>;
}
