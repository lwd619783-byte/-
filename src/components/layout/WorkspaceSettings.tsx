export function PortfolioBoundary() {
  return <section className="ui-v2-empty" aria-labelledby="portfolio-title"><p className="ui-v2-eyebrow">组合</p><h1 id="portfolio-title">尚未连接组合数据</h1><p>账户与持仓的浏览器接入尚未启用。这里不会显示估算的收益、净值或配置建议。</p><details><summary>后续接入范围</summary><p>沿用已有 Local Core 账户与账本；明确持仓时点、币种及公司／行业／主题关系后，再展示可追溯的暴露结果。ETF 穿透、归因与再平衡按各自能力准入。</p></details></section>;
}
export function WorkspaceSettings({ openKnowledge, openSources }: { openKnowledge: () => void; openSources: () => void }) {
  return <section className="ui-v2-settings space-y-6"><header><p className="ui-v2-eyebrow">工作区</p><h1 className="text-2xl font-semibold">设置与帮助</h1><p className="mt-2 text-textMuted">数据保存在各自的原有位置；前端切换不会改写正式研究版本。</p></header>
    <section className="ui-v2-surface"><h2>资料与知识保护</h2><p>本地原件、批次和贡献包保存在当前网址的 IndexedDB；知识库文章、修订和审核历史保存在当前网址的本地存储。不同 Preview 网址和浏览器 profile 不共享这些数据。</p><p className="text-warning">知识库备份不包含原件。目前没有覆盖原件与全部资料的整库恢复功能，请保留原验收网址与浏览器 profile。</p><div className="flex flex-wrap gap-2"><button className="inbox-action" onClick={openKnowledge}>知识库备份与单向导出</button><button className="inbox-action" onClick={openSources}>查看与下载原件</button></div></section>
    <section className="ui-v2-surface"><h2>研究与审核</h2><p>从资料与连接添加资料，在任务中审核候选；接受后形成可回溯的知识版本。AI 草稿、外部观点与已核验事实始终分别呈现。</p><p>只读研究桥只能访问明确发送的副本；自动检索、自动提审与 Agent 执行器尚未启用。</p></section>
    <section className="ui-v2-surface"><h2>显示与快捷操作</h2><p>统一浅色阅读界面。旧主题偏好保留，方便回滚；不清理研究数据。使用 Ctrl / ⌘ K 打开入口搜索，Esc 关闭弹窗，Tab 在控件间移动。数据模式在页顶切换，模块保留缺失、过期及来源状态。</p></section>
  </section>;
}
