import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { IndustrySegment } from '../../types';
import type { industrySegmentResearch } from '../../data/industryChainResearch';

type ResearchMap = NonNullable<ReturnType<typeof industrySegmentResearch>>;
type Line = { d: string };
type Box = { left: number; right: number; top: number; bottom: number; cy: number };

/** Rounded orthogonal paths between live HTML nodes; no fixed screenshot geometry. */
function elbow(a: Box, b: Box, lane: number, targetY: number): string {
  const dy = targetY - a.cy;
  if (Math.abs(dy) < 1) return `M ${a.right} ${a.cy} H ${b.left}`;
  const sign = Math.sign(dy), r = Math.min(8, Math.abs(dy) / 2);
  return `M ${a.right} ${a.cy} H ${lane - r} Q ${lane} ${a.cy} ${lane} ${a.cy + sign * r} V ${targetY - sign * r} Q ${lane} ${targetY} ${lane + r} ${targetY} H ${b.left}`;
}

export function IndustrySegmentMap({ graph, renderSegment }: { graph: ResearchMap; renderSegment: (segment: IndustrySegment, stage: string) => ReactNode }) {
  const prefix = `segment-map-${useId().replace(/:/g, '')}`;
  const canvas = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      if (window.innerWidth < 768 || !bounds.width) { setLines([]); return; }
      const boxes = new Map<string, Box>();
      for (const node of graph.nodes) {
        const element = root.querySelector<HTMLElement>(`[data-chain-group="${node.segmentId}"]`);
        const summary = element?.querySelector('summary');
        if (!element || !summary) return;
        const r = element.getBoundingClientRect(), s = summary.getBoundingClientRect();
        boxes.set(node.segmentId, { left:r.left-bounds.left, right:r.right-bounds.left, top:r.top-bounds.top, bottom:r.bottom-bounds.top, cy:(s.top+s.bottom)/2-bounds.top });
      }
      const bottomLane = Math.max(...[...boxes.values()].map(b => b.bottom)) + 32;
      setLines(graph.edges.map((edge, i) => {
        const a = boxes.get(edge.from)!, b = boxes.get(edge.to)!;
        if (edge.kind === 'capability') {
          const x = b.right - 24;
          return { d:`M ${x} ${a.top} V ${b.bottom}` };
        }
        if (edge.from === 'vision-sensor-skin') {
          const lane = a.right + 64, endX = (b.left + b.right) / 2;
          return { d:`M ${a.right} ${a.cy} H ${lane-8} Q ${lane} ${a.cy} ${lane} ${a.cy+8} V ${bottomLane-8} Q ${lane} ${bottomLane} ${lane+8} ${bottomLane} H ${endX-8} Q ${endX} ${bottomLane} ${endX} ${bottomLane-8} V ${b.bottom}` };
        }
        const middleInputY = Math.max(b.cy-16, Math.min(b.cy+16, boxes.get('linear-actuator-screw')!.cy));
        const targetY = edge.to === 'actuator-module' ? middleInputY+(i-1)*16 : a.cy;
        return { d:elbow(a,b,a.right+(edge.to === 'actuator-module' ? [48,16,32][i] : 48),targetY) };
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('.chain-segment,.chain-map-column').forEach(n => observer.observe(n));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [graph]);

  const node = (entry: ResearchMap['nodes'][number]) => <div key={entry.segmentId} className="chain-map-node">
    {renderSegment(entry.segment, entry.stage)}
    <ul className="chain-mobile-relations">{graph.edges.filter(e => e.from === entry.segmentId).map(e => <li key={e.to}><span>{e.label}</span> → {graph.nodes.find(n => n.segmentId === e.to)!.segment.name}{e.kind === 'capability' ? '（研究方向）' : ''}</li>)}</ul>
  </div>;
  return <>
    <div ref={canvas} className="chain-canvas chain-relationship-canvas" aria-label="细分功能关系图">
      <svg className="chain-edges" role="img" aria-labelledby={`${prefix}-title ${prefix}-desc`}>
        <title id={`${prefix}-title`}>细分之间的功能关系</title><desc id={`${prefix}-desc`}>{graph.edges.map(e => `${graph.nodes.find(n => n.segmentId === e.from)!.segment.name}通过${e.label}联系${graph.nodes.find(n => n.segmentId === e.to)!.segment.name}`).join('；')}。均为研究结构，非公司供货事实。</desc>
        <defs><marker id={`${prefix}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="currentColor" /></marker></defs>
        {lines.map((line,i) => <g key={`${graph.edges[i].from}-${graph.edges[i].to}`} data-chain-edge={`${graph.edges[i].from}:${graph.edges[i].to}`} className={graph.edges[i].kind === 'capability' ? 'chain-edge-capability' : ''}><path d={line.d} markerEnd={`url(#${prefix}-arrow)`} /></g>)}
      </svg>
      {(['上游','中游','下游'] as const).map((stage,i) => <div key={stage} className="chain-map-column">
        <section className="chain-stage" data-chain-stage={stage} aria-labelledby={`${prefix}-stage-${i}`}><header className="chain-stage-header"><span className="chain-stage-index">0{i+1}</span><div><p className="chain-stage-code">{['上游环节','中游环节','下游环节'][i]}</p><h3 id={`${prefix}-stage-${i}`}>{stage}</h3></div></header><div className="chain-segment-grid">{graph.nodes.filter(n => n.stage === stage).map(node)}</div></section>
        {stage === '中游' && <aside className="chain-cross-context"><p>横向研究方向</p>{graph.nodes.filter(n => n.stage === '横向').map(node)}</aside>}
      </div>)}
    </div>
    <details className="chain-relation-evidence"><summary>关系依据与边界</summary><p>每个细分按主要功能展示一次；电机驱控等跨环节业务仍保留在研究原文中。汽车零部件迁移是能力来源，不是独立的生产阶段。实线为功能关系，虚线为待验证的能力迁移方向；均不表示具体企业供货关系。</p>{graph.edges.map(edge => <div key={`${edge.from}:${edge.to}`}><strong>{graph.nodes.find(n => n.segmentId === edge.from)!.segment.name} → {graph.nodes.find(n => n.segmentId === edge.to)!.segment.name} · {edge.label}</strong>{edge.refs.map((ref,i) => <p key={i}>既有细分研究（{ref.field}）：{ref.quote}</p>)}</div>)}</details>
  </>;
}
