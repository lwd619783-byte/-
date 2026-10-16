import type { ChartAuditView } from '../../services/chartAudit';
import { ChartAuditPanel } from '../charts/ChartAuditPanel';
import { Modal } from '../common/Modal';

/** Pure audit surface; does not load event providers or real research datasets. */
export function ChartEvidenceDrawer({ audit, onClose }: { audit: ChartAuditView; onClose: () => void }) {
  return <Modal title="证据核对" size="drawer" onClose={onClose} description="留存来源核对；候选证据不代表历史时点可得性（PIT） 或生产准入。"><ChartAuditPanel audit={audit} expanded /></Modal>;
}
