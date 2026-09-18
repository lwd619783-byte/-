import type { ReactNode } from 'react';

export function AdvancedAuditDetails({ children }: { children: ReactNode }) {
  return <details className="mt-3 min-w-0 rounded-md border border-borderSoft p-3 text-xs [overflow-wrap:anywhere]" data-advanced-audit>
    <summary className="min-h-11 cursor-pointer py-3 font-medium text-accent">高级审计信息 / 技术详情</summary>
    <div className="min-w-0 space-y-3 border-t border-borderSoft pt-3">{children}</div>
  </details>;
}
