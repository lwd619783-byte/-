import type { ReactNode } from "react";

export function DataTable({
  children,
  minWidth = "1180px",
  className = "",
}: {
  children: ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div tabIndex={0} role="region" aria-label="数据表，可横向滚动" className={`max-w-full overflow-x-auto rounded-lg border border-borderSoft bg-card shadow-soft ${className}`}>
      <table className="w-full text-left text-[13px] leading-5 [&_tbody_tr]:h-11 [&_th]:text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function MobileCardList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid min-w-0 gap-3 ${className}`}>{children}</div>;
}
