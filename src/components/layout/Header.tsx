import { describeDataTime } from "../../utils/dataTrustDisplay";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import { Search } from "lucide-react";
import type { DashboardDataMode } from "../../types";
import { StatusBadge } from "../common/terminal";
import { dataModeDisplayLabel, localizeDataSourceNote } from "../../utils/displayLabels";
import { AppearanceControl } from "./Appearance";
interface HeaderProps {
  onHome?: () => void;
  search: string; onSearchChange: (value: string) => void; updatedAt: string; sourceNote: string;
  dataMode: DashboardDataMode; modeLabel: string; coverageSummary?: string;
  onDataModeChange: (mode: DashboardDataMode) => void;
}
export function Header({onHome,search,onSearchChange,updatedAt,sourceNote,dataMode,modeLabel,coverageSummary,onDataModeChange}: HeaderProps) {
  const time = describeDataTime(dataMode === "mock" ? undefined : updatedAt, "package_updated", useDisplayNow());
  const modeStatus = dataMode === "mock" ? "mock" : modeLabel === "Real Data" ? "real" : "partial";
  const displayModeLabel = dataModeDisplayLabel(modeLabel);
  return <header className="workspace-header">
    <div className="workspace-topbar">
      <a className="workspace-brand" href="#/home" onClick={event => { if(onHome){event.preventDefault();onHome();} }}><span aria-hidden="true">◈</span> 投研工作台</a>
      <label className="workspace-search"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan" />
        <span className="sr-only">搜索当前研究池</span><input placeholder="当前研究池 · 行业、公司或代码" value={search} onChange={(event)=>onSearchChange(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-textMuted"><span className="sr-only">数据模式</span>
          <select aria-label="数据模式" value={dataMode} onChange={(event)=>onDataModeChange(event.target.value as DashboardDataMode)}>
            <option value="mock">模拟数据</option><option value="mixed">混合数据</option><option value="real">真实数据</option>
          </select>
        </label><AppearanceControl />
      </div>
    </div>
    <details className="workspace-data-status">
      <summary><StatusBadge status={modeStatus} label={`当前模式：${displayModeLabel}`} /><span className="text-textMuted">数据来源与时点</span></summary>
      <div className="space-y-1 py-3 text-xs leading-6 text-textMuted">
        <p>{time.text}。数据包更新不代表所有模块同时更新或市场观测时间。</p>
        <p>{localizeDataSourceNote(sourceNote)} 缺失、过期或不支持的字段会明确显示。</p>
        {coverageSummary ? <p>{coverageSummary}</p> : null}
      </div>
    </details>
  </header>;
}
