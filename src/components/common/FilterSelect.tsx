import type { ReactNode } from "react";

export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-textMuted">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-md border border-borderSoft bg-surface/85 px-3 text-sm text-text outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
