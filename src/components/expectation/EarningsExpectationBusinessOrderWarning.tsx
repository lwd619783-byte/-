import type { EarningsExpectationComparison } from "../../types";
import type { EarningsExpectationSelection } from "../../services/earningsExpectationIntegrity";

interface EarningsExpectationBusinessOrderWarningProps {
  selection?: EarningsExpectationSelection;
  comparison?: EarningsExpectationComparison;
}

export function EarningsExpectationBusinessOrderWarning({ selection, comparison }: EarningsExpectationBusinessOrderWarningProps) {
  const resolution = selection?.previousResolution;
  if (!resolution || !["ambiguous", "equal_time", "unresolved"].includes(resolution.status)) return null;
  const statusText = resolution.status === "equal_time"
    ? "候选前序形成于同一精确时刻（时间关系为 equal）"
    : resolution.status === "unresolved"
      ? "候选前序含未解析的历史时间"
      : "同日存在多条仅日期精度或混合精度的候选，上一业务预测不唯一";
  const candidates = [...resolution.candidateNodes].sort((left, right) => left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id));
  return (
    <div role="status" className="mt-3 min-w-0 rounded border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
      <p className="font-semibold text-textStrong">
        {comparison?.comparabilityStatus === "comparable" ? "当前预测可以与实际值比较；" : "实际值比较与业务修订前序分别判断；"}
        但{statusText}，无法计算上修或下修。
      </p>
      <p className="mt-1">候选前序 {candidates.length} 条：</p>
      <ul className="mt-1 space-y-1">
        {candidates.map((candidate) => {
          const formation = candidate.effectiveFormationTime;
          const formedAt = formation.value ?? formation.businessCalendarDate ?? "形成时间缺失";
          return (
            <li key={candidate.businessRootSnapshot.id} className="min-w-0 break-words rounded border border-warning/20 bg-bg2/35 px-2 py-1">
              <span className="text-textStrong">{candidate.effectiveSnapshot.sourceName || "来源缺失"}</span> · 形成时间 {formedAt}（{formation.precision ?? "精度缺失"}）
              <span className="mt-0.5 block text-[11px] text-textMuted">审计标识：业务根 {candidate.businessRootSnapshot.id} · 有效快照 {candidate.effectiveSnapshot.id}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2">请补充候选的精确形成时间，或通过追加纠正快照人工确认前序；稳定 ID 排序不作为业务先后依据。</p>
    </div>
  );
}
