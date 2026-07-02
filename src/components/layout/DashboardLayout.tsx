import type { ReactNode } from "react";

export function DashboardLayout({
  sidebar,
  main,
  rightRail,
}: {
  sidebar: ReactNode;
  main: ReactNode;
  rightRail: ReactNode;
}) {
  return (
    <main className="dashboard-shell mx-auto w-full max-w-[1760px] px-4 py-5 lg:px-6 2xl:px-8">
      <div className="dashboard-sidebar min-w-0">{sidebar}</div>
      <div className="dashboard-main min-w-0">{main}</div>
      <div className="dashboard-rail min-w-0">{rightRail}</div>
    </main>
  );
}
