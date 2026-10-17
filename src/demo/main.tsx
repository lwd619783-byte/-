import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppearanceProvider } from '../components/layout/Appearance';
import { ThesisWorkspacePanel } from '../components/research/ThesisWorkspacePanel';
import { ExpressionWorkspacePanel } from '../components/research/ExpressionWorkspace';
import { createDemoRuntime } from './runtime';
import { ResearchLinkNavigation } from '../components/common/ResearchLink';
import { SimulationWorkspace } from './round-one/SimulationWorkspace';
import { DecisionHome, KnowledgeIndex, decisionSamples } from './round-one/DecisionHome';
import './round-one/styles.css';
import '../index.css';
import '../styles/workspace-v2.css';

type View = 'home' | 'decision' | 'simulation' | 'knowledge' | 'history' | 'thesis' | 'expression';
const viewLabels: Record<View, string> = { home: '决策总览', decision: '个股决策', simulation: '超跌模拟', knowledge: '知识库索引', history: '历史复盘', thesis: 'Thesis 演练', expression: 'Expression 演练' };

function Demo({ runtime }: { runtime: Awaited<ReturnType<typeof createDemoRuntime>> }) {
  const [tab, setTab] = useState<View>('home');
  const [selectedId, setSelectedId] = useState('SYN-01');
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 800px)').matches);
  const [groups, setGroups] = useState({ decisions: true, research: true, simulation: true, history: false });
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const navigate = (next: View, id?: string) => {
    if (id) setSelectedId(id);
    setTab(next);
    const activeGroup = next === 'home' ? 'decisions' : next === 'decision' || next === 'knowledge' ? 'research' : next === 'simulation' ? 'simulation' : 'history';
    setGroups(current => ({ ...current, [activeGroup]: true }));
    if (window.matchMedia('(max-width: 800px)').matches) setSidebarOpen(false);
    heading.current?.focus();
  };
  const item = (view: View, label: string, id?: string) => <button key={id || view} className="demo-nav-item" aria-current={tab === view && (!id || id === selectedId) ? 'page' : undefined} onClick={() => navigate(view, id)}>{label}</button>;
  const group = (key: keyof typeof groups, label: string, children: React.ReactNode) => <section className="demo-nav-group">
    <button className="demo-group-toggle" aria-expanded={groups[key]} aria-controls={`demo-group-${key}`} onClick={() => setGroups(current => ({ ...current, [key]: !current[key] }))}><span>{label}</span><span aria-hidden="true">{groups[key] ? '−' : '+'}</span></button>
    <div id={`demo-group-${key}`} hidden={!groups[key]}>{children}</div>
  </section>;
  return <AppearanceProvider persist={false}><div className={`demo-shell ${sidebarOpen ? 'demo-sidebar-open' : ''}`}>
    <a className="demo-skip" href="#demo-main">跳到当前功能</a>
    <header className="demo-topbar">
      <button ref={toggle} className="inbox-action demo-sidebar-toggle" aria-expanded={sidebarOpen} aria-controls="demo-sidebar" onClick={() => setSidebarOpen(open => !open)}>{sidebarOpen ? '收起导航' : '展开导航'}</button>
      <div><strong>投研 OS</strong><span>个人研究与决策工作台</span></div>
      <p className="demo-synthetic">SYNTHETIC ONLY · 合成演示</p>
    </header>
    <aside id="demo-sidebar" className="demo-sidebar" hidden={!sidebarOpen} onKeyDown={event => { if (event.key === 'Escape') { setSidebarOpen(false); toggle.current?.focus(); } }}>
      <p className="demo-nav-caption">工作空间 / 仅本页内存</p>
      <nav aria-label="合成演示导航">
        {group('decisions', '决策总览', item('home', '决策首页'))}
        {group('research', '行业与个股', <><p className="demo-nav-hint">仅有合成个股，行业功能未接入</p>{decisionSamples.map(card => item('decision', `${card.id} · ${card.name}`, card.id))}{item('knowledge', '知识库索引')}</>)}
        {group('simulation', '超跌模拟', item('simulation', '超跌模拟'))}
        {group('history', '历史复盘', <>{item('history', '决策确认历史')}<p className="demo-nav-hint">二级入口 · 证据链演练</p>{item('thesis', 'Thesis 演练')}{item('expression', 'Expression 演练')}</>)}
      </nav>
      <p className="demo-sidebar-note">确认不代表成交<br />未连接正式账户或私人研究</p>
    </aside>
    <main id="demo-main" className="demo-main" tabIndex={-1}>
      <header className="demo-page-heading"><p className="demo-breadcrumb">合成工作空间 / {viewLabels[tab]}</p><h1 ref={heading} tabIndex={-1}>{viewLabels[tab]}{tab === 'decision' ? ` · ${selectedId}` : ''}</h1><p>仅 demo 原型 · 尚未接入正式 App · 用户确认不代表成交</p></header>
      <div hidden={!['home', 'decision', 'history'].includes(tab)}><DecisionHome view={tab === 'home' ? 'overview' : tab === 'history' ? 'history' : 'cards'} selectedId={selectedId} onDecision={id => navigate('decision', id)} onHistory={() => navigate('history')} onKnowledge={() => navigate('knowledge')} onEvidence={() => navigate('thesis')} /></div>
      <div hidden={tab !== 'simulation'}><SimulationWorkspace /></div>
      {tab === 'knowledge' && <KnowledgeIndex />}
      {tab === 'thesis' && <ThesisWorkspacePanel runtime={runtime.thesis} />}
      {tab === 'expression' && <ExpressionWorkspacePanel runtime={runtime.expression} />}
      <footer className="demo-footer"><details><summary>演示范围与数据保存说明</summary>
        <p>仅本页内存，刷新重置。超跌备份仅含超跌轮次；Thesis/Expression 各自导出。阅读、决策确认和建议版本未提供导出。Notion 仅为合成索引占位，尚未接入。</p>
        <section aria-label="演示服务边界"><p>预置合成 Thesis 用于演练 Expression；演示中的“正式”状态仅存在于演示内存。以下服务在演示中不可用：本机 SQLite / Portfolio 账本、共享与 MCP、Research Bridge、Daily Review。未连接服务，不发送请求。</p><div className="os-actions">{['本机账本', '共享 / MCP', 'Research Bridge', 'Daily Review'].map(label => <button key={label} className="inbox-action" disabled>{label} · 已禁用</button>)}</div></section>
      </details></footer>
    </main>
  </div></AppearanceProvider>;
}

createDemoRuntime().then(runtime => createRoot(document.getElementById('root')!).render(<ResearchLinkNavigation.Provider value={false}><Demo runtime={runtime} /></ResearchLinkNavigation.Provider>)).catch(() => {
  document.getElementById('root')!.textContent = '合成样本初始化失败。演示已阻断，不会回退到真实数据或服务。';
});
