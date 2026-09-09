import { useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
export function Sidebar<TabId extends string>({ tabs, activeTab, onChange }: {
  tabs: Array<{ id: TabId; icon: LucideIcon }>; activeTab: TabId; onChange: (tab: TabId) => void;
}) {
  const [more, setMore] = useState(false);
  const primary = ["首页", "行业", "个股池", "观察清单"];
  return <>
    <nav className="workspace-navigation" aria-label="主要导航">
      <p className="nav-caption">研究工作区</p>
      {tabs.map(({id,icon:Icon})=><button type="button" key={id} aria-current={id===activeTab ? "page" : undefined} onClick={()=>onChange(id)}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{id}</span></button>)}
      <p className="nav-footnote">本地研究 · 来源可查</p>
    </nav>
    <nav className="mobile-navigation" aria-label="窄屏主要导航">
      {tabs.filter(t=>primary.includes(t.id)).map(({id,icon:Icon})=><button type="button" key={id} aria-current={id===activeTab ? "page" : undefined} onClick={()=>{setMore(false);onChange(id);}}><Icon aria-hidden="true" className="h-5 w-5" /><span>{id==="观察清单"?"观察":id}</span></button>)}
      <button type="button" aria-expanded={more} aria-controls="mobile-more" onClick={()=>setMore(!more)}><MoreHorizontal aria-hidden="true" className="h-5 w-5" /><span>更多</span></button>
      {more ? <div id="mobile-more" className="mobile-more">{tabs.filter(t=>!primary.includes(t.id)).map(({id})=><button key={id} type="button" onClick={()=>{setMore(false);onChange(id);}}>{id}</button>)}</div> : null}
    </nav>
  </>;
}
