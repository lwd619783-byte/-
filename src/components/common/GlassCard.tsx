import type { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-borderSoft bg-card shadow-soft backdrop-blur-xl transition hover:border-borderGlow hover:bg-cardHover ${className}`}
    >
      {children}
    </div>
  );
}
