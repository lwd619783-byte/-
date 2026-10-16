import { createContext, useContext, type ReactNode } from 'react';

// The formal app keeps its existing navigation. Only the isolated demo opts out;
// React context also reaches Claim/Evidence modals rendered through portals.
export const ResearchLinkNavigation = createContext(true);

export function ResearchLink({ href, className, children }: { href?: string; className?: string; children: ReactNode }) {
  const navigable = useContext(ResearchLinkNavigation);
  if (!navigable) return <span role="link" aria-disabled="true" tabIndex={0} className={className}
    title={`演示模式不打开外链${href ? `：${href}` : ''}`}>{children}（演示不打开外链）</span>;
  return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
}
