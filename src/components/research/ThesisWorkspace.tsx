import { useEffect, useMemo, useState } from 'react';
import { createExpressionWorkspace } from '../../services/expressionWorkspace';
import { ExpressionWorkspacePanel } from './ExpressionWorkspace';
import { createThesisWorkspace, type ThesisWorkspaceDataset, type ThesisWorkspaceRuntime } from '../../services/thesisWorkspace';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { ThesisWorkspacePanel } from './ThesisWorkspacePanel';
export { ThesisWorkspacePanel } from './ThesisWorkspacePanel';

export function ThesisWorkspace({ dataset }: { dataset: ThesisWorkspaceDataset }) {
  const [runtime, setRuntime] = useState<ThesisWorkspaceRuntime | null>(null), [error, setError] = useState<string | null>(null);
  const expression = useMemo(() => runtime ? createExpressionWorkspace(runtime, dataset.stocks, window.localStorage) : null, [runtime, dataset]);
  useEffect(() => { let active = true; setRuntime(null); setError(null); void createThesisWorkspace(dataset, window.localStorage).then(value => { if (active) setRuntime(value); }).catch(cause => { if (active) setError(String(cause)); }); return () => { active = false; }; }, [dataset]);
  if (!runtime) return <section aria-label="Thesis V1" className="mb-4 rounded border border-borderSoft p-4"><h2>Thesis V1</h2><p>{error ? '原始证据读取失败，论点工作区已阻断。' : '正在读取论点与原始主张…'}</p>{error && <AdvancedAuditDetails>{error}</AdvancedAuditDetails>}</section>;
  return <><ThesisWorkspacePanel runtime={runtime} />{expression && <ExpressionWorkspacePanel key={dataset.stocks.map(s => s.id).join('|')} runtime={expression} />}</>;
}
