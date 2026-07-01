import type { ReactNode } from "react";

export function SectionPanel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borderSoft bg-surface/80 p-4 shadow-soft ${className}`}>
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold tracking-wide text-textStrong" title={title}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}
