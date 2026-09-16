import type { ReactNode } from "react";

/** Read-only research context. Navigation and evidence owners remain at the caller. */
export function ProductShell({ section, title, scope, quality, actions, children, className = "" }: {
  section: string; title: string; scope: string; quality?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return <header className={`product-shell min-w-0 rounded-lg border border-borderSoft bg-bg2 p-4 ${className}`} aria-label="研究上下文">
    <p className="text-xs text-textMuted">{section}</p>
    <div className="mt-1 flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h1 className="break-words text-2xl font-semibold text-textStrong">{title}</h1><p className="mt-2 break-words text-xs text-textMuted">{scope}</p></div><div className="flex max-w-full flex-wrap gap-2">{actions}</div></div>
    {quality ? <div className="mt-3 text-xs text-textMuted">{quality}</div> : null}{children}
  </header>;
}
