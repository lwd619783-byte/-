import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppearanceProvider } from '../components/layout/Appearance';
import { ThesisWorkspacePanel } from '../components/research/ThesisWorkspacePanel';
import { ExpressionWorkspacePanel } from '../components/research/ExpressionWorkspace';
import { createDemoRuntime } from './runtime';
import { ResearchLinkNavigation } from '../components/common/ResearchLink';
import '../index.css';
import '../styles/workspace-v2.css';

function Demo({ runtime }: { runtime: Awaited<ReturnType<typeof createDemoRuntime>> }) {
  const [tab, setTab] = useState<'thesis' | 'expression'>('thesis');
  return <AppearanceProvider persist={false}><main className="mx-auto max-w-6xl p-3 sm:p-6">
    <header className="mb-5 space-y-3">
      <p className="text-xs font-semibold text-warning">SYNTHETIC ONLY · 纯合成演示 · 未部署候选</p>
      <h1 className="text-2xl font-semibold">投研 OS 决策链演练</h1>
      <p className="text-sm">此处所有来源、主张、论点和标的都是合成样本。预置已确认的合成 Thesis 仅用于演练 Expression；界面中的“正式”状态仅存在于本次演示内存，不构成真实投资判断。</p>
      <p className="text-sm text-textMuted">数据仅保留在当前页面内存，刷新即重置。可导出 JSON 再预览导入；仅使用合成数据。正式本地模式请使用原项目入口。</p>
      <section aria-label="演示服务边界" className="rounded border border-borderSoft p-3 text-sm">
        <p>以下服务在演示中不可用：本机 SQLite / Portfolio 账本、共享与 MCP、Research Bridge、Daily Review。未连接服务，不发送请求。</p>
        <div className="mt-2 flex flex-wrap gap-2">{['本机账本', '共享 / MCP', 'Research Bridge', 'Daily Review'].map(label => <button key={label} className="inbox-action" disabled>{label} · 已禁用</button>)}</div>
      </section>
      <nav aria-label="合成演示导航" className="flex flex-wrap gap-2">
        <button className="inbox-action" aria-pressed={tab === 'thesis'} onClick={() => setTab('thesis')}>Thesis 演练</button>
        <button className="inbox-action" aria-pressed={tab === 'expression'} onClick={() => setTab('expression')}>Expression 演练</button>
      </nav>
    </header>
    {tab === 'thesis' ? <ThesisWorkspacePanel runtime={runtime.thesis} /> : <ExpressionWorkspacePanel runtime={runtime.expression} />}
  </main></AppearanceProvider>;
}

createDemoRuntime().then(runtime => createRoot(document.getElementById('root')!).render(<ResearchLinkNavigation.Provider value={false}><Demo runtime={runtime} /></ResearchLinkNavigation.Provider>)).catch(() => {
  document.getElementById('root')!.textContent = '合成样本初始化失败。演示已阻断，不会回退到真实数据或服务。';
});
