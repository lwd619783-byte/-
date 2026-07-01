export function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-textMuted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-borderSoft bg-surface/85 px-3 text-sm text-text outline-none transition placeholder:text-textWeak focus:border-cyan focus:ring-2 focus:ring-cyan/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="名称 / 代码"
      />
    </label>
  );
}
