import { expect, it } from 'vitest';
import { industries } from './industries';
import { industrySegmentResearch } from './industryChainResearch';
const robotics = industries.find(i => i.id === 'robotics')!;

it('represents each exact segment once, independently of company cross-stage attachments', () => {
  const graph = industrySegmentResearch(robotics)!;
  expect(graph.nodes).toHaveLength(7);
  expect(new Set(graph.nodes.map(n => n.segmentId)).size).toBe(7);
  expect(['上游', '中游', '下游', '横向'].map(stage => graph.nodes.filter(n => n.stage === stage).length)).toEqual([4,1,1,1]);
  expect(graph.nodes.find(n => n.segmentId === 'actuator-module')!.stage).toBe('中游');
  expect(graph.nodes.find(n => n.segmentId === 'auto-parts-migration')!.stage).toBe('横向');
});

it('grounds every edge in exact retained source fields and labels capability separately', () => {
  const graph = industrySegmentResearch(robotics)!;
  expect(graph.edges.map(e => [e.from, e.to, e.label])).toEqual([
    ['precision-reducer', 'actuator-module', '关节传动'],
    ['linear-actuator-screw', 'actuator-module', '线性运动'],
    ['motor-drive-control', 'actuator-module', '驱动控制'],
    ['actuator-module', 'robot-oem', '运动执行'],
    ['vision-sensor-skin', 'robot-oem', '感知交互'],
    ['auto-parts-migration', 'actuator-module', '能力迁移'],
  ]);
  for (const edge of graph.edges) {
    for (const id of [edge.from, edge.to]) expect(graph.nodes.some(n => n.segmentId === id)).toBe(true);
    for (const ref of edge.refs) expect(robotics.segments.find(s => s.id === ref.segmentId)![ref.field]).toContain(ref.quote);
  }
  expect(graph.edges.filter(e => e.kind === 'capability').map(e => e.from)).toEqual(['auto-parts-migration']);
});

it('fails closed on missing, duplicate, foreign or changed structural context', () => {
  expect(industrySegmentResearch({ ...robotics, chain: [] })).toBeNull();
  expect(industrySegmentResearch({ ...robotics, chain: robotics.chain.map(stage => ({ ...stage, items: ['foreign'] })) })).toBeNull();
  expect(industrySegmentResearch({ ...robotics, segments: robotics.segments.slice(1) })).toBeNull();
  expect(industrySegmentResearch({ ...robotics, segments: [...robotics.segments, robotics.segments[0]] })).toBeNull();
  expect(industrySegmentResearch({ ...robotics, segments: robotics.segments.map(s => ({ ...s, industryId: 'foreign' })) })).toBeNull();
  expect(industrySegmentResearch({ ...robotics, segments: robotics.segments.map(s => ({ ...s, logic: 'changed', demandSource: 'changed' })) })).toBeNull();
  expect(industrySegmentResearch(industries.find(i => i.id === 'ai-computing')!)).toBeNull();
});
