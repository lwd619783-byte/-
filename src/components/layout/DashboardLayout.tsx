import type { ReactNode } from "react";
export function DashboardLayout({sidebar,main,rightRail}: {sidebar:ReactNode;main:ReactNode;rightRail?:ReactNode}) {
  return <div className="dashboard-shell">
    <div className="dashboard-sidebar">{sidebar}</div>
    <main id="workspace-main" tabIndex={-1} className="dashboard-main">{main}</main>
    {rightRail ? <aside className="dashboard-rail" aria-label="研究辅助信息">{rightRail}</aside> : null}
  </div>;
}
