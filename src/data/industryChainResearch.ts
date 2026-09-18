import type { Industry, IndustrySegment } from '../types';

type ContextRef = { segmentId: string; field: 'logic' | 'demandSource'; quote: string };
export type ChainResearchNode = { segmentId: string; stage: '上游' | '中游' | '下游' | '横向'; chainItem?: string; refs: ContextRef[] };
export type ChainResearchEdge = { from: string; to: string; label: string; kind: 'functional' | 'capability'; refs: ContextRef[] };
const ref = (segmentId: string, field: ContextRef['field'], quote: string): ContextRef => ({ segmentId, field, quote });

/** Presentation of existing research context, not a Provider owner or company supply-chain assertion. */
const robotics = {
  nodes: [
    { segmentId: 'precision-reducer', stage: '上游', chainItem: '减速器', refs: [ref('precision-reducer', 'logic', '机器人关节的核心部件')] },
    { segmentId: 'linear-actuator-screw', stage: '上游', chainItem: '丝杠', refs: [ref('linear-actuator-screw', 'logic', '承接人形机器人线性运动需求')] },
    { segmentId: 'motor-drive-control', stage: '上游', chainItem: '电机', refs: [ref('motor-drive-control', 'logic', '无框力矩电机、空心杯电机、伺服驱动器、控制器')] },
    { segmentId: 'vision-sensor-skin', stage: '上游', chainItem: '视觉', refs: [ref('vision-sensor-skin', 'logic', '构成机器人感知层')] },
    { segmentId: 'actuator-module', stage: '中游', chainItem: '关节模组', refs: [ref('actuator-module', 'logic', '旋转关节、线性关节、机电执行器、关节模组和灵巧手总成')] },
    { segmentId: 'robot-oem', stage: '下游', chainItem: '工业机器人', refs: [ref('robot-oem', 'logic', '机器人本体、工业机器人、人形机器人、服务机器人和系统集成')] },
    { segmentId: 'auto-parts-migration', stage: '横向', refs: [ref('auto-parts-migration', 'logic', '汽车零部件企业向机器人结构件、执行器、传动件和电子控制件迁移')] },
  ] satisfies ChainResearchNode[],
  edges: [
    { from: 'precision-reducer', to: 'actuator-module', label: '关节传动', kind: 'functional', refs: [ref('precision-reducer', 'logic', '机器人关节的核心部件'), ref('actuator-module', 'logic', '旋转关节')] },
    { from: 'linear-actuator-screw', to: 'actuator-module', label: '线性运动', kind: 'functional', refs: [ref('linear-actuator-screw', 'demandSource', '人形机器人线性执行器'), ref('actuator-module', 'logic', '线性关节')] },
    { from: 'motor-drive-control', to: 'actuator-module', label: '驱动控制', kind: 'functional', refs: [ref('motor-drive-control', 'demandSource', '关节模组'), ref('actuator-module', 'logic', '机电执行器')] },
    { from: 'actuator-module', to: 'robot-oem', label: '运动执行', kind: 'functional', refs: [ref('actuator-module', 'logic', '决定机器人运动能力'), ref('robot-oem', 'logic', '机器人本体')] },
    { from: 'vision-sensor-skin', to: 'robot-oem', label: '感知交互', kind: 'functional', refs: [ref('vision-sensor-skin', 'demandSource', '机器人定位导航、抓取识别、人机交互和安全感知'), ref('robot-oem', 'logic', '机器人本体')] },
    { from: 'auto-parts-migration', to: 'actuator-module', label: '能力迁移', kind: 'capability', refs: [ref('auto-parts-migration', 'logic', '向机器人结构件、执行器、传动件和电子控制件迁移'), ref('actuator-module', 'demandSource', '汽车零部件能力迁移')] },
  ] satisfies ChainResearchEdge[],
};

export function industrySegmentResearch(industry: Industry): { nodes: (ChainResearchNode & { segment: IndustrySegment })[]; edges: ChainResearchEdge[] } | null {
  if (industry.id !== 'robotics' || !['上游', '中游', '下游'].every(stage => industry.chain.some(s => s.stage === stage && s.items.length))) return null;
  const segments = industry.segments.filter(s => s.industryId === industry.id);
  const exact = (id: string) => segments.filter(s => s.id === id);
  const validRef = (source: ContextRef) => exact(source.segmentId).length === 1 && exact(source.segmentId)[0][source.field].includes(source.quote);
  if (robotics.nodes.some(n => exact(n.segmentId).length !== 1 || !n.refs.every(validRef) || (n.stage !== '横向' && !industry.chain.some(stage => stage.stage === n.stage && stage.items.includes(n.chainItem)))) || robotics.edges.some(e => !e.refs.every(validRef))) return null;
  return { nodes: robotics.nodes.map(n => ({ ...n, segment: exact(n.segmentId)[0] })), edges: robotics.edges };
}
