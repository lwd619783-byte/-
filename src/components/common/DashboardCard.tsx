import type { HTMLAttributes, ReactNode } from "react";

export function DashboardCard({
  children,
  className = "",
  interactive = false,
  ...attributes
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...attributes}
      className={`ui-panel min-w-0 rounded-lg border border-borderSoft bg-card shadow-soft ${
        interactive ? "transition hover:border-borderGlow hover:bg-cardHover hover:shadow-glow" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}
