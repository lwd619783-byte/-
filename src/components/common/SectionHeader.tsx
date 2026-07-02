import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">{eyebrow}</p> : null}
        <h2 className="mt-1 truncate text-lg font-semibold text-textStrong" title={title}>
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-textMuted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
