import { useEffect, useRef, useState } from 'react';
import { BookOpen, BriefcaseBusiness, CheckSquare, House, Menu, Search, Settings, FolderOpen, Compass } from 'lucide-react';
import type { PageId } from '../../hooks/useWorkspaceNavigation';
import { primaryPage, primaryPages, researchPages, utilityPages } from './workspaceV2';
import { Modal } from '../common/Modal';

const icons = { home: House, research: Compass, knowledge: BookOpen, portfolio: BriefcaseBusiness, tasks: CheckSquare, sources: FolderOpen, settings: Settings };
export function WorkspaceNavigation({ page, navigate }: { page: PageId; navigate: (page: PageId) => void }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const active = primaryPage(page);
  const links = (items: typeof primaryPages) => items.map(item => {
    const Icon = icons[item.page as keyof typeof icons];
    return <a key={item.page} href={`#/${item.page}`} aria-current={active === item.page ? 'page' : undefined} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); navigate(item.page); setExpanded(false); }}>
      <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
    </a>;
  });
  return <div className="ui-v2-navigation" onKeyDown={event => { if (event.key === 'Escape' && expanded) { setExpanded(false); toggle.current?.focus(); } }}>
    <button ref={toggle} className="ui-v2-menu-toggle" aria-expanded={expanded} aria-controls="workspace-navigation" onClick={() => setExpanded(!expanded)}><Menu size={18} aria-hidden="true" />导航</button>
    <a className="ui-v2-sidebar-brand" href="#/home" onClick={event => { event.preventDefault(); navigate('home'); setExpanded(false); }}><span className="ui-v2-brandmark" aria-hidden="true"><i /><i /><i /></span><span>投研 OS<small>RESEARCH WORKSPACE</small></span></a>
    <nav id="workspace-navigation" className={expanded ? 'is-expanded' : ''} aria-label="主要导航">
      <p className="ui-v2-nav-caption">工作空间</p>{links(primaryPages)}
      <div className="ui-v2-nav-utilities">{links(utilityPages)}</div>
      <div className="ui-v2-nav-footnote"><span className="ui-v2-avatar" aria-hidden="true">研</span><span>本地工作区<small>资料与知识 · 来源可查</small></span></div>
    </nav>
  </div>;
}

export function ResearchNavigation({ page, navigate }: { page: PageId; navigate: (page: PageId) => void }) {
  if (primaryPage(page) !== 'research') return null;
  return <nav aria-label="研究分类" className="ui-v2-tabs">{researchPages.map(item => <a key={item.page} href={`#/${item.page}`} aria-current={page === item.page ? 'page' : undefined} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); navigate(item.page); }}>{item.label}</a>)}</nav>;
}

export function WorkspaceSearch({ navigate, onCompanySearch }: { navigate: (page: PageId) => void; onCompanySearch: (query: string) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[data-workspace-modal]')) { event.preventDefault(); trigger.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const items = [...primaryPages, ...researchPages.filter(item => item.page !== 'research'), ...utilityPages].filter(item => `${item.label}${item.description}`.includes(query.trim()));
  return <><button ref={trigger} className="ui-v2-search-trigger" onClick={() => setOpen(true)}><Search size={17} aria-hidden="true" /><span>搜索页面或公司</span><kbd>Ctrl K</kbd></button>
    {open && <Modal title="搜索" size="compact" initialFocusRef={input} onClose={() => setOpen(false)}><label className="block">搜索页面、公司或代码<input ref={input} value={query} onChange={event => setQuery(event.target.value)} className="ui-v2-search-input" /></label>
      <div className="ui-v2-search-results">{items.map(item => <button key={item.page} onClick={() => { setOpen(false); navigate(item.page); }}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div>
      {query.trim() && <button className="inbox-action mt-4" onClick={() => { onCompanySearch(query.trim()); setOpen(false); }}>在公司研究池查找“{query.trim()}”</button>}
      {!items.length && <p role="status" className="mt-3 text-textMuted">没有匹配的页面。可使用公司研究池或知识库内的正文搜索。</p>}
      <p className="mt-4 text-xs text-textMuted">这里只搜索入口，不扫描原件或向外部服务发送内容。</p>
    </Modal>}
  </>;
}
