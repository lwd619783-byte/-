export function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "cyan" | "red" | "green" | "amber";
}) {
  const tones = {
    neutral: "text-textStrong",
    cyan: "text-cyan",
    red: "text-danger",
    green: "text-success",
    amber: "text-amber",
  };
  return (
    <div className="min-w-0 rounded-md border border-borderSoft bg-bg2/80 p-3">
      <p className="truncate text-xs text-textMuted" title={label}>
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${tones[tone]}`} title={value}>
        {value}
      </p>
    </div>
  );
}
