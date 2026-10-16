import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppearanceProvider } from '../components/layout/Appearance';
import { ThesisWorkspacePanel } from '../components/research/ThesisWorkspacePanel';
import { ExpressionWorkspacePanel } from '../components/research/ExpressionWorkspace';
import { createDemoRuntime } from './runtime';
import { ResearchLinkNavigation } from '../components/common/ResearchLink';
import { SimulationWorkspace } from './round-one/SimulationWorkspace';
import { DecisionHome, KnowledgeIndex } from './round-one/DecisionHome';
import './round-one/styles.css';
import '../index.css';
import '../styles/workspace-v2.css';

function Demo({ runtime }: { runtime: Awaited<ReturnType<typeof createDemoRuntime>> }) {
  const [tab, setTab] = useState<'home' | 'simulation' | 'knowledge' | 'thesis' | 'expression'>('home');
  return <AppearanceProvider persist={false}><main className="mx-auto max-w-6xl p-3 sm:p-6">
    <header className="mb-5 space-y-3">
      <p className="text-xs font-semibold text-warning">SYNTHETIC ONLY · 纯合成演示 · 未部署候选</p>
      <h1 className="text-2xl font-semibold">投研 OS · 决策工作台</h1>
      <p className="text-sm">全部为合成样例。建议需本人复核，确认不代表成交；不构成真实投资判断。</p>
      <p className="text-sm text-textMuted">仅本页内存，刷新重置；请导出合成备份。正式模式保留原入口。</p>
      <nav aria-label="合成演示导航" className="flex flex-wrap gap-2">
        <button className="inbox-action" aria-pressed={tab === 'home'} onClick={() => setTab('home')}>决策首页</button>
        <button className="inbox-action" aria-pressed={tab === 'knowledge'} onClick={() => setTab('knowledge')}>知识库索引</button>
        <button className="inbox-action" aria-pressed={tab === 'simulation'} onClick={() => setTab('simulation')}>超跌模拟</button>
        <details className="w-full"><summary className="cursor-pointer text-sm">二级入口 · 证据链演练</summary><div className="mt-2 flex flex-wrap gap-2">
        <button className="inbox-action" aria-pressed={tab === 'thesis'} onClick={() => setTab('thesis')}>Thesis 演练</button>
        <button className="inbox-action" aria-pressed={tab === 'expression'} onClick={() => setTab('expression')}>Expression 演练</button></div></details>
      </nav>
    </header>
    <div hidden={tab !== 'home'}><DecisionHome onKnowledge={() => setTab('knowledge')} onEvidence={() => setTab('thesis')} /></div>
    <div hidden={tab !== 'simulation'}><SimulationWorkspace /></div>
    {tab === 'knowledge' && <KnowledgeIndex />}
    {tab === 'thesis' && <ThesisWorkspacePanel runtime={runtime.thesis} />}
    {tab === 'expression' && <ExpressionWorkspacePanel runtime={runtime.expression} />}
<footer className="mt-6">      <section aria-label="演示服务边界" className="rounded border border-borderSoft p-3 text-sm">
        <p>预置合成 Thesis 用于演练 Expression；演示中的“正式”状态仅存在于演示内存。以下服务在演示中不可用：本机 SQLite / Portfolio 账本、共享与 MCP、Research Bridge、Daily Review。未连接服务，不发送请求。</p>
        <div className="mt-2 flex flex-wrap gap-2">{['本机账本', '共享 / MCP', 'Research Bridge', 'Daily Review'].map(label => <button key={label} className="inbox-action" disabled>{label} · 已禁用</button>)}</div>
      </section>
</footer>
  </main></AppearanceProvider>;
}

createDemoRuntime().then(runtime => createRoot(document.getElementById('root')!).render(<ResearchLinkNavigation.Provider value={false}><Demo runtime={runtime} /></ResearchLinkNavigation.Provider>)).catch(() => {
  document.getElementById('root')!.textContent = '合成样本初始化失败。演示已阻断，不会回退到真实数据或服务。';
});
