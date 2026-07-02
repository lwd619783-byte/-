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
    <div className={`overflow-x-auto rounded-lg border border-borderSoft bg-card shadow-soft ${className}`}>
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function MobileCardList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid min-w-0 gap-3 ${className}`}>{children}</div>;
}
