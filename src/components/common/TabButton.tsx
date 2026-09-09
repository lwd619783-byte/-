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
      type="button"
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-10 ${
        active
          ? "border-accent bg-selected text-accent"
          : "border-control bg-panel text-textMuted hover:border-accent hover:bg-cardHover hover:text-textStrong"
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
