import type { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`ui-panel min-w-0 rounded-lg border border-borderSoft bg-card shadow-soft transition hover:border-borderGlow ${className}`}
    >
      {children}
    </div>
  );
}
