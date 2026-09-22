import './workspace-settings.css';

export function PortfolioBoundary() {
  return <section className="ui-v2-empty" aria-labelledby="portfolio-title"><p className="ui-v2-eyebrow">组合</p><h1 id="portfolio-title">尚未连接组合数据</h1><p>账户与持仓的浏览器接入尚未启用。这里不会显示估算的收益、净值或配置建议。</p><details><summary>后续接入范围</summary><p>沿用已有 Local Core 账户与账本；明确持仓时点、币种及公司／行业／主题关系后，再展示可追溯的暴露结果。ETF 穿透、归因与再平衡按各自能力准入。</p></details></section>;
}
export function WorkspaceSettings({ openKnowledge, openSources }: { openKnowledge: () => void; openSources: () => void }) {
  return <section className="workspace-settings"><header><h1>设置与帮助</h1></header>
    <section aria-label="存储与备份" className="workspace-settings-group">
      <div className="workspace-setting-row"><div><h2>存储位置</h2><p>当前网址、当前浏览器中的本地数据。</p><details><summary>位置与迁移详情</summary><p>原件、批次、贡献包保存在 IndexedDB；文章、修订与审核历史保存在本地存储。不同网址与浏览器 profile 不共享数据。当前未提供覆盖原件与全部资料的整库恢复，请保留原网址与 profile。</p></details></div><span className="text-sm text-textMuted">本地优先</span></div>
      <div className="workspace-setting-row"><div><h2>文章备份与恢复</h2><p className="text-warning">文章备份不包含原件。</p></div><button className="inbox-action" onClick={openKnowledge}>管理文章备份</button></div>
      <div className="workspace-setting-row"><div><h2>原件下载</h2><p>按批次查看已保存文件与解析状态。</p></div><button className="inbox-action" onClick={openSources}>查看与下载原件</button></div>
      <div className="workspace-setting-row"><div><h2>Obsidian 单向导出</h2><p>外部编辑不会回写正式知识库。</p></div><button className="inbox-action" onClick={openKnowledge}>导出与目录校验</button></div>
    </section>
    <section aria-label="使用设置" className="workspace-settings-group">
      <div className="workspace-setting-row"><div><h2>数据模式</h2><p>在页顶切换模拟、混合或真实；缺失、过期与来源状态就近显示。</p></div><span className="text-sm text-textMuted">页顶切换</span></div>
      <div className="workspace-setting-row"><div><h2>快捷键</h2><p>Ctrl / ⌘ K 搜索页面或公司；Esc 关闭弹窗；Tab 移动焦点。</p></div></div>
      <div className="workspace-setting-row"><details><summary>研究、审核与连接帮助</summary><p>添加资料后交接研究，在任务中审核候选。接受只形成知识版本，不将 AI 草稿或企业自述升级为已核验事实。只读研究桥访问明确发送的副本；自动检索、自动提审与 Agent 执行器尚未启用。</p><p>统一浅色界面；旧显示偏好字节保留，研究数据不会因显示调整而清理。</p></details></div>
    </section>
  </section>;
}
