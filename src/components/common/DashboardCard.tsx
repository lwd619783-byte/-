import type { ReactNode } from "react";

export function DashboardCard({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-borderSoft bg-card/95 shadow-soft backdrop-blur-xl ${
        interactive ? "transition hover:border-borderGlow hover:bg-cardHover hover:shadow-glow" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}
