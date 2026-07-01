import type { ReactNode } from "react";

export function OverflowTooltip({ children, title, className = "" }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <span className={`block min-w-0 truncate ${className}`} title={title}>
      {children}
    </span>
  );
}
