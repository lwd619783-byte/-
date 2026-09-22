import type { PageId } from '../../hooks/useWorkspaceNavigation';

/** Presentation routing only; each destination retains its existing domain owner. */
export const researchPages: { page: PageId; label: string; description: string }[] = [
  { page: 'research', label: '研究总览', description: '研究收件箱、行情覆盖与跟踪对象' },
  { page: 'macro', label: '宏观', description: '宏观指标、时点与证据' },
  { page: 'industry', label: '行业', description: '产业链、指标与研究信号' },
  { page: 'stocks', label: '公司', description: '公司研究池、财务与估值' },
  { page: 'watchlist', label: '论点与观察', description: 'Thesis 草稿、本人确认与版本历史；观察判断与复盘' },
  { page: 'verification', label: '验证', description: '研究事件、预测验证与复盘' },
  { page: 'expectations', label: '预期证据', description: '业绩预期、实际结果与来源' },
  { page: 'creators', label: '观点追踪', description: '外部作者观点与历史变化' },
];
export const primaryPages: { page: PageId; label: string; description: string }[] = [
  { page: 'home', label: '工作台', description: '开始与继续研究' },
  { page: 'research', label: '研究', description: '宏观、行业、公司与验证' },
  { page: 'knowledge', label: '知识库', description: 'External Knowledge Lane（默认）；Legacy Local Wiki / Bridge（兼容）' },
  { page: 'portfolio', label: '组合', description: '组合暴露接入位置，尚未连接' },
  { page: 'tasks', label: '任务', description: '待审核建议与待处理研究事项' },
];
export const utilityPages: typeof primaryPages = [
  { page: 'sources', label: '资料与连接', description: '兼容本地原件、AI 整理与只读研究桥；外部知识路线未连接 API' },
  { page: 'settings', label: '设置与帮助', description: '数据模式、备份与使用边界' },
];
export function primaryPage(page: PageId): PageId {
  if (researchPages.some(item => item.page === page)) return 'research';
  if (page === 'memory') return 'knowledge';
  return page;
}
