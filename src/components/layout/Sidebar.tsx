import type { LucideIcon } from "lucide-react";
import { DashboardCard, TabButton } from "../common/terminal";

export function Sidebar<TabId extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: TabId; icon: LucideIcon }>;
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <DashboardCard className="p-3">
      <div className="mb-3 hidden border-b border-borderSoft pb-3 lg:block">
        <p className="text-sm font-semibold text-textStrong">投资研究看板</p>
        <p className="mt-1 text-xs text-textMuted">Investment Research Dashboard</p>
      </div>
      <nav className="scrollbar-thin flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => onChange(tab.id)} className="h-10 shrink-0 justify-start">
              <Icon className="h-4 w-4" />
              {tab.id}
            </TabButton>
          );
        })}
      </nav>
    </DashboardCard>
  );
}
