import type { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-lg border border-borderSoft bg-card shadow-soft backdrop-blur-xl transition hover:border-borderGlow hover:bg-cardHover ${className}`}
    >
      {children}
    </div>
  );
}
