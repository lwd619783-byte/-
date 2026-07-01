import type { ReactNode } from "react";

export function TabButton({
  active,
  children,
  onClick,
  className = "",
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan/30 ${
        active
          ? "border-cyan/45 bg-cyan/15 text-textStrong shadow-glow"
          : "border-borderSoft bg-surface/70 text-textMuted hover:border-borderGlow hover:bg-cardHover hover:text-textStrong"
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
