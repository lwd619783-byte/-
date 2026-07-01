import type { ReactNode } from "react";

const lineClasses = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
};

export function TextClamp({
  children,
  lines = 2,
  title,
  className = "",
}: {
  children: ReactNode;
  lines?: 1 | 2 | 3 | 4;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`block min-w-0 break-words ${lineClasses[lines]} ${className}`} title={title}>
      {children}
    </span>
  );
}
